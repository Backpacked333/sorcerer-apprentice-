import { describe, expect, it } from "vitest";
import { decideSelfCapture, type SelfCaptureInput } from "./capture-frame";

const vp = { w: 1440, h: 900 };
// same aspect as the viewport (DPR 2): a same-window sibling tab looks exactly like this tab
const base: SelfCaptureInput = { surface: "browser", videoW: 2880, videoH: 1800, viewport: vp, mode: "tab", ownHandle: "tacit_abc", trackHandleApi: true, trackHandle: "tacit_abc" };

describe("decideSelfCapture (M1)", () => {
  it("our own capture handle proves this tab, in tab and workspace mode", () => {
    expect(decideSelfCapture(base)).toBe(true);
    expect(decideSelfCapture({ ...base, mode: "workspace" })).toBe(true);
  });
  it("a same-aspect sibling tab without our handle is not self", () => {
    expect(decideSelfCapture({ ...base, trackHandle: null })).toBe(false);
    expect(decideSelfCapture({ ...base, trackHandle: undefined, mode: "workspace" })).toBe(false);
    expect(decideSelfCapture({ ...base, trackHandle: "tacit_other" })).toBe(false);
  });
  it("our handle on a non-browser surface is not self", () => {
    expect(decideSelfCapture({ ...base, surface: "window" })).toBe(false);
  });
  it("without the Capture Handle API, the aspect guess applies only in workspace mode", () => {
    const noApi = { ...base, ownHandle: null, trackHandleApi: false, trackHandle: undefined };
    expect(decideSelfCapture({ ...noApi, mode: "workspace" })).toBe(true);
    expect(decideSelfCapture({ ...noApi, mode: "tab" })).toBe(false);
    expect(decideSelfCapture({ ...noApi, mode: "workspace", videoW: 1920, videoH: 1080 })).toBe(false);
    expect(decideSelfCapture({ ...noApi, mode: "workspace", surface: "monitor" })).toBe(false);
  });
  it("a handle we set but a track without getCaptureHandle falls back to the workspace-only aspect guess", () => {
    expect(decideSelfCapture({ ...base, trackHandleApi: false, trackHandle: undefined, mode: "tab" })).toBe(false);
    expect(decideSelfCapture({ ...base, trackHandleApi: false, trackHandle: undefined, mode: "workspace" })).toBe(true);
  });
});
