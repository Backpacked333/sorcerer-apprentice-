import { describe, expect, it, vi } from "vitest";
import { contentBox, cropRectFor, cssToVideo, drawFrame, frameSize, iframeContentBox, isSelfCapture, OccluderHistory, OCCLUDER_PAD, padRect, piiToCss, planFrame, toCropSpace, type FrameSpec, type Rect } from "./capture-frame";
import { classifyActivity, diffGray, toGray, DIFF_H, DIFF_W, type DiffResult } from "./framediff";

const VP = { w: 1440, h: 900 };

/** A tiny software canvas: an RGBA buffer with nearest-neighbour drawImage(9 args) and fillRect. */
class FakeCtx {
  data: Uint8ClampedArray;
  log: string[] = [];
  fillStyle: string | CanvasGradient | CanvasPattern = "#fff";
  globalAlpha = 0.5;
  globalCompositeOperation: GlobalCompositeOperation = "multiply";
  filter = "blur(2px)";
  constructor(readonly width: number, readonly height: number) { this.data = new Uint8ClampedArray(width * height * 4); }
  save() { this.log.push("save"); }
  restore() { this.log.push("restore"); }
  resetTransform() { this.log.push("resetTransform"); }
  drawImage(src: FakeVideo, sx: number, sy: number, sw: number, sh: number, dx: number, dy: number, dw: number, dh: number) {
    this.log.push("drawImage");
    for (let y = 0; y < dh; y++) for (let x = 0; x < dw; x++) {
      const vx = Math.min(src.videoWidth - 1, Math.floor(sx + ((x + 0.5) * sw) / dw));
      const vy = Math.min(src.videoHeight - 1, Math.floor(sy + ((y + 0.5) * sh) / dh));
      const g = src.pixel(vx, vy), i = ((dy + y) * this.width + dx + x) * 4;
      this.data[i] = this.data[i + 1] = this.data[i + 2] = g; this.data[i + 3] = 255;
    }
  }
  fillRect(x: number, y: number, w: number, h: number) {
    this.log.push(`fillRect:${this.fillStyle}:${this.globalAlpha}:${this.globalCompositeOperation}`);
    for (let yy = Math.max(0, y); yy < Math.min(this.height, y + h); yy++) for (let xx = Math.max(0, x); xx < Math.min(this.width, x + w); xx++) {
      const i = (yy * this.width + xx) * 4;
      this.data[i] = this.data[i + 1] = this.data[i + 2] = 0; this.data[i + 3] = 255;
    }
  }
  getImageData() { return { data: this.data }; }
  gray(x: number, y: number) { return this.data[(y * this.width + x) * 4]; }
}

/** A synthetic gray "video" frame: background 128, a noisy block inside `hot` (video px) that changes each frame. */
class FakeVideo {
  constructor(readonly videoWidth: number, readonly videoHeight: number, readonly hot: Rect | null, readonly seed: number) {}
  pixel(x: number, y: number) {
    const h = this.hot;
    if (h && x >= h.x && x < h.x + h.w && y >= h.y && y < h.y + h.h) return (x * 7 + y * 13 + this.seed * 97) % 256;
    return 128;
  }
}
const asCtx = (c: FakeCtx) => c as unknown as CanvasRenderingContext2D;
const asVideo = (v: FakeVideo) => v as unknown as CanvasImageSource;

