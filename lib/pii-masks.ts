import type { PiiRegion } from "./redact";

export const PII_CHANNEL = "tacit-erp-pii";
const kinds = new Set(["name", "email", "iban", "phone"]);
export interface CaptureRect { x: number; y: number; w: number; h: number }
/** `instanceId` identifies one publishing tab, so two sandbox tabs paired by the same sourceId never replace
 * each other's rects at the receiver (see PiiChannelUnion). */
export interface PiiRectsMessage { sourceId: string; at: number; rects: PiiRegion[]; instanceId?: string }

function validRect(r: CaptureRect): boolean {
  return [r.x, r.y, r.w, r.h].every(Number.isFinite) && r.w > 0 && r.h > 0;
}

function clip(r: PiiRegion): PiiRegion | undefined {
  if (!validRect(r)) return;
  const x = Math.max(0, r.x), y = Math.max(0, r.y);
  const right = Math.min(1, r.x + r.w), bottom = Math.min(1, r.y + r.h);
  return right > x && bottom > y ? { x, y, w: right - x, h: bottom - y, kind: r.kind } : undefined;
}

/** sourceId must uniquely pair this ERP document with its capture subscriber (e.g. a shared UUID).
 * Rects are local to the publishing document's viewport, including inside a same-origin iframe.
 */
export function publishPiiRects(sourceId: string, doc?: Document, instanceId?: string, project?: (rects: PiiRegion[]) => PiiRegion[] | undefined): PiiRectsMessage | undefined {
  if (!sourceId?.trim()) throw new Error("PII publisher identity required");
  const collected = collectPiiRects(doc);
  const rects = collected && project ? project(collected) : collected;
  if (!rects) return;
  const message: PiiRectsMessage = { sourceId, at: Date.now(), rects, ...(instanceId ? { instanceId } : {}) };
  if (typeof BroadcastChannel !== "undefined") {
    const channel = new BroadcastChannel(PII_CHANNEL);
    try { channel.postMessage(message); } finally { channel.close(); }
  }
  return message;
}

/** Recognized `[data-pii]` rectangles, normalized to (and clipped by) `doc`'s own viewport. No broadcast.
 * Used directly by the capture pipeline to read a same-origin iframe synchronously.
 * Returns undefined without usable document geometry. */
export function collectPiiRects(doc?: Document): PiiRegion[] | undefined {
  doc ??= typeof document === "undefined" ? undefined : document;
  const view = doc?.defaultView;
  if (!doc || !view || !validRect({ x: 0, y: 0, w: view.innerWidth, h: view.innerHeight })) return;
  const rects: PiiRegion[] = [];
  for (const el of doc.querySelectorAll("[data-pii]")) {
    const kind = el.getAttribute("data-pii") ?? "";
    if (!kinds.has(kind)) continue;
    const r = visibleRect(el, view);
    const bounded = clip({ x: r.x / view.innerWidth, y: r.y / view.innerHeight, w: r.width / view.innerWidth, h: r.height / view.innerHeight, kind });
    if (bounded) rects.push(bounded);
  }
  return rects;
}

/** Pairing value between a sandbox page's PiiPublisher and a capture subscriber (two-window mode):
 * the sandbox origin, the app and the queue. Not authentication; see P-24. */
export function piiSourceId(p: { origin: string; app?: string; queue?: string }): string {
  return `${p.origin}|${p.app ?? "erp"}|${p.queue ?? "default"}`;
}

function visibleRect(el: Element, view: Window) {
  const r = el.getBoundingClientRect();
  if (!el.parentElement) return r;
  // Positioned descendants can escape overflow clips; retain coverage when containing blocks are uncertain.
  for (let node: Element | null = el; node; node = node.parentElement) {
    if (/^(fixed|absolute)$/.test(view.getComputedStyle(node).position)) return r;
  }
  let x = r.x, y = r.y, right = r.right ?? r.x + r.width, bottom = r.bottom ?? r.y + r.height;
  for (let parent: HTMLElement | null = el.parentElement; parent; parent = parent.parentElement) {
    const style = view.getComputedStyle(parent), bounds = parent.getBoundingClientRect();
    const sx = parent.offsetWidth ? bounds.width / parent.offsetWidth : 1;
    const sy = parent.offsetHeight ? bounds.height / parent.offsetHeight : 1;
    if (/^(hidden|clip|auto|scroll)$/.test(style.overflowX)) {
      const left = bounds.x + parent.clientLeft * sx;
      x = Math.max(x, left); right = Math.min(right, left + parent.clientWidth * sx);
    }
    if (/^(hidden|clip|auto|scroll)$/.test(style.overflowY)) {
      const top = bounds.y + parent.clientTop * sy;
      y = Math.max(y, top); bottom = Math.min(bottom, top + parent.clientHeight * sy);
    }
  }
  return { x, y, width: right - x, height: bottom - y };
}

