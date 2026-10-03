import { afterEach, describe, expect, it, vi } from "vitest";
import { paintPiiMasks, projectPiiRects, publishPiiRects, subscribePiiRects } from "./pii-masks";

const region = { x: 0.25, y: 0.25, w: 0.5, h: 0.5, kind: "email" };
const viewport = { x: 100, y: 50, w: 400, h: 200 };
class Channel {
  static all: Channel[] = [];
  onmessage?: (event: { data: unknown }) => void;
  postMessage = vi.fn();
  close = vi.fn();
  constructor(readonly name: string) { Channel.all.push(this); }
}
afterEach(() => { vi.unstubAllGlobals(); Channel.all = []; });

describe("DOM PII coordinates", () => {
  it("projects iframe-local coordinates through the content viewport and a workspace crop", () => {
    const [result] = projectPiiRects([region], viewport, { x: 150, y: 75, w: 250, h: 150 });
    expect(result.x).toBeCloseTo(0.2);
    expect(result.y).toBeCloseTo(1 / 6);
    expect(result.w).toBeCloseTo(0.8);
    expect(result.h).toBeCloseTo(2 / 3);
    expect(projectPiiRects([region], viewport, viewport)).toEqual([region]);
    expect(projectPiiRects([region], { x: 0, y: 0, w: 800, h: 600 })).toEqual([region]);
  });
  it("clips to source viewport and output crop, rejecting invalid or invisible rectangles", () => {
    expect(projectPiiRects([
      { ...region, x: -0.1, y: -0.1, w: 0.3, h: 0.3 },
      { ...region, x: 2 }, { ...region, y: -2 }, { ...region, w: -1 },
      { ...region, x: NaN }, { ...region, h: Infinity },
    ], viewport)).toEqual([{ ...region, x: 0, y: 0, w: expect.closeTo(0.2), h: expect.closeTo(0.2) }]);
    expect(projectPiiRects([region], viewport, { x: 600, y: 0, w: 50, h: 50 })).toEqual([]);
    expect(() => projectPiiRects([region], { ...viewport, w: 0 })).toThrow();
    expect(() => projectPiiRects([region], viewport, { ...viewport, x: Infinity })).toThrow();
  });
  it("publishes only recognized PII rectangles normalized to the supplied iframe document, not its parent", () => {
    vi.stubGlobal("BroadcastChannel", Channel);
    vi.stubGlobal("window", { innerWidth: 1200, innerHeight: 900 });
    const element = (kind: string, x = 10) => ({
      getAttribute: () => kind,
      getBoundingClientRect: () => ({ x, y: 20, width: 40, height: 30 }),
    });
    const doc = { defaultView: { innerWidth: 200, innerHeight: 100 }, querySelectorAll: vi.fn(() => [
      element("name"), element("email"), element("iban"), element("phone"),
      element("supplier"), element("name", Infinity), element("name", 300),
    ]) };
    const message = publishPiiRects("erp-1", doc as unknown as Document);
    expect(message?.sourceId).toBe("erp-1");
    expect(doc.querySelectorAll).toHaveBeenCalledWith("[data-pii]");
    expect(message?.rects).toEqual(["name", "email", "iban", "phone"].map((kind) => ({ x: 0.05, y: 0.2, w: 0.2, h: 0.3, kind })));
    expect(Channel.all[0].name).toBe("tacit-erp-pii");
    expect(Channel.all[0].postMessage).toHaveBeenCalledWith(message);
    expect(Channel.all[0].close).toHaveBeenCalledOnce();
  });
  it("validates channel payloads, rejects malformed updates and unsubscribes", () => {
    vi.stubGlobal("BroadcastChannel", Channel);
    const handler = vi.fn();
    const stop = subscribePiiRects("erp-1", handler);
    for (const data of [null, {}, { at: Infinity, rects: [] }, { at: 1, rects: [null] },
      ...[{ kind: "supplier" }, { x: NaN }, { w: 0 }].map((invalid) => ({ at: 1, rects: [{ ...region, ...invalid }] })),
    ]) {
      Channel.all[0].onmessage?.({ data: data && { ...data, sourceId: "erp-1" } });
    }
    expect(handler).not.toHaveBeenCalled();
    Channel.all[0].onmessage?.({ data: { sourceId: "erp-2", at: 1, rects: [region] } });
    Channel.all[0].onmessage?.({ data: { at: 1, rects: [] } });
    expect(handler).not.toHaveBeenCalled();
    Channel.all[0].onmessage?.({ data: { sourceId: "erp-1", at: 1, rects: [region] } });
    expect(handler).toHaveBeenCalledWith({ sourceId: "erp-1", at: 1, rects: [region] });
    Channel.all[0].onmessage?.({ data: { sourceId: "erp-1", at: 1, rects: [{ ...region, x: -0.25 }] } });
    expect(handler).toHaveBeenLastCalledWith({ sourceId: "erp-1", at: 1, rects: [{ ...region, x: 0, w: 0.25 }] });
    Channel.all[0].onmessage?.({ data: { sourceId: "erp-1", at: 2, rects: [] } });
    expect(handler).toHaveBeenLastCalledWith({ sourceId: "erp-1", at: 2, rects: [] });
    stop();
    expect(Channel.all[0].close).toHaveBeenCalledOnce();
  });
  it("is safe without browser globals", () => {
    vi.stubGlobal("document", undefined);
    vi.stubGlobal("BroadcastChannel", undefined);
    expect(publishPiiRects("erp-1")).toBeUndefined();
    expect(() => subscribePiiRects("erp-1", vi.fn())()).not.toThrow();
    expect(() => subscribePiiRects("", vi.fn())).toThrow();
    expect(() => publishPiiRects("")).toThrow();
  });
  it("clips published boxes to the visible viewport and ignores an invalid viewport", () => {
    const doc = { defaultView: { innerWidth: 100, innerHeight: 100 }, querySelectorAll: () => [{
      getAttribute: () => "name", getBoundingClientRect: () => ({ x: -10, y: 80, width: 50, height: 50 }),
    }] };
    vi.stubGlobal("BroadcastChannel", undefined);
    expect(publishPiiRects("erp-1", doc as unknown as Document)?.rects).toEqual([{ x: 0, y: 0.8, w: 0.4, h: expect.closeTo(0.2), kind: "name" }]);
    doc.defaultView.innerWidth = 0;
    expect(publishPiiRects("erp-1", doc as unknown as Document)).toBeUndefined();
  });
  it("intersects scroll-container clips instead of masking adjacent content", () => {
    const parent = { parentElement: null, clientLeft: 2, clientTop: 2, clientWidth: 100, clientHeight: 100,
      offsetWidth: 104, offsetHeight: 104, getBoundingClientRect: () => ({ x: -2, y: -2, width: 104, height: 104 }) };
    const doc = { defaultView: { innerWidth: 200, innerHeight: 200,
      getComputedStyle: () => ({ overflowX: "hidden", overflowY: "auto" }) }, querySelectorAll: () => [{
      parentElement: parent, getAttribute: () => "name", getBoundingClientRect: () => ({ x: 90, y: 90, width: 40, height: 40 }),
    }] };
    vi.stubGlobal("BroadcastChannel", undefined);
    expect(publishPiiRects("erp-1", doc as unknown as Document)?.rects).toEqual([
      { x: 0.45, y: 0.45, w: expect.closeTo(0.05), h: expect.closeTo(0.05), kind: "name" },
    ]);
    parent.clientWidth = 80;
    expect(publishPiiRects("erp-1", doc as unknown as Document)?.rects).toEqual([]);
  });
  it.each(["fixed", "absolute"])("retains %s PII escaping an overflow ancestor, including positioned descendants", (position) => {
    const wrapper = { parentElement: null, clientLeft: 0, clientTop: 0, clientWidth: 100, clientHeight: 100,
      offsetWidth: 100, offsetHeight: 100, getBoundingClientRect: () => ({ x: 0, y: 0, width: 100, height: 100 }) };
    const positioned = { ...wrapper, parentElement: wrapper };
    const field = { parentElement: wrapper as typeof wrapper | typeof positioned,
      getAttribute: () => "email", getBoundingClientRect: () => ({ x: 150, y: 150, width: 100, height: 20 }) };
    let positionedNode: unknown = field;
    const doc = { defaultView: { innerWidth: 400, innerHeight: 300, getComputedStyle: (node: unknown) => ({
      position: node === positionedNode ? position : "static", transform: "none", overflowX: "hidden", overflowY: "hidden",
    }) }, querySelectorAll: () => [field] };
    vi.stubGlobal("BroadcastChannel", undefined);
    const expected = [{ x: 0.375, y: 0.5, w: 0.25, h: expect.closeTo(20 / 300), kind: "email" }];
    expect(publishPiiRects("erp-1", doc as unknown as Document)?.rects).toEqual(expected);
    field.parentElement = positioned; positionedNode = positioned;
    expect(publishPiiRects("erp-1", doc as unknown as Document)?.rects).toEqual(expected);
  });
});

