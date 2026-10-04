/**
 * One frame helper for every pixel that leaves the screen pipeline (WP1, additive to P-23/P-24).
 *
 * The 64x36 diff thumbnail, the vision frame and the stored still are all drawn by `drawFrame`:
 *   drawImage(video, crop) -> paint occluders + manual masks + DOM PII (opaque #000) -> only then read/encode.
 *
 * Coordinate spaces:
 * - CSS px: this tab's layout viewport (getBoundingClientRect). Crop target, occluders and DOM PII start here.
 * - video px: the captured MediaStream frame. A self-tab capture is the viewport scaled by the device pixel
 *   ratio, letterboxed (centered, aspect kept) if the window was resized after the share started.
 * - crop-normalized 0..1: relative to the drawn source rectangle; what `paintMaskRects` consumes.
 * Manual masks are normalized to the full video frame (the preview shows the full frame); they are re-projected.
 */
import type { PiiRegion } from "./redact";
import { paintMaskRects, type CaptureRect } from "./pii-masks";

export type Rect = CaptureRect;
export interface Size { w: number; h: number }
export interface Padding { t: number; r: number; b: number; l: number }
export type Surface = "browser" | "window" | "monitor";

/** Visual overflow of the floating glass card (glow + shadow) in CSS px. */
export const OCCLUDER_PAD: Padding = { t: 32, r: 52, b: 72, l: 52 };
/** Frame lag at 4-10 fps is 100-250 ms; an animating occluder is painted as its union over this window. */
export const OCCLUDER_WINDOW_MS = 750;
/** A browser-surface capture whose aspect is within 2 % of this viewport is taken to be this tab. */
export const SELF_ASPECT_TOLERANCE = 0.02;

const finite = (...n: number[]) => n.every(Number.isFinite);
const validRect = (r: Rect | null | undefined): r is Rect => !!r && finite(r.x, r.y, r.w, r.h) && r.w > 0 && r.h > 0;
const validSize = (s: Size | null | undefined): s is Size => !!s && finite(s.w, s.h) && s.w > 0 && s.h > 0;

/** Where the viewport sits inside the video frame (video px), handling DPR scale and letterboxing. */
export function contentBox(viewport: Size, videoW: number, videoH: number): Rect {
  const s = Math.min(videoW / viewport.w, videoH / viewport.h);
  const w = viewport.w * s, h = viewport.h * s;
  return { x: (videoW - w) / 2, y: (videoH - h) / 2, w, h };
}

/** A CSS-px rect of this tab, in video px. */
export function cssToVideo(r: Rect, viewport: Size, videoW: number, videoH: number): Rect {
  const b = contentBox(viewport, videoW, videoH);
  const s = b.w / viewport.w;
  return { x: b.x + r.x * s, y: b.y + r.y * s, w: r.w * s, h: r.h * s };
}

/** drawImage source rectangle (video px, integer, rounded inward so no outside pixel is drawn).
 * No/invalid/off-screen frame rect: the full video frame (identical to the uncropped behaviour). */
export function cropRectFor(frameRect: Rect | null | undefined, viewport: Size | null | undefined, videoW: number, videoH: number): Rect {
  const full = { x: 0, y: 0, w: videoW, h: videoH };
  if (!validRect(frameRect) || !validSize(viewport) || !(videoW > 0 && videoH > 0)) return full;
  const x0 = Math.max(0, frameRect.x), y0 = Math.max(0, frameRect.y);
  const x1 = Math.min(viewport.w, frameRect.x + frameRect.w), y1 = Math.min(viewport.h, frameRect.y + frameRect.h);
  if (x1 <= x0 || y1 <= y0) return full;
  const v = cssToVideo({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 }, viewport, videoW, videoH);
  const sx = Math.max(0, Math.ceil(v.x - 1e-6)), sy = Math.max(0, Math.ceil(v.y - 1e-6));
  const ex = Math.min(videoW, Math.floor(v.x + v.w + 1e-6)), ey = Math.min(videoH, Math.floor(v.y + v.h + 1e-6));
  return ex - sx >= 1 && ey - sy >= 1 ? { x: sx, y: sy, w: ex - sx, h: ey - sy } : full;
}

/** A video-px rect normalized to the drawn source rect and clipped to 0..1 (undefined when outside). */
export function toCropSpace(r: Rect, src: Rect, kind = "mask"): PiiRegion | undefined {
  if (!validRect(r) || !validRect(src)) return;
  const x0 = Math.max(0, (r.x - src.x) / src.w), y0 = Math.max(0, (r.y - src.y) / src.h);
  const x1 = Math.min(1, (r.x + r.w - src.x) / src.w), y1 = Math.min(1, (r.y + r.h - src.y) / src.h);
  return x1 > x0 && y1 > y0 ? { x: x0, y: y0, w: x1 - x0, h: y1 - y0, kind } : undefined;
}

export function padRect(r: Rect, pad: Padding = OCCLUDER_PAD): Rect {
  return { x: r.x - pad.l, y: r.y - pad.t, w: r.w + pad.l + pad.r, h: r.h + pad.t + pad.b };
}

/** Is a capture this very tab? Browser surface and the video aspect within 2 % of the viewport aspect. */
export function isSelfCapture(surface: string | undefined, videoW: number, videoH: number, viewport: Size | null | undefined, tolerance = SELF_ASPECT_TOLERANCE): boolean {
  if (surface !== "browser" || !validSize(viewport) || !(videoW > 0 && videoH > 0)) return false;
  const want = viewport.w / viewport.h;
  return Math.abs(videoW / videoH - want) / want <= tolerance;
}

/** Timestamped ring buffer of occluder rects (CSS px). `rects(now)` is, per occluder, the bounding union of
 * every rect it had in the last `windowMs`, padded. An occluder that just vanished stays painted for `windowMs`. */
