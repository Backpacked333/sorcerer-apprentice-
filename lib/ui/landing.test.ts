import { describe, expect, it } from "vitest";
import { pickSample } from "./landing";

describe("pickSample", () => {
  it("returns the newest confirmed demo session", () => {
    expect(pickSample([
      { id: "demo_old", startedAt: 1, confirmedAt: 10 },
      { id: "demo_new", startedAt: 5, confirmedAt: 9 },
      { id: "live", startedAt: 9, confirmedAt: 9 },
      { id: "demo_open", startedAt: 8, confirmedAt: null },
    ])).toBe("demo_new");
  });

  it("returns undefined when nothing is confirmed", () => {
    expect(pickSample([{ id: "demo_open", startedAt: 1, confirmedAt: null }])).toBeUndefined();
    expect(pickSample([])).toBeUndefined();
  });
});
