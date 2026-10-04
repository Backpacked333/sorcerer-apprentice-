import { describe, expect, it, vi } from "vitest";
import { buildAgentReconnectOptions, createAgentReconnectPolicy } from "@/components/voice";

describe("agent reconnect policy", () => {
  it("preserves session metadata without replaying the greeting", () => {
    expect(buildAgentReconnectOptions({
      firstMessage: "Hello again.",
      sessionStartMs: 123_000,
      keyterms: ["invoice"],
      dynamicVariables: { expert_name: "Ada" },
    })).toEqual({
      sessionStartMs: 123_000,
      keyterms: ["invoice"],
      dynamicVariables: { expert_name: "Ada" },
    });
  });

  it("retries an unexpected active-session error with bounded backoff", () => {
    vi.useFakeTimers();
    const retry = vi.fn();
    const policy = createAgentReconnectPolicy();

    expect(policy.handleDisconnect({ reason: "error", requested: true, current: true, retry })).toEqual({
      action: "retry",
      attempt: 1,
      delayMs: 750,
    });
    expect(retry).not.toHaveBeenCalled();
    vi.advanceTimersByTime(750);
    expect(retry).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });

  it("does not reconnect an intentional, agent-ended, or stale session", () => {
    const retry = vi.fn();
    const policy = createAgentReconnectPolicy();

    expect(policy.handleDisconnect({ reason: "user", requested: true, current: true, retry }).action).toBe("stop");
    expect(policy.handleDisconnect({ reason: "agent", requested: true, current: true, retry }).action).toBe("stop");
    expect(policy.handleDisconnect({ reason: "error", requested: false, current: true, retry }).action).toBe("stop");
    expect(policy.handleDisconnect({ reason: "error", requested: true, current: false, retry }).action).toBe("stop");
    expect(retry).not.toHaveBeenCalled();
  });

  it("stops after two unstable reconnects and resets only after a stable connection", () => {
    vi.useFakeTimers();
    const policy = createAgentReconnectPolicy({ stableAfterMs: 10_000 });
    const retry = vi.fn();

    expect(policy.handleDisconnect({ reason: "error", requested: true, current: true, retry })).toMatchObject({ action: "retry", attempt: 1 });
    vi.advanceTimersByTime(750);
    policy.connected();
    vi.advanceTimersByTime(9_999);
    expect(policy.handleDisconnect({ reason: "error", requested: true, current: true, retry })).toMatchObject({ action: "retry", attempt: 2 });
    vi.advanceTimersByTime(1_500);
    policy.connected();
    vi.advanceTimersByTime(9_999);
    expect(policy.handleDisconnect({ reason: "error", requested: true, current: true, retry })).toEqual({ action: "exhausted", attempt: 2 });

    policy.connected();
    vi.advanceTimersByTime(10_000);
    expect(policy.handleDisconnect({ reason: "error", requested: true, current: true, retry })).toMatchObject({ action: "retry", attempt: 1 });
    vi.useRealTimers();
  });

  it("cancels a pending retry when the user disconnects", () => {
    vi.useFakeTimers();
    const retry = vi.fn();
    const policy = createAgentReconnectPolicy();
    policy.handleDisconnect({ reason: "error", requested: true, current: true, retry });

    policy.cancel();
    vi.runAllTimers();
    expect(retry).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});