export class OccluderHistory {
  private samples: { t: number; key: unknown; rect: Rect }[] = [];
  constructor(readonly windowMs = OCCLUDER_WINDOW_MS, readonly pad: Padding = OCCLUDER_PAD) {}
  record(t: number, items: readonly { key: unknown; rect: Rect }[]): void {
    for (const it of items) if (validRect(it.rect)) this.samples.push({ t, key: it.key, rect: { ...it.rect } });
    this.prune(t);
  }
  rects(t: number): Rect[] {
    this.prune(t);
    const boxes = new Map<unknown, { x0: number; y0: number; x1: number; y1: number }>();
    for (const { key, rect: r } of this.samples) {
      const b = boxes.get(key);
      if (!b) boxes.set(key, { x0: r.x, y0: r.y, x1: r.x + r.w, y1: r.y + r.h });
      else { b.x0 = Math.min(b.x0, r.x); b.y0 = Math.min(b.y0, r.y); b.x1 = Math.max(b.x1, r.x + r.w); b.y1 = Math.max(b.y1, r.y + r.h); }
    }
    return [...boxes.values()].map((b) => padRect({ x: b.x0, y: b.y0, w: b.x1 - b.x0, h: b.y1 - b.y0 }, this.pad));
  }
  get size(): number { return this.samples.length; }
  clear(): void { this.samples = []; }
  private prune(t: number) {
    const keep = t - this.windowMs;
    if (this.samples.length && this.samples[0].t < keep) this.samples = this.samples.filter((s) => s.t >= keep);
  }
}

/** Everything `drawFrame` needs: the source rect (video px) and the rects to paint (crop-normalized). */
export interface FrameSpec {
  crop: Rect;
  occluders: PiiRegion[];
  masks: PiiRegion[];
  pii: PiiRegion[];
}

export interface FrameInput {
  videoW: number;
  videoH: number;
  /** This tab's viewport in CSS px (null outside a browser). */
  viewport: Size | null;
  /** True only for a verified self-tab capture; CSS-px inputs are ignored otherwise (they are not in the frame). */
  self: boolean;
  /** Crop target rect (CSS px), e.g. the ERP iframe; applied only when `self`. */
  cropCss?: Rect | null;
  /** Occluder rects (CSS px), already unioned over time and padded; applied only when `self`. */
  occludersCss?: readonly Rect[];
  /** DOM PII rects read from this tab (CSS px); applied only when `self`. */
  piiCss?: readonly (Rect & { kind?: string })[];
  /** Manual masks, normalized to the full video frame. */
  manual?: readonly PiiRegion[];
  /** DOM PII published by another tab (two-window mode), normalized to that tab's viewport = the full frame. */
  piiFrame?: readonly PiiRegion[];
}

export function planFrame(i: FrameInput): FrameSpec {
  const self = i.self && validSize(i.viewport);
  const crop = self ? cropRectFor(i.cropCss, i.viewport, i.videoW, i.videoH) : { x: 0, y: 0, w: i.videoW, h: i.videoH };
  const fromCss = (rs: readonly (Rect & { kind?: string })[] | undefined, kind: string) =>
    !self || !rs ? [] : rs.flatMap((r) => toCropSpace(cssToVideo(r, i.viewport as Size, i.videoW, i.videoH), crop, r.kind ?? kind) ?? []);
  const fromFrame = (rs: readonly PiiRegion[] | undefined) =>
    (rs ?? []).flatMap((m) => toCropSpace({ x: m.x * i.videoW, y: m.y * i.videoH, w: m.w * i.videoW, h: m.h * i.videoH }, crop, m.kind) ?? []);
  return {
    crop,
    occluders: fromCss(i.occludersCss, "occluder"),
    masks: fromFrame(i.manual),
    pii: [...fromCss(i.piiCss, "pii"), ...(self ? [] : fromFrame(i.piiFrame))],
  };
}

/** Output size for a source rect at a given width (aspect kept). */
export function frameSize(crop: Rect, width: number): Size {
  return { w: width, h: Math.max(1, Math.round((crop.h / crop.w) * width)) };
}

type DrawContext = Pick<CanvasRenderingContext2D, "drawImage" | "save" | "restore" | "resetTransform" | "fillRect" | "globalAlpha" | "globalCompositeOperation" | "filter" | "fillStyle">;

/** Draw the (cropped) frame, then paint every occluder, mask and PII rect, in that order, always.
 * Callers read pixels / encode only after this returns. Returns the number of painted rects. */
export function drawFrame(ctx: DrawContext, video: CanvasImageSource, w: number, h: number, spec: FrameSpec): number {
  const { crop } = spec;
  ctx.drawImage(video, crop.x, crop.y, crop.w, crop.h, 0, 0, w, h);
  const rects = [...spec.occluders, ...spec.masks, ...spec.pii];
  return rects.length ? paintMaskRects(ctx, w, h, rects) : 0;
}

/** DOM PII of a same-origin iframe, in this tab's CSS px (the iframe's content box offset added). */
export function iframeContentBox(r: Rect, border: { left: number; top: number }, client: Size, offset: Size): Rect {
  const sx = offset.w ? r.w / offset.w : 1, sy = offset.h ? r.h / offset.h : 1;
  return { x: r.x + border.left * sx, y: r.y + border.top * sy, w: client.w * sx, h: client.h * sy };
}

export function piiToCss(rects: readonly PiiRegion[], box: Rect): (Rect & { kind: string })[] {
  return rects.map((r) => ({ x: box.x + r.x * box.w, y: box.y + r.y * box.h, w: r.w * box.w, h: r.h * box.h, kind: r.kind }));
}
