import { describe, expect, it } from "vitest";
import { initialTurnState, reduce, type TurnEvent, type TurnResult } from "./voice-turn";

const question = "When would you stop here and ask someone instead?";
function run(events: TurnEvent[]): TurnResult {
  let state = initialTurnState;
  for (const event of events) {
    const next = reduce(state, event);
    state = next.state;
    const resolved = next.effects.find((effect) => effect.type === "RESOLVE");
    if (resolved?.type === "RESOLVE") return resolved.result;
  }
  throw new Error("Turn did not resolve");
}
const start: TurnEvent[] = [
  { type: "SEND", at: 257.219, options: { tag: "ASK", text: question, listen: true }, agentConnected: true },
  { type: "SPEAK_START", at: 257.897, source: "agent" },
];

describe("partial question transcript integrity", () => {
  it.each(["paused", "disconnected", "user"] as const)("does not store full requested text after %s cuts off speech", (reason) => {
    const result = run([...start, { type: "CANCEL", at: 258.433, reason }]);
    expect(result).toMatchObject({ via: "aborted", sentAt: 257.219, spokeAt: 257.897, closedAt: 258.433, spoke: false });
    expect(result.spokenText).toBeUndefined();
  });

  it("does not equate the one-second audibility threshold with a completed question", () => {
    const result = run([...start, { type: "CANCEL", at: 260, reason: "paused" }]);
    expect(result.spoke).toBe(true);
    expect(result.spokenText).toBeUndefined();
  });

  it("preserves completed question text and an ordered interval when paused while listening", () => {
    const result = run([
      ...start,
      { type: "SPEAK_END", at: 261 },
      { type: "TICK", at: 261.6 },
      { type: "CANCEL", at: 263, reason: "paused" },
      { type: "TICK", at: 266 },
    ]);
    expect(result.spokenText).toBe(question);
    expect(result.askedAt).toBeGreaterThan(result.spokeAt!);
  });

  it("does not keep a superseded partial utterance as a full transcript", () => {
    const result = run([...start, { type: "SEND", at: 258.433, options: { tag: "ASK", text: "Next question", listen: true }, agentConnected: true }]);
    expect(result).toMatchObject({ via: "aborted", abortReason: "superseded" });
    expect(result.spokenText).toBeUndefined();
  });
});
