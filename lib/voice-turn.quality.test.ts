import { describe, expect, it } from "vitest";

import { VoiceTurnAdapter } from "./voice-turn-adapter";
import { withVoiceQualityWindow, type TurnEffect } from "./voice-turn";

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

const options = { tag: "CONFIRMED", text: "Say: go ahead.", spoken: "Go ahead.", listen: false, watchdogSecs: 8 };

describe("V4 voice quality policy", () => {
  it("uses eight seconds unless the caller explicitly chooses another window", () => {
    expect(withVoiceQualityWindow({ tag: "ASK", text: "Why?" }).watchdogSecs).toBe(8);
    expect(withVoiceQualityWindow({ tag: "ASK", text: "Why?", watchdogSecs: 12 }).watchdogSecs).toBe(12);
  });

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

  it("waits the full quality window before requesting labeled fallback speech", () => {
    const h = harness();
    void h.adapter.turn(options);
    h.tick(10);
    h.tick(17.99);
    expect(h.effects.some((effect) => effect.type === "FALLBACK_SPEAK")).toBe(false);
    h.tick(18);
    expect(h.effects.at(-1)).toEqual({ type: "FALLBACK_SPEAK", text: "Go ahead." });
    expect(h.adapter.isSquelched()).toBe(true);
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
