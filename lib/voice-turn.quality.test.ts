import { describe, expect, it } from "vitest";

import { VoiceTurnAdapter } from "./voice-turn-adapter";
import type { TurnEffect } from "./voice-turn";

function harness(connected = true) {
  let now = 10;
  const effects: TurnEffect[] = [];
  const adapter = new VoiceTurnAdapter({
    now: () => now,
    agentConnected: () => connected,
    applyEffect: (effect) => { effects.push(effect); },
  });
  return { adapter, effects, tick(at: number) { now = at; adapter.tick(); } };
}

const options = { tag: "CONFIRMED", text: "Say: go ahead.", spoken: "Go ahead.", listen: false, watchdogSecs: 8, fallbackOnTimeout: false };

describe("V4 voice quality policy", () => {
  it("accepts speech after four seconds without changing voice", async () => {
    const h = harness();
    const result = h.adapter.turn(options);
    h.tick(10);
    h.tick(14.6);
    expect(h.adapter.snapshot().phase).toBe("waiting_for_speech");
    h.adapter.dispatch({ type: "SPEAK_START", at: 15, source: "agent" });
    h.adapter.dispatch({ type: "SPEAK_END", at: 16 });
    h.tick(16.6);
    h.tick(19.1);
    await expect(result).resolves.toMatchObject({ spoke: true, spokenBy: "agent", via: "spoken" });
    expect(h.effects.some((effect) => effect.type === "FALLBACK_SPEAK")).toBe(false);
  });

  it("resolves a silent turn honestly, squelches late audio and permits the next agent turn", async () => {
    const h = harness();
    const result = h.adapter.turn(options);
    h.tick(10);
    h.tick(18);
    expect(h.effects.some((effect) => effect.type === "FALLBACK_SPEAK")).toBe(false);
    await expect(result).resolves.toMatchObject({ spoke: false, via: "aborted", abortReason: "silent" });
    expect(h.adapter.snapshot().phase).toBe("idle");
    expect(h.adapter.isSquelched()).toBe(true);
    expect(h.effects.some((effect) => effect.type === "FALLBACK_SPEAK")).toBe(false);
    h.adapter.dispatch({ type: "SPEAK_START", at: 18.1, source: "agent" });
    expect(h.adapter.isSquelched()).toBe(true);
    const next = h.adapter.turn(options);
    expect(h.adapter.isSquelched()).toBe(false);
    expect(h.effects.at(-1)).toMatchObject({ type: "SEND_TAG", tag: "CONFIRMED" });
    h.adapter.cancel();
    await expect(next).resolves.toMatchObject({ abortReason: "user" });
  });

  it("preserves immediate, labeled keyless browser speech", async () => {
    const h = harness(false);
    const result = h.adapter.turn(options);
    expect(h.effects.at(-1)).toEqual({ type: "FALLBACK_SPEAK", text: "Go ahead." });
    h.adapter.dispatch({ type: "SPEAK_START", at: 10.1, source: "fallback" });
    h.adapter.dispatch({ type: "SPEAK_END", at: 11.1 });
    h.tick(11.7);
    h.tick(14.2);
    await expect(result).resolves.toMatchObject({ spoke: true, spokenBy: "fallback", via: "spoken" });
  });
});
