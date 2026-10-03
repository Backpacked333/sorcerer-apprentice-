import { describe, expect, it } from "vitest";
import { buildCandidates, CandidateQueue, narrationFills, narrationMatch, newContext } from "./curiosity";
import type { ScreenEvent } from "./events";

const candidates = buildCandidates(
  {
    id: "edit-9001",
    source: "dom",
    t: 10,
    kind: "field_changed",
    invoice: "9001",
    field: "costCenter",
    from: "1000",
    to: "2000",
    state: { amount: 3200 },
  } satisfies ScreenEvent,
  { ...newContext(), valueLabels: { "2000": "Research equipment" } },
  10,
);
const why = candidates.find((candidate) => candidate.kind === "why")!;

describe("targeted narration", () => {
  it.each([
    "I put this one on hold and move over to the next",
    "This invoice needs a little more work before I continue",
  ])("does not let filler narration fill the why: %s", (text) => {
    expect(narrationFills(text, why, 12)).toBe(false);
  });

  it("requires the candidate target and a causal cue within the event window", () => {
    expect(narrationMatch("Invoice 9001 changes because the policy requires research equipment coding", why, 12)).toMatchObject({
      fills: true,
      target: "invoice",
      cue: "because",
    });
    expect(narrationFills("Invoice 9002 changes because the policy requires research equipment coding", why, 12)).toBe(false);
    expect(narrationFills("Invoice 9001 changes because the policy requires research equipment coding", why, 5)).toBe(false);
    expect(narrationFills("Invoice 9001 changes because the policy requires research equipment coding", why, 26)).toBe(false);
  });

  it("recognises labels without a scenario-specific word list", () => {
    expect(why.aliases).toContain("research");
    expect(narrationMatch("Research equipment uses 2000 because that is our policy", why, 12).target).toBe("value");
  });

  it("attributes shared narration only to the current invoice, not a grace candidate", () => {
    const context = { ...newContext(), valueLabels: { "2000": "Research equipment" } };
    const queue = new CandidateQueue(90, 18);
    queue.add([
      ...buildCandidates({ ...whyEvent("9001"), id: "edit-9001" }, context, 10),
      ...buildCandidates({ ...whyEvent("9002"), id: "edit-9002" }, context, 10),
    ]);
    queue.expire(12, "9002");
    const grace = queue.items.find((candidate) => candidate.invoice === "9001" && candidate.kind === "why")!;
    const current = queue.items.find((candidate) => candidate.invoice === "9002" && candidate.kind === "why")!;

    expect(narrationMatch("Invoice 9002 uses research equipment because that is the policy", grace, 13).fills).toBe(false);
    expect(narrationMatch("Invoice 9002 uses research equipment because that is the policy", current, 13).fills).toBe(true);
    expect(narrationMatch("This invoice uses the cost center because policy requires review", grace, 13).fills).toBe(false);
    expect(narrationMatch("This invoice uses the cost center because policy requires review", current, 13).fills).toBe(true);
  });
});

function whyEvent(invoice: string): ScreenEvent {
  return {
    id: `edit-${invoice}`,
    source: "dom",
    t: 10,
    kind: "field_changed",
    invoice,
    field: "costCenter",
    from: "1000",
    to: "2000",
    state: { amount: 3200 },
  };
}
