import { describe, expect, it } from "vitest";
import { compileDeterministic, stepRefOf } from "./compile/steps";
import { buildCandidates, newContext } from "./curiosity";
import { emptySession, type ScreenEvent } from "./events";

const claimEdit = (id: string, to: string, t: number): ScreenEvent => ({
  id: `e-${id}-${t}`, source: "vision", t, kind: "field_changed", subject: { type: "claim", id }, field: "cause", from: "", to,
});

describe("claims in the Work Map (M4)", () => {
  it("two claims with the same field change give two steps, in claim wording", () => {
    const log = emptySession("claims-test", "capture", "Triage claims", "Expert");
    log.events = [claimEdit("CLM-30412", "flood", 5), claimEdit("CLM-30418", "flood", 20)];
    const map = compileDeterministic(log);
    expect(map.steps.map((s) => s.title)).toEqual(["Set cause of loss on claim CLM-30412", "Set cause of loss on claim CLM-30418"]);
    for (const s of map.steps) {
      expect(s.title).not.toMatch(/invoice/i);
      expect(s.invoice).toBeUndefined();
    }
    expect(stepRefOf(log.events[0])).toBe("CLM-30412:cause");
  });
  it("invoice steps keep their wording and refs", () => {
    const log = emptySession("inv-test", "capture", "Review invoices", "Expert");
    log.events = [{ id: "i1", source: "dom", t: 3, kind: "field_changed", invoice: "4471", field: "costCenter", from: "1000", to: "2000" }];
    const map = compileDeterministic(log);
    expect(map.steps[0].title).toBe("Code invoice 4471 to a cost center");
    expect(map.steps[0].invoice).toBe("4471");
    expect(stepRefOf(log.events[0])).toBe("4471:costCenter");
  });
  it("curiosity candidates carry the same stepRef the compiler joins on", () => {
    const events: ScreenEvent[] = [
      claimEdit("CLM-30412", "flood", 5),
      { id: "i1", source: "dom", t: 3, kind: "field_changed", invoice: "4471", field: "costCenter", from: "1000", to: "2000" },
    ];
    for (const e of events) {
      const candidates = buildCandidates(e, newContext(), 0);
      expect(candidates.length).toBeGreaterThan(0);
      for (const c of candidates) expect(c.stepRef).toBe(stepRefOf(e));
    }
  });
});
