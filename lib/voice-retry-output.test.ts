import { describe, expect, it, vi } from "vitest";
import { applyConversationGate, createAnswerRetryPlaybackGuard } from "@/components/voice";

describe("answer-retry playback", () => {
  it("finishes the original acknowledgment and synchronously gates only a distinct repeated response", () => {
    const guard = createAnswerRetryPlaybackGuard();
    const volume = vi.fn();
    expect(guard.onAgentMessage(1, "I see.", "first", true)).toBe(true);
    guard.onRejectedAnswer(1);
    expect(guard.isBlocked(1)).toBe(false);
    expect(guard.onAgentMessage(1, "I see.", "first", true)).toBe(true);
    expect(guard.onAgentMessage(1, "I see.", "retry", true)).toBe(false);
    applyConversationGate({ setVolume: volume }, !guard.isBlocked(1));
    expect(volume).toHaveBeenLastCalledWith({ volume: 0 });
    expect(guard.onAgentMessage(1, "I see.", "retry", true)).toBe(false);
  });

  it("does not suppress ordinary repeated speech without a rejected answer", () => {
    const guard = createAnswerRetryPlaybackGuard();
    guard.onAgentMessage(1, "Got it.", "first", true);
    expect(guard.onAgentMessage(1, "Got it.", "second", true)).toBe(true);
  });

  it("leaves correction failures and connection replies audible, then retires the retry", () => {
    const guard = createAnswerRetryPlaybackGuard();
    guard.onAgentMessage(1, "Got it.", "first", true);
    guard.onRejectedAnswer(1);
    expect(guard.onAgentMessage(1, "I couldn't save that answer.", "failure", true)).toBe(true);
    expect(guard.onAgentMessage(1, "Got it.", "next", true)).toBe(true);
  });

  it("does not mistake the initial question for a repeated acknowledgment", () => {
    const guard = createAnswerRetryPlaybackGuard();
    guard.onAgentMessage(1, "Why this route?", "first", false);
    guard.onRejectedAnswer(1);
    expect(guard.onAgentMessage(1, "Why this route?", "repeat", true)).toBe(true);
  });

  it("resets matching for new human input without unmuting the duplicate's tail", () => {
    const guard = createAnswerRetryPlaybackGuard();
    guard.onAgentMessage(1, "Got it.", "first", true);
    guard.onRejectedAnswer(1);
    guard.onAgentMessage(1, "Got it.", "duplicate", true);
    guard.onHumanSpeech(1);
    expect(guard.isBlocked(1)).toBe(true);
    expect(guard.onAgentMessage(1, "Got it.", "new-answer", true)).toBe(true);
    expect(guard.isBlocked(1)).toBe(false);
  });

  it("isolates turn generations and ignores stale rejections", () => {
    const guard = createAnswerRetryPlaybackGuard();
    guard.onAgentMessage(1, "Got it.", "first", true);
    guard.onRejectedAnswer(1);
    guard.onAgentMessage(1, "Got it.", "duplicate", true);
    expect(guard.isBlocked(2)).toBe(false);
    expect(guard.onAgentMessage(2, "Got it.", "new-turn", true)).toBe(true);
    guard.onRejectedAnswer(1);
    expect(guard.onAgentMessage(2, "Got it.", "new-answer", true)).toBe(true);
  });

  it("requires response identity and supports disconnect/legacy reset", () => {
    const guard = createAnswerRetryPlaybackGuard();
    guard.onAgentMessage(1, "Got it.", undefined, true);
    guard.onRejectedAnswer(1);
    expect(guard.onAgentMessage(1, "Got it.", undefined, true)).toBe(true);
    guard.onAgentMessage(1, "Got it.", "first", true);
    guard.onRejectedAnswer(1);
    guard.reset();
    expect(guard.onAgentMessage(1, "Got it.", "legacy", true)).toBe(true);
  });
});