describe("crop math", () => {
  it.each([[1, 1440, 900], [2, 2880, 1800]])("maps the ERP frame rect into video px at DPR %i", (dpr, vw, vh) => {
    const frame = { x: 0, y: 64, w: 1440, h: 836 }; // app bar above the ERP iframe
    expect(cropRectFor(frame, VP, vw, vh)).toEqual({ x: 0, y: 64 * dpr, w: 1440 * dpr, h: 836 * dpr });
    const card = { x: 1000, y: 600, w: 400, h: 260 };
    expect(cssToVideo(card, VP, vw, vh)).toEqual({ x: 1000 * dpr, y: 600 * dpr, w: 400 * dpr, h: 260 * dpr });
  });
  it("handles letterboxing (window resized after the share started) and rounds inward", () => {
    // viewport became 1200x900 while the video kept 1440x900: content is pillarboxed, 120 px bars each side
    expect(contentBox({ w: 1200, h: 900 }, 1440, 900)).toEqual({ x: 120, y: 0, w: 1200, h: 900 });
    expect(cropRectFor({ x: 0, y: 0, w: 600, h: 450 }, { w: 1200, h: 900 }, 1440, 900)).toEqual({ x: 120, y: 0, w: 600, h: 450 });
    expect(cropRectFor({ x: 10.4, y: 10.4, w: 100.2, h: 100.2 }, VP, 1440, 900)).toEqual({ x: 11, y: 11, w: 99, h: 99 });
  });
  it("falls back to the full frame without a usable crop target", () => {
    const full = { x: 0, y: 0, w: 1440, h: 900 };
    expect(cropRectFor(null, VP, 1440, 900)).toEqual(full);
    expect(cropRectFor({ x: 2000, y: 0, w: 10, h: 10 }, VP, 1440, 900)).toEqual(full);
    expect(cropRectFor({ x: 0, y: 0, w: 0, h: 10 }, VP, 1440, 900)).toEqual(full);
    expect(cropRectFor({ x: 0, y: 0, w: 10, h: 10 }, null, 1440, 900)).toEqual(full);
    expect(frameSize({ x: 0, y: 64, w: 1440, h: 836 }, 1024)).toEqual({ w: 1024, h: 594 });
  });
  it("decides self-capture from surface and aspect (2 %)", () => {
    expect(isSelfCapture("browser", 2880, 1800, VP)).toBe(true);
    expect(isSelfCapture("browser", 1440, 912, VP)).toBe(true); // 1.3 % off
    expect(isSelfCapture("browser", 1440, 1000, VP)).toBe(false);
    expect(isSelfCapture("window", 1440, 900, VP)).toBe(false);
    expect(isSelfCapture(undefined, 1440, 900, VP)).toBe(false);
    expect(isSelfCapture("browser", 1440, 900, null)).toBe(false);
  });
});

describe("occluder projection", () => {
  it("projects CSS-px occluders into crop space at DPR 1 and 2 identically", () => {
    for (const dpr of [1, 2]) {
      const spec = planFrame({ videoW: 1440 * dpr, videoH: 900 * dpr, viewport: VP, self: true, cropCss: { x: 0, y: 100, w: 1440, h: 800 }, occludersCss: [{ x: 720, y: 500, w: 360, h: 200 }] });
      expect(spec.crop).toEqual({ x: 0, y: 100 * dpr, w: 1440 * dpr, h: 800 * dpr });
      expect(spec.occluders).toHaveLength(1);
      const [o] = spec.occluders;
      expect([o.x, o.y, o.w, o.h]).toEqual([0.5, 0.5, 0.25, 0.25]);
    }
  });
  it("clips occluders to the crop and drops ones outside it", () => {
    const spec = planFrame({ videoW: 1440, videoH: 900, viewport: VP, self: true, cropCss: { x: 0, y: 100, w: 1440, h: 800 }, occludersCss: [{ x: 1300, y: 0, w: 300, h: 200 }, { x: 0, y: 0, w: 100, h: 50 }] });
    expect(spec.occluders).toHaveLength(1);
    expect(spec.occluders[0]).toMatchObject({ y: 0, h: 100 / 800 });
    expect(spec.occluders[0].x + spec.occluders[0].w).toBeCloseTo(1);
  });
  it("ignores this tab's CSS-px rects when the capture is not this tab, but keeps manual and paired PII", () => {
    const spec = planFrame({ videoW: 1280, videoH: 720, viewport: VP, self: false, cropCss: { x: 0, y: 100, w: 1440, h: 800 }, occludersCss: [{ x: 0, y: 0, w: 100, h: 100 }], piiCss: [{ x: 0, y: 0, w: 10, h: 10 }], manual: [{ x: 0.1, y: 0.1, w: 0.2, h: 0.2, kind: "mask" }], piiFrame: [{ x: 0.5, y: 0.5, w: 0.1, h: 0.1, kind: "iban" }] });
    expect(spec.crop).toEqual({ x: 0, y: 0, w: 1280, h: 720 });
    expect(spec.occluders).toEqual([]);
    const near = (r: { x: number; y: number; w: number; h: number; kind: string }) => ({ x: expect.closeTo(r.x), y: expect.closeTo(r.y), w: expect.closeTo(r.w), h: expect.closeTo(r.h), kind: r.kind });
    expect(spec.masks).toEqual([near({ x: 0.1, y: 0.1, w: 0.2, h: 0.2, kind: "mask" })]);
    expect(spec.pii).toEqual([near({ x: 0.5, y: 0.5, w: 0.1, h: 0.1, kind: "iban" })]);
  });
  it("re-projects full-frame manual masks into the crop", () => {
    const spec = planFrame({ videoW: 1440, videoH: 900, viewport: VP, self: true, cropCss: { x: 0, y: 450, w: 1440, h: 450 }, manual: [{ x: 0, y: 0.5, w: 0.5, h: 0.25, kind: "mask" }] });
    expect(spec.masks).toEqual([{ x: 0, y: 0, w: 0.5, h: 0.5, kind: "mask" }]);
  });
  it("is identical to the uncropped behaviour with nothing configured", () => {
    expect(planFrame({ videoW: 1024, videoH: 768, viewport: null, self: false })).toEqual({ crop: { x: 0, y: 0, w: 1024, h: 768 }, occluders: [], masks: [], pii: [] });
    expect(toCropSpace({ x: 10, y: 10, w: 0, h: 5 }, { x: 0, y: 0, w: 100, h: 100 })).toBeUndefined();
  });
  it("puts same-origin iframe PII into this tab's CSS px (iframe offset and border added)", () => {
    const box = iframeContentBox({ x: 0, y: 64, w: 1440, h: 836 }, { left: 0, top: 2 }, { w: 1440, h: 832 }, { w: 1440, h: 836 });
    expect(box).toEqual({ x: 0, y: 66, w: 1440, h: 832 });
    const [r] = piiToCss([{ x: 0.5, y: 0.25, w: 0.1, h: 0.05, kind: "iban" }], box);
    expect(r).toEqual({ x: 720, y: 66 + 208, w: 144, h: 41.6, kind: "iban" });
    const spec = planFrame({ videoW: 2880, videoH: 1800, viewport: VP, self: true, cropCss: { x: 0, y: 64, w: 1440, h: 836 }, piiCss: [r] });
    expect(spec.pii[0].kind).toBe("iban");
    expect(spec.pii[0].x).toBeCloseTo(0.5);
    expect(spec.pii[0].y).toBeCloseTo(210 / 836);
  });
});

