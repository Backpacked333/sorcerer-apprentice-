import { readFileSync } from "node:fs";
import ts from "typescript";
import { expect, it, vi } from "vitest";
import { emptySession } from "../lib/events";
import { recordTypedAnswer } from "../lib/capture-answer";
import { computeMetrics } from "../lib/metrics";

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

function fixture(kind = "typed") {
  const log = emptySession("closing", "capture", "Review invoices", "Expert");
  const window = { id: "w", candidateId: "c", openedAt: 1, askedAt: 2, kind: "limit" as const, question: "What is the limit?" };
  log.windows.push(window);
  if (kind !== "typed") {
    log.transcript.push({ id: "spoken", t: 2.5, text: "For this amount.", speaker: "expert", final: true });
    log.windows[0].answerText = "For this amount.";
  }
  if (kind !== "spoken") recordTypedAnswer(log, "w", "Above 7200 ask the lead.", 3);
  const r = { onstop: undefined as (() => void) | undefined, stop: vi.fn() };
  const fetch = vi.fn().mockResolvedValue(new Response("{}"));
  const g = { window: window as typeof window | null, close: vi.fn(() => { g.window = null; }) };
  const candidate = { id: "c", status: "asked", createdAt: 1 };
  const context = {
    recorder: { current: r }, chunks: { current: [new Blob(["a".repeat(3000)])] }, fetch,
    log: { current: log }, governor: { current: g }, closing: { current: null }, nowSecs: () => 4,
    voiceRef: { current: { setMicMuted: vi.fn(), disconnect: vi.fn() } },
    queue: { current: { items: [candidate], markFilled: vi.fn(), drainToDebrief: vi.fn() } },
    spokeStarted: { current: true }, dirty: { current: false }, rerender: vi.fn(), ended: { current: false },
    reasoning: { current: { invalidate: vi.fn() } }, prepared: { current: { clear: vi.fn() } },
    pipeline: { framesSeen: 0, piiBlurred: 0, stop: vi.fn(), bumpEpoch: vi.fn() },
    entitiesRedacted: { current: 0 }, router: { push: vi.fn() }, computeMetrics,
  };
  const stopRecorder = callback("stopRecorder", context);
  const closeWindow = callback("closeWindow", { ...context, stopRecorder });
  const endTask = callback("endTask", { ...context, closeWindow });
  const strike = callback("strike", { ...context, closeWindow });
  return { log, fetch, g, candidate, context, closeWindow, endTask, strike, finish: () => r.onstop?.() };
}

it.each(["typed", "mixed", "spoken"])("waits for the %s answer before Done saves, ignoring duplicate timeout closes", async (kind) => {
  const { log, fetch, g, context, closeWindow, endTask, finish } = fixture(kind);
  const closing = closeWindow("answered");
  expect(log.windows[0].outcome).toBe("answered");
  expect(closeWindow("timeout")).toBe(closing);
  const done = endTask();
  expect(fetch).not.toHaveBeenCalled();
  finish();
  await done;
  const put = fetch.mock.calls.find(([, init]) => init.method === "PUT")!;
  const saved = JSON.parse(put[1].body);
  expect(saved.windows[0].outcome).toBe("answered");
  expect(saved.windows[0].answerText).toBe(log.windows[0].answerText);
  expect(fetch.mock.calls.filter(([url]) => url.endsWith("/clips"))).toHaveLength(kind === "spoken" ? 1 : 0);
  if (kind !== "spoken") expect(saved.windows[0].answerAudioId).toBeUndefined();
  else expect(saved.windows[0].answerAudioId).toMatch(/^clip_/);
  expect(context.chunks.current).toEqual([]);
  expect(g.close).toHaveBeenCalledTimes(1);
  expect(context.closing.current).toBeNull();
});

it("lets an explicit strike win over an in-flight answered close without uploading audio", async () => {
  const { log, fetch, candidate, closeWindow, strike, finish } = fixture("mixed");
  const closing = closeWindow("answered");
  strike();
  finish();
  await closing;
  expect(log.windows[0].outcome).toBe("off_record");
  expect(log.windows[0].answerText).toBe("");
  expect(candidate.status).toBe("expired");
  expect(fetch).not.toHaveBeenCalled();
});

it("keeps late finalized speech while closing and rejects a second typed submission", async () => {
  const { log, g, closeWindow, finish } = fixture();
  const closing = closeWindow("answered");
  expect(g.window?.id).toBe("w");
  expect(recordTypedAnswer(log, "w", "A second answer", 4)).toBeUndefined();
  log.windows[0].answerText += " Late finalized speech.";
  finish();
  await closing;
  expect(log.windows[0].answerText).toContain("Late finalized speech.");
});
