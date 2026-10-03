import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./store", () => ({
  getSession: vi.fn(), getMap: vi.fn(), saveSession: vi.fn(), saveMap: vi.fn(),
}));
vi.mock("./erp", async (original) => ({
  ...await original<typeof import("./erp")>(), resetErp: vi.fn(), disarmTeachGuard: vi.fn(),
}));

import { getMap, getSession, saveMap, saveSession } from "./store";
import { resetErp, disarmTeachGuard } from "./erp";
import { seedDemo } from "./seed";
import { emptySession } from "./events";
import { compileDeterministic } from "./compile";

describe("non-destructive boot seed", () => {
  beforeEach(() => vi.resetAllMocks());

  it("does not reset ERP, disarm guards, or overwrite existing samples on boot", async () => {
    vi.mocked(getSession).mockImplementation(async (id) => emptySession(id, "capture", "existing", "Tester"));
    vi.mocked(getMap).mockImplementation(async (id) => compileDeterministic(emptySession(id, "capture", "existing", "Tester")));
    await seedDemo({ ifMissing: true });
    expect(resetErp).not.toHaveBeenCalled();
    expect(disarmTeachGuard).not.toHaveBeenCalled();
    expect(saveSession).not.toHaveBeenCalled();
    expect(saveMap).not.toHaveBeenCalled();
  });

  it("creates missing samples only once and labels them scripted samples", async () => {
    await seedDemo({ ifMissing: true });
    expect(saveSession).toHaveBeenCalledTimes(2);
    for (const [session] of vi.mocked(saveSession).mock.calls) {
      expect(session).toMatchObject({ sample: true });
    }
    vi.mocked(getSession).mockImplementation(async (id) => vi.mocked(saveSession).mock.calls.find(([s]) => s.id === id)?.[0]);
    vi.mocked(getMap).mockImplementation(async (id) => vi.mocked(saveMap).mock.calls.find(([m]) => m.sessionId === id)?.[0]);
    await seedDemo({ ifMissing: true });
    expect(saveSession).toHaveBeenCalledTimes(2);
    expect(saveMap).toHaveBeenCalledTimes(2);
  });

  it("propagates damaged storage instead of overwriting it", async () => {
    vi.mocked(getSession).mockRejectedValue(new SyntaxError("corrupt stored session"));
    await expect(seedDemo({ ifMissing: true })).rejects.toThrow("corrupt stored session");
    expect(saveSession).not.toHaveBeenCalled();
    expect(resetErp).not.toHaveBeenCalled();
  });

  it("only resets ERP and disarms guards on an explicit reset", async () => {
    await seedDemo();
    expect(resetErp).toHaveBeenCalledOnce();
    expect(disarmTeachGuard).toHaveBeenCalledOnce();
  });
});
