import { readFileSync } from "node:fs";
import ts from "typescript";
import { expect, it, vi } from "vitest";
import { MemoryFlight, ReasoningWire, validateProposal, type WorkingMemory } from "../lib/memory";
import { PreparedQuestions } from "../lib/prepared-question";

const source = ts.createSourceFile("CaptureClient.tsx", readFileSync(new URL("./CaptureClient.tsx", import.meta.url), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
function fixture() {
  let expression: ts.Expression | undefined;
  function visit(node: ts.Node) {
    if (ts.isCallExpression(node) && node.expression.getText(source) === "useEffect" && node.arguments[0].getText(source).includes('fetch("/api/reason"')) expression = node.arguments[0];
    ts.forEachChild(node, visit);
  }
  visit(source);
  if (!expression) throw new Error("Missing Capture reasoning effect");
  const memory: WorkingMemory = { sessionId: "s", expert: "Expert", task: "Review", events: [], evidence: [],
    history: [], questions: [{ id: "candidate", eventId: "e", kind: "why", question: "Why?" }] };
  const reasoning = new MemoryFlight(), prepared = new PreparedQuestions();
  let tick!: () => void;
  let resolve!: (response: Response) => void;
  const fetch = vi.fn(() => new Promise<Response>((r) => { resolve = r; }));
  const context = {
    started: true,
    reasoning: { current: reasoning }, prepared: { current: prepared }, reasoningOff: { current: false },
    holdingRef: { current: false }, governor: { current: { window: undefined } }, ending: { current: false },
    readMemory: () => structuredClone(memory), ReasoningWire, validateProposal, fetch,
    invalidateReasoning: () => { reasoning.invalidate(); prepared.clear(); },
    window: { setInterval: (fn: () => void) => { tick = fn; return 1; }, clearInterval: vi.fn() },
  };
  const code = ts.transpileModule(`(${expression.getText(source)})`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const cleanup = new Function(...Object.keys(context), `return ${code}`)(...Object.values(context))();
  return { memory, context, prepared, cleanup, tick: () => tick(), reply: (mode = "live") => resolve(Response.json({ mode, questions: [
    { candidateId: "foreign", question: "Foreign?" }, { candidateId: "candidate", question: "What made this different?" },
  ] })) };
}

it("keeps one request in flight and prepares only validated live candidates", async () => {
  const f = fixture();
  f.tick(); f.tick();
  expect(f.context.fetch).toHaveBeenCalledTimes(1);
  f.reply();
  await vi.waitFor(() => expect(f.prepared.preferred(f.memory)).toBe("candidate"));
  f.tick();
  expect(f.context.fetch).toHaveBeenCalledTimes(1);
  f.cleanup();
  expect(f.prepared.preferred(f.memory)).toBeUndefined();
});
it.each(["invalidation", "unmount"])("aborts and discards pending output on %s", async (boundary) => {
  const f = fixture();
  f.tick();
  if (boundary === "unmount") f.cleanup();
  else f.context.invalidateReasoning();
  const init = (f.context.fetch.mock.calls as unknown as [string, RequestInit][])[0][1];
  expect(init.signal?.aborted).toBe(true);
  f.reply();
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(f.prepared.preferred(f.memory)).toBeUndefined();
  f.cleanup();
});
it.each(["shadow", "stale", "off"])("does not prepare questions for %s output", async (mode) => {
  const f = fixture();
  f.tick();
  if (mode === "stale") f.memory.history.push({ question: "Why?", outcome: "active" });
  f.reply(mode === "stale" ? "live" : mode);
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(f.prepared.preferred(f.memory)).toBeUndefined();
  if (mode === "off") { f.tick(); expect(f.context.fetch).toHaveBeenCalledTimes(1); }
  f.cleanup();
});
