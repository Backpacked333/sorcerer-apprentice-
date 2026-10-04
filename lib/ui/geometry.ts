// Small pure geometry helpers for overlays (halo, connector cable, occluder paint-out).

export type Rect = { x: number; y: number; w: number; h: number };

type Pad = number | { t: number; r: number; b: number; l: number };

/** Grows (or shrinks, with a negative pad) a rect. Width/height never go below 0. */
export function expandRect(r: Rect, pad: Pad): Rect {
  const p = typeof pad === "number" ? { t: pad, r: pad, b: pad, l: pad } : pad;
  return { x: r.x - p.l, y: r.y - p.t, w: Math.max(0, r.w + p.l + p.r), h: Math.max(0, r.h + p.t + p.b) };
}

/** Smallest rect containing every input rect (empty rects ignored). Null when there is none. */
export function unionRects(rects: Rect[]): Rect | null {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const r of rects) {
    if (!r || !(r.w > 0) || !(r.h > 0)) continue;
    x0 = Math.min(x0, r.x);
    y0 = Math.min(y0, r.y);
    x1 = Math.max(x1, r.x + r.w);
    y1 = Math.max(y1, r.y + r.h);
  }
  return x0 === Infinity ? null : { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/** The element's border box relative to `root`'s border box (viewport when root is null). */
export function relativeRect(el: Element, root: Element | null): Rect {
  const a = el.getBoundingClientRect();
  const b = root ? root.getBoundingClientRect() : { left: 0, top: 0 };
  return { x: a.left - b.left, y: a.top - b.top, w: a.width, h: a.height };
}

/**
 * Connector cable from a field to the companion card (design §6.6):
 * starts 7 px right of the field, at min(h/2, 22) down; ends 1 px left of the card, 34 px down
 * (the orb row). Mirrors when the field sits to the right of the card.
 */
export function connectorPath(from: Rect, to: Rect): { d: string; x0: number; y0: number; x1: number; y1: number } {
  const y0 = from.y + Math.min(from.h / 2, 22);
  const y1 = to.y + 34;
  const leftToRight = from.x + from.w / 2 <= to.x + to.w / 2;
  const x0 = leftToRight ? from.x + from.w + 7 : from.x - 7;
  const x1 = leftToRight ? to.x - 1 : to.x + to.w + 1;
  const c = leftToRight ? 110 : -110;
  const f = (n: number) => Math.round(n * 100) / 100;
  const d = `M${f(x0)} ${f(y0)} C ${f(x0 + c)} ${f(y0)}, ${f(x1 - c)} ${f(y1)}, ${f(x1)} ${f(y1)}`;
  return { d, x0, y0, x1, y1 };
}

/** Seconds → "mm:ss" (minutes keep growing past 59). Non-finite → "--:--"; negatives clamp to 0. */
export function mmss(sec: number): string {
  if (!Number.isFinite(sec)) return "--:--";
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}
