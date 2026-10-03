import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { ScreenEvent } from "./events";
import type { TelemetryMessage } from "./telemetry";
import { useScreenPipeline } from "@/components/useScreenPipeline";

const h = vi.hoisted(() => ({ index: 0, slots: [] as { value?: unknown; deps?: unknown[]; cleanup?: () => void }[], effects: [] as (() => void)[], telemetry: (_m: TelemetryMessage) => {} }));
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
vi.mock("./telemetry", () => ({ subscribeTelemetry: (fn: typeof h.telemetry) => { h.telemetry = fn; return () => {}; } }));
vi.mock("./redact", () => ({ blurRegions: () => 0 }));
const fetchMock = vi.fn(), encode = vi.fn(() => "data:image/jpeg;base64,/9j/"), trackStop = vi.fn();
const events: ScreenEvent[] = [];
let pipeline: ReturnType<typeof useScreenPipeline>;
const options = { sessionStart: 0, source: "both" as "both" | "dom", onEvent: (e: ScreenEvent) => events.push(e) };
const render = () => { h.index = 0; pipeline = useScreenPipeline(options); h.effects.splice(0).forEach((f) => f()); };
const tick = async (ms = 1500) => { await vi.advanceTimersByTimeAsync(ms); render(); };
const response = (status = 200, data = {}) => ({ status, ok: status === 200, json: async () => data });
const frame = (state = {}, screen = "invoice_detail", banner = "none") => ({ state, screen, banner, confidence: 1, uiActivity: "reading", piiRegions: [], latencyMs: 10 });

beforeEach(async () => {
  vi.useFakeTimers(); vi.setSystemTime(0); h.index = 0; h.slots = []; h.effects = []; events.length = 0; options.source = "both";
  fetchMock.mockReset().mockResolvedValue(response(200, frame())); encode.mockClear(); trackStop.mockClear();
  vi.stubGlobal("window", globalThis); vi.stubGlobal("fetch", fetchMock);
  const ctx = { drawImage() {}, getImageData: () => ({ data: new Uint8ClampedArray(64 * 36 * 4) }) };
  vi.stubGlobal("document", { createElement: () => ({ getContext: () => ctx, toDataURL: encode }) });
  const track = { stop: trackStop, addEventListener() {} };
  vi.stubGlobal("navigator", { mediaDevices: { getDisplayMedia: async () => ({ getTracks: () => [track], getVideoTracks: () => [track] }) } });
  render(); pipeline.videoRef.current = { videoWidth: 1024, videoHeight: 768, play: async () => {} } as unknown as HTMLVideoElement;
  await pipeline.start(); render();
});
afterEach(() => { h.slots.forEach((s) => s.cleanup?.()); vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); });

