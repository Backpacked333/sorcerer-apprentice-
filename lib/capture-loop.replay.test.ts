import { describe, expect, it } from "vitest";
import { CaptureLoop, windowOutcome, type LoopSignals } from "./capture-loop";
import { buildCandidates, CandidateQueue, newContext, type Candidate } from "./curiosity";
import { DEFAULT_GOVERNOR, DEMO_GOVERNOR, Governor } from "./governor";
import type { ScreenEvent } from "./events";
import type { TurnResult } from "./voice-turn";
import { countsAsSpeech } from "./voice-protocol";

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

function hearQuestion(loop: CaptureLoop, candidate: Candidate, openedAt: number): void {
  loop.opened(candidate, openedAt);
  loop.governor.markAsked(openedAt + 4);
}

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
    expect(windowOutcome(result({ via: "aborted", abortReason: "disconnected" }))).toMatchObject({ outcome: "aborted", candidateStatus: "queued", retryAfter: 26 });
    expect(windowOutcome(result({ via: "aborted", abortReason: "resumed", spoke: false }))).toMatchObject({ outcome: "remove", candidateStatus: "queued", governor: "abort" });
    expect(windowOutcome(result({ via: "aborted", abortReason: "silent", spoke: false }))).toMatchObject({ outcome: "remove", candidateStatus: "queued", governor: "abort" });
    expect(windowOutcome(result({ via: "aborted", abortReason: "superseded", spoke: false }))).toMatchObject({ outcome: "remove", candidateStatus: "queued", governor: "abort" });
  });
});

