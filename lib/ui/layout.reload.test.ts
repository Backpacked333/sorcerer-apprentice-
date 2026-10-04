import { describe, expect, it } from "vitest";
import { ERP_RELOAD_MS } from "./layout";

describe("ERP_RELOAD_MS", () => {
  it("pins the ERP iframe remount delay", () => {
    expect(ERP_RELOAD_MS).toBe(1500);
  });
});
