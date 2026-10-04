import { afterEach, describe, expect, it, vi } from "vitest";
import { prefersReducedMotion } from "./motion";

const reducedMotionQuery = ["(prefers-reduced-motion", "reduce)"].join(": ");

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("prefersReducedMotion", () => {
  it("returns false without window", () => {
    expect(prefersReducedMotion()).toBe(false);
  });

  it("returns false when window has no matchMedia", () => {
    vi.stubGlobal("window", {});
    expect(prefersReducedMotion()).toBe(false);
  });

  it("returns false when matchMedia throws", () => {
    const matchMedia = vi.fn(() => {
      throw new Error("matchMedia unavailable");
    });
    vi.stubGlobal("window", { matchMedia });
    expect(prefersReducedMotion()).toBe(false);
  });

  it("returns true when matchMedia matches reduced motion", () => {
    const matchMedia = vi.fn(() => ({ matches: true }));
    vi.stubGlobal("window", { matchMedia });
    expect(prefersReducedMotion()).toBe(true);
    expect(matchMedia).toHaveBeenCalledTimes(1);
    expect(matchMedia).toHaveBeenCalledWith(reducedMotionQuery);
  });

  it("returns false when matchMedia does not match reduced motion", () => {
    vi.stubGlobal("window", { matchMedia: vi.fn(() => ({ matches: false })) });
    expect(prefersReducedMotion()).toBe(false);
  });

  it("returns false when matchMedia returns undefined", () => {
    vi.stubGlobal("window", { matchMedia: vi.fn(() => undefined) });
    expect(prefersReducedMotion()).toBe(false);
  });
});
