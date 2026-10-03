import { describe, expect, it } from "vitest";
import { WorkMapSchema } from "../workmap";
import { pickSample } from "./landing";

const map = WorkMapSchema.parse({
  sessionId: "demo_old", task: "Check a label", expert: { name: "Alex" }, privacy: {}, confirmedAt: 100,
  steps: [{ id: "check", index: 0, title: "Check the label", judgment: false, screenMoment: { t: 1 }, action: { type: "open" }, decision: "Inspect the label" }],
  rules: [], slots: [],
});
const candidate = { id: "demo_old", mode: "capture" as const, startedAt: 1, map };

describe("pickSample", () => {
  it("picks the newest confirmed sample by session time without mutating the list", () => {
    const newer = { ...candidate, id: "demo_new", startedAt: 2, map: { ...map, confirmedAt: 50 } };
    const candidates = [candidate, newer];
    expect(pickSample(candidates)).toBe(newer);
    expect(candidates).toEqual([candidate, newer]);
  });

  it.each([
    { ...candidate, id: "real_capture", startedAt: 3 },
    { ...candidate, mode: "teach" as const, startedAt: 3 },
    { ...candidate, map: undefined, startedAt: 3 },
    { ...candidate, map: { ...map, confirmedAt: undefined }, startedAt: 3 },
    { ...candidate, map: { ...map, steps: [] }, startedAt: 3 },
  ])("ignores an ineligible candidate: %j", (ineligible) => {
    expect(pickSample([ineligible, candidate])).toBe(candidate);
    expect(pickSample([ineligible])).toBeUndefined();
  });

  it("returns undefined when no sessions exist", () => {
    expect(pickSample([])).toBeUndefined();
  });
});
