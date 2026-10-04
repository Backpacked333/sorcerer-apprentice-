import { describe, expect, it } from "vitest";
import { connectorPath, expandRect, findErpTarget, iframeTargetRect, mmss, rectsEqual, relativeRect, roundRect, unionRects } from "./geometry";

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

describe("rectsEqual / roundRect", () => {
  it("compares by value and treats null as equal only to null", () => {
    expect(rectsEqual({ x: 1, y: 2, w: 3, h: 4 }, { x: 1, y: 2, w: 3, h: 4 })).toBe(true);
    expect(rectsEqual({ x: 1, y: 2, w: 3, h: 4 }, { x: 1, y: 2, w: 3, h: 5 })).toBe(false);
    expect(rectsEqual(null, null)).toBe(true);
    expect(rectsEqual({ x: 0, y: 0, w: 0, h: 0 }, null)).toBe(false);
  });
  it("rounds every side", () => {
    expect(roundRect({ x: 1.4, y: 2.5, w: 3.6, h: 0.4 })).toEqual({ x: 1, y: 3, w: 4, h: 0 });
  });
});

describe("findErpTarget", () => {
  const doc = (found: Element | null) =>
    ({ querySelector: (sel: string) => (sel === '[data-erp-target="total"]' ? found : null) }) as unknown as Document;
  it("reuses an attached cached element from the same document and re-queries otherwise", () => {
    (globalThis as { CSS?: unknown }).CSS ??= { escape: (s: string) => s };
    const fresh = { isConnected: true } as unknown as Element;
    const d = doc(fresh);
    const cached = { isConnected: true, ownerDocument: d } as unknown as Element;
    expect(findErpTarget(d, "total", cached)).toBe(cached);
    expect(findErpTarget(d, "total", { isConnected: false, ownerDocument: d } as unknown as Element)).toBe(fresh);
    expect(findErpTarget(d, "total", { isConnected: true, ownerDocument: doc(null) } as unknown as Element)).toBe(fresh);
    expect(findErpTarget(null, "total", null)).toBeNull();
  });
});

describe("iframeTargetRect", () => {
  const iframe = fakeEl(10, 60, 800, 600);
  const root = fakeEl(10, 40, 800, 620);
  it("maps iframe-local coords into root coords, rounded", () => {
    expect(iframeTargetRect(fakeEl(100.4, 50.6, 120.2, 30), iframe, root)).toEqual({ x: 100, y: 71, w: 120, h: 30 });
    expect(iframeTargetRect(fakeEl(100, 50, 120, 30), iframe, null)).toEqual({ x: 110, y: 110, w: 120, h: 30 });
  });
  it("is null for empty elements or ones outside the iframe viewport on either axis", () => {
    expect(iframeTargetRect(fakeEl(100, 50, 0, 30), iframe, root)).toBeNull();
    expect(iframeTargetRect(fakeEl(100, -30, 120, 30), iframe, root)).toBeNull();
    expect(iframeTargetRect(fakeEl(100, 600, 120, 30), iframe, root)).toBeNull();
    expect(iframeTargetRect(fakeEl(-120, 50, 120, 30), iframe, root)).toBeNull();
    expect(iframeTargetRect(fakeEl(800, 50, 120, 30), iframe, root)).toBeNull();
  });
  it("keeps partially visible elements", () => {
    expect(iframeTargetRect(fakeEl(-20, -10, 120, 30), iframe, root)).toEqual({ x: -20, y: 10, w: 120, h: 30 });
    expect(iframeTargetRect(fakeEl(790, 590, 120, 30), iframe, root)).toEqual({ x: 790, y: 610, w: 120, h: 30 });
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
