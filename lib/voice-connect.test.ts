import { afterEach, describe, expect, it, vi } from "vitest";
import { buildAgentSessionOptions, createCancellationGuard, createConnectionLifecycle, type ConnectionOutcome } from "@/components/voice";

describe("voice connection options", () => {
  it("always supplies safe dynamic-variable defaults and lets session values override them", () => {
    const options = buildAgentSessionOptions("agent_123", { dynamicVariables: { expert_name: "Ada", task: "reviewing claims" } });
    expect(options).toMatchObject({
      agentId: "agent_123",
      connectionType: "webrtc",
      dynamicVariables: { expert_name: "Ada", newhire_name: "the new hire", task: "reviewing claims" },
    });
  });
  it("omits empty overrides", () => {
    const options = buildAgentSessionOptions("agent_123", { firstMessage: "", prompt: "", language: "" });
    expect(options).not.toHaveProperty("overrides");
  });
  it("includes only non-empty overrides", () => {
    const options = buildAgentSessionOptions("agent_123", { firstMessage: "Ready when you are.", prompt: "Use this session context.", language: "en" });
    expect(options).toMatchObject({
      overrides: { agent: { firstMessage: "Ready when you are.", prompt: { prompt: "Use this session context." }, language: "en" } },
    });
  });
});

describe("connection lifecycle", () => {
  afterEach(() => vi.useRealTimers());
  function setup() {
    vi.useFakeTimers();
    const outcomes: ConnectionOutcome[] = [];
    let ended = 0;
    const lifecycle = createConnectionLifecycle({ onOutcome: (outcome) => outcomes.push(outcome), endSession: () => { ended += 1; } });
    return { lifecycle, outcomes, ended: () => ended };
  }
  it("degrades and ends a timed-out session, then ignores its late connect", async () => {
    const { lifecycle, outcomes, ended } = setup();
    const attempt = lifecycle.start(false);
    await vi.advanceTimersByTimeAsync(20_000);
    await expect(attempt.promise).resolves.toMatchObject({ kind: "degraded" });
    expect(ended()).toBe(1);
    expect(lifecycle.connected(attempt.generation)).toBe(false);
    expect(outcomes).toHaveLength(1);
  });
  it("settles an explicit disconnect immediately without degrading", async () => {
    const { lifecycle, outcomes, ended } = setup();
    const attempt = lifecycle.start(false);
    expect(lifecycle.cancel(attempt.generation)).toBe(true);
    await expect(attempt.promise).resolves.toEqual({ kind: "cancelled", generation: attempt.generation });
    expect(outcomes).toEqual([{ kind: "cancelled", generation: attempt.generation }]);
    expect(ended()).toBe(1);
  });
  it("waits for a first-message speaking falling edge", async () => {
    const { lifecycle, outcomes } = setup();
    const attempt = lifecycle.start(true);
    expect(lifecycle.connected(attempt.generation)).toBe(true);
    expect(outcomes).toEqual([]);
    lifecycle.mode(attempt.generation, "speaking");
    expect(outcomes).toEqual([]);
    lifecycle.mode(attempt.generation, "listening");
    await expect(attempt.promise).resolves.toEqual({ kind: "connected", generation: attempt.generation });
  });
  it("shares the active promise while a first message is still playing", async () => {
    const { lifecycle } = setup();
    const first = lifecycle.start(true);
    lifecycle.connected(first.generation);
    const active = lifecycle.activeAttempt();
    expect(active?.promise).toBe(first.promise);
    let resolved = false;
    active?.promise.then(() => { resolved = true; });
    await vi.advanceTimersByTimeAsync(1_000);
    expect(resolved).toBe(false);
    lifecycle.mode(first.generation, "speaking");
    lifecycle.mode(first.generation, "listening");
    await expect(active?.promise).resolves.toMatchObject({ kind: "connected" });
  });
  it("reports an error as degradation and ignores stale generations", async () => {
    const { lifecycle, outcomes, ended } = setup();
    const first = lifecycle.start(false);
    lifecycle.fail(first.generation, "permission denied");
    await expect(first.promise).resolves.toMatchObject({ kind: "degraded", reason: "permission denied" });
    const second = lifecycle.start(false);
    expect(lifecycle.connected(first.generation)).toBe(false);
    expect(outcomes.at(-1)?.kind).toBe("degraded");
    expect(ended()).toBe(1);
    lifecycle.cancel(second.generation);
  });
});

describe("transcriber cancellation guard", () => {
  it("does not construct or start fallback recognition after disable", () => {
    let cancelled = false;
    let constructed = 0;
    let started = 0;
    const guard = createCancellationGuard(() => cancelled);
    expect(guard.run(() => { constructed += 1; return "recognizer"; })).toBe("recognizer");
    cancelled = true;
    expect(guard.run(() => { constructed += 1; })).toBeUndefined();
    expect(guard.run(() => { started += 1; })).toBeUndefined();
    expect({ constructed, started }).toEqual({ constructed: 1, started: 0 });
  });
});