export function subscribePiiRects(sourceId: string, handler: (message: PiiRectsMessage) => void): () => void {
  if (!sourceId?.trim()) throw new Error("PII publisher identity required");
  if (typeof BroadcastChannel === "undefined") return () => {};
  const channel = new BroadcastChannel(PII_CHANNEL);
  channel.onmessage = ({ data }) => {
    if (!data || data.sourceId !== sourceId || !Number.isFinite(data.at) || data.at < 0 || !Array.isArray(data.rects)) return;
    if (!data.rects.every((r: PiiRegion | null) => r && kinds.has(r.kind) && validRect(r))) return;
    const rects = data.rects.map(clip).filter((r: PiiRegion | undefined) => r !== undefined);
    handler({ sourceId, at: data.at, rects, ...(typeof data.instanceId === "string" && data.instanceId ? { instanceId: data.instanceId } : {}) });
  };
  return () => channel.close();
}

/** Receiver-side store of paired PII rects: one entry per publishing tab (instanceId), and `rects(now)` is the
 * UNION of every entry fresher than `freshMs`. Two sandbox tabs on the same app+queue both stay masked; a closed tab
 * expires. Over-masking is acceptable, under-masking is not. */
export class PiiChannelUnion {
  private entries = new Map<string, { rects: PiiRegion[]; at: number }>();
  constructor(readonly freshMs = 3000) {}
  put(m: Pick<PiiRectsMessage, "at" | "rects" | "instanceId">): void {
    const key = m.instanceId ?? "";
    const prev = this.entries.get(key);
    if (prev && prev.at > m.at) return; // out-of-order delivery from the same tab
    this.entries.set(key, { rects: m.rects, at: m.at });
  }
  /** Union of fresh entries; undefined when no entry is fresh (no paired publisher alive). */
  rects(now: number): PiiRegion[] | undefined {
    let any = false;
    const out: PiiRegion[] = [];
    for (const [key, e] of this.entries) {
      if (now - e.at > this.freshMs) { this.entries.delete(key); continue; }
      any = true;
      out.push(...e.rects);
    }
    return any ? out : undefined;
  }
  clear(): void { this.entries.clear(); }
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
  return paintMaskRects(context, canvas.width, canvas.height, rects);
}

/** Same painting as paintPiiMasks, on a context whose drawing surface is `width` x `height` px.
 * Opaque #000, outward-rounded, transform/alpha/composite/filter reset. Returns the number of painted rects. */
export function paintMaskRects(
  context: Pick<CanvasRenderingContext2D, "save" | "restore" | "resetTransform" | "fillRect" | "globalAlpha" | "globalCompositeOperation" | "filter" | "fillStyle">,
  width: number, height: number, rects: readonly PiiRegion[],
): number {
  if (!validRect({ x: 0, y: 0, w: width, h: height })) throw new Error("Cannot mask frame");
  context.save();
  try {
    context.resetTransform();
    context.globalAlpha = 1;
    context.globalCompositeOperation = "source-over";
    context.filter = "none";
    context.fillStyle = "#000";
    const bounded = rects.flatMap((r) => clip(r) ?? []);
    for (const r of bounded) {
      const x = Math.floor(r.x * width), y = Math.floor(r.y * height);
      context.fillRect(x, y, Math.ceil((r.x + r.w) * width) - x, Math.ceil((r.y + r.h) * height) - y);
    }
    return bounded.length;
  } finally { context.restore(); }
}
