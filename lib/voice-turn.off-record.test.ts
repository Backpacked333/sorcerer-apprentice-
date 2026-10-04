import { describe, expect, it } from "vitest";

import { windowOutcome } from "./capture-loop";
import { initialTurnState, reduce, withAnswerConfirmation, type TurnState } from "./voice-turn";

const reason = "The supporting record was already approved.";

function listening() {
  const options = withAnswerConfirmation({ tag: "ASK", text: "Why that route?", listen: true, recordClip: { sessionId: "test" } });
  let state = reduce(initialTurnState, { type: "SEND", at: 10, options, agentConnected: true, audioId: "clip" }).state;
  state = reduce(state, { type: "TICK", at: 10 }).state;
  state = reduce(state, { type: "SPEAK_START", at: 11, source: "agent" }).state;
  state = reduce(state, { type: "SPEAK_END", at: 13 }).state;
  state = reduce(state, { type: "TICK", at: 13.6 }).state;
  return reduce(state, { type: "HUMAN_COMMIT", at: 14, text: reason }).state;
}

describe("off-record tool precedence", () => {
  const stages: Record<string, (state: TurnState) => TurnState> = {
    listening: (state) => state,
    "closing a confirmed answer": (state) => reduce(state, { type: "TOOL", at: 15, name: "log_answer", params: { reason } }).state,
    "closing a typed answer": (state) => reduce(state, { type: "TYPED", at: 15, text: reason }).state,
    "closing a timeout": (state) => reduce(state, { type: "TICK", at: 26 }).state,
  };

  it.each(Object.entries(stages))("honors mark_off_record while %s and discards the clip", (_name, stage) => {
    const before = stage(listening());
    const at = (before.close?.startedAt ?? 14) + 0.5;
    const next = reduce(before, { type: "TOOL", at, name: "mark_off_record", params: {} });
    expect(next.state.phase).toBe("closing");
    expect(next.state.close).toMatchObject({ via: "aborted", heard: "", command: "off_record" });
    expect(next.effects).toContainEqual({ type: "MUTE" });

    const lateCommit = reduce(next.state, { type: "HUMAN_COMMIT", at: at + 1, text: reason }).state;
    const lateAnswer = reduce(lateCommit, { type: "TOOL", at: at + 1.5, name: "log_answer", params: { reason } }).state;
    const done = reduce(lateAnswer, { type: "TICK", at: at + 4 });
    expect(done.effects).toContainEqual({ type: "CLIP_STOP", upload: false, audioId: "clip" });
    const resolved = done.effects.find((effect) => effect.type === "RESOLVE");
    expect(resolved?.type).toBe("RESOLVE");
    if (resolved?.type !== "RESOLVE") throw new Error("expected the privacy request to close the turn");
    expect(resolved.result).toMatchObject({ via: "aborted", heard: "", command: "off_record" });
    expect(resolved.result.audioId).toBeUndefined();
    expect(windowOutcome(resolved.result)).toMatchObject({ outcome: "off_record", strike: true });
  });
});
