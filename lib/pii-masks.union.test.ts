import { afterEach, describe, expect, it, vi } from "vitest";
import { PiiChannelUnion, publishPiiRects, subscribePiiRects } from "./pii-masks";

class Channel {
  static all: Channel[] = [];
  onmessage?: (event: { data: unknown }) => void;
  postMessage = vi.fn((data: unknown) => { for (const c of Channel.all) if (c !== this) c.onmessage?.({ data }); });
  close = vi.fn();
  constructor(readonly name: string) { Channel.all.push(this); }
}
afterEach(() => { vi.unstubAllGlobals(); Channel.all = []; });

const docWith = (x: number) => ({
  defaultView: { innerWidth: 200, innerHeight: 100, getComputedStyle: () => ({ position: "static", overflowX: "visible", overflowY: "visible" }) },
  querySelectorAll: () => [{ getAttribute: () => "name", parentElement: null, getBoundingClientRect: () => ({ x, y: 20, width: 40, height: 30 }) }],
}) as unknown as Document;

describe("two sandbox tabs on one app+queue (PII channel union)", () => {
  it("two publishers with different rects: the receiver paints the union", () => {
    vi.stubGlobal("BroadcastChannel", Channel);
    const union = new PiiChannelUnion(3000);
    const stop = subscribePiiRects("o|erp|expert", (m) => union.put(m));
    const a = publishPiiRects("o|erp|expert", docWith(10), "tab-a");
    const b = publishPiiRects("o|erp|expert", docWith(100), "tab-b");
    expect(a?.instanceId).toBe("tab-a");
    const painted = union.rects(Math.max(a!.at, b!.at));
    expect(painted?.map((r) => r.x)).toEqual([0.05, 0.5]);
    // the same tab republishing replaces only its own entry
    publishPiiRects("o|erp|expert", docWith(60), "tab-a");
    expect(union.rects(Date.now())?.map((r) => r.x).sort()).toEqual([0.3, 0.5]);
    stop();
  });
  it("a stale entry expires after 3 s; with none fresh, nothing is reported", () => {
    const union = new PiiChannelUnion(3000);
    union.put({ at: 1000, rects: [{ x: 0, y: 0, w: 0.1, h: 0.1, kind: "name" }], instanceId: "a" });
    union.put({ at: 3500, rects: [{ x: 0.5, y: 0, w: 0.1, h: 0.1, kind: "iban" }], instanceId: "b" });
    expect(union.rects(3900)?.map((r) => r.kind)).toEqual(["name", "iban"]);
    expect(union.rects(4100)?.map((r) => r.kind)).toEqual(["iban"]);
    expect(union.rects(7000)).toBeUndefined();
  });
  it("an out-of-order older message from the same tab does not replace a newer one", () => {
    const union = new PiiChannelUnion(3000);
    union.put({ at: 2000, rects: [{ x: 0.5, y: 0, w: 0.1, h: 0.1, kind: "iban" }], instanceId: "a" });
    union.put({ at: 1500, rects: [], instanceId: "a" });
    expect(union.rects(2100)).toHaveLength(1);
  });
});
