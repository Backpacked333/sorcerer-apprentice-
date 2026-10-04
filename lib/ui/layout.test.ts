import { describe, expect, it } from "vitest";
import { ERP_RELOAD_MS, layoutInputFrom, layoutMode, WORKSPACE_MIN_WIDTH } from "./layout";

const wide = { search: "", width: 1440, canCrop: false, source: "vision", share0: false };

describe("layoutMode", () => {
  it("follows the five branches in order", () => {
    expect(layoutMode({ ...wide, search: "layout=companion", canCrop: true, share0: true })).toBe("companion");
    expect(layoutMode({ ...wide, search: "layout=workspace", width: 1179 })).toBe("companion");
    expect(layoutMode({ ...wide, search: "?layout=workspace" })).toBe("workspace");
    expect(layoutMode({ ...wide, canCrop: true })).toBe("workspace");
    expect(layoutMode({ ...wide, source: "dom" })).toBe("workspace");
    expect(layoutMode({ ...wide, share0: true })).toBe("workspace");
    expect(layoutMode(wide)).toBe("companion");
  });

  it("uses 1180 px as the workspace breakpoint", () => {
    expect(WORKSPACE_MIN_WIDTH).toBe(1180);
    expect(layoutMode({ ...wide, width: 1180, canCrop: true })).toBe("workspace");
    expect(layoutMode({ ...wide, width: 1179, canCrop: true })).toBe("companion");
  });

  it("canCrop alone is enough for workspace on a wide screen", () => {
    expect(layoutMode({ ...wide, source: "both", canCrop: true })).toBe("workspace");
    expect(layoutMode({ ...wide, source: "both", canCrop: false })).toBe("companion");
  });
});

describe("ERP_RELOAD_MS", () => {
  it("pins the ERP iframe remount delay", () => {
    expect(ERP_RELOAD_MS).toBe(1500);
  });
});

describe("layoutInputFrom", () => {
  it("reads share=0 with or without the leading question mark", () => {
    expect(layoutInputFrom("?share=0", 1440, false, "both").share0).toBe(true);
    expect(layoutInputFrom("share=0&layout=workspace", 1440, false, "both").share0).toBe(true);
    expect(layoutInputFrom("?share=1", 1440, false, "both").share0).toBe(false);
    expect(layoutInputFrom("", 1440, false, "both").share0).toBe(false);
  });

  it("feeds layoutMode the same answer the smoke viewport expects", () => {
    expect(layoutMode(layoutInputFrom("?share=0", 1440, false, "both"))).toBe("workspace");
    expect(layoutMode(layoutInputFrom("?share=0", 390, false, "both"))).toBe("companion");
    expect(layoutMode(layoutInputFrom("?from=demo&share=0", 1440, false, "dom"))).toBe("workspace");
  });
});
