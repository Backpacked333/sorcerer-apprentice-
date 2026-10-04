import { readFileSync } from "node:fs";
import ts from "typescript";
import { afterEach, expect, it, vi } from "vitest";
import { emptySession } from "../lib/events";
import { recordTypedAnswer } from "../lib/capture-answer";
import { computeMetrics } from "../lib/metrics";
import { captureEvidenceIsOffRecord, CaptureLoop, shouldPersistAgentSpokenText, turnCommitEvidenceEligible, windowOutcome } from "../lib/capture-loop";
import { CandidateQueue, extractThresholds, newContext, type Candidate } from "../lib/curiosity";
import { Governor } from "../lib/governor";
import { redactText } from "../lib/redact";
import { VoiceTurnAdapter } from "../lib/voice-turn-adapter";
import { withAnswerConfirmation, type TurnEffect, type TurnResult } from "../lib/voice-turn";
import { compileDeterministic, refineWithLLM } from "../lib/compile";
import { compileEvidence } from "../lib/compile/evidence";

const { generate } = vi.hoisted(() => ({ generate: vi.fn() }));
vi.mock("ai", () => ({ generateText: generate, Output: { object: (o: unknown) => o } }));
afterEach(() => vi.unstubAllEnvs());
const source = ts.createSourceFile("CaptureClient.tsx", readFileSync(new URL("./CaptureClient.tsx", import.meta.url), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
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
  let now = 10;
  const log = emptySession("provenance", "capture", "Review invoices", "Expert");
  const question = "What if it had no PO?";
  log.events.push({ id: "e", t: 9, kind: "status_changed", source: "dom", invoice: "73", from: "open", to: "hold" });
  log.windows.push({ id: "w", candidateId: "c", openedAt: 10, spokeAt: 11, askedAt: 13.6, kind: "counterfactual", question, stepRef: "73:status" });
  const candidate: Candidate = { id: "c", status: "asked", createdAt: 9, kind: "counterfactual", value: 0.8, question, questionRetro: question, eventId: "e", stepRef: "73:status", guardrail: true, aliases: [] };
  const governor = new Governor(), queue = new CandidateQueue();
  queue.items.push(candidate);
  const effects: TurnEffect[] = [];
  const adapter = new VoiceTurnAdapter({ now: () => now, agentConnected: () => true, applyEffect: (effect) => { effects.push(effect); } });
  const context = {
    started: true, holdingRef: { current: false }, log: { current: log }, loop: { current: new CaptureLoop(governor, queue) }, queue: { current: queue },
    ctx: { current: newContext() }, nowSecs: () => now, dirty: { current: false }, rerender: vi.fn(),
    voiceRef: { current: { submitTyped: (text: string) => adapter.submitTyped(text), finishAnswer: () => adapter.finishAnswer(), cancelTurn: () => adapter.cancel(), disconnect: vi.fn() } },
    activeTurn: { current: null as Promise<TurnResult> | null }, activeWindowId: { current: "w" }, activeHeard: { current: "" }, struckWindowIds: { current: new Set<string>() },
    ending: { current: false }, setEndingUi: vi.fn(), syncPromise: { current: null }, sync: { current: { sync: vi.fn(async () => {}) } },
    pipelineRef: { current: { framesSeen: 0, piiBlurred: 0, stop: vi.fn() } }, entitiesRedacted: { current: 0 }, expertSpeech: { current: [] },
    router: { push: vi.fn() }, setSyncError: vi.fn(), setPartial: vi.fn(), invalidateReasoning: vi.fn(), updateDeferred: vi.fn(),
    computeMetrics, recordTypedAnswer, windowOutcome, shouldPersistAgentSpokenText, extractThresholds,
    redactText, captureEvidenceIsOffRecord, turnCommitEvidenceEligible,
  };
  const pushTranscript = callback("pushTranscript", context);
  const apply = callback("applyTurnResult", { ...context, pushTranscript, redactRange: vi.fn() });
  const transcriber = callback("transcriber", { ...context, pushTranscript });
  const endTask = callback("endTask", context);
  const turn = adapter.turn(withAnswerConfirmation({ tag: "ASK", text: question, spoken: question, listen: true, recordClip: { sessionId: log.id } }));
  context.activeTurn.current = turn.then((result) => { apply({ candidate }, "w", result); return result; });
  adapter.tick(10);
  adapter.dispatch({ type: "SPEAK_START", at: 11, source: "agent" });
  adapter.dispatch({ type: "SPEAK_END", at: 13 });
  adapter.tick(13.6);
  return { log, effects, adapter, context, question, endTask,
    commit(text: string, startedAt: number) {
      now = 15;
      adapter.dispatch({ type: "HUMAN_COMMIT", at: now, startedAt, text, source: "scribe" });
      transcriber.onCommitted(text, startedAt, now);
    },
    async finish() { now = 20; adapter.tick(now); return context.activeTurn.current!; },
  };
}

async function compile(f: ReturnType<typeof fixture>, text: string) {
  vi.stubEnv("AI_GATEWAY_API_KEY", "mock");
  const draft = compileDeterministic(f.log);
  generate.mockResolvedValue({ output: { rules: [{ stepId: draft.steps[0].id, title: "No PO", when: { anyOf: [{ allOf: [{ field: "hasPO", op: "==", value: false }] }] }, then: { kind: "status", field: null, value: "hold" }, unless: null, stopAndAsk: null, quoteTexts: [text], confidence: "medium" }], stepReasons: [], guardrails: [], slots: [] } });
  const compiled = await refineWithLLM(f.log, draft);
  expect(compiled.used).toBe(true);
  expect(generate.mock.lastCall![0].prompt).toContain(f.question);
  expect(compiled.map.rules[0]).toMatchObject({ confirmedBy: ["counterfactual"], quotes: [{ text, source: "counterfactual" }] });
  return compiled.map.rules[0].quotes[0];
}

it.each([13.2, 14])("preserves accepted speech provenance spanning listen-open: start=%s", async (start) => {
  const f = fixture(), text = "If there is no PO, I hold it.";
  f.commit(text, start);
  f.adapter.dispatch({ type: "TOOL", at: 15.2, name: "log_answer", params: { reason: text } });
  const result = await f.finish();
  expect(result.via).toBe("tool");
  expect(compileEvidence(f.log).windows).toHaveLength(1);
  const quote = await compile(f, text);
  if (start < 13.6) expect(quote.audioId).toBeUndefined();
  else expect(quote.audioId).toBe(result.audioId);
  f.log.offRecord = [{ from: start, to: start + 0.1 }];
  expect(compileEvidence(f.log)).toMatchObject({ windows: [], transcript: [] });
});

it.each(["speech", "typed", "mixed"])("Done preserves %s source and only uploads wholly spoken answers", async (kind) => {
  const f = fixture(), text = "If there is no PO, I hold it.";
  if (kind !== "typed") f.commit(text, 14);
  if (kind !== "speech") f.adapter.submitTyped(text, 15.1);
  const done = f.endTask();
  const result = await f.finish();
  await done;
  expect(result.via).toBe(kind === "speech" ? "scribe" : "typed");
  expect(f.effects).toContainEqual(expect.objectContaining({ type: "CLIP_STOP", upload: kind === "speech" }));
  const transcript = f.log.transcript.find((s) => s.speaker === "expert")!;
  expect(transcript.typedFor).toBe(kind === "speech" ? undefined : "w");
  expect(compileEvidence(f.log).windows).toHaveLength(1);
  expect(f.log.windows[0].closedBy).toBe("user");
  const quote = await compile(f, text);
  if (kind === "speech") expect(quote.audioId).toMatch(/^clip_/);
  else expect(quote.audioId).toBeUndefined();
});

it.each(["speech", "typed"])("Done does not lose the redaction marker on %s evidence", async (kind) => {
  const f = fixture();
  if (kind === "speech") f.commit("Send it to private@example.test.", 14);
  else f.adapter.submitTyped("Send it to private@example.test.", 15.1);
  const done = f.endTask();
  await f.finish();
  await done;
  expect(f.log.transcript.find((s) => s.speaker === "expert")).toMatchObject({ redacted: true });
  expect(JSON.stringify(f.log)).not.toContain("private@example.test");
  expect(compileEvidence(f.log)).toMatchObject({ windows: [], transcript: [] });
});
