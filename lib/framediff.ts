/**
 * Frame diffing: cheap, local, runs every 500 ms on a 64 x 36 grayscale thumbnail.
 * Decides (a) whether a frame is worth sending to the vision model and (b) whether the expert is typing.
 */

export const DIFF_W = 64;
export const DIFF_H = 36;

export interface DiffResult {
  mean: number; // mean absolute difference 0..255
  changedCells: number; // of the 8 x 6 grid
  bbox?: { x0: number; y0: number; x1: number; y1: number }; // in grid cells
  fraction: number; // changed pixels / all pixels
}

/** Grayscale thumbnail from RGBA image data (any size) by nearest sampling. */
export function toGray(rgba: Uint8ClampedArray, width: number, height: number, outW = DIFF_W, outH = DIFF_H): Uint8ClampedArray {
  const out = new Uint8ClampedArray(outW * outH);
  for (let y = 0; y < outH; y++) {
    const sy = Math.min(height - 1, Math.floor((y + 0.5) * (height / outH)));
    for (let x = 0; x < outW; x++) {
      const sx = Math.min(width - 1, Math.floor((x + 0.5) * (width / outW)));
      const i = (sy * width + sx) * 4;
      out[y * outW + x] = (rgba[i] * 299 + rgba[i + 1] * 587 + rgba[i + 2] * 114) / 1000;
    }
  }
  return out;
}

export function diffGray(a: Uint8ClampedArray, b: Uint8ClampedArray, w = DIFF_W, h = DIFF_H, pixelThreshold = 24, gridX = 8, gridY = 6): DiffResult {
  let sum = 0;
  let changed = 0;
  const cells = new Set<number>();
  let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const d = Math.abs(a[i] - b[i]);
      sum += d;
      if (d > pixelThreshold) {
        changed++;
        const cx = Math.floor((x / w) * gridX);
        const cy = Math.floor((y / h) * gridY);
        cells.add(cy * gridX + cx);
        if (cx < x0) x0 = cx;
        if (cy < y0) y0 = cy;
        if (cx > x1) x1 = cx;
        if (cy > y1) y1 = cy;
      }
    }
  }
  return { mean: sum / (w * h), changedCells: cells.size, fraction: changed / (w * h), bbox: cells.size ? { x0, y0, x1, y1 } : undefined };
}

export type Activity = "still" | "typing" | "scrolling" | "navigating";

/**
 * Classify the last few diffs. Typing = small, localized changes repeated across consecutive ticks.
 * Scrolling / navigating = large changes.
 */
export function classifyActivity(history: DiffResult[]): Activity {
  const recent = history.slice(-4);
  if (recent.length === 0) return "still";
  const last = recent[recent.length - 1];
  if (last.fraction > 0.35) return "navigating";
  if (last.fraction > 0.08) return "scrolling";
  const small = recent.filter((d) => d.changedCells >= 1 && d.changedCells <= 3 && d.fraction > 0.0005 && d.fraction < 0.05);
  if (small.length >= 2 && sameRegion(small)) return "typing";
  if (last.changedCells === 0) return "still";
  return "still";
}

function sameRegion(ds: DiffResult[]): boolean {
  const boxes = ds.map((d) => d.bbox).filter(Boolean) as NonNullable<DiffResult["bbox"]>[];
  if (boxes.length < 2) return false;
  const rows = new Set(boxes.map((b) => b.y0));
  return rows.size <= 2;
}

/** Should this frame go to the vision model? */
export function worthSending(diff: DiffResult | null, secondsSinceLastSend: number, maxIdleSecs = 1.5, meanThreshold = 1.5): boolean {
  if (!diff) return true;
  if (secondsSinceLastSend >= maxIdleSecs) return true;
  return diff.mean >= meanThreshold || diff.changedCells >= 2;
}
