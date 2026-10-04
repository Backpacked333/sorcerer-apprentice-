import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./store", () => ({
  getSession: vi.fn(), getMap: vi.fn(), saveSession: vi.fn(), saveMap: vi.fn(),
}));
vi.mock("./erp", async (original) => ({
  ...await original<typeof import("./erp")>(), resetErp: vi.fn(), disarmTeachGuard: vi.fn(),
}));

import { seedDemo } from "./seed";
import { saveMap, saveSession } from "./store";
import { confirmationIssues } from "./confirmation";

describe("scripted sample confirmation boundary", () => {
  beforeEach(() => vi.resetAllMocks());

  it("provides a screen moment for every step and satisfies the real confirmation gate", async () => {
    await seedDemo({ ifMissing: true });
    const maps = vi.mocked(saveMap).mock.calls.map(([map]) => map);
    for (const map of maps) {
      const session = vi.mocked(saveSession).mock.calls.find(([s]) => s.id === map.sessionId)![0];
      expect(session.sample).toBe(true);
      for (const step of map.steps) {
        expect(session.frames.some((frame) => frame.id === step.screenMoment.frameId)).toBe(true);
      }
    }
    const confirmed = maps.find((map) => map.confirmedAt)!;
    expect(confirmed).toBeDefined();
    expect(confirmationIssues(confirmed)).toEqual([]);
    expect(maps.find((map) => !map.confirmedAt)?.slots.some((slot) => slot.status === "open")).toBe(true);
  });
});
