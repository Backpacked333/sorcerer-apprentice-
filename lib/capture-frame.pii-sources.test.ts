import { describe, expect, it } from "vitest";
import { decideCapture, pixelTypingSource, planFrame, type SelfCaptureInput } from "./capture-frame";

const vp = { w: 1440, h: 900 };
// same aspect as the viewport: a same-window sibling sandbox tab looks exactly like this tab
const base: SelfCaptureInput = { surface: "browser", videoW: 2880, videoH: 1800, viewport: vp, mode: "workspace", ownHandle: "tacit_abc", trackHandleApi: true, trackHandle: "tacit_abc" };

describe("decideCapture: PII sources by how self was decided", () => {
  it("a decisive own handle uses this tab's DOM PII alone", () => {
    expect(decideCapture(base)).toEqual({ self: true, piiSources: ["dom"] });
  });
  it("a heuristic self (no handle on the track) unions this tab's DOM PII with the paired channel", () => {
    expect(decideCapture({ ...base, trackHandle: undefined })).toEqual({ self: true, piiSources: ["dom", "channel"] });
    expect(decideCapture({ ...base, trackHandle: null })).toEqual({ self: true, piiSources: ["dom", "channel"] });
    expect(decideCapture({ ...base, trackHandleApi: false, trackHandle: undefined, ownHandle: null })).toEqual({ self: true, piiSources: ["dom", "channel"] });
  });
  it("another browser surface uses the channel only; a window/monitor gets none", () => {
    expect(decideCapture({ ...base, trackHandle: "sandbox:erp" })).toEqual({ self: false, piiSources: ["channel"] });
    expect(decideCapture({ ...base, trackHandle: null, mode: "tab" })).toEqual({ self: false, piiSources: ["channel"] });
    expect(decideCapture({ ...base, surface: "monitor", trackHandle: null })).toEqual({ self: false, piiSources: [] });
  });
  it("planFrame paints channel rects together with this tab's DOM rects on a self capture", () => {
    const spec = planFrame({ videoW: 1440, videoH: 900, viewport: vp, self: true, piiCss: [{ x: 0, y: 0, w: 144, h: 90, kind: "name" }], piiFrame: [{ x: 0.5, y: 0.5, w: 0.1, h: 0.1, kind: "iban" }] });
    expect(spec.pii.map((r) => r.kind)).toEqual(["name", "iban"]);
    expect(spec.pii[1]).toMatchObject({ x: expect.closeTo(0.5), y: expect.closeTo(0.5) });
  });
});

describe("pixel-diff typing source", () => {
  it("is vision for claims or a vision-only source, dom for the ERP otherwise", () => {
    expect(pixelTypingSource("claims", "vision")).toBe("vision");
    expect(pixelTypingSource("claims", "both")).toBe("vision");
    expect(pixelTypingSource("erp", "vision")).toBe("vision");
    expect(pixelTypingSource("erp", "both")).toBe("dom");
    expect(pixelTypingSource("erp", "dom")).toBe("dom");
  });
});