it("disables requests and vision encoding after mock 503 until a new Start", async () => {
  fetchMock.mockResolvedValue(response(503, { mock: true, error: "keyless" }));
  await tick(500); await tick(10000);
  expect(fetchMock).toHaveBeenCalledTimes(1); expect(encode).toHaveBeenCalledTimes(1);
  expect([pipeline.framesSeen, pipeline.framesSent]).toEqual([0, 0]);
  pipeline.setPaused(true); pipeline.setPaused(false); await tick(); expect(fetchMock).toHaveBeenCalledTimes(1);
  pipeline.stop(); render(); await pipeline.start(); render(); await tick(); expect(fetchMock).toHaveBeenCalledTimes(2);
});
it.each([502, 503, 504, 201])("counts only HTTP 200, allowing retry after non-mock %s", async (status) => {
  fetchMock.mockResolvedValueOnce(response(status, { error: "unavailable" }));
  await tick(500); expect([pipeline.framesSeen, pipeline.framesSent]).toEqual([0, 0]);
  await tick(); expect([pipeline.framesSeen, pipeline.framesSent]).toEqual([1, 1]);
});
it("does not open list rows or use DOM state as visual observation", async () => {
  fetchMock.mockResolvedValueOnce(response(200, frame({ invoice: "INV-1001" }, "invoice_list")));
  await tick(500); expect(events).toEqual([]); expect(pipeline.currentState.current).toEqual({});
  h.telemetry({ kind: "invoice_opened", invoice: "1001", state: { invoice: "1001", costCenter: "010" }, at: Date.now() });
  fetchMock.mockResolvedValue(response(200, frame({ invoice: "INV-1002", costCenter: "020" })));
  await tick();
  expect(events.filter((e) => e.source === "vision").map((e) => [e.kind, e.invoice])).toEqual([["invoice_opened", "1002"]]);
});
it("keeps unmatched held events and ERP control verdicts DOM-sourced", async () => {
  await tick(500);
  h.telemetry({ kind: "field_changed", invoice: "1001", field: "costCenter", from: "010", to: "020", at: Date.now() });
  h.telemetry({ kind: "save_blocked", invoice: "1001", blocked: { ruleId: "rule", title: "held" }, at: Date.now() });
  await tick(3000);
  expect(events).toHaveLength(2); expect(events.every((e) => e.source === "dom" && !e.alsoSeenBy)).toBe(true);
});
it("keeps same-invoice ERP fields in combined state, but not across invoice switches or lists", async () => {
  h.telemetry({ kind: "invoice_opened", invoice: "INV-1001", state: { invoice: "INV-1001", amount: 7200, category: "equipment" }, at: Date.now() });
  fetchMock.mockResolvedValue(response(200, frame({ invoice: "1001", costCenter: "020" }))); await tick(500);
  expect(pipeline.currentState.current).toMatchObject({ invoice: "1001", amount: 7200, category: "equipment", costCenter: "020" });
  expect(events.at(-1)?.state).toMatchObject({ amount: 7200, category: "equipment" });
  h.telemetry({ kind: "save_blocked", invoice: "1001", state: { invoice: "1001", costCenter: "030" }, at: Date.now() });
  fetchMock.mockResolvedValue(response(200, frame({ invoice: "1001" }))); await tick();
  expect(pipeline.currentState.current.costCenter).toBe("030");
  fetchMock.mockResolvedValue(response(200, frame({}, "invoice_list", "posted"))); await tick();
  expect(events.find((e) => e.kind === "save_clicked")?.state).toMatchObject({ invoice: "1001", amount: 7200, category: "equipment" });
  expect(pipeline.currentState.current).toEqual({});
  fetchMock.mockResolvedValue(response(200, frame({ invoice: "1002", costCenter: "040" }))); await tick();
  expect(pipeline.currentState.current).toEqual({ invoice: "1002", costCenter: "040" });
  fetchMock.mockResolvedValue(response(200, frame({ invoice: "1002" }, "invoice_list"))); await tick();
  expect(pipeline.currentState.current).toEqual({});
});
it("never promotes a second DOM report to vision while the first is held", async () => {
  await tick(500);
  const event: TelemetryMessage = { kind: "field_changed", invoice: "1001", field: "costCenter", to: "020", at: Date.now() };
  h.telemetry(event); fetchMock.mockResolvedValueOnce(response(502)); await tick();
  h.telemetry({ ...event, at: Date.now() });
  expect(events).toMatchObject([{ source: "dom", kind: "field_changed" }]); expect(events[0].alsoSeenBy).toBeUndefined();
});
it("keeps keyless shutdown even when consent changes before the response", async () => {
  let resolve!: (value: ReturnType<typeof response>) => void;
  fetchMock.mockReturnValueOnce(new Promise((r) => { resolve = r; }));
  await tick(500); pipeline.setPaused(true); resolve(response(503, { mock: true })); await tick();
  pipeline.setPaused(false); await tick(5000);
  expect(fetchMock).toHaveBeenCalledTimes(1); expect(encode).toHaveBeenCalledTimes(1);
});
it.each([200, 503])("discards late %s responses from a stopped capture without disabling a new Start", async (status) => {
  let resolve!: (value: ReturnType<typeof response>) => void;
  fetchMock.mockReturnValueOnce(new Promise((r) => { resolve = r; }));
  await tick(500); pipeline.stop(); render(); await pipeline.start(); render();
  resolve(response(status, status === 200 ? frame({ invoice: "old" }) : { mock: true })); await Promise.resolve(); await Promise.resolve(); render();
  expect(pipeline.framesSeen).toBe(0); expect(events).toEqual([]);
  await tick(); expect(pipeline.framesSeen).toBe(1); expect(fetchMock).toHaveBeenCalledTimes(2);
});
it("aborts a hung request after nine seconds and can retry", async () => {
  fetchMock.mockImplementationOnce((_url, { signal }: RequestInit) => new Promise((_resolve, reject) => signal!.addEventListener("abort", () => reject(new Error("aborted")))));
  await tick(500); await tick(8999); expect(pipeline.framesSeen).toBe(0); await tick(1);
  expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true);
  await tick(500); expect(pipeline.framesSeen).toBe(1);
});
it.each(["both", "dom"] as const)("stops capture and telemetry at fifteen minutes (%s)", async (source) => {
  options.source = source; render();
  fetchMock.mockResolvedValue(response(503, { mock: true }));
  await tick(15 * 60 * 1000 - 1); expect(trackStop).not.toHaveBeenCalled(); await tick(1);
  expect(trackStop).toHaveBeenCalled(); expect(pipeline.sharing).toBe(false);
  const encoded = encode.mock.calls.length;
  const emitted = events.length;
  h.telemetry({ kind: "save_blocked", invoice: "1001", at: Date.now() }); await tick(5000);
  expect(events).toHaveLength(emitted); expect(encode).toHaveBeenCalledTimes(encoded);
  expect(fetchMock).toHaveBeenCalledTimes(source === "both" ? 1 : 0);
  await pipeline.start(); render();
  h.telemetry({ kind: "save_blocked", invoice: "1002", at: Date.now() }); expect(events).toHaveLength(emitted + 1);
});
it("clears pending held telemetry when the capture expires", async () => {
  await tick(15 * 60 * 1000 - 1000);
  h.telemetry({ kind: "field_changed", invoice: "1001", field: "costCenter", to: "020", at: Date.now() });
  await tick(5000); expect(events).toEqual([]);
});
