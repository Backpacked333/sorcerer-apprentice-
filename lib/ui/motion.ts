// Single gate for the user's reduced-motion preference. SSR-safe; never throws.
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return !!window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  } catch {
    return false;
  }
}
