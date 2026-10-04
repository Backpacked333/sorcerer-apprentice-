import { describe, expect, it } from "vitest";
import { connectorPath, expandRect, mmss, relativeRect, unionRects } from "./geometry";

const fakeEl = (left: number, top: number, width: number, height: number) =>
  ({ getBoundingClientRect: () => ({ left, top, width, height }) }) as unknown as Element;

describe("expandRect", () => {
  it("pads evenly with a number", () => {
    expect(expandRect({ x: 10, y: 20, w: 100, h: 30 }, 5)).toEqual({ x: 5, y: 15, w: 110, h: 40 });
  });
  it("pads per side", () => {
    expect(expandRect({ x: 10, y: 20, w: 100, h: 30 }, { t: 1, r: 2, b: 3, l: 4 })).toEqual({ x: 6, y: 19, w: 106, h: 34 });
  });
  it("never goes negative when shrinking", () => {
    expect(expandRect({ x: 0, y: 0, w: 4, h: 4 }, -5)).toEqual({ x: 5, y: 5, w: 0, h: 0 });
  });
});

describe("unionRects", () => {
  it("returns null for nothing", () => {
    expect(unionRects([])).toBeNull();
    expect(unionRects([{ x: 1, y: 1, w: 0, h: 10 }])).toBeNull();
  });
  it("bounds every non-empty rect", () => {
    expect(unionRects([{ x: 10, y: 10, w: 10, h: 10 }, { x: 0, y: 30, w: 5, h: 5 }, { x: 99, y: 99, w: 0, h: 0 }])).toEqual({ x: 0, y: 10, w: 20, h: 25 });
  });
});

describe("relativeRect", () => {
  it("subtracts the root origin", () => {
    expect(relativeRect(fakeEl(120, 80, 50, 20), fakeEl(100, 50, 800, 600))).toEqual({ x: 20, y: 30, w: 50, h: 20 });
  });
  it("uses the viewport when root is null", () => {
    expect(relativeRect(fakeEl(12, 34, 5, 6), null)).toEqual({ x: 12, y: 34, w: 5, h: 6 });
  });
});

describe("connectorPath", () => {
  it("matches the mockup cable formula (field left of card)", () => {
    const r = connectorPath({ x: 100, y: 200, w: 200, h: 34 }, { x: 900, y: 500, w: 404, h: 300 });
    expect(r.x0).toBe(307);
    expect(r.y0).toBe(217);
    expect(r.x1).toBe(899);
    expect(r.y1).toBe(534);
    expect(r.d).toBe("M307 217 C 417 217, 789 534, 899 534");
  });
  it("caps the start height at 22px for tall fields", () => {
    expect(connectorPath({ x: 0, y: 0, w: 10, h: 200 }, { x: 500, y: 0, w: 10, h: 10 }).y0).toBe(22);
  });
  it("mirrors when the field is right of the card", () => {
    const r = connectorPath({ x: 900, y: 100, w: 100, h: 20 }, { x: 100, y: 400, w: 300, h: 200 });
    expect(r.x0).toBe(893);
    expect(r.x1).toBe(401);
    expect(r.d).toBe("M893 110 C 783 110, 511 434, 401 434");
  });
});

describe("mmss", () => {
  it("formats", () => {
    expect(mmss(0)).toBe("00:00");
    expect(mmss(252)).toBe("04:12");
    expect(mmss(59.9)).toBe("00:59");
    expect(mmss(3725)).toBe("62:05");
  });
  it("is defensive", () => {
    expect(mmss(-3)).toBe("00:00");
    expect(mmss(NaN)).toBe("--:--");
    expect(mmss(Infinity)).toBe("--:--");
  });
});
