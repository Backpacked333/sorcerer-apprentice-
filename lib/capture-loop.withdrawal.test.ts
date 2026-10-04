import { describe, expect, it } from "vitest";
import { captureEvidenceIsOffRecord, CaptureLoop, redactCaptureRange } from "./capture-loop";
import { buildCandidates, CandidateQueue, newContext, observe } from "./curiosity";
import { emptySession, type ScreenEvent } from "./events";
import { DEMO_GOVERNOR, Governor } from "./governor";

const reason = "I changed this invoice because I always need review above 5000 euros.";
const edit = (id: string, t: number): ScreenEvent => ({
  id, t, invoice: id, source: "dom", kind: "field_changed", field: "costCenter", from: "1000", to: "2000",
});

function setup() {
  const session = emptySession("withdrawal", "capture", "test", "Expert");
  const context = { ...newContext(), valueLabels: { "2000": "Research" } };
  const queue = new CandidateQueue();
  const loop = new CaptureLoop(new Governor(DEMO_GOVERNOR), queue);
  const event = edit("9001", 10);
  session.events.push(event);
  queue.add(buildCandidates(event, context, event.t));
  const why = queue.items.find((candidate) => candidate.kind === "why")!;
  return { session, context, queue, loop, why };
}

describe("Capture runtime evidence withdrawal", () => {
  it("removes the visible reason and cached quote when narration is withdrawn", () => {
    const { session, context, queue, loop, why } = setup();
    queue.fillNarration(reason, 12, "9001");
    session.transcript.push({ id: "t1", t: 12, text: reason, speaker: "expert", final: true });
    expect(loop.reasonHeard).toEqual([{ stepRef: why.stepRef, quote: reason, t: 12 }]);

    redactCaptureRange(session, loop, context, 11, 14);

    expect(loop.reasonHeard).toEqual([]);
    expect(why).toMatchObject({ status: "expired", filledBy: undefined, heardQuote: undefined, heardAt: undefined });
    expect(session.transcript[0]).toMatchObject({ text: "", redacted: true });
    expect(JSON.stringify(queue.items)).not.toContain(reason);
  });

  it("invalidates every candidate state grounded in a withdrawn screen event and refreshes deferred", () => {
    const { session, context, queue, loop } = setup();
    queue.items.forEach((candidate, i) => {
      candidate.status = (["filled", "asked", "debrief", "queued"] as const)[i % 4];
      candidate.heardQuote = reason;
      candidate.filledBy = "narration";
      candidate.heardAt = 16;
      candidate.userDeferred = true;
    });
    session.deferred = loop.deferred();
    expect(session.deferred.length).toBeGreaterThan(0);
    redactCaptureRange(session, loop, context, 10, 10);
    expect(queue.items.every((candidate) => candidate.status === "expired" && !candidate.heardQuote)).toBe(true);
    expect(loop.reasonHeard).toEqual([]);
    expect(session.deferred).toEqual([]);
  });

  it("clears accepted answers, inferred sibling coverage and pending follow-ups for an overlapping window", () => {
    const { session, context, queue, loop, why } = setup();
    loop.opened(why, 12);
    loop.closed({ candidate: why, outcome: "answered", heard: reason, now: 25 });
    session.windows.push({ id: "w1", candidateId: why.id, stepRef: why.stepRef, kind: "why", question: why.question,
      openedAt: 12, closedAt: 25, answerText: reason, outcome: "answered", logged: { reason }, answerAudioId: "clip" });
    expect(queue.items.some((candidate) => candidate.filledBy === "answer")).toBe(true);

    redactCaptureRange(session, loop, context, 20, 30);

    expect(session.windows[0]).toMatchObject({ outcome: "off_record", answerText: "", answerAudioId: undefined, logged: undefined });
    expect(queue.items.every((candidate) => candidate.status === "expired" && !candidate.heardQuote)).toBe(true);
    expect(loop.next({ now: 27, currentInvoice: "9001", lastSpeechAt: 0, lastScreenChangeAt: 0, lastTypingAt: 0,
      lastBoundaryAt: 0, lastInvoiceOpenedAt: 0, agentSpeaking: false, sttHealthy: true, paused: false }).type).toBe("wait");
    expect(loop.deferred()).toEqual([]);
  });

  it("preserves unrelated reasons and rebuilds threshold/action context from unstruck evidence only", () => {
    const { session, context, queue, loop, why } = setup();
    const retained = "This invoice follows policy because I always ask above 7000 euros.";
    const old = edit("9000", 1);
    old.to = "3000";
    session.events.unshift(old);
    queue.add(buildCandidates(old, context, 1));
    const oldWhy = queue.items.find((candidate) => candidate.eventId === old.id && candidate.kind === "why")!;
    queue.markFilled(oldWhy.id, "narration", retained, 2);
    queue.markFilled(why.id, "narration", reason, 12);
    session.transcript.push(
      { id: "old", t: 2, text: retained, speaker: "expert", final: true },
      { id: "new", t: 12, text: reason, speaker: "expert", final: true },
      { id: "agent", t: 3, text: "above 9000 euros", speaker: "agent", final: true },
    );
    observe(old, context);
    observe(session.events[1], context);
    context.knownThresholds = [5000, 7000];

    redactCaptureRange(session, loop, context, 10, 14);
    redactCaptureRange(session, loop, context, 10, 14);

    expect(loop.reasonHeard).toEqual([{ stepRef: oldWhy.stepRef, quote: retained, t: 2 }]);
    expect(context.knownThresholds).toEqual([7000]);
    expect(context.priorActions.get("costCenter")).toBe("3000");
    expect(context.valueLabels).toEqual({ "2000": "Research" });
    expect(session.offRecord).toEqual([{ from: 10, to: 14 }]);
  });

  it("rejects late timestamps and overlapping segments but permits genuinely later evidence", () => {
    const ranges = [{ from: 10, to: 20 }];
    expect(captureEvidenceIsOffRecord(ranges, 12)).toBe(true);
    expect(captureEvidenceIsOffRecord(ranges, 9, 10)).toBe(true);
    expect(captureEvidenceIsOffRecord(ranges, 20, 22)).toBe(true);
    expect(captureEvidenceIsOffRecord(ranges, 21, 23)).toBe(false);
    expect(captureEvidenceIsOffRecord(ranges, 8, 9)).toBe(false);
    const { session, context, loop } = setup();
    session.transcript.push({ id: "overlap", t: 9, tEnd: 12, text: reason, speaker: "expert", final: true });
    redactCaptureRange(session, loop, context, 10, 20);
    expect(session.transcript[0]).toMatchObject({ text: "", redacted: true });
  });
});
