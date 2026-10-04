import { expect, it } from "vitest";
import { answerToolEvidenceRejection, initialTurnState, reduce, withAnswerConfirmation, type TurnEvent } from "./voice-turn";

function listening() {
  const options = withAnswerConfirmation({ tag: "ASK", text: "Why this route?", listen: true, recordClip: { sessionId: "session" } });
  let state = reduce(initialTurnState, { type: "SEND", at: 10, options, agentConnected: true, audioId: "clip" }).state;
  state = reduce(state, { type: "TICK", at: 10 }).state;
  state = reduce(state, { type: "SPEAK_START", at: 11, source: "agent" }).state;
  state = reduce(state, { type: "SPEAK_END", at: 13 }).state;
  return reduce(state, { type: "TICK", at: 13.6 }).state;
}

it.each(["scribe", "agent_asr"] as const)("Done latches committed %s speech and rejects late replacements", (source) => {
  const text = "Ask the purchasing lead.";
  let state = reduce(listening(), { type: "HUMAN_COMMIT", at: 15, startedAt: 14, text, source }).state;
  state = reduce(state, { type: "ACCEPT_SPEECH", at: 15.2 }).state;
  const events: TurnEvent[] = [
    { type: "HUMAN_COMMIT", at: 16, text: "Late unrelated words." },
    { type: "TYPED", at: 16, text: "Replace it." },
    { type: "TOOL", at: 16, name: "log_answer", params: { reason: "purchasing lead" } },
    { type: "ACCEPT_SPEECH", at: 16 },
  ];
  for (const event of events) expect(reduce(state, event).state).toEqual(state);
  expect(answerToolEvidenceRejection(state, { name: "log_answer", params: { reason: text } })).toContain("not_logged");
  const done = reduce(state, { type: "TICK", at: 20 });
  expect(done.effects).toContainEqual({ type: "CLIP_STOP", upload: true, audioId: "clip" });
  expect(done.effects).toContainEqual({ type: "RESOLVE", result: expect.objectContaining({ heard: text, heardSource: source, via: "scribe", acceptedByUser: true, audioId: "clip", answerStartedAt: 14, answeredAt: 15 }) });
});

it("does not promote partial or pre-listening evidence on Done", () => {
  let state = { ...listening(), provisionalCommit: "Too early." };
  state = reduce(state, { type: "HUMAN_PARTIAL", at: 14, text: "Not finalized." }).state;
  state = reduce(state, { type: "ACCEPT_SPEECH", at: 15 }).state;
  const done = reduce(state, { type: "TICK", at: 20 });
  expect(done.effects).toContainEqual({ type: "CLIP_STOP", upload: false, audioId: "clip" });
  expect(done.effects).toContainEqual({ type: "RESOLVE", result: expect.objectContaining({ heard: "", via: "aborted" }) });
});

it.each(["command", "tool"])("off-record %s overrides Done's accepted speech", (source) => {
  let state = reduce(listening(), { type: "HUMAN_COMMIT", at: 15, startedAt: 14, text: "Private answer." }).state;
  state = reduce(state, { type: "ACCEPT_SPEECH", at: 15.2 }).state;
  state = reduce(state, source === "command" ? { type: "COMMAND", at: 16, command: "off_record" } : { type: "TOOL", at: 16, name: "mark_off_record", params: {} }).state;
  const done = reduce(state, { type: "TICK", at: 20 });
  expect(done.effects).toContainEqual({ type: "CLIP_STOP", upload: false, audioId: "clip" });
  expect(done.effects).toContainEqual({ type: "RESOLVE", result: expect.objectContaining({ heard: "", via: "aborted", command: "off_record" }) });
});
