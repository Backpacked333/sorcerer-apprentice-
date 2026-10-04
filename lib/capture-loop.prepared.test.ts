import { expect, it } from "vitest";
import { CaptureLoop, type LoopSignals } from "./capture-loop";
import { CandidateQueue, type Candidate } from "./curiosity";
import { Governor } from "./governor";

const signals: LoopSignals = { now: 20, currentInvoice: "item", lastSpeechAt: 0, lastScreenChangeAt: 0,
  lastTypingAt: 0, lastBoundaryAt: -Infinity, lastInvoiceOpenedAt: 0, agentSpeaking: false,
  transcriberHealthy: true, sttHealthy: true, paused: false };
const candidate = (id: string, value: number, guardrail = false): Candidate => ({
  id, value, guardrail, kind: guardrail ? "limit" : "why", question: "Why this choice?", questionRetro: "Why that choice?",
  createdAt: 1, status: "queued", eventId: "event", stepRef: "item:route", invoice: "item", aliases: [],
});
function fixture() {
  const queue = new CandidateQueue();
  queue.items.push(candidate("high", 0.99), candidate("preferred", 0.8));
  return { queue, loop: new CaptureLoop(new Governor(), queue) };
}

it("prefers a prepared candidate only among governor-eligible questions", () => {
  const { queue, loop } = fixture();
  expect(loop.next(signals, "preferred")).toMatchObject({ type: "open", candidate: { id: "preferred" } });
  queue.items[1].value = 0.01;
  expect(loop.next(signals, "preferred")).toMatchObject({ type: "open", candidate: { id: "high" } });
});
it.each([{ paused: true }, { sttHealthy: false }, { agentSpeaking: true }, { lastSpeechAt: 20 }, { lastTypingAt: 20 }])("never bypasses live gating: %j", (blocked) => {
  expect(fixture().loop.next({ ...signals, ...blocked }, "preferred").type).toBe("wait");
});
it("preserves mandatory guardrails and queue status", () => {
  const { queue, loop } = fixture();
  queue.items.push(candidate("guardrail", 0.9, true));
  queue.items.push(...["asked1", "asked2"].map((id) => ({ ...candidate(id, 0.8), status: "filled" as const, filledBy: "window" as const })));
  expect(loop.next(signals, "preferred")).toMatchObject({ type: "open", candidate: { id: "guardrail" } });
  queue.items.splice(-2);
  queue.items[1].status = "expired";
  expect(loop.next(signals, "preferred")).toMatchObject({ type: "open", candidate: { id: "high" } });
});
