import { describe, expect, it } from "vitest";

import { initialTurnState, reduce, withAnswerConfirmation, type TurnOptions, type TurnState } from "./voice-turn";

const question = withAnswerConfirmation({ tag: "ASK", text: "Why that route?", listen: true, recordClip: { sessionId: "test" } });
const reason = "The supporting record was already approved.";
const background = "Would you like some coffee?";
const log = { type: "TOOL" as const, at: 17, name: "log_answer" as const, params: { reason } };

function listening(options: TurnOptions = question, source: "agent" | "fallback" = "agent") {
  let state = reduce(initialTurnState, { type: "SEND", at: 10, options, agentConnected: source === "agent", audioId: "clip" }).state;
  state = reduce(state, { type: "TICK", at: 10 }).state;
  state = reduce(state, { type: "SPEAK_START", at: 11, source }).state;
  state = reduce(state, { type: "SPEAK_END", at: 13 }).state;
  state = reduce(state, { type: "TICK", at: 13.6 }).state;
  expect(state.phase).toBe("listening");
  return state;
}

function commit(state: TurnState, text: string, at = 14, source: "scribe" | "agent_asr" = "scribe") {
  return reduce(state, { type: "HUMAN_COMMIT", at, text, source }).state;
}

describe("agent answer confirmation", () => {
  it("defaults only listening ASK/DEBRIEF turns to log_answer", () => {
    for (const tag of ["ASK", "DEBRIEF"]) {
      expect(withAnswerConfirmation({ tag, text: "Why?", listen: true }).answerTool).toBe("log_answer");
    }
    expect(withAnswerConfirmation({ ...question, answerTool: "confirm_teachback" }).answerTool).toBe("confirm_teachback");
    expect(withAnswerConfirmation({ tag: "ASK", text: "Why?" }).answerTool).toBeUndefined();
    expect(withAnswerConfirmation({ tag: "INTERVENE", text: "Hold on.", listen: true }).answerTool).toBeUndefined();
  });

  it.each(["scribe", "agent_asr"] as const)("does not accept unconfirmed %s or upload its clip", (source) => {
    let state = commit(listening(), background, 14, source);
    state = reduce(state, { type: "TICK", at: 16.5 }).state;
    expect(state.phase).toBe("listening");
    state = reduce(state, { type: "TICK", at: 26 }).state;
    expect(state.close).toMatchObject({ via: "timeout", heard: "" });
    state = commit(state, background, 27, source);
    const done = reduce(state, { type: "TICK", at: 29.5 });
    expect(done.effects).toContainEqual({ type: "CLIP_STOP", upload: false, audioId: "clip" });
    expect(done.effects).toContainEqual(expect.objectContaining({ type: "RESOLVE", result: expect.objectContaining({ via: "timeout", heard: "" }) }));
  });

  it("keeps listening through a clarification, then accepts only the logged verbatim answer", () => {
    let state = commit(listening(), background);
    state = reduce(state, { type: "SPEAK_START", at: 15 }).state;
    state = reduce(state, { type: "TICK", at: 28 }).state;
    expect(state.phase).toBe("listening");
    state = reduce(state, { type: "SPEAK_END", at: 29 }).state;
    state = commit(state, reason, 30);
    state = reduce(state, { ...log, at: 31 }).state;
    expect(state.close).toMatchObject({ via: "tool", heard: reason, heardSource: "scribe", answeredAt: 30 });
  });

  it("requires the matching tool and never substitutes a model paraphrase for evidence", () => {
    let state = commit(listening(), reason);
    state = reduce(state, { ...log, name: "show_replay" }).state;
    expect(state.phase).toBe("listening");
    state = reduce(state, { ...log, params: { reason: "A model invented this reason." } }).state;
    expect(state.close).toMatchObject({ via: "tool", heard: "" });
  });

  it("accepts exact provider ASR when Scribe differs", () => {
    let state = commit(listening(), "Different transcription.");
    state = commit(state, reason, 15, "agent_asr");
    state = reduce(state, log).state;
    expect(state.close).toMatchObject({ via: "tool", heard: reason, heardSource: "agent_asr" });
  });

  it("allows a late matching tool or late transcript but not unrelated late text", () => {
    let state = commit(listening(), reason);
    state = reduce(state, { type: "TICK", at: 26 }).state;
    state = reduce(state, { ...log, at: 27 }).state;
    expect(state.close).toMatchObject({ via: "tool", heard: reason, answeredAt: 14 });
    let earlyTool = reduce(listening(), log).state;
    earlyTool = commit(earlyTool, background, 17.5);
    expect(earlyTool.close?.heard).toBe("");
    earlyTool = commit(earlyTool, reason, 18);
    expect(earlyTool.close).toMatchObject({ via: "tool", heard: reason });
  });

  it("bounds repeated noise and stalled partials without recovering them as answers", () => {
    let state = listening({ ...question, maxSecs: 20 });
    state = reduce(state, { type: "HUMAN_PARTIAL", at: 14, text: background }).state;
    state = reduce(state, { type: "TICK", at: 18.5 }).state;
    expect(state.phase).toBe("listening");
    state = commit(state, background, 32);
    state = reduce(state, { type: "TICK", at: 33.6 }).state;
    expect(state.close).toMatchObject({ via: "timeout", heard: "" });
  });

  it("preserves explicit typed answers and privacy commands against late tools", () => {
    for (const event of [{ type: "TYPED" as const, at: 14, text: reason }, { type: "COMMAND" as const, at: 14, command: "off_record" as const }]) {
      const closed = reduce(listening(), event).state;
      expect(reduce(closed, log).state).toEqual(closed);
      expect(commit(closed, background, 15)).toEqual(closed);
    }
  });

  it.each(["fallback", "legacy"])("preserves %s transcript completion", (mode) => {
    const opts = mode === "legacy" ? { ...question, answerTool: undefined } : question;
    let state = commit(listening(opts, mode === "fallback" ? "fallback" : "agent"), reason);
    state = reduce(state, { type: "TICK", at: 16.5 }).state;
    expect(state.close).toMatchObject({ via: "scribe", heard: reason });
  });
});
