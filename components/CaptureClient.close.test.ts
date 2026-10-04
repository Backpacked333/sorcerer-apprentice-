import { readFileSync } from "node:fs";
import ts from "typescript";
import { expect, it, vi } from "vitest";
import { emptySession } from "../lib/events";
import { recordTypedAnswer } from "../lib/capture-answer";
import { computeMetrics } from "../lib/metrics";
import { CaptureLoop, redactCaptureRange, shouldPersistAgentSpokenText, windowOutcome } from "../lib/capture-loop";
import { CandidateQueue, extractThresholds, newContext, type Candidate } from "../lib/curiosity";
import { Governor } from "../lib/governor";
import type { TurnResult } from "../lib/voice-turn";

const source = ts.createSourceFile("CaptureClient.tsx", readFileSync(new URL("./CaptureClient.tsx", import.meta.url), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

// Execute the real callbacks with mocked browser boundaries, without duplicating their logic.
function callback(name: string, context: Record<string, unknown>) {
  let expression: ts.Expression | undefined;
  function visit(node: ts.Node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(source) === name && node.initializer && ts.isCallExpression(node.initializer)) expression = node.initializer.arguments[0];
    ts.forEachChild(node, visit);
  }
  visit(source);
  if (!expression) throw new Error(`Missing callback ${name}`);
  const code = ts.transpileModule(`(${expression.getText(source)})`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  return new Function(...Object.keys(context), `return ${code}`)(...Object.values(context));
}

function fixture() {
  const log = emptySession("closing", "capture", "Review invoices", "Expert");
  log.windows.push({ id: "w", candidateId: "c", openedAt: 1, askedAt: 2, kind: "limit", question: "What is the limit?" });
  const candidate: Candidate = { id: "c", status: "asked", createdAt: 1, kind: "limit", value: 0.8, question: "What is the limit?", questionRetro: "What was the limit?", eventId: "e", stepRef: "item:route", guardrail: true, aliases: [] };
  const governor = new Governor();
  const queue = new CandidateQueue();
  queue.items.push(candidate);
  const loop = new CaptureLoop(governor, queue);
  const sync = vi.fn(async () => {});
  const context = {
    log: { current: log }, governor: { current: governor }, loop: { current: loop }, queue: { current: queue },
    ctx: { current: newContext() }, nowSecs: () => 4, dirty: { current: false }, rerender: vi.fn(),
    voiceRef: { current: { submitTyped: vi.fn(), cancelTurn: vi.fn(), disconnect: vi.fn() } },
    activeTurn: { current: null as Promise<TurnResult> | null }, activeWindowId: { current: "w" },
    activeHeard: { current: "" }, struckWindowIds: { current: new Set<string>() },
    ending: { current: false }, setEndingUi: vi.fn(), syncPromise: { current: null }, sync: { current: { sync } },
    pipelineRef: { current: { framesSeen: 0, piiBlurred: 0, stop: vi.fn(), bumpEpoch: vi.fn() } },
    entitiesRedacted: { current: 0 }, recordingConsentEpoch: { current: 0 }, expertSpeech: { current: [] },
    router: { push: vi.fn() }, setSyncError: vi.fn(), setPartial: vi.fn(), setLastStrike: vi.fn(),
    invalidateReasoning: vi.fn(), updateDeferred: vi.fn(), computeMetrics, recordTypedAnswer,
    windowOutcome, shouldPersistAgentSpokenText, extractThresholds, redactCaptureRange,
    pushTranscript: vi.fn((text: string, speaker: "expert" | "agent", t: number) => log.transcript.push({ id: "tr_" + log.transcript.length, text, speaker, t, final: true })),
  };
  const redactRange = callback("redactRange", context);
  const apply = callback("applyTurnResult", { ...context, redactRange });
  const endTask = callback("endTask", context);
  const strike = callback("strike", { ...context, redactRange });
  let resolve!: (result: TurnResult) => void;
  const turn = new Promise<TurnResult>((r) => { resolve = r; });
  context.activeTurn.current = turn.then((result) => { apply({ candidate }, "w", result); return result; });
  return { log, context, endTask, strike, finish: async (result: TurnResult) => { resolve(result); await context.activeTurn.current; } };
}

const answered = (via: TurnResult["via"] = "typed", heard = "Above 7200 ask the lead."): TurnResult => ({
  spoke: true, heard, via, sentAt: 1, spokeAt: 1, askedAt: 2, answeredAt: 3, closedAt: 4,
});

it.each(["typed", "scribe"] as const)("Done waits for the accepted %s result and duplicate Done does not resave", async (via) => {
  const { log, context, endTask, finish } = fixture();
  const done = endTask();
  await endTask();
  expect(context.sync.current.sync).not.toHaveBeenCalled();
  await finish(answered(via));
  await done;
  expect(log.windows[0]).toMatchObject({ outcome: "answered", answerText: "Above 7200 ask the lead." });
  expect(context.sync.current.sync).toHaveBeenCalledTimes(1);
  expect(context.sync.current.sync).toHaveBeenCalledWith(log);
  expect(context.router.push).toHaveBeenCalledWith("/map/closing");
  expect(context.invalidateReasoning).toHaveBeenCalled();
  if (via === "typed") {
    expect(log.transcript[0].typedFor).toBe("w");
    expect(log.windows[0].answerAudioId).toBeUndefined();
  }
});

it("lets an explicit strike win over a late answered result", async () => {
  const { log, context, strike, finish } = fixture();
  strike();
  await finish(answered());
  expect(log.windows[0]).toMatchObject({ outcome: "off_record", answerText: "" });
  expect(log.transcript).toEqual([]);
  expect(context.invalidateReasoning).toHaveBeenCalled();
});

it("redacts typed PII and refuses a spoken clip on a typed result", async () => {
  const { log, finish } = fixture();
  await finish({ ...answered("typed", "Ask Expert at private@example.test."), audioId: "spoken-clip" });
  expect(log.transcript[0]).toMatchObject({ typedFor: "w", redacted: true });
  expect(log.windows[0].answerAudioId).toBeUndefined();
  expect(JSON.stringify(log)).not.toContain("private@example.test");
});

it("leaves Done retryable after a failed durable save", async () => {
  const { context, endTask, finish } = fixture();
  context.sync.current.sync.mockRejectedValueOnce(new Error("offline"));
  await finish(answered());
  await endTask();
  expect(context.ending.current).toBe(false);
  expect(context.router.push).not.toHaveBeenCalled();
  await endTask();
  expect(context.router.push).toHaveBeenCalledTimes(1);
});
