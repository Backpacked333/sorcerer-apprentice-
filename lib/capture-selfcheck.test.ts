import { describe, expect, it, vi } from "vitest";
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
    // No handle on the captured surface: tab mode is never self; workspace falls back to the aspect check.
    expect(decideSelfCapture({ ...base, trackHandle: null })).toBe(false);
    expect(decideSelfCapture({ ...base, trackHandle: undefined, mode: "workspace" })).toBe(true);
    expect(decideSelfCapture({ ...base, trackHandle: null, mode: "workspace", videoW: 1920, videoH: 1080 })).toBe(false);
    // A sibling sandbox tab announces its own handle, so the same aspect is not enough.
    expect(decideSelfCapture({ ...base, trackHandle: "sandbox:erp", mode: "workspace" })).toBe(false);
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

// ---- the hook: a share that resolves after stop() is discarded (minimal React harness, as in capture-frame.test.ts) ----
const h = vi.hoisted(() => ({ index: 0, slots: [] as { value?: unknown; deps?: unknown[]; cleanup?: () => void }[], effects: [] as (() => void)[] }));
vi.mock("react", () => {
  const slot = () => h.slots[h.index++] ?? (h.slots[h.index - 1] = {});
  const changed = (s: typeof h.slots[number], deps: unknown[]) => !s.deps || deps.some((d, i) => !Object.is(d, s.deps![i]));
  return {
    useRef: (value: unknown) => { const s = slot(); return s.value ??= { current: value }; },
    useState: (value: unknown) => { const s = slot(); if (!("value" in s)) s.value = value; return [s.value, (v: unknown) => { s.value = typeof v === "function" ? v(s.value) : v; }]; },
    useCallback: (fn: unknown, deps: unknown[]) => { const s = slot(); if (changed(s, deps)) { s.value = fn; s.deps = deps; } return s.value; },
    useEffect: (fn: () => (() => void) | undefined, deps: unknown[]) => { const s = slot(); if (changed(s, deps)) { s.deps = deps; h.effects.push(() => { s.cleanup?.(); s.cleanup = fn(); }); } },
  };
});
vi.mock("./telemetry", () => ({ subscribeTelemetry: () => () => {} }));

describe("useScreenPipeline start/stop race (MINOR 3)", async () => {
  const { useScreenPipeline } = await import("@/components/useScreenPipeline");
  it("stop() while the picker is open stops the late stream and never sets sharing", async () => {
    h.index = 0; h.slots = []; h.effects = [];
    const stopped = vi.fn();
    const track = { stop: stopped, addEventListener() {}, getSettings: () => ({ displaySurface: "browser", width: 2880, height: 1800 }) };
    let resolve!: (s: unknown) => void;
    const gdm = vi.fn(() => new Promise((r) => { resolve = r; }));
    const setCfg = vi.fn();
    vi.stubGlobal("window", Object.assign(globalThis, { innerWidth: 1440, innerHeight: 900 }));
    vi.stubGlobal("navigator", { mediaDevices: { getDisplayMedia: gdm, setCaptureHandleConfig: setCfg } });
    vi.stubGlobal("location", { origin: "http://localhost" });
    try {
      let p!: ReturnType<typeof useScreenPipeline>;
      const render = () => { h.index = 0; p = useScreenPipeline({ sessionStart: 0, source: "dom", onEvent: () => {} }); h.effects.splice(0).forEach((f) => f()); };
      render();
      const started = p.start({ mode: "tab" });
      expect(setCfg).toHaveBeenCalledTimes(1); // capture handle set in tab mode too
      p.stop(); // e.g. the session POST failed
      resolve({ getTracks: () => [track], getVideoTracks: () => [track] });
      await started; render();
      expect(stopped).toHaveBeenCalled();
      expect(p.sharing).toBe(false);
    } finally { h.slots.forEach((x) => x.cleanup?.()); vi.unstubAllGlobals(); }
  });
});
