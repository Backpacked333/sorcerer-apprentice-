import { describe, expect, it } from "vitest";

import {
  createTurnPromiseQueue,
  gateState,
  initialTurnState,
  reduce,
  type TurnEffect,
  type TurnEvent,
  type TurnOptions,
  type TurnState,
} from "./voice-turn";

describe("turn promise queue", () => {
  it("resolves superseded turns in request order without settling the replacement", async () => {
    const queue = createTurnPromiseQueue();
    const first = queue.push();
    const second = queue.push();
    const aborted = {
      spoke: false,
      heard: "",
      via: "aborted" as const,
      askedAt: 10,
      sentAt: 10,
      closedAt: 11,
      abortReason: "superseded" as const,
    };

    expect(queue.resolve(aborted)).toBe(true);
    await expect(first).resolves.toEqual(aborted);
    expect(queue.pending()).toBe(1);

    let replacementSettled = false;
    void second.then(() => { replacementSettled = true; });
    await Promise.resolve();
    expect(replacementSettled).toBe(false);
  });
});

const options: TurnOptions = {
  tag: "ASK",
  text: "What made you choose that route?",
  listen: true,
  recordClip: { sessionId: "session-neutral" },
};

function apply(state: TurnState, event: TurnEvent) {
  return reduce(state, event);
}

function start(opts: TurnOptions = options, at = 10, agentConnected = true, audioId?: string) {
  const sent = apply(initialTurnState, {
    type: "SEND",
    at,
    options: opts,
    agentConnected,
    audioId,
  });
  return apply(sent.state, { type: "TICK", at });
}

function listening(opts: TurnOptions = options, audioId?: string) {
  let current = start(opts, 10, true, audioId);
  current = apply(current.state, { type: "SPEAK_START", at: 11, source: "agent" });
  current = apply(current.state, { type: "SPEAK_END", at: 13 });
  current = apply(current.state, { type: "TICK", at: 13.6 });
  expect(current.state.phase).toBe("listening");
  return current;
}

function effect(effects: TurnEffect[], type: TurnEffect["type"]) {
  return effects.find((candidate) => candidate.type === type);
}

function finish(state: TurnState, at = 18) {
  return apply(state, { type: "TICK", at });
}

describe("gate", () => {
  it("is closed at rest when the legacy microphone is muted", () => {
    expect(gateState({ turnActive: false, now: 10, gateHoldUntil: 0, micMuted: true, squelch: false })).toBe(false);
  });

  it.each(["sending", "waiting_for_speech", "speaking", "listening", "closing"] as const)(
    "is open during the %s turn phase",
    (turnActive) => {
      expect(gateState({ turnActive, now: 10, gateHoldUntil: 0, micMuted: true, squelch: false })).toBe(true);
    },
  );

  it("is closed while squelched even with a pending turn", () => {
    expect(gateState({ turnActive: "waiting_for_speech", now: 10, gateHoldUntil: 20, micMuted: false, squelch: true })).toBe(false);
  });

  it("keeps a legacy say audible only until its hold expires", () => {
    expect(gateState({ turnActive: false, now: 9.9, gateHoldUntil: 10, micMuted: true, squelch: false })).toBe(true);
    expect(gateState({ turnActive: false, now: 10, gateHoldUntil: 10, micMuted: true, squelch: false })).toBe(false);
    expect(gateState({ turnActive: false, now: 20, gateHoldUntil: 0, micMuted: false, squelch: false })).toBe(true);
  });
});

