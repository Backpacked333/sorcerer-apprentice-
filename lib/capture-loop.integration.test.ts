import { describe, expect, it } from "vitest";
import { CaptureLoop, findLateAnswerWindow, windowOutcome, type LoopSignals } from "./capture-loop";
import { buildCandidates, CandidateQueue, newContext } from "./curiosity";
import type { QuestionWindow, ScreenEvent } from "./events";
import { DEMO_GOVERNOR, Governor } from "./governor";
import type { TurnResult } from "./voice-turn";

const event = (invoice = "4471"): ScreenEvent => ({
  id: `edit-${invoice}`,
  source: "dom",
  t: 10,
  kind: "field_changed",
  invoice,
  field: "costCenter",
  from: "4711",
  to: "0400",
  state: { amount: 7_850 },
});

const signals = (now: number, extra: Partial<LoopSignals> = {}): LoopSignals => ({
  now,
  currentInvoice: "4471",
  lastSpeechAt: now - 10,
  lastScreenChangeAt: now - 10,
  lastTypingAt: now - 10,
  lastBoundaryAt: Number.NEGATIVE_INFINITY,
  lastInvoiceOpenedAt: now - 10,
  agentSpeaking: false,
  transcriberHealthy: true,
  sttHealthy: true,
  paused: false,
  ...extra,
});

const turn = (partial: Partial<TurnResult>): TurnResult => ({
  spoke: true,
  heard: "",
  via: "timeout",
  askedAt: 12,
  sentAt: 11,
  closedAt: 20,
  ...partial,
});

function readyLoop() {
  const governor = new Governor({ ...DEMO_GOVERNOR, warmupSecs: 0 });
  const queue = new CandidateQueue(90, 18);
  const loop = new CaptureLoop(governor, queue, { graceSecs: 18 });
  queue.add(buildCandidates(event(), newContext(), 10));
  const action = loop.next(signals(20));
  if (action.type !== "open") throw new Error("expected a ready question");
  return { governor, queue, loop, action };
}

describe("Capture turn integration", () => {
  it("rechecks activity and candidate freshness immediately before opening", () => {
    const { loop, action } = readyLoop();

    expect(loop.isFresh(action, signals(20.5))).toBe(true);
    expect(loop.isFresh(action, signals(20.5, { lastTypingAt: 20.25 }))).toBe(false);
    expect(loop.isFresh(action, signals(20.5, { lastSpeechAt: 20.25 }))).toBe(false);
    expect(loop.isFresh(action, signals(20.5, { lastScreenChangeAt: 20.25 }))).toBe(false);
    expect(loop.isFresh(action, signals(20.5, { paused: true }))).toBe(false);
  });

  it("does not consume a chained follow-up when the final freshness check rejects it", () => {
    const { loop, action } = readyLoop();
    loop.opened(action.candidate, 20);
    loop.governor.markAsked(21);
    loop.closed({ candidate: action.candidate, outcome: "answered", heard: "I changed it because the invoice required equipment coding.", now: 24 });

    const firstAttempt = loop.next(signals(25.5));
    expect(firstAttempt).toMatchObject({ type: "open", followup: true });
    if (firstAttempt.type !== "open") throw new Error("expected a chained follow-up");
    expect(loop.isFresh(firstAttempt, signals(25.5, { lastTypingAt: 25.4 }))).toBe(false);

    expect(loop.next(signals(26))).toMatchObject({ type: "open", candidate: { id: firstAttempt.candidate.id }, followup: true });
  });

  it("applies retry and user-deferred outcomes without losing governor accounting", () => {
    const retry = readyLoop();
    retry.loop.opened(retry.action.candidate, 20);
    retry.governor.markAsked(21);
    retry.loop.applyOutcome(retry.action.candidate, windowOutcome(turn({ via: "aborted", abortReason: "paused" })), 20);

    expect(retry.action.candidate).toMatchObject({ status: "queued", retryAfter: 26 });
    expect(retry.governor.window).toBeNull();
    expect(retry.governor.questionsAsked).toBe(0);

    const deferred = readyLoop();
    deferred.loop.opened(deferred.action.candidate, 20);
    deferred.governor.markAsked(21);
    deferred.loop.applyOutcome(deferred.action.candidate, windowOutcome(turn({ via: "aborted", command: "not_now" })), 20);

    expect(deferred.action.candidate).toMatchObject({ status: "debrief", userDeferred: true });
    expect(deferred.loop.deferred()).toContainEqual(expect.objectContaining({ stepRef: deferred.action.candidate.stepRef }));
    expect(deferred.governor.questionsAsked).toBe(0);
  });

  it("applies verbatim answered and timeout outcomes", () => {
    const answered = readyLoop();
    answered.loop.opened(answered.action.candidate, 20);
    answered.governor.markAsked(21);
    answered.loop.applyOutcome(
      answered.action.candidate,
      windowOutcome(turn({ via: "scribe", heard: "I use 0400 because this is equipment." })),
      24,
    );
    expect(answered.action.candidate).toMatchObject({
      status: "filled",
      filledBy: "window",
      heardQuote: "I use 0400 because this is equipment.",
      heardAt: 24,
    });
    expect(answered.governor.questionsAsked).toBe(1);

    const timedOut = readyLoop();
    timedOut.loop.opened(timedOut.action.candidate, 20);
    timedOut.governor.markAsked(21);
    timedOut.loop.applyOutcome(timedOut.action.candidate, windowOutcome(turn({ via: "timeout" })), 40);
    expect(timedOut.action.candidate.status).toBe("debrief");
    expect(timedOut.governor.window).toBeNull();
  });
});

describe("late Capture tool attribution", () => {
  const window = (overrides: Partial<QuestionWindow>): QuestionWindow => ({
    id: "win-old",
    candidateId: "candidate-old",
    kind: "why",
    question: "Why?",
    stepRef: "4471:costCenter",
    openedAt: 10,
    askedAt: 12,
    answeredAt: 17,
    closedAt: 18,
    outcome: "answered",
    ...overrides,
  });

  it("selects only the latest safe closed window for the same step", () => {
    const replacement = window({ id: "win-new", candidateId: "candidate-new", stepRef: "4472:route", openedAt: 19, askedAt: undefined, closedAt: undefined, outcome: undefined });
    const struck = window({ id: "win-struck", closedAt: 19, outcome: "off_record" });
    const aborted = window({ id: "win-aborted", closedAt: 19.5, outcome: "aborted" });
    const answer = window({ id: "win-answer", closedAt: 18 });

    expect(findLateAnswerWindow([answer, struck, aborted, replacement], "4471:costCenter", 25)?.id).toBe("win-answer");
    expect(findLateAnswerWindow([answer], "4471:costCenter", 34)).toBeUndefined();
    expect(findLateAnswerWindow([answer], "4472:route", 25)).toBeUndefined();
  });
});