describe("capture cadence replay", () => {
  it("replays red and green signals with three grounded windows, a guardrail and retro wording", () => {
    const governor = new Governor(DEMO_GOVERNOR);
    const queue = new CandidateQueue(90, 18);
    const loop = new CaptureLoop(governor, queue, { graceSecs: 18 });
    const opened = [] as Array<{ invoice?: string; question: string; retro: boolean; followup: boolean }>;
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

    queue.expire(16, "9002");
    const firstSignals = signals(18, "9002");
    const first = loop.next(firstSignals);
    expect(first).toMatchObject({ type: "open", followup: false, retro: true });
    if (first.type !== "open") throw new Error("expected first question");
    opened.push({ ...first.candidate, retro: first.retro, followup: first.followup });
    expect(first.candidate.questionRetro).toMatch(/^On invoice 9001 a moment ago,/);
    expect(Object.values(governor.evaluate(firstSignals).lights).every(Boolean)).toBe(true);
    hearQuestion(loop, first.candidate, 18);
    loop.closed({ candidate: first.candidate, outcome: "answered", heard: "I changed it for the current invoice.", now: 29 });

    const chained = loop.next(signals(30.3, "9002"));
    expect(chained).toMatchObject({ type: "open", followup: true, forced: false });
    if (chained.type !== "open") throw new Error("expected guardrail chain");
    opened.push({ ...chained.candidate, retro: chained.retro, followup: chained.followup });
    expect(chained.candidate.guardrail).toBe(true);
    const chainLights = governor.evaluate(signals(30.3, "9002")).lights;
    expect(chainLights).toMatchObject({ silence: true, still: true, notTyping: true, notReading: true });
    hearQuestion(loop, chained.candidate, 30.3);
    loop.closed({ candidate: chained.candidate, outcome: "answered", heard: "It depends on the case.", now: 41.3 });

    queue.add(buildCandidates(edit("9002", 48, "route_changed"), newContext(), 48));
    queue.fillNarration("Invoice 9002 routes because the policy requires review.", 52, "9002");
    queue.add(buildCandidates(edit("9003", 60, "status_changed"), newContext(), 60));
    const third = loop.next(signals(68, "9003"));
    expect(third.type).toBe("open");
    if (third.type !== "open") throw new Error("expected third question");
    opened.push({ ...third.candidate, retro: third.retro, followup: third.followup });
    expect(Object.values(governor.evaluate(signals(68, "9003")).lights).every(Boolean)).toBe(true);
    hearQuestion(loop, third.candidate, 68);
    loop.closed({ candidate: third.candidate, outcome: "answered", heard: "The review policy applies here.", now: 79 });

    expect(queue.windowsAsked).toBeGreaterThanOrEqual(3);
    expect(queue.guardrailAsked).toBe(true);
    expect(opened.every((candidate) => candidate.invoice && candidate.question.includes(candidate.invoice))).toBe(true);
    expect(opened.every((candidate) => !candidate.retro || candidate.question.includes(candidate.invoice!))).toBe(true);
    expect(loop.reasonHeard).toEqual([{ stepRef: "9002:route_changed", quote: "Invoice 9002 routes because the policy requires review.", t: 52 }]);
  });

  it("uses retro wording for an off-screen invoice during grace", () => {
    const queue = new CandidateQueue(90, 18);
    const loop = new CaptureLoop(new Governor({ ...DEMO_GOVERNOR, warmupSecs: 0 }), queue, { graceSecs: 18 });
    queue.add(buildCandidates(edit("9001", 10), newContext(), 10));
    const action = loop.next(signals(20, "9002"));
    expect(action).toMatchObject({ type: "open", retro: true });
    if (action.type === "open") expect(action.candidate.questionRetro).toMatch(/^On invoice 9001 a moment ago,/);
  });

  it("asks three windows after a talkative narrated reason and retains the evidence timestamp", () => {
    const governor = new Governor(DEMO_GOVERNOR);
    const queue = new CandidateQueue(90, 18);
    const loop = new CaptureLoop(governor, queue, { graceSecs: 18 });
    queue.add(buildCandidates(edit("9001", 10), newContext(), 10));
    const narratedWhy = queue.items.find((candidate) => candidate.invoice === "9001" && candidate.kind === "why")!;
    expect(queue.fillNarration("Invoice 9001 changed because the policy requires review.", 14, "9001")).toContain(narratedWhy);

    const first = loop.next(signals(18));
    if (first.type !== "open") throw new Error("expected narrated sibling");
    expect(first.candidate.id).not.toBe(narratedWhy.id);
    hearQuestion(loop, first.candidate, 18);
    loop.closed({ candidate: first.candidate, outcome: "answered", heard: "It depends on the situation.", now: 29 });

    queue.add(buildCandidates(edit("9002", 32, "route_changed"), newContext(), 32));
    const secondSignals = signals(50, "9002");
    const second = loop.next(secondSignals);
    if (second.type !== "open") throw new Error("expected second window");
    expect(Object.values(governor.evaluate(secondSignals).lights).every(Boolean)).toBe(true);
    hearQuestion(loop, second.candidate, 50);
    loop.closed({ candidate: second.candidate, outcome: "answered", heard: "I route it for a neutral reason.", now: 61 });

    const thirdSignals = signals(62.3, "9002");
    const third = loop.next(thirdSignals);
    if (third.type !== "open") throw new Error("expected chained third window");
    expect(governor.evaluate(thirdSignals).lights).toMatchObject({ silence: true, still: true, notTyping: true, notReading: true });
    hearQuestion(loop, third.candidate, 62.3);
    loop.closed({ candidate: third.candidate, outcome: "answered", heard: "There is no fixed boundary.", now: 73.3 });

    expect(queue.windowsAsked).toBeGreaterThanOrEqual(3);
    expect(queue.guardrailAsked).toBe(true);
    expect(loop.reasonHeard).toEqual([{ stepRef: "9001:costCenter", quote: "Invoice 9001 changed because the policy requires review.", t: 14 }]);
  });

  it("ignores one-word noise partials and still reaches the demo cadence", () => {
    const governor = new Governor(DEMO_GOVERNOR);
    const queue = new CandidateQueue(90, 18);
    const loop = new CaptureLoop(governor, queue, { graceSecs: 18 });
    let previousPartial = "";
    let lastHumanSpeechAt = Number.NEGATIVE_INFINITY;
    for (let at = 2; at <= 64; at += 2) {
      const partial = "uh";
      if (countsAsSpeech(previousPartial, partial)) lastHumanSpeechAt = at;
      previousPartial = partial;
    }
    expect(lastHumanSpeechAt).toBe(Number.NEGATIVE_INFINITY);

    queue.add(buildCandidates(edit("9001", 10), newContext(), 10));
    const firstSignals = signals(18, "9001", { lastSpeechAt: lastHumanSpeechAt });
    const first = loop.next(firstSignals);
    if (first.type !== "open") throw new Error("expected first noise-tolerant window");
    expect(Object.values(governor.evaluate(firstSignals).lights).every(Boolean)).toBe(true);
    hearQuestion(loop, first.candidate, 18);
    loop.closed({ candidate: first.candidate, outcome: "answered", heard: "A neutral reason for this choice.", now: 29 });
    const chainSignals = signals(30.3, "9001", { lastSpeechAt: lastHumanSpeechAt });
    const chain = loop.next(chainSignals);
    if (chain.type !== "open") throw new Error("expected noise-tolerant chain");
    expect(governor.evaluate(chainSignals).lights).toMatchObject({ silence: true, still: true, notTyping: true, notReading: true });
    hearQuestion(loop, chain.candidate, 30.3);
    loop.closed({ candidate: chain.candidate, outcome: "answered", heard: "It depends on the situation.", now: 41.3 });
    queue.add(buildCandidates(edit("9002", 44, "route_changed"), newContext(), 44));
    const thirdSignals = signals(62, "9002", { lastSpeechAt: lastHumanSpeechAt });
    const third = loop.next(thirdSignals);
    if (third.type !== "open") throw new Error("expected third noise-tolerant window");
    expect(Object.values(governor.evaluate(thirdSignals).lights).every(Boolean)).toBe(true);
    hearQuestion(loop, third.candidate, 62);
    loop.closed({ candidate: third.candidate, outcome: "answered", heard: "A neutral routing reason.", now: 73 });
    expect(queue.windowsAsked).toBeGreaterThanOrEqual(3);
    expect(queue.guardrailAsked).toBe(true);
  });

  it("records a narrated reason without counting it as a window", () => {
    const queue = new CandidateQueue(90, 18);
    const loop = new CaptureLoop(new Governor(DEMO_GOVERNOR), queue, { graceSecs: 18 });
    queue.add(buildCandidates(edit("9001", 10), newContext(), 10));
    queue.fillNarration("Invoice 9001 changed because the policy requires it.", 14, "9001");
    expect(loop.reasonHeard).toEqual([{ stepRef: "9001:costCenter", quote: "Invoice 9001 changed because the policy requires it.", t: 14 }]);
    expect(queue.windowsAsked).toBe(0);
  });

  it("leaves governor ask accounting to the listening phase", () => {
    const governor = new Governor(DEMO_GOVERNOR);
    const queue = new CandidateQueue(90, 18);
    const loop = new CaptureLoop(governor, queue, { graceSecs: 18 });
    queue.add(buildCandidates(edit("9001", 10), newContext(), 10));
    const why = queue.items.find((candidate) => candidate.kind === "why")!;
    hearQuestion(loop, why, 18);
    loop.closed({ candidate: why, outcome: "answered", heard: "Invoice 9001 changed for a neutral reason.", now: 29 });
    expect(governor.questionsAsked).toBe(1);
  });

  it("does not chain a sibling already covered by the answer and orders deferred questions", () => {
    const queue = new CandidateQueue(90, 18);
    const loop = new CaptureLoop(new Governor(DEMO_GOVERNOR), queue, { graceSecs: 18 });
    queue.add(buildCandidates(edit("9001", 10, "status_changed"), newContext(), 10));
    const why = queue.items.find((candidate) => candidate.kind === "why")!;
    hearQuestion(loop, why, 18);
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
        hearQuestion(loop, action.candidate, at + 8);
        loop.closed({ candidate: action.candidate, outcome: "answered", heard: "A neutral reason for this choice.", now: at + 19 });
      }
      queue.expire(at + 20, `next-${invoice}`);
    }
    expect(queue.windowsAsked).toBeLessThan(3);
  });
});
