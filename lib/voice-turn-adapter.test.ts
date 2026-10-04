import { describe, expect, it, vi } from "vitest";

import { VoiceTurnAdapter, type VoiceTurnAdapterPorts } from "./voice-turn-adapter";
import type { TurnEffect, TurnOptions, TurnResult } from "./voice-turn";

const listeningTurn: TurnOptions = { tag: "ASK", text: "What made you choose that route?", listen: true };

function harness({ connected = true, onEffect }: { connected?: boolean; onEffect?: (effect: TurnEffect) => void | Promise<void> } = {}) {
  let now = 10;
  const effects: TurnEffect[] = [];
  const phases: string[] = [];
  const errors: unknown[] = [];
  const ports: VoiceTurnAdapterPorts = {
    now: () => now,
    agentConnected: () => connected,
    applyEffect: (effect) => {
      effects.push(effect);
      return onEffect?.(effect);
    },
    onPhase: (phase) => phases.push(phase),
    onError: (error) => errors.push(error),
  };
  const adapter = new VoiceTurnAdapter(ports);
  return {
    adapter,
    effects,
    phases,
    errors,
    at(value: number) { now = value; },
    event(event: Parameters<VoiceTurnAdapter["dispatch"]>[0]) { now = event.at; adapter.dispatch(event); },
    tick(value: number) { now = value; adapter.tick(); },
  };
}

function speakingThenListening(h: ReturnType<typeof harness>) {
  h.tick(10);
  h.event({ type: "SPEAK_START", at: 11, source: "agent" });
  h.event({ type: "SPEAK_END", at: 12 });
  h.tick(12.59);
  expect(h.adapter.snapshot().phase).toBe("speaking");
  h.tick(12.6);
}

