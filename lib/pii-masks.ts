import type { PiiRegion } from "./redact";

export const PII_CHANNEL = "tacit-erp-pii";
const kinds = new Set(["name", "email", "iban", "phone"]);
export interface CaptureRect { x: number; y: number; w: number; h: number }
export interface PiiRectsMessage { at: number; rects: PiiRegion[] }

function validRect(r: CaptureRect): boolean {
  return [r.x, r.y, r.w, r.h].every(Number.isFinite) && r.w > 0 && r.h > 0;
}

function clip(r: PiiRegion): PiiRegion | undefined {
  if (!validRect(r)) return;
  const x = Math.max(0, r.x), y = Math.max(0, r.y);
  const right = Math.min(1, r.x + r.w), bottom = Math.min(1, r.y + r.h);
  return right > x && bottom > y ? { x, y, w: right - x, h: bottom - y, kind: r.kind } : undefined;
}

/** Rects are local to the publishing document's viewport, including inside a same-origin iframe. */
export function publishPiiRects(doc?: Document): PiiRectsMessage | undefined {
  doc ??= typeof document === "undefined" ? undefined : document;
  const view = doc?.defaultView;
  if (!doc || !view || !validRect({ x: 0, y: 0, w: view.innerWidth, h: view.innerHeight })) return;
  const rects: PiiRegion[] = [];
  for (const el of doc.querySelectorAll("[data-pii]")) {
    const kind = el.getAttribute("data-pii") ?? "";
    if (!kinds.has(kind)) continue;
    const r = el.getBoundingClientRect();
    const bounded = clip({ x: r.x / view.innerWidth, y: r.y / view.innerHeight, w: r.width / view.innerWidth, h: r.height / view.innerHeight, kind });
    if (bounded) rects.push(bounded);
  }
  const message = { at: Date.now(), rects };
  if (typeof BroadcastChannel !== "undefined") {
    const channel = new BroadcastChannel(PII_CHANNEL);
    try { channel.postMessage(message); } finally { channel.close(); }
  }
  return message;
}

export function subscribePiiRects(handler: (message: PiiRectsMessage) => void): () => void {
  if (typeof BroadcastChannel === "undefined") return () => {};
  const channel = new BroadcastChannel(PII_CHANNEL);
  channel.onmessage = ({ data }) => {
    if (!data || !Number.isFinite(data.at) || data.at < 0 || !Array.isArray(data.rects)) return;
    if (!data.rects.every((r: PiiRegion | null) => r && kinds.has(r.kind) && validRect(r))) return;
    handler({ at: data.at, rects: data.rects.map(clip).filter((r: PiiRegion | undefined) => r !== undefined) });
  };
  return () => channel.close();
}

/** viewport = publisher's content box in captured-tab CSS pixels (iframe borders excluded).
 * crop uses the same coordinates. Standalone tab: viewport = crop = { x: 0, y: 0, w, h }.
 * Full iframe crop: viewport = crop; partial workspace crop: supply its actual capture rectangle.
 */
export function projectPiiRects(rects: readonly PiiRegion[], viewport: CaptureRect, crop = viewport): PiiRegion[] {
  if (!validRect(viewport) || !validRect(crop)) throw new Error("Invalid capture geometry");
  return rects.flatMap((r) => {
    const bounded = clip(r);
    if (!bounded) return [];
    const projected = clip({
      x: (viewport.x + bounded.x * viewport.w - crop.x) / crop.w,
      y: (viewport.y + bounded.y * viewport.h - crop.y) / crop.h,
      w: bounded.w * viewport.w / crop.w, h: bounded.h * viewport.h / crop.h, kind: r.kind,
    });
    return projected ? [projected] : [];
  });
}

/** On a fresh/resized, unclipped canvas: draw frame, paint projected masks, THEN encode/upload/store. */
export function paintPiiMasks(canvas: HTMLCanvasElement, rects: readonly PiiRegion[]): number {
  const context = canvas.getContext("2d");
  if (!context || !validRect({ x: 0, y: 0, w: canvas.width, h: canvas.height })) throw new Error("Cannot mask frame");
  context.save();
  try {
    context.resetTransform();
    context.globalAlpha = 1;
    context.globalCompositeOperation = "source-over";
    context.filter = "none";
    context.fillStyle = "#000";
    const bounded = rects.flatMap((r) => clip(r) ?? []);
    for (const r of bounded) {
      const x = Math.floor(r.x * canvas.width), y = Math.floor(r.y * canvas.height);
      context.fillRect(x, y, Math.ceil((r.x + r.w) * canvas.width) - x, Math.ceil((r.y + r.h) * canvas.height) - y);
    }
    return bounded.length;
  } finally { context.restore(); }
}