describe("black mask painting before frame encoding", () => {
  it("paints outward-rounded pixels opaquely before encoding and restores canvas state", () => {
    const calls: string[] = [];
    const context = {
      save: () => calls.push("save"), resetTransform: () => calls.push("reset"), restore: () => calls.push("restore"),
      fillRect: vi.fn(() => { expect(context).toMatchObject({ fillStyle: "#000", globalAlpha: 1, globalCompositeOperation: "source-over", filter: "none" }); calls.push("fill"); }),
      fillStyle: "red", globalAlpha: 0.1, globalCompositeOperation: "destination-out", filter: "blur(20px)",
    };
    const canvas = { width: 101, height: 51, getContext: () => context, toDataURL: () => calls.push("encode") };
    calls.push("draw");
    expect(paintPiiMasks(canvas as unknown as HTMLCanvasElement, [region, { ...region, x: 2 }, { ...region, y: NaN }])).toBe(1);
    canvas.toDataURL();
    expect(context.fillRect).toHaveBeenCalledWith(25, 12, 51, 27);
    expect(calls).toEqual(["draw", "save", "reset", "fill", "restore", "encode"]);
    canvas.width = 202; canvas.height = 102;
    paintPiiMasks(canvas as unknown as HTMLCanvasElement, [region]);
    expect(context.fillRect).toHaveBeenLastCalledWith(50, 25, 102, 52);
  });
  it("refuses to silently encode unmasked pixels when the canvas context is unavailable", () => {
    expect(() => paintPiiMasks({ width: 100, height: 100, getContext: () => null } as unknown as HTMLCanvasElement, [region])).toThrow();
  });
});
