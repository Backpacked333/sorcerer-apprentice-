import { describe, expect, it } from "vitest";
import { dedupeConfirmedBy, evidenceBadge, headlineCounts, lowConfidenceLine } from "./mapview";

describe("map view helpers", () => {
  it("counts recorded steps until a canonical summary exists", () => {
    const steps = [{ judgment: true, guardrails: [{}] }, { judgment: false, guardrails: [] }, { judgment: true, guardrails: [{}, {}] }];
    expect(headlineCounts({ steps })).toBe("3 recorded steps · 2 judgment calls · 3 guardrails");
    expect(headlineCounts({ steps, canonical: { steps: 7, judgment: 3, guardrails: 4 } })).toBe("7 steps · 3 judgment calls · 4 guardrails");
  });

  it("falls back from an evidence field to the quote source", () => {
    expect(evidenceBadge({ evidence: "described", source: "live" })).toBe("described");
    expect(evidenceBadge({ source: "debrief" })).toBe("described");
    expect(evidenceBadge({ source: "live" })).toBe("demonstrated");
    expect(evidenceBadge(null)).toBeUndefined();
  });

  it("de-duplicates who confirmed a rule", () => {
    expect(dedupeConfirmedBy(["Sabine", "Sabine", "AP lead"])).toEqual(["Sabine", "AP lead"]);
  });

  it("says a low-confidence rule has no quote, and does not score it", () => {
    expect(lowConfidenceLine("low")).toBe("No quote backs this yet");
    expect(lowConfidenceLine("high")).toBeNull();
    expect(lowConfidenceLine("low")).not.toMatch(/\d|confidence/i);
  });
});