describe("OccluderHistory", () => {
  it("pads by {t:32,r:52,b:72,l:52}", () => {
    expect(OCCLUDER_PAD).toEqual({ t: 32, r: 52, b: 72, l: 52 });
    const h = new OccluderHistory(750, OCCLUDER_PAD, 0, 0);
    h.record(0, [{ key: "card", rect: { x: 1000, y: 600, w: 348, h: 132 } }]);
    expect(h.rects(0)).toEqual([padRect({ x: 1000, y: 600, w: 348, h: 132 })]);
    expect(h.rects(0)).toEqual([{ x: 948, y: 568, w: 452, h: 236 }]);
  });
  it("by default holds a shrinking box for 5 s and snaps edges outward to 8 px", () => {
    const h = new OccluderHistory(750, { t: 0, r: 0, b: 0, l: 0 });
    h.record(0, [{ key: "card", rect: { x: 1001, y: 603, w: 440, h: 260 } }]);
    h.record(1000, [{ key: "card", rect: { x: 1001, y: 703, w: 348, h: 132 } }]);
    expect(h.rects(1000)).toEqual([{ x: 1000, y: 600, w: 448, h: 264 }]);
    expect(h.rects(5500)).toEqual([{ x: 1000, y: 696, w: 352, h: 144 }]);
  });
  it("unions each occluder over the last 750 ms, then forgets", () => {
    const h = new OccluderHistory(750, { t: 0, r: 0, b: 0, l: 0 }, 0, 0);
    h.record(0, [{ key: "card", rect: { x: 1000, y: 700, w: 348, h: 132 } }, { key: "toast", rect: { x: 10, y: 10, w: 50, h: 20 } }]);
    h.record(300, [{ key: "card", rect: { x: 1000, y: 572, w: 440, h: 260 } }]); // spring-grown card
    expect(h.rects(300)).toEqual([{ x: 1000, y: 572, w: 440, h: 260 }, { x: 10, y: 10, w: 50, h: 20 }]);
    // at 900 ms the 0 ms sample is older than 750 ms: the toast (gone from the DOM) and the old card size drop out
    expect(h.rects(900)).toEqual([{ x: 1000, y: 572, w: 440, h: 260 }]);
    expect(h.rects(1100)).toEqual([]);
    h.record(1200, [{ key: "card", rect: { x: 0, y: 0, w: 0, h: 10 } }]);
    expect(h.size).toBe(0);
  });
});

