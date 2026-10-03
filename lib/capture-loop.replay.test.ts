import { describe, expect, it } from "vitest";
import { CaptureLoop, windowOutcome, type LoopSignals } from "./capture-loop";
import { buildCandidates, CandidateQueue, newContext } from "./curiosity";
import { DEFAULT_GOVERNOR, DEMO_GOVERNOR, Governor } from "./governor";
import type { ScreenEvent } from "./events";
import type { TurnResult } from "./voice-turn";

const edit = (invoice: string, t: number, kind: "field_changed" | "route_changed" | "status_changed" = "field_changed"): ScreenEvent => ({
  id: `${kind}-${invoice}`,
  source: "dom",
  t,
  kind,
  invoice,
  ...(kind === "field_changed" ? { field: "costCenter", from: "1000", to: "2000" } : {}),
  ...(kind === "route_changed" ? { from: "single", to: "review" } : {}),
  ...(kind === "status_changed" ? { from: "open", to: "hold" } : {}),
  state: { amount: 3200 },
});

const signals = (now: number, currentInvoice = "9001", extra: Partial<LoopSignals> = {}): LoopSignals => ({
  now,
  currentInvoice,
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

const result = (partial: Partial<TurnResult>): TurnResult => ({
  spoke: true,
  heard: "",
  via: "timeout",
  askedAt: 10,
  sentAt: 8,
  closedAt: 20,
  ...partial,
});

describe("window outcome mapping", () => {
  it("maps verbatim answers and diagnostic tool fields", () => {
    expect(
      windowOutcome(
        result({
          via: "tool",
          heard: "Invoice 9001 because the policy says so.",
          audioId: "audio-1",
          tool: { name: "log_answer", params: { reason: "summary", guardrail: "none", kind: "why" } },
        }),
      ),
    ).toMatchObject({
      outcome: "answered",
      closedBy: "tool",
      answerText: "Invoice 9001 because the policy says so.",
      answerAudioId: "audio-1",
      candidateStatus: "filled",
      filledBy: "window",
      governor: "close",
      logged: { reason: "summary", guardrail: "none", kind: "why" },
    });
    expect(windowOutcome(result({ via: "scribe", heard: "A spoken answer" }))).toMatchObject({ outcome: "answered", closedBy: "scribe_fallback" });
    expect(windowOutcome(result({ via: "typed", heard: "A typed answer" }))).toMatchObject({ outcome: "answered", closedBy: "user" });
  });

  it("keeps empty, timed-out, deferred, struck and unspoken outcomes distinct", () => {
    expect(windowOutcome(result({ via: "tool", heard: "" }))).toMatchObject({ outcome: "answered", candidateStatus: "debrief", governor: "close" });
    expect(windowOutcome(result({ via: "timeout" }))).toMatchObject({ outcome: "timeout", candidateStatus: "debrief", governor: "close" });
    expect(windowOutcome(result({ via: "aborted", command: "off_record" }))).toMatchObject({ outcome: "off_record", candidateStatus: "expired", governor: "short_close", strike: true });
    expect(windowOutcome(result({ via: "aborted", command: "not_now" }))).toMatchObject({ outcome: "aborted", candidateStatus: "debrief", userDeferred: true });
    expect(windowOutcome(result({ via: "aborted", abortReason: "paused" }))).toMatchObject({ outcome: "aborted", candidateStatus: "queued", retryAfter: 26 });
    expect(windowOutcome(result({ via: "aborted", abortReason: "resumed", spoke: false }))).toMatchObject({ outcome: "remove", candidateStatus: "queued", governor: "abort" });
  });
});

describe("capture cadence replay", () => {
  it("asks at least three grounded questions including a guardrail and never opens on a red signal", () => {
    const governor = new Governor(DEMO_GOVERNOR);
    const queue = new CandidateQueue(90, 18);
    const loop = new CaptureLoop(governor, queue, { graceSecs: 18 });
    const opened = [] as Array<{ invoice?: string; question: string }>;
    queue.add(buildCandidates(edit("9001", 10), newContext(), 10));

    for (const red of [
      signals(18, "9001", { lastTypingAt: 18 }),
      signals(18, "9001", { lastScreenChangeAt: 18 }),
      signals(18, "9001", { lastSpeechAt: 18 }),
      signals(18, "9001", { sttHealthy: false }),
      signals(18, "9001", { paused: true }),
    ]) {
      expect(loop.next(red).type).toBe("wait");
    }

    const first = loop.next(signals(18));
    expect(first).toMatchObject({ type: "open", followup: false, retro: false });
    if (first.type !== "open") throw new Error("expected first question");
    opened.push(first.candidate);
    loop.opened(first.candidate, 18);
    loop.closed({ candidate: first.candidate, outcome: "answered", heard: "I changed it for the current invoice.", now: 29 });

    const chained = loop.next(signals(30.3));
    expect(chained).toMatchObject({ type: "open", followup: true, forced: false });
    if (chained.type !== "open") throw new Error("expected guardrail chain");
    opened.push(chained.candidate);
    expect(chained.candidate.guardrail).toBe(true);
    loop.opened(chained.candidate, 30.3);
    loop.closed({ candidate: chained.candidate, outcome: "answered", heard: "It depends on the case.", now: 41.3 });

    queue.add(buildCandidates(edit("9002", 48, "route_changed"), newContext(), 48));
    queue.add(buildCandidates(edit("9003", 60, "status_changed"), newContext(), 60));
    const third = loop.next(signals(68, "9003"));
    expect(third.type).toBe("open");
    if (third.type !== "open") throw new Error("expected third question");
    opened.push(third.candidate);
    loop.opened(third.candidate, 68);
    loop.closed({ candidate: third.candidate, outcome: "answered", heard: "The review policy applies here.", now: 79 });

    expect(queue.windowsAsked).toBeGreaterThanOrEqual(3);
    expect(queue.guardrailAsked).toBe(true);
    expect(opened.every((candidate) => candidate.invoice && candidate.question.includes(candidate.invoice))).toBe(true);
  });

  it("uses retro wording for an off-screen invoice during grace", () => {
    const queue = new CandidateQueue(90, 18);
    const loop = new CaptureLoop(new Governor({ ...DEMO_GOVERNOR, warmupSecs: 0 }), queue, { graceSecs: 18 });
    queue.add(buildCandidates(edit("9001", 10), newContext(), 10));
    const action = loop.next(signals(20, "9002"));
    expect(action).toMatchObject({ type: "open", retro: true });
    if (action.type === "open") expect(action.candidate.questionRetro).toMatch(/^On invoice 9001 a moment ago,/);
  });

  it("records a narrated reason without counting it as a window", () => {
    const queue = new CandidateQueue(90, 18);
    const loop = new CaptureLoop(new Governor(DEMO_GOVERNOR), queue, { graceSecs: 18 });
    queue.add(buildCandidates(edit("9001", 10), newContext(), 10));
    const why = queue.items.find((candidate) => candidate.kind === "why")!;
    queue.markFilled(why.id, "narration", "Invoice 9001 changed because the policy requires it.");
    expect(loop.reasonHeard).toEqual([{ stepRef: "9001:costCenter", quote: "Invoice 9001 changed because the policy requires it.", t: 10 }]);
    expect(queue.windowsAsked).toBe(0);
  });

  it("does not chain a sibling already covered by the answer and orders deferred questions", () => {
    const queue = new CandidateQueue(90, 18);
    const loop = new CaptureLoop(new Governor(DEMO_GOVERNOR), queue, { graceSecs: 18 });
    queue.add(buildCandidates(edit("9001", 10, "status_changed"), newContext(), 10));
    const why = queue.items.find((candidate) => candidate.kind === "why")!;
    loop.opened(why, 18);
    loop.closed({ candidate: why, outcome: "answered", heard: "Only the reviewer decides and I ask them first.", now: 29 });
    expect(queue.items.filter((candidate) => candidate.parentId === why.id && candidate.status === "filled").map((candidate) => candidate.kind)).toEqual(
      expect.arrayContaining(["limit", "counterfactual", "who", "stop"]),
    );
    expect(loop.next(signals(30.3))).toMatchObject({ type: "wait" });

    queue.add(buildCandidates(edit("9002", 40), newContext(), 40));
    const deferredWhy = queue.items.find((candidate) => candidate.invoice === "9002" && candidate.kind === "why")!;
    deferredWhy.status = "debrief";
    deferredWhy.userDeferred = true;
    expect(loop.deferred()[0]).toMatchObject({ stepRef: "9002:costCenter", kind: "why" });
  });

  it("documents that the legacy cadence cannot ask three questions in the same brisk run", () => {
    const queue = new CandidateQueue(90, 0);
    const loop = new CaptureLoop(new Governor({ ...DEFAULT_GOVERNOR, warmupSecs: 0 }), queue, { graceSecs: 0 });
    for (const [invoice, at] of [["9001", 10], ["9002", 55], ["9003", 100]] as const) {
      queue.add(buildCandidates(edit(invoice, at), newContext(), at));
      const action = loop.next(signals(at + 8, invoice));
      if (action.type === "open") {
        loop.opened(action.candidate, at + 8);
        loop.closed({ candidate: action.candidate, outcome: "answered", heard: "A neutral reason for this choice.", now: at + 19 });
      }
      queue.expire(at + 20, `next-${invoice}`);
    }
    expect(queue.windowsAsked).toBeLessThan(3);
  });
});