describe("turn reducer", () => {
  it("closes from a tool call and uploads a non-empty Scribe answer", () => {
    let current = listening();
    current = apply(current.state, { type: "HUMAN_COMMIT", at: 14, text: "Because the route was already approved.", source: "scribe" });
    current = apply(current.state, { type: "TOOL", at: 14.2, name: "log_answer", params: { stepRef: "step-1" } });

    expect(current.state.phase).toBe("closing");
    expect(effect(current.effects, "MUTE")).toBeTruthy();
    current = finish(current.state, 17);
    const resolved = effect(current.effects, "RESOLVE");
    expect(resolved).toMatchObject({
      type: "RESOLVE",
      result: {
        via: "tool",
        heard: "Because the route was already approved.",
        heardSource: "scribe",
        tool: { name: "log_answer", params: { stepRef: "step-1" } },
      },
    });
    expect(effect(current.effects, "CLIP_STOP")).toMatchObject({ type: "CLIP_STOP", upload: true });
  });

  it("closes from Scribe after 2.5 seconds of human silence", () => {
    let current = listening({ ...options, silenceCloseSecs: 2.5 });
    current = apply(current.state, { type: "HUMAN_COMMIT", at: 14, text: "It matched the supporting record." });
    current = apply(current.state, { type: "TICK", at: 16.49 });
    expect(current.state.phase).toBe("listening");
    current = apply(current.state, { type: "TICK", at: 16.5 });
    expect(current.state).toMatchObject({ phase: "closing", close: { via: "scribe" } });
  });

  it("does not close while fresh partials keep arriving", () => {
    let current = listening({ ...options, timeoutSecs: 3, silenceCloseSecs: 2.5 });
    current = apply(current.state, { type: "HUMAN_PARTIAL", at: 15, text: "because" });
    current = apply(current.state, { type: "TICK", at: 17.9 });
    expect(current.state.phase).toBe("listening");
    current = apply(current.state, { type: "HUMAN_PARTIAL", at: 18, text: "because the record" });
    current = apply(current.state, { type: "TICK", at: 20.9 });
    expect(current.state.phase).toBe("listening");
  });

  it("times out when no human speech arrives", () => {
    let current = listening({ ...options, timeoutSecs: 4 });
    current = apply(current.state, { type: "TICK", at: 17.59 });
    expect(current.state.phase).toBe("listening");
    current = apply(current.state, { type: "TICK", at: 17.6 });
    expect(current.state).toMatchObject({ phase: "closing", close: { via: "timeout", heard: "" } });
  });

  it("uses Scribe rather than timeout when maxSecs is reached with text", () => {
    let current = listening({ ...options, timeoutSecs: 99, maxSecs: 5, silenceCloseSecs: 99 });
    current = apply(current.state, { type: "HUMAN_COMMIT", at: 17, text: "The total was outside the usual range." });
    current = apply(current.state, { type: "TICK", at: 18.6 });
    expect(current.state).toMatchObject({
      phase: "closing",
      close: { via: "scribe", heard: "The total was outside the usual range." },
    });
  });

  it.each([
    { prefix: "", partial: "A partial-only answer.", heard: "A partial-only answer." },
    { prefix: "The complete reason is", partial: "the late approval.", heard: "The complete reason is the late approval." },
  ])("folds live partial text into the Scribe answer at maxSecs: $heard", ({ prefix, partial, heard }) => {
    let current = listening({ ...options, timeoutSecs: 99, maxSecs: 5, silenceCloseSecs: 99 });
    if (prefix) current = apply(current.state, { type: "HUMAN_COMMIT", at: 16, text: prefix });
    current = apply(current.state, { type: "HUMAN_PARTIAL", at: 18.4, text: partial });
    current = apply(current.state, { type: "TICK", at: 18.6 });
    expect(current.state).toMatchObject({
      phase: "closing",
      close: { via: "scribe", heard, heardSource: "scribe", answeredAt: 18.4 },
    });
  });

  it("closes from typed input with the typed source", () => {
    let current = listening();
    current = apply(current.state, { type: "TYPED", at: 14, text: "  A typed explanation.  " });
    expect(current.state).toMatchObject({
      phase: "closing",
      close: { via: "typed", heard: "A typed explanation.", heardSource: "typed" },
    });
  });

  it("uses browser speech when the agent watchdog expires", () => {
    let current = start({ ...options, watchdogSecs: 4 });
    current = apply(current.state, { type: "TICK", at: 13.99 });
    expect(effect(current.effects, "FALLBACK_SPEAK")).toBeFalsy();
    current = apply(current.state, { type: "TICK", at: 14 });
    expect(current.state).toMatchObject({ phase: "speaking", spokenBy: "fallback", fallbackRequestedAt: 14 });
    expect(effect(current.effects, "SQUELCH")).toBeTruthy();
    expect(effect(current.effects, "FALLBACK_SPEAK")).toMatchObject({
      type: "FALLBACK_SPEAK",
      text: "What made you choose that route?",
    });
  });

  it("aborts as silent if fallback speech also does not start", () => {
    let current = start({ ...options, watchdogSecs: 4 });
    current = apply(current.state, { type: "TICK", at: 14 });
    current = apply(current.state, { type: "TICK", at: 15.5 });
    expect(current.state.phase).toBe("idle");
    expect(effect(current.effects, "RESOLVE")).toMatchObject({
      type: "RESOLVE",
      result: { via: "aborted", abortReason: "silent", spoke: false, askedAt: 10 },
    });
  });

  it("aborts on resumed human speech before the question is audible", () => {
    let current = start({ ...options, abortOnHumanSpeech: true });
    current = apply(current.state, { type: "HUMAN_PARTIAL", at: 10.5, text: "one moment" });
    expect(current.state.phase).toBe("idle");
    expect(effect(current.effects, "SEND_CONTEXT")).toMatchObject({ type: "SEND_CONTEXT" });
    expect(effect(current.effects, "RESOLVE")).toMatchObject({
      type: "RESOLVE",
      result: { via: "aborted", abortReason: "resumed", spoke: false },
    });
  });

  it("cancels before speech without claiming the question was heard", () => {
    let current = start();
    current = apply(current.state, { type: "CANCEL", at: 10.5, reason: "paused" });
    expect(current.state.phase).toBe("idle");
    expect(effect(current.effects, "RESOLVE")).toMatchObject({
      type: "RESOLVE",
      result: { via: "aborted", abortReason: "paused", spoke: false, askedAt: 10 },
    });
  });

  it("does not auto-abort after one second of audible speech", () => {
    let current = start({ ...options, abortOnHumanSpeech: true });
    current = apply(current.state, { type: "SPEAK_START", at: 11 });
    current = apply(current.state, { type: "HUMAN_PARTIAL", at: 12, text: "I can answer now" });
    expect(current.state.phase).toBe("speaking");
    expect(effect(current.effects, "RESOLVE")).toBeFalsy();
  });

  it("attaches a late tool call while closing", () => {
    let current = listening({ ...options, silenceCloseSecs: 1 });
    current = apply(current.state, { type: "HUMAN_COMMIT", at: 14, text: "It is the documented exception." });
    current = apply(current.state, { type: "TICK", at: 15 });
    expect(current.state.phase).toBe("closing");
    current = apply(current.state, { type: "TOOL", at: 15.2, name: "log_answer", params: { kind: "why" } });
    current = finish(current.state, 18);
    expect(effect(current.effects, "RESOLVE")).toMatchObject({
      type: "RESOLVE",
      result: { via: "scribe", tool: { name: "log_answer", params: { kind: "why" } } },
    });
  });

  it("resolves the old turn as superseded before starting the new turn", () => {
    const first = start();
    const secondOptions = { ...options, text: "Where would you stop?" };
    let current = apply(first.state, { type: "SEND", at: 11, options: secondOptions, agentConnected: true });
    expect(current.state).toMatchObject({
      phase: "sending",
      options: secondOptions,
      queuedAt: 11,
      waitingForSquelch: true,
    });
    expect(effect(current.effects, "RESOLVE")).toMatchObject({
      type: "RESOLVE",
      result: { via: "aborted", abortReason: "superseded", spoke: false },
    });
    expect(effect(current.effects, "SQUELCH")).toBeTruthy();
    expect(effect(current.effects, "SEND_CONTEXT")).toBeTruthy();
    expect(effect(current.effects, "SEND_TAG")).toBeFalsy();
    current = apply(current.state, { type: "TICK", at: 13.5 });
    expect(current.state).toMatchObject({ phase: "sending", sentAt: 13.5, waitingForSquelch: false });
    expect(effect(current.effects, "SEND_TAG")).toMatchObject({ type: "SEND_TAG", tag: "ASK", text: "Where would you stop?" });
  });

  it("debounces a 300 ms falling-edge dip instead of opening the mic", () => {
    let current = start();
    current = apply(current.state, { type: "SPEAK_START", at: 11 });
    current = apply(current.state, { type: "SPEAK_END", at: 12 });
    current = apply(current.state, { type: "TICK", at: 12.3 });
    expect(current.state.phase).toBe("speaking");
    current = apply(current.state, { type: "SPEAK_START", at: 12.3 });
    current = apply(current.state, { type: "TICK", at: 12.7 });
    expect(current.state.phase).toBe("speaking");
    current = apply(current.state, { type: "SPEAK_END", at: 13 });
    current = apply(current.state, { type: "TICK", at: 13.6 });
    expect(current.state.phase).toBe("listening");
    expect(effect(current.effects, "UNMUTE")).toBeTruthy();
  });

  it("falls back to the agent ASR transcript when a tool closes without Scribe text", () => {
    let current = listening();
    current = apply(current.state, { type: "HUMAN_COMMIT", at: 14, text: "The supporting record was missing.", source: "agent_asr" });
    current = apply(current.state, { type: "TOOL", at: 14.1, name: "log_answer", params: { reason: "paraphrase ignored" } });
    current = finish(current.state, 17);
    expect(effect(current.effects, "RESOLVE")).toMatchObject({
      type: "RESOLVE",
      result: {
        via: "tool",
        heard: "The supporting record was missing.",
        heardSource: "agent_asr",
      },
    });
  });

  it("returns an empty heard string when a tool has no verbatim transcript", () => {
    let current = listening();
    current = apply(current.state, { type: "TOOL", at: 14, name: "log_answer", params: { reason: "model summary" } });
    current = finish(current.state, 17);
    expect(effect(current.effects, "RESOLVE")).toMatchObject({
      type: "RESOLVE",
      result: { via: "tool", heard: "" },
    });
  });

  it("keeps a human commit that arrives during the closing grace period", () => {
    let current = listening();
    current = apply(current.state, { type: "TOOL", at: 14, name: "log_answer", params: {} });
    current = apply(current.state, {
      type: "HUMAN_COMMIT",
      at: 14.4,
      text: "The approval arrived after the initial check.",
    });
    current = finish(current.state, 17);
    expect(effect(current.effects, "RESOLVE")).toMatchObject({
      type: "RESOLVE",
      result: {
        via: "tool",
        heard: "The approval arrived after the initial check.",
        heardSource: "scribe",
      },
    });
    expect(effect(current.effects, "CLIP_STOP")).toMatchObject({ type: "CLIP_STOP", upload: true });
  });

  it("speaks immediately through fallback when no agent is connected", () => {
    const current = apply(initialTurnState, {
      type: "SEND",
      at: 10,
      options: { ...options, spoken: "A browser-safe line." },
      agentConnected: false,
    });
    expect(current.state).toMatchObject({ phase: "speaking", spokenBy: "fallback", fallbackRequestedAt: 10 });
    expect(effect(current.effects, "FALLBACK_SPEAK")).toMatchObject({ type: "FALLBACK_SPEAK", text: "A browser-safe line." });
    const silent = apply(current.state, { type: "TICK", at: 11.5 });
    expect(effect(silent.effects, "RESOLVE")).toMatchObject({
      type: "RESOLVE",
      result: { via: "aborted", abortReason: "silent", spoke: false },
    });
  });

  it("discards a clip for an off-record command", () => {
    let current = listening();
    current = apply(current.state, { type: "COMMAND", at: 14, command: "off_record" });
    current = finish(current.state, 17);
    expect(effect(current.effects, "CLIP_STOP")).toMatchObject({ type: "CLIP_STOP", upload: false });
    expect(effect(current.effects, "RESOLVE")).toMatchObject({
      type: "RESOLVE",
      result: { via: "aborted", command: "off_record", heard: "" },
    });
  });
});

