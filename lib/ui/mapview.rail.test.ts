import { describe, expect, it } from "vitest";
import {
  frameSrc,
  mmssOf,
  newlyFilled,
  quoteCaption,
  railHeadline,
  railMeta,
  slotEyebrow,
  slotSegments,
  slotSub,
  slotTag,
  splitSentences,
  stepHeading,
  teachbackMeta,
} from "./mapview";

describe("work map rail", () => {
  it("formats the step time and the change it made", () => {
    expect(railMeta({ index: 1, screenMoment: { t: 41 }, action: { field: "costCenter", from: "4711", to: "0400" } })).toBe("00:41 · 4711 → 0400");
    expect(railMeta({ index: 5, invoice: "4473", screenMoment: { t: 205 }, action: { type: "hold" } })).toBe("03:25 · INV-4473");
    expect(railMeta({ index: 0, screenMoment: { t: 12 }, action: { type: "open" } })).toBe("00:12");
    expect(railMeta({ index: 0, screenMoment: { t: 3 }, action: { field: "route", to: "x" } })).toBe("00:03 · empty → x");
  });

  it("counts steps and judgment calls from the map", () => {
    expect(railHeadline([{ judgment: true }, { judgment: false }, { judgment: true }])).toBe("3 steps · 2 judgment calls");
    expect(railHeadline([{ judgment: true }])).toBe("1 step · 1 judgment call");
    expect(stepHeading({ index: 5, judgment: true }, 10)).toBe("Step 6 of 10 · Judgment");
    expect(stepHeading({ index: 0 }, 10)).toBe("Step 1 of 10");
  });

  it("clamps and guards mm:ss", () => {
    expect(mmssOf(0)).toBe("00:00");
    expect(mmssOf(3725)).toBe("62:05");
    expect(mmssOf(undefined)).toBe("--:--");
    expect(mmssOf(Number.NaN)).toBe("--:--");
  });

  it("accepts frames that only have a url, or only a data url", () => {
    expect(frameSrc({ url: "/f.jpg" })).toBe("/f.jpg");
    expect(frameSrc({ dataUrl: "data:x" })).toBe("data:x");
    expect(frameSrc({})).toBeUndefined();
    expect(frameSrc(null)).toBeUndefined();
  });
});

describe("open questions", () => {
  it("tags a slot by where its answer really came from", () => {
    expect(slotTag({ status: "open" })).toBe("open");
    expect(slotTag({ status: "skipped" })).toBe("skipped");
    expect(slotTag({ status: "filled", filledBy: { source: "debrief" } })).toBe("answered in debrief");
    expect(slotTag({ status: "filled", filledBy: { source: "live" } })).toBe("answered live");
    expect(slotTag({ status: "filled", filledBy: { source: "narration" } })).toBe("answered live");
    expect(slotTag({ status: "filled" })).toBe("answered");
  });

  it("keeps slot order in the segmented bar", () => {
    expect(slotSegments([{ status: "open" }, { status: "filled" }, { status: "skipped" }])).toEqual(["open", "filled", "skipped"]);
  });

  it("builds the companion eyebrow and sub from the slot only", () => {
    const steps = [{ id: "s1", index: 0 }, { id: "s6", index: 5 }];
    expect(slotEyebrow({ kind: "exception", stepId: "s6" }, steps)).toBe("EXCEPTION · STEP 6");
    expect(slotEyebrow({ kind: "novel" }, steps)).toBe("NOVEL");
    expect(slotSub("novel")).toBe("A case I haven't seen");
    expect(slotSub("escalation")).toBe("A rule I'm unsure about");
    expect(slotSub("reason")).toBe("Not answered during the task");
  });

  it("detects the slot that was just filled", () => {
    const prev = [{ id: "a", status: "open" }, { id: "b", status: "open" }];
    const next = [{ id: "a", status: "filled" }, { id: "b", status: "open" }];
    expect(newlyFilled(prev, next)).toEqual(["a"]);
    expect(newlyFilled(next, next)).toEqual([]);
    expect(newlyFilled([], next)).toEqual([]);
  });
});

describe("quotes and teach-back", () => {
  it("captions a verbatim quote with its real source", () => {
    expect(quoteCaption("Sabine", { source: "narration", t: 207 })).toBe("Sabine · said while working · 03:27");
    expect(quoteCaption("Sabine", { source: "live", t: 49 })).toBe("Sabine · live answer · 00:49");
    expect(quoteCaption("Sabine", { source: "debrief" })).toBe("Sabine · in the debrief");
  });

  it("splits sentences and reports counts, never a percentage", () => {
    expect(splitSentences("One. Two? Three!")).toEqual(["One.", "Two?", "Three!"]);
    const meta = teachbackMeta({ text: "a b c d e", sure: ["x"], unsure: [] });
    expect(meta).toBe("5 words · about 2 s · 1 confident · 0 unsure");
    expect(meta).not.toMatch(/%/);
  });
});
