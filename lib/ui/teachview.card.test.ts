import { describe, expect, it } from "vitest";
import { decisionContext, formatEuro, learnedChips, phaseLabel, replayCaption, targetOfEvent, teachKindOf, teachSub, watchingLine } from "./teachview";
import { teachMood } from "./moods";

const label = (f?: string) => (f === "costCenter" ? "cost center" : f ?? "field");

describe("teach companion card helpers", () => {
  it("treats a guard verdict as its own kind, and teach never listens", () => {
    expect(teachKindOf({ kind: "intervene", guard: true })).toBe("save-blocked");
    expect(teachKindOf({ kind: "stop" })).toBe("stop");
    expect(teachKindOf(null)).toBe("none");
    expect(teachKindOf({ kind: "weird" })).toBe("none");
    for (const k of ["predict", "intervene", "stop", "save-blocked", "praise", "novel", "none"] as const) {
      expect(teachMood({ latestKind: k, latestAgoMs: 0, isSpeaking: false, ended: false })).not.toBe("listening");
      expect(teachMood({ latestKind: k, latestAgoMs: 0, isSpeaking: true, ended: false })).not.toBe("listening");
    }
    expect(teachMood({ latestKind: teachKindOf({ kind: "intervene", guard: true }), isSpeaking: false, ended: false })).toBe("step");
  });

  it("maps events to the ERP's data-erp-target hooks and nothing else", () => {
    expect(targetOfEvent({ kind: "field_changed", field: "costCenter" })).toBe("cc");
    expect(targetOfEvent({ kind: "field_changed", field: "assetNumber" })).toBe("asset");
    expect(targetOfEvent({ kind: "field_changed", field: "notes" })).toBeNull();
    expect(targetOfEvent({ kind: "route_changed" })).toBe("route");
    expect(targetOfEvent({ kind: "save_blocked" })).toBe("save");
    expect(targetOfEvent({ kind: "invoice_opened" })).toBe("vendor");
    expect(targetOfEvent({ kind: "screen_changed" })).toBeNull();
    expect(targetOfEvent(undefined)).toBeNull();
  });

  it("builds the capsule line from real state only", () => {
    expect(watchingLine("Ada", { invoice: "4490", supplier: "Acme GmbH", amount: 7200 })).toEqual({ title: "Watching Ada · INV-4490", sub: `Acme GmbH · ${formatEuro(7200)}` });
    expect(formatEuro(7200)).toBe("€7,200.00");
    expect(watchingLine("Ada", { invoice: "4490" }).sub).toBe("Invoice open");
    expect(watchingLine("Ada", {})).toEqual({ title: "Watching Ada", sub: "Open the first invoice in your queue." });
    expect(watchingLine("Ada", null).title).toBe("Watching Ada");
  });

  it("says Not posted only for a guard verdict", () => {
    expect(teachSub({ guard: true }, "Ada", "Kim")).toBe("Not posted · Ada, learning from Kim");
    expect(teachSub({ guard: false }, "Ada", "Kim")).toBe("Ada, learning from Kim");
    expect(teachSub(undefined, "Ada", "Kim")).not.toMatch(/Not posted/);
  });

  it("keeps the honest phase copy", () => {
    expect(phaseLabel("coached")).toBe("Coached");
    expect(phaseLabel("independent")).toBe("On your own — the tutor stays quiet");
  });

  it("shows learned chips only for exercised rules, with the T3 labels", () => {
    const chips = learnedChips([
      { ruleId: "a", title: "A", label: "correct without help", status: "mastered" },
      { ruleId: "b", title: "B", label: "corrected after intervention", status: "needs_practice" },
      { ruleId: "c", title: "C", label: "not tested", status: "untested" },
    ]);
    expect(chips).toEqual([
      { id: "a", kind: "learned", text: "A · correct without help" },
      { id: "b", kind: "practice", text: "B · corrected after intervention" },
    ]);
  });

  it("captions a replay as a captured still, never a video or a voice", () => {
    expect(replayCaption("Kim", 41)).toBe("Replay · Kim's screen · 00:41 · captured still");
    expect(replayCaption("Kim")).toBe("Replay · Kim's screen · captured still");
    expect(replayCaption("Kim", 41)).not.toMatch(/voice|video/i);
  });

  it("describes only what the learner actually changed", () => {
    expect(decisionContext({ kind: "field_changed", field: "costCenter", to: "4120" }, "Ada", label)).toBe("Ada set the cost center to 4120");
    expect(decisionContext({ kind: "invoice_opened" }, "Ada", label)).toBeNull();
    expect(decisionContext(null, "Ada", label)).toBeNull();
  });
});