describe("turn reducer review matrix", () => {
  it.each(["listening", "closing"] as const)(
    "discards the active clip before resolving a superseded %s turn",
    (phase) => {
      let current = listening();
      if (phase === "closing") {
        current = apply(current.state, { type: "TOOL", at: 14, name: "log_answer", params: {} });
      }
      const next = apply(current.state, {
        type: "SEND",
        at: 14.5,
        options: { ...options, text: "What is the limit?" },
      });
      expect(next.effects.slice(0, 4).map((item) => item.type)).toEqual([
        "SQUELCH",
        "MUTE",
        "CLIP_STOP",
        "RESOLVE",
      ]);
      expect(next.effects[2]).toMatchObject({ type: "CLIP_STOP", upload: false });
      expect(next.effects[3]).toMatchObject({
        type: "RESOLVE",
        result: { via: "aborted", abortReason: "superseded" },
      });
      expect(effect(next.effects, "SEND_TAG")).toBeFalsy();
    },
  );

  it("waits for and appends a trailing partial after a committed prefix", () => {
    let current = listening({ ...options, silenceCloseSecs: 2.5, timeoutSecs: 4 });
    current = apply(current.state, { type: "HUMAN_COMMIT", at: 14, text: "The reason is" });
    current = apply(current.state, { type: "HUMAN_PARTIAL", at: 15, text: "the supporting note." });
    current = apply(current.state, { type: "TICK", at: 19.49 });
    expect(current.state.phase).toBe("listening");
    current = apply(current.state, { type: "TICK", at: 19.5 });
    expect(current.state).toMatchObject({
      phase: "closing",
      close: {
        via: "scribe",
        heard: "The reason is the supporting note.",
        heardSource: "scribe",
        answeredAt: 15,
      },
    });
  });

  it("uses the latest committed evidence time for Scribe and agent-ASR answers", () => {
    for (const source of ["scribe", "agent_asr"] as const) {
      let current = listening();
      current = apply(current.state, { type: "HUMAN_COMMIT", at: 14, text: "First clause.", source });
      current = apply(current.state, { type: "HUMAN_COMMIT", at: 14.7, text: "Second clause.", source });
      current = apply(current.state, { type: "TOOL", at: 15, name: "log_answer", params: {} });
      current = finish(current.state, 18);
      expect(effect(current.effects, "RESOLVE")).toMatchObject({
        type: "RESOLVE",
        result: { answeredAt: 14.7, heardSource: source },
      });
    }
  });

  it("updates answeredAt when a late commit is accepted during tool closing", () => {
    let current = listening();
    current = apply(current.state, { type: "HUMAN_COMMIT", at: 14, text: "First clause." });
    current = apply(current.state, { type: "TOOL", at: 14.1, name: "log_answer", params: {} });
    current = apply(current.state, { type: "HUMAN_COMMIT", at: 14.8, text: "Final clause." });
    current = finish(current.state, 18);
    expect(effect(current.effects, "RESOLVE")).toMatchObject({
      type: "RESOLVE",
      result: { heard: "First clause. Final clause.", answeredAt: 14.8 },
    });
  });

  it("keeps typed text and its timestamp immutable against a late Scribe commit", () => {
    let current = listening();
    current = apply(current.state, { type: "TYPED", at: 14, text: "Typed evidence." });
    current = apply(current.state, { type: "HUMAN_COMMIT", at: 14.5, text: "Late microphone text." });
    current = finish(current.state, 17);
    expect(effect(current.effects, "RESOLVE")).toMatchObject({
      type: "RESOLVE",
      result: { via: "typed", heard: "Typed evidence.", heardSource: "typed", answeredAt: 14 },
    });
  });

  it("promotes a timeout to Scribe when verbatim text arrives during closing", () => {
    let current = listening({ ...options, timeoutSecs: 1 }, "clip-review");
    current = apply(current.state, { type: "TICK", at: 14.6 });
    expect(current.state).toMatchObject({ phase: "closing", close: { via: "timeout", heard: "" } });
    current = apply(current.state, { type: "HUMAN_COMMIT", at: 15, text: "A delayed final answer." });
    current = finish(current.state, 18);
    expect(effect(current.effects, "CLIP_STOP")).toMatchObject({ type: "CLIP_STOP", upload: true });
    expect(effect(current.effects, "RESOLVE")).toMatchObject({
      type: "RESOLVE",
      result: {
        via: "scribe",
        heard: "A delayed final answer.",
        heardSource: "scribe",
        answeredAt: 15,
        audioId: "clip-review",
      },
    });
  });

  it("records successful fallback speech start/end and result stamps", () => {
    let current = start({ ...options, watchdogSecs: 1 });
    current = apply(current.state, { type: "TICK", at: 11 });
    current = apply(current.state, { type: "SPEAK_START", at: 11.2, source: "fallback" });
    current = apply(current.state, { type: "SPEAK_END", at: 12.2 });
    current = apply(current.state, { type: "TICK", at: 12.8 });
    expect(current.state).toMatchObject({ phase: "listening", sentAt: 10, spokeAt: 11.2, askedAt: 12.8 });
    current = apply(current.state, { type: "TYPED", at: 13, text: "Answer." });
    current = finish(current.state, 16);
    expect(effect(current.effects, "RESOLVE")).toMatchObject({
      type: "RESOLVE",
      result: { spoke: true, spokenBy: "fallback", sentAt: 10, spokeAt: 11.2, askedAt: 12.8, closedAt: 16 },
    });
  });

  it("resolves a no-listen line as spoken", () => {
    let current = start({ tag: "PRAISE", text: "Nicely handled.", listen: false });
    current = apply(current.state, { type: "SPEAK_START", at: 11 });
    current = apply(current.state, { type: "SPEAK_END", at: 12 });
    current = apply(current.state, { type: "TICK", at: 12.6 });
    expect(current.state).toMatchObject({ phase: "closing", close: { via: "spoken" }, askedAt: 12.6 });
    current = finish(current.state, 15.1);
    expect(effect(current.effects, "RESOLVE")).toMatchObject({ type: "RESOLVE", result: { via: "spoken", heard: "" } });
  });

  it.each([
    { age: 0.9, spoke: false },
    { age: 1, spoke: true },
  ])("reports spoke=$spoke when cancelling after $age seconds of speech", ({ age, spoke }) => {
    let current = start();
    current = apply(current.state, { type: "SPEAK_START", at: 11 });
    current = apply(current.state, { type: "CANCEL", at: 11 + age, reason: "user" });
    expect(effect(current.effects, "RESOLVE")).toMatchObject({ type: "RESOLVE", result: { via: "aborted", spoke } });
  });

  it("moves a listening cancellation through closing and discards its clip", () => {
    let current = listening();
    current = apply(current.state, { type: "CANCEL", at: 14, reason: "paused" });
    expect(current.state).toMatchObject({ phase: "closing", close: { via: "aborted", abortReason: "paused" } });
    current = finish(current.state, 17);
    expect(current.effects).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "CLIP_STOP", upload: false }),
      expect.objectContaining({ type: "RESOLVE", result: expect.objectContaining({ via: "aborted", heard: "" }) }),
    ]));
  });

  it("recovers an old uncommitted partial as Scribe text", () => {
    let current = listening({ ...options, silenceCloseSecs: 2.5, timeoutSecs: 99 });
    current = apply(current.state, { type: "HUMAN_PARTIAL", at: 14, text: "A recovered partial." });
    current = apply(current.state, { type: "TICK", at: 18.5 });
    expect(current.state).toMatchObject({
      phase: "closing",
      close: { via: "scribe", heard: "A recovered partial.", answeredAt: 14 },
    });
  });

  it("uses eight seconds of silence after agent speech during listening", () => {
    let current = listening({ ...options, silenceCloseSecs: 2.5, timeoutSecs: 99 });
    current = apply(current.state, { type: "HUMAN_COMMIT", at: 14, text: "An answer." });
    current = apply(current.state, { type: "SPEAK_START", at: 14.2 });
    current = apply(current.state, { type: "SPEAK_END", at: 15 });
    current = apply(current.state, { type: "TICK", at: 22.99 });
    expect(current.state.phase).toBe("listening");
    current = apply(current.state, { type: "TICK", at: 23 });
    expect(current.state).toMatchObject({ phase: "closing", close: { via: "scribe" } });
  });

  it("waits for acknowledgement end and its 600 ms falling edge", () => {
    let current = listening();
    current = apply(current.state, { type: "TOOL", at: 14, name: "log_answer", params: {} });
    current = apply(current.state, { type: "SPEAK_START", at: 15 });
    current = apply(current.state, { type: "SPEAK_END", at: 16 });
    current = apply(current.state, { type: "TICK", at: 16.59 });
    expect(current.state.phase).toBe("closing");
    current = apply(current.state, { type: "TICK", at: 16.6 });
    expect(current.state.phase).toBe("idle");
  });

  it.each([
    { label: "no acknowledgement starts", options: { ...options }, closeAt: 16.5 },
    { label: "acknowledgement never ends", options: { ...options, ackMaxSecs: 3 }, closeAt: 18 },
  ])("resolves when $label", ({ label, options: turnOptions, closeAt }) => {
    void label;
    let current = listening(turnOptions);
    current = apply(current.state, { type: "TOOL", at: 14, name: "log_answer", params: {} });
    if (turnOptions.ackMaxSecs) current = apply(current.state, { type: "SPEAK_START", at: 15 });
    current = apply(current.state, { type: "TICK", at: closeAt });
    expect(current.state.phase).toBe("idle");
    expect(effect(current.effects, "RESOLVE")).toBeTruthy();
  });

  it("enforces the 20 second closing hard cap even while human commits continue", () => {
    let current = listening();
    current = apply(current.state, { type: "TOOL", at: 14, name: "log_answer", params: {} });
    current = apply(current.state, { type: "HUMAN_COMMIT", at: 33.9, text: "Still speaking." });
    current = apply(current.state, { type: "TICK", at: 34 });
    expect(current.state.phase).toBe("idle");
    expect(effect(current.effects, "RESOLVE")).toBeTruthy();
  });

  it.each([
    { via: "scribe", upload: true },
    { via: "typed", upload: true },
    { via: "timeout", upload: false },
  ] as const)("uses clip upload=$upload for $via", ({ via, upload }) => {
    let current = listening({ ...options, timeoutSecs: 1, silenceCloseSecs: 1 });
    if (via === "scribe") {
      current = apply(current.state, { type: "HUMAN_COMMIT", at: 14, text: "Verbatim." });
      current = apply(current.state, { type: "TICK", at: 15 });
    } else if (via === "typed") {
      current = apply(current.state, { type: "TYPED", at: 14, text: "Typed." });
    } else {
      current = apply(current.state, { type: "TICK", at: 14.6 });
    }
    current = finish(current.state, 18);
    expect(effect(current.effects, "CLIP_STOP")).toMatchObject({ type: "CLIP_STOP", upload });
  });
});
