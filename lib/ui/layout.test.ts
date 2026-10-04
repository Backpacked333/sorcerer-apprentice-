import { describe, expect, it } from "vitest";
import { layoutMode } from "./layout";

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
});
