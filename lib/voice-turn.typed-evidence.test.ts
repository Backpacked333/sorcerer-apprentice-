import { expect, it } from "vitest";
import { initialTurnState, reduce, withAnswerConfirmation } from "./voice-turn";

it.each([false, true])("discards the clip for typed evidence, including a mixed turn: %s", (mixed) => {
  const options = withAnswerConfirmation({ tag: "ASK", text: "Why this route?", listen: true, recordClip: { sessionId: "session" } });
  let state = reduce(initialTurnState, { type: "SEND", at: 10, options, agentConnected: true, audioId: "clip" }).state;
  state = reduce(state, { type: "TICK", at: 10 }).state;
  state = reduce(state, { type: "SPEAK_START", at: 11, source: "agent" }).state;
  state = reduce(state, { type: "SPEAK_END", at: 13 }).state;
  state = reduce(state, { type: "TICK", at: 13.6 }).state;
  expect(state.phase).toBe("listening");
  if (mixed) state = reduce(state, { type: "HUMAN_COMMIT", at: 14, text: "Spoken context." }).state;
  state = reduce(state, { type: "TYPED", at: 15, text: "Ask the purchasing lead." }).state;
  expect(reduce(state, { type: "TYPED", at: 16, text: "Duplicate answer." }).state).toEqual(state);
  expect(reduce(state, { type: "HUMAN_COMMIT", at: 16, text: "Late unrelated speech." }).state).toEqual(state);
  const done = reduce(state, { type: "TICK", at: 20 });
  expect(done.effects).toContainEqual({ type: "CLIP_STOP", upload: false, audioId: "clip" });
  const resolved = done.effects.find((effect) => effect.type === "RESOLVE");
  expect(resolved?.type).toBe("RESOLVE");
  if (resolved?.type === "RESOLVE") {
    expect(resolved.result.heard).toBe("Ask the purchasing lead.");
    expect(resolved.result.audioId).toBeUndefined();
  }
});
