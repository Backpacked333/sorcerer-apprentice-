import { describe, expect, it } from "vitest";
import { MOODS, ORB_MOODS, captureMood, mapMood, ripplesOnEnter, teachMood, type CaptureMoodInput } from "./moods";

const lights = (notTyping = true, notReading = true) => ({ notTyping, notReading });
const base: CaptureMoodInput = { presence: "quiet", decision: { state: "listening", lights: lights() }, sharing: true, queued: 0 };

describe("MOODS table", () => {
  it("has every mood with complete specs and k = 0.1 applied", () => {
    expect(ORB_MOODS).toHaveLength(13);
    for (const m of ORB_MOODS) {
      const s = MOODS[m];
      expect(s.label.length).toBeGreaterThan(0);
      expect(s.base).toMatch(/gradient/);
      expect(s.rim.colors.length).toBeGreaterThanOrEqual(5);
      expect(s.tint).toHaveLength(2);
      expect(s.rim.opacity).toBeLessThanOrEqual(1);
      expect(s.kindColor).toMatch(/^#/);
    }
    expect(MOODS.quiet.rim.opacity).toBeCloseTo(0.5 * 0.46);
    expect(MOODS.understood.glow).toBeCloseTo(0.05);
    expect(MOODS.notice.swirl).toBeCloseTo(0.072);
    expect(MOODS.asking.halo).toBeCloseTo(0.95 * 0.595);
    expect(MOODS.understood.raw.swirl).toBe(0.95);
  });
  it("matches key design values", () => {
    expect(MOODS.listening.anim).toMatch(/^tc-talk 1\.1s/);
    expect(MOODS.off.anim).toBe("none");
    expect(MOODS.holding.badge).toBe(true);
    expect(MOODS.holding.halo).toBe(0);
    expect(MOODS.typing.rim.speed).toBe(20);
    expect(MOODS.quiet.rim.speed).toBe(9);
    expect(MOODS.asking.kindColor).toBe("#a35f00");
    expect(MOODS.step.kindColor).toBe("#b4501f");
  });
  it("ripples only on entry to attention moods", () => {
    expect(ripplesOnEnter("quiet", "asking")).toBe(true);
    expect(ripplesOnEnter("asking", "asking")).toBe(false);
    expect(ripplesOnEnter("quiet", "typing")).toBe(false);
    for (const m of ["notice", "asking", "understood", "step", "heard"] as const) expect(MOODS[m].ripple).toBe(true);
  });
});

describe("captureMood priority", () => {
  it("off-record beats everything", () => {
    expect(captureMood({ ...base, presence: "off-record", understoodAgoMs: 10, noticeAgoMs: 10 })).toBe("off");
  });
  it("asking > listening > understood > heard > notice", () => {
    expect(captureMood({ ...base, presence: "asking", understoodAgoMs: 10 })).toBe("asking");
    expect(captureMood({ ...base, presence: "listening", understoodAgoMs: 10 })).toBe("listening");
    expect(captureMood({ ...base, understoodAgoMs: 100, heardAgoMs: 100, noticeAgoMs: 100 })).toBe("understood");
    expect(captureMood({ ...base, heardAgoMs: 100, noticeAgoMs: 100 })).toBe("heard");
    expect(captureMood({ ...base, noticeAgoMs: 100, decision: { state: "listening", lights: lights(false) } })).toBe("notice");
  });
  it("one-shot moods expire", () => {
    expect(captureMood({ ...base, understoodAgoMs: 3400 })).toBe("quiet");
    expect(captureMood({ ...base, heardAgoMs: 4000 })).toBe("quiet");
    expect(captureMood({ ...base, noticeAgoMs: 2500 })).toBe("quiet");
    expect(captureMood({ ...base, noticeAgoMs: -5 })).toBe("quiet");
  });
  it("typing > reading > pausing > quiet", () => {
    expect(captureMood({ ...base, decision: { state: "waiting", lights: lights(false, false) }, queued: 1 })).toBe("typing");
    expect(captureMood({ ...base, decision: { state: "waiting", lights: lights(true, false) }, queued: 1 })).toBe("reading");
    expect(captureMood({ ...base, decision: { state: "waiting", lights: lights() }, queued: 1 })).toBe("pausing");
    expect(captureMood({ ...base, decision: { state: "waiting", lights: lights() }, queued: 0 })).toBe("quiet");
    expect(captureMood({ ...base, decision: null })).toBe("quiet");
  });
  it("does not claim to watch when nothing is shared", () => {
    expect(captureMood({ ...base, sharing: false, decision: { state: "waiting", lights: lights(false) }, queued: 2 })).toBe("quiet");
  });
});

describe("mapMood", () => {
  const m = { phase: "idle" as const, isSpeaking: false, debriefOn: false, confirmed: false };
  it("confirmed wins", () => {
    expect(mapMood({ ...m, confirmed: true, isSpeaking: true, debriefOn: true })).toBe("correct");
    expect(mapMood({ ...m, phase: "confirmed" })).toBe("correct");
  });
  it("a fresh filled slot shows understood", () => {
    expect(mapMood({ ...m, phase: "asking", debriefOn: true, filledAgoMs: 500 })).toBe("understood");
    expect(mapMood({ ...m, phase: "asking", debriefOn: true, filledAgoMs: 5000 })).toBe("listening");
  });
  it("teach-back is understood; speaking is asking; open mic is listening", () => {
    expect(mapMood({ ...m, phase: "teachback", isSpeaking: true, debriefOn: true })).toBe("understood");
    expect(mapMood({ ...m, phase: "asking", isSpeaking: true, debriefOn: true })).toBe("asking");
    expect(mapMood({ ...m, debriefOn: true })).toBe("listening");
    expect(mapMood(m)).toBe("quiet");
  });
});

describe("teachMood", () => {
  const t = { isSpeaking: false, ended: false };
  it("maps decision kinds", () => {
    expect(teachMood({ ...t, latestKind: "predict" })).toBe("asking");
    expect(teachMood({ ...t, latestKind: "intervene" })).toBe("step");
    expect(teachMood({ ...t, latestKind: "stop" })).toBe("step");
    expect(teachMood({ ...t, latestKind: "save-blocked", latestAgoMs: 60000 })).toBe("step");
    expect(teachMood({ ...t, latestKind: "praise", latestAgoMs: 100 })).toBe("correct");
    expect(teachMood({ ...t, latestKind: "novel", latestAgoMs: 100 })).toBe("notice");
    expect(teachMood({ ...t, latestKind: "praise", latestAgoMs: 9000 })).toBe("quiet");
    expect(teachMood(t)).toBe("quiet");
  });
  it("ended wins", () => {
    expect(teachMood({ ...t, ended: true, latestKind: "intervene" })).toBe("understood");
  });
  it("never returns listening", () => {
    const kinds = [undefined, null, "predict", "intervene", "stop", "save-blocked", "praise", "novel", "none", "weird"];
    for (const latestKind of kinds)
      for (const isSpeaking of [true, false])
        for (const ended of [true, false])
          for (const latestAgoMs of [undefined, 0, 1000, 99999])
            expect(teachMood({ latestKind, isSpeaking, ended, latestAgoMs })).not.toBe("listening");
  });
});