describe("drawFrame", () => {
  it("paints occluders, masks and PII after drawImage and before any read, opaque and untransformed", () => {
    const ctx = new FakeCtx(64, 36);
    const spec: FrameSpec = { crop: { x: 0, y: 0, w: 64, h: 36 }, occluders: [{ x: 0.5, y: 0.5, w: 0.5, h: 0.5, kind: "occluder" }], masks: [{ x: 0, y: 0, w: 0.1, h: 0.1, kind: "mask" }], pii: [{ x: 0.2, y: 0, w: 0.1, h: 0.1, kind: "iban" }] };
    expect(drawFrame(asCtx(ctx), asVideo(new FakeVideo(64, 36, null, 0)), 64, 36, spec)).toBe(3);
    expect(ctx.log[0]).toBe("drawImage");
    expect(ctx.log.filter((l) => l.startsWith("fillRect"))).toEqual(Array(3).fill("fillRect:#000:1:source-over"));
    expect(ctx.log.indexOf("resetTransform")).toBeLessThan(ctx.log.indexOf("fillRect:#000:1:source-over"));
    expect([ctx.gray(40, 30), ctx.gray(1, 1), ctx.gray(14, 1), ctx.gray(10, 20)]).toEqual([0, 0, 0, 128]);
  });
  it("an encode spy sees the masked pixels (paint before encode)", () => {
    const ctx = new FakeCtx(32, 18);
    const encode = vi.fn(() => ctx.gray(24, 12));
    const spec = planFrame({ videoW: 1440, videoH: 900, viewport: VP, self: true, occludersCss: [{ x: 720, y: 450, w: 720, h: 450 }] });
    drawFrame(asCtx(ctx), asVideo(new FakeVideo(1440, 900, null, 0)), 32, 18, spec);
    encode();
    expect(encode).toHaveReturnedWith(0);
    expect(ctx.gray(4, 4)).toBe(128);
  });
  it("draws no paint calls when there is nothing to paint (keeps simple contexts working)", () => {
    const ctx = { drawImage: vi.fn() };
    expect(drawFrame(ctx as unknown as CanvasRenderingContext2D, {} as CanvasImageSource, 64, 36, planFrame({ videoW: 1024, videoH: 768, viewport: null, self: false }))).toBe(0);
    expect(ctx.drawImage).toHaveBeenCalledWith({}, 0, 0, 1024, 768, 0, 0, 64, 36);
  });
});

describe("governor stays blind to an animating occluder", () => {
  it.each([1, 2])("frames that change only inside the card give zero diff after painting (DPR %i)", (dpr) => {
    const card = { x: 1040, y: 560, w: 348, h: 260 }; // CSS px, bottom-right floating card
    const hist = new OccluderHistory();
    const history: DiffResult[] = [];
    let prev: Uint8ClampedArray | null = null;
    for (let f = 0; f < 8; f++) {
      const t = f * 500;
      // the card "breathes": a few px of motion, recorded as the DOM reports it
      hist.record(t, [{ key: "card", rect: { ...card, y: card.y - (f % 2) * 6, h: card.h + (f % 2) * 6 } }]);
      const hotVideo = cssToVideo({ x: card.x, y: card.y - 6, w: card.w, h: card.h + 6 }, VP, 1440 * dpr, 900 * dpr);
      const video = new FakeVideo(1440 * dpr, 900 * dpr, hotVideo, f);
      const ctx = new FakeCtx(DIFF_W, DIFF_H);
      drawFrame(asCtx(ctx), asVideo(video), DIFF_W, DIFF_H, planFrame({ videoW: video.videoWidth, videoH: video.videoHeight, viewport: VP, self: true, occludersCss: hist.rects(t) }));
      const gray = toGray(ctx.getImageData().data, DIFF_W, DIFF_H);
      if (prev) {
        const d = diffGray(prev, gray);
        history.push(d);
        // f=1: the card grew once (a real change of the painted box); every later tick must be identical
        if (f >= 2) { expect(d.changedCells).toBe(0); expect(d.mean).toBe(0); }
      }
      prev = gray;
    }
    expect(classifyActivity(history)).toBe("still");
  });
  it("without painting, the same frames do register as screen change (control)", () => {
    const card = { x: 1040, y: 560, w: 348, h: 260 };
    const hot = cssToVideo(card, VP, 1440, 900);
    const grab = (f: number) => {
      const ctx = new FakeCtx(DIFF_W, DIFF_H);
      drawFrame(asCtx(ctx), asVideo(new FakeVideo(1440, 900, hot, f)), DIFF_W, DIFF_H, planFrame({ videoW: 1440, videoH: 900, viewport: VP, self: false }));
      return toGray(ctx.getImageData().data, DIFF_W, DIFF_H);
    };
    expect(diffGray(grab(0), grab(1)).changedCells).toBeGreaterThan(0);
  });
});
