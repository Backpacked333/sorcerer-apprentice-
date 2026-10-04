import { describe, expect, it } from "vitest";
import { buildCandidates, CandidateQueue, newContext } from "./curiosity";
import type { ScreenEvent } from "./events";

const claimEdit = (id: string, to: string, t = 10): ScreenEvent => ({
  id: `edit-${id}`, source: "vision", t, kind: "field_changed", subject: { type: "claim", id }, field: "cause", from: "storm", to,
});

describe("claims candidates (M4)", () => {
  it("the stepRef names the claim, never '?'", () => {
    const cs = buildCandidates(claimEdit("CLM-30412", "flood"), newContext(), 10);
    expect(cs.length).toBeGreaterThan(0);
    for (const c of cs) expect(c.stepRef).toBe("CLM-30412:cause");
    expect(cs[0].invoice).toBeUndefined();
  });
  it("a change on one claim does not replace the open why of another", () => {
    const q = new CandidateQueue();
    q.add(buildCandidates(claimEdit("CLM-30412", "flood", 10), newContext(), 10));
    q.add(buildCandidates(claimEdit("CLM-30418", "fire", 12), newContext(), 12));
    const whys = q.items.filter((c) => c.kind === "why" && c.status === "queued").map((c) => c.stepRef).sort();
    expect(whys).toEqual(["CLM-30412:cause", "CLM-30418:cause"]);
  });
  it("invoice stepRefs are unchanged", () => {
    const e: ScreenEvent = { id: "e", source: "dom", t: 1, kind: "field_changed", invoice: "4471", field: "costCenter", from: "1000", to: "2000" };
    expect(buildCandidates(e, newContext(), 1)[0].stepRef).toBe("4471:costCenter");
    expect(buildCandidates({ ...e, invoice: undefined }, newContext(), 1)[0].stepRef).toBe("?:costCenter");
  });
});