describe("VoiceTurnAdapter orchestration", () => {
  it("resolves a no-listen turn only after speech falls and the acknowledgement grace expires", async () => {
    const h = harness();
    const result = h.adapter.turn({ tag: "PRAISE", text: "Nicely handled.", listen: false });
    speakingThenListening(h);
    expect(h.adapter.snapshot().phase).toBe("closing");
    h.tick(15.1);

    await expect(result).resolves.toMatchObject({ via: "spoken", spoke: true, heard: "", askedAt: 12.6, closedAt: 15.1 });
    expect(h.effects.map((effect) => effect.type)).toEqual(expect.arrayContaining(["OPEN_GATE", "MUTE", "SEND_TAG", "RESOLVE"]));
  });

  it("uses watchdog fallback and opens listening only after fallback speech ends", async () => {
    let adapter!: VoiceTurnAdapter;
    const h = harness({
      onEffect: (effect) => {
        if (effect.type !== "FALLBACK_SPEAK") return;
        adapter.dispatch({ type: "SPEAK_START", at: 14.1, source: "fallback" });
        adapter.dispatch({ type: "SPEAK_END", at: 15 });
      },
    });
    adapter = h.adapter;
    const result = adapter.turn({ ...listeningTurn, watchdogSecs: 4 });
    h.tick(10);
    h.tick(14);
    expect(h.effects.map((effect) => effect.type)).toEqual(expect.arrayContaining(["SQUELCH", "FALLBACK_SPEAK"]));
    h.tick(15.59);
    expect(adapter.snapshot().phase).toBe("speaking");
    h.tick(15.6);
    expect(adapter.snapshot().phase).toBe("listening");
    expect(h.effects.at(-1)).toMatchObject({ type: "UNMUTE" });
    adapter.submitTyped("Fallback answer.");
    h.tick(18.1);
    await expect(result).resolves.toMatchObject({ via: "typed", spokenBy: "fallback" });
  });

  it("closes from a tool, keeps a late tool while closing, and waits for acknowledgement end", async () => {
    const h = harness();
    const result = h.adapter.turn(listeningTurn);
    speakingThenListening(h);
    h.event({ type: "HUMAN_COMMIT", at: 13, text: "The record was already approved.", source: "scribe" });
    h.event({ type: "TOOL", at: 13.1, name: "log_answer", params: { stepRef: "step-neutral" } });
    h.event({ type: "TOOL", at: 13.2, name: "log_answer", params: { stepRef: "late-neutral" } });
    h.event({ type: "SPEAK_START", at: 14, source: "agent" });
    h.event({ type: "SPEAK_END", at: 14.5 });
    h.tick(15.09);
    expect(h.adapter.snapshot().phase).toBe("closing");
    h.tick(15.1);

    await expect(result).resolves.toMatchObject({
      via: "tool",
      heard: "The record was already approved.",
      tool: { name: "log_answer", params: { stepRef: "late-neutral" } },
    });
  });

  it("closes from Scribe silence, timeout/max, and typed input", async () => {
    const scribe = harness();
    const scribeResult = scribe.adapter.turn({ ...listeningTurn, silenceCloseSecs: 2.5 });
    speakingThenListening(scribe);
    scribe.event({ type: "HUMAN_COMMIT", at: 13, text: "Scribe evidence.", source: "scribe" });
    scribe.tick(15.5);
    scribe.tick(18);
    await expect(scribeResult).resolves.toMatchObject({ via: "scribe", heard: "Scribe evidence." });

    const timeout = harness();
    const timeoutResult = timeout.adapter.turn({ ...listeningTurn, timeoutSecs: 1 });
    speakingThenListening(timeout);
    timeout.tick(13.6);
    timeout.tick(16.1);
    await expect(timeoutResult).resolves.toMatchObject({ via: "timeout", heard: "" });

    const typed = harness();
    const typedResult = typed.adapter.turn(listeningTurn);
    speakingThenListening(typed);
    typed.at(13);
    typed.adapter.submitTyped("Typed evidence.");
    typed.tick(15.5);
    await expect(typedResult).resolves.toMatchObject({ via: "typed", heard: "Typed evidence." });
  });

  it("aborts on human speech before one audible second but not after", async () => {
    const early = harness();
    const earlyResult = early.adapter.turn({ ...listeningTurn, abortOnHumanSpeech: true });
    early.tick(10);
    early.event({ type: "SPEAK_START", at: 11, source: "agent" });
    early.event({ type: "HUMAN_PARTIAL", at: 11.9, text: "one moment" });
    await expect(earlyResult).resolves.toMatchObject({ via: "aborted", abortReason: "resumed", spoke: false });

    const late = harness();
    const lateResult = late.adapter.turn({ ...listeningTurn, abortOnHumanSpeech: true });
    late.tick(10);
    late.event({ type: "SPEAK_START", at: 11, source: "agent" });
    late.event({ type: "HUMAN_PARTIAL", at: 12, text: "I can answer now" });
    expect(late.adapter.snapshot().phase).toBe("speaking");
    late.adapter.cancel("user");
    await expect(lateResult).resolves.toMatchObject({ via: "aborted", spoke: true });
  });

  it("resolves superseded, cancelled, and disconnected turns without rejecting", async () => {
    const h = harness();
    const first = h.adapter.turn(listeningTurn);
    h.tick(10);
    const second = h.adapter.turn({ ...listeningTurn, text: "What is the limit?" });
    await expect(first).resolves.toMatchObject({ via: "aborted", abortReason: "superseded" });
    h.adapter.cancel("paused");
    await expect(second).resolves.toMatchObject({ via: "aborted", abortReason: "paused" });

    const disconnected = h.adapter.turn(listeningTurn);
    h.adapter.disconnect();
    await expect(disconnected).resolves.toMatchObject({ via: "aborted", abortReason: "disconnected" });
  });

  it("contains port exceptions and keeps turn promises non-rejecting", async () => {
    const h = harness({ onEffect: (effect) => { if (effect.type === "SEND_TAG") throw new Error("sdk unavailable"); } });
    const result = h.adapter.turn(listeningTurn);
    h.tick(10);
    h.adapter.cancel("user");
    await expect(result).resolves.toMatchObject({ via: "aborted", abortReason: "user" });
    expect(h.errors).toHaveLength(1);
  });

  it("publishes phase and live partial state with session-clock event times", async () => {
    const onPhase = vi.fn();
    const h = harness();
    const adapter = new VoiceTurnAdapter({
      now: () => 42,
      agentConnected: () => true,
      applyEffect: () => {},
      onPhase,
    });
    const result = adapter.turn({ ...listeningTurn, onPhase });
    adapter.tick();
    adapter.dispatch({ type: "SPEAK_START", at: 43, source: "agent" });
    adapter.dispatch({ type: "SPEAK_END", at: 44 });
    adapter.tick(44.6);
    adapter.dispatch({ type: "HUMAN_PARTIAL", at: 45, text: "live partial" });
    expect(adapter.snapshot()).toMatchObject({ phase: "listening", partial: "live partial", lastHumanSpeechAt: 45 });
    adapter.submitTyped("done", 46);
    adapter.tick(48.5);
    await expect(result).resolves.toMatchObject({ sentAt: 42, askedAt: 44.6, answeredAt: 46, closedAt: 48.5 });
    expect(onPhase).toHaveBeenCalledWith("listening", 44.6);
  });

  it("ignores stale fallback callbacks after a replacement and keeps cancellation squelched", async () => {
    const h = harness();
    const first = h.adapter.turn(listeningTurn);
    const oldGeneration = h.adapter.currentGeneration();
    h.tick(14);
    const replacement = h.adapter.turn({ ...listeningTurn, text: "Replacement" });
    expect(h.adapter.isSquelched()).toBe(true);
    expect(h.adapter.dispatchForGeneration(oldGeneration, { type: "SPEAK_END", at: 15 })).toBe(false);
    await expect(first).resolves.toMatchObject({ abortReason: "superseded" });
    h.adapter.cancel("user", 16);
    await expect(replacement).resolves.toMatchObject({ abortReason: "user" });
  });
});
