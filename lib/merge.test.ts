import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { EventMerger, type MergeEvent, type MergeTelemetry, type MergerConfig } from "./merge";

const events: MergeEvent[] = [], frames: string[] = [];
const update = vi.fn();
const setup = (cfg: Partial<MergerConfig> = {}) => new EventMerger({
  now: () => (Date.now() - 100000) / 1000, wallMs: () => Date.now(),
  setTimer: (fn, ms) => setTimeout(fn, ms), clearTimer: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
  emit: (e, frame) => { const stored = { ...e, id: `event-${events.length}` }; events.push(stored); frames.push(frame); return stored; }, update,
}, { source: "both", ...cfg });
const telemetry = (patch: Partial<MergeTelemetry> = {}): MergeTelemetry => ({
  kind: "field_changed", invoice: "INV-1001", field: "costCenter", from: "010", to: "020", at: Date.now(), ...patch,
});
const vision = (m: EventMerger, patch: Partial<MergeEvent> = {}, changed = true) => m.onVision([
  { source: "vision", kind: "field_changed", invoice: "1001", field: "costCenter", from: "wrong", to: "020", ...patch },
], { capturedAt: (Date.now() - 100000) / 1000, confidence: 0.9, uiActivity: "reading", screenChangedRecently: changed });
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(100000); events.length = frames.length = 0; update.mockClear(); });
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

it("merges a held observation with ERP identity, time, mode and exact state, disclosing mismatches", () => {
  const m = setup(); m.setVisionAlive(true);
  m.onTelemetry(telemetry({ mode: "independent", boundary: true, state: { invoice: "INV-1001", supplier: "ERP", amount: 0 } }));
  vi.advanceTimersByTime(900);
  vision(m, { state: { invoice: "1001", supplier: "misread", hasPO: false } });
  expect(events).toMatchObject([{ source: "vision", alsoSeenBy: "dom", invoice: "1001", from: "010", to: "020", t: 0,
    mode: "independent", boundary: true, latencyMs: 900, confidence: 0.9, uiActivity: "reading",
    state: { invoice: "1001", supplier: "ERP", amount: 0, hasPO: false } }]);
  expect(m.counters).toMatchObject({ merged: 1, stateMismatches: 1, domOnly: 0, visionOnly: 0 });
  expect(frames).toEqual(["sent"]); vi.advanceTimersByTime(5000); expect(events).toHaveLength(1);
});
it.each(["dom", "both"] as const)("emits immediately in %s/holdMs=0 and late vision only updates the stored object", (source) => {
  const m = setup({ source, holdMs: 0 }); m.setVisionAlive(true); m.onTelemetry(telemetry({ mode: "independent" }));
  expect(events).toHaveLength(1); const first = events[0]; vi.advanceTimersByTime(6000); vision(m);
  expect(events).toEqual([first]); expect(first.source).toBe("dom"); expect(frames).toEqual(["post-repaint"]);
  if (source === "both") { expect(first).toMatchObject({ alsoSeenBy: "vision", latencyMs: 6000 }); expect(update).toHaveBeenCalledWith(first); }
  else expect(update).not.toHaveBeenCalled();
});
it("updates vision-first evidence in both mode without changing its time, source or id", () => {
  const m = setup(); vision(m, { state: { supplier: "vision" } }); const first = events[0];
  vi.advanceTimersByTime(8000); m.onTelemetry(telemetry({ mode: "independent", state: { supplier: "ERP" } }));
  expect(events).toEqual([first]); expect(first).toMatchObject({ source: "vision", t: 0, alsoSeenBy: "dom", mode: "independent", state: { supplier: "ERP" } });
  expect(m.counters).toMatchObject({ visionOnly: 0, lateConfirmed: 1, stateMismatches: 1 });
});
it.each(["vision", "dom", "both"] as const)("delivers and deduplicates ERP controls in %s without visual promotion", (source) => {
  const m = setup({ source }); m.setVisionAlive(true);
  for (let i = 0; i < 2; i++) for (const kind of ["save_intent", "save_blocked"] as const) m.onTelemetry(telemetry({ kind }));
  expect(events.map((e) => [e.kind, e.source, e.alsoSeenBy])).toEqual([["save_intent", "dom", undefined], ["save_blocked", "dom", undefined]]);
  expect(frames).toEqual(["none", "post-repaint"]); vision(m, { kind: "save_blocked" }); vision(m, { kind: "save_intent" });
  expect(events).toHaveLength(2); vi.advanceTimersByTime(1000); m.onTelemetry(telemetry({ kind: "save_intent" })); expect(events).toHaveLength(3);
});
it("uses only telemetry mode in vision-only events; never overlays ERP state", () => {
  const m = setup({ source: "vision" }); m.onTelemetry(telemetry({ mode: "independent", state: { supplier: "ERP" } }));
  expect(events).toEqual([]); vision(m, { state: { supplier: "vision" } });
  m.onTelemetry(telemetry({ state: { supplier: "ERP" } }));
  expect(events).toMatchObject([{ source: "vision", mode: "independent", state: { supplier: "vision" } }]); expect(update).not.toHaveBeenCalled();
});
it.each(["notes", "assetNumber"])("coalesces ten %s keystrokes after quiet, preserving first from and last to", (field) => {
  const m = setup(); m.setVisionAlive(true);
  for (let i = 0; i < 10; i++) { m.onTelemetry(telemetry({ field, from: String(i), to: String(i + 1) })); vi.advanceTimersByTime(100); }
  vision(m, { field, to: "entered" }); expect(events.map((e) => e.kind)).toEqual(["typing"]);
  vi.advanceTimersByTime(1099); expect(events).toHaveLength(1); vi.advanceTimersByTime(1);
  expect(events[1]).toMatchObject({ source: "dom", kind: "field_changed", field, from: "0", to: "10", t: 0 });
  expect(frames).toEqual(["none", field === "notes" ? "none" : "post-repaint"]); expect(m.lastTypingAt).toBe(0.9);
});
it("throttles typing across both sources to one event per four seconds, without frames", () => {
  const m = setup(); m.onTelemetry(telemetry({ kind: "typing" })); vi.advanceTimersByTime(3999); vision(m, { kind: "typing" });
  expect(m.lastTypingAt).toBe(3.999); expect(events).toHaveLength(1); vi.advanceTimersByTime(1); vision(m, { kind: "typing" });
  expect(events).toHaveLength(2); expect(frames).toEqual(["none", "none"]);
});
it("filters pre-Start, wrong-queue, missing-queue, stale-session and negative-time telemetry", () => {
  const m = setup({ enabled: false, acceptQueues: ["expert"], sessionId: "session" });
  m.onTelemetry(telemetry({ queue: "expert" })); vision(m); m.setActive(true);
  for (const patch of [{ queue: "newhire" as const }, {}, { queue: "expert" as const, sandboxSession: "stale" }, { queue: "expert" as const, at: 99999 }]) m.onTelemetry(telemetry(patch));
  expect(events).toEqual([]); expect(m.counters.telemetryDropped).toBe(5);
  m.onTelemetry(telemetry({ queue: "expert", sandboxSession: "session" })); expect(events).toHaveLength(1);
});
it("drops held, debounce and late updates inside strikes and retains strikes over pause/resume", () => {
  const m = setup(); m.setVisionAlive(true); m.onTelemetry(telemetry()); m.onTelemetry(telemetry({ field: "notes" }));
  m.strike({ from: 0, to: 1 }); m.setActive(true, true); m.onTelemetry(telemetry()); vision(m); m.setActive(true);
  vi.advanceTimersByTime(5000); m.onTelemetry(telemetry({ at: 100000 }));
  m.onVision([{ source: "vision", kind: "invoice_opened" }], { capturedAt: 0, confidence: 1, uiActivity: "idle", screenChangedRecently: true });
  expect(events.map((e) => e.kind)).toEqual(["typing"]); expect(update).not.toHaveBeenCalled();
  m.reset(); m.onTelemetry(telemetry()); expect(events.at(-1)?.kind).toBe("field_changed");
});
it("cancels delayed emissions on disable and reset and forgets old corroboration", () => {
  const m = setup(); m.setVisionAlive(true); m.onTelemetry(telemetry()); m.setActive(false); vi.advanceTimersByTime(5000);
  expect(events).toEqual([]); m.setActive(true); vision(m); m.reset(); m.onTelemetry(telemetry());
  expect(events).toHaveLength(2); expect(update).not.toHaveBeenCalled();
});
it("uses the default hold before five samples, then clamps latency-based holds", () => {
  const m = setup(); m.setVisionAlive(true, 10); m.onTelemetry(telemetry()); vi.advanceTimersByTime(3499); expect(events).toHaveLength(0);
  vi.advanceTimersByTime(1); expect(events[0].t).toBe(0);
  for (let i = 0; i < 4; i++) m.setVisionAlive(true, 10);
  m.onTelemetry(telemetry({ to: "030" })); vi.advanceTimersByTime(2499); expect(events).toHaveLength(1); vi.advanceTimersByTime(1); expect(events).toHaveLength(2);
  for (let i = 0; i < 20; i++) m.setVisionAlive(true, 9000);
  m.onTelemetry(telemetry({ to: "040" })); vi.advanceTimersByTime(4999); expect(events).toHaveLength(2); vi.advanceTimersByTime(1); expect(events).toHaveLength(3);
});
it("flushes ordinary holds honestly when vision dies and does not orphan a repeated hold", () => {
  const m = setup(); m.setVisionAlive(true); m.onTelemetry(telemetry()); vi.advanceTimersByTime(1000); m.onTelemetry(telemetry());
  m.setVisionAlive(false); expect(events).toMatchObject([{ source: "dom", t: 0 }]); vi.advanceTimersByTime(5000); expect(events).toHaveLength(1);
});
it("requires consecutive repeats on a static vision-only screen and deduplicates for five seconds", () => {
  const m = setup({ source: "vision" }); vision(m, {}, false); expect(events).toEqual([]);
  m.onVision([], { capturedAt: 0, confidence: 1, uiActivity: "idle", screenChangedRecently: false }); vision(m, {}, false); expect(events).toEqual([]);
  vision(m, {}, false); expect(events).toHaveLength(1); vi.advanceTimersByTime(5000); vision(m); expect(events).toHaveLength(1);
  vi.advanceTimersByTime(1); vision(m); expect(events).toHaveLength(2);
});
it.each(["invoice_opened", "invoice_closed", "save_clicked"] as const)("ignores field/to noise and normalizes ids for %s keys", (kind) => {
  const m = setup(); m.setVisionAlive(true); m.onTelemetry(telemetry({ kind, invoice: " Invoice #1001 " })); vision(m, { kind, field: undefined, to: undefined });
  expect(events).toMatchObject([{ invoice: "1001", source: "vision", alsoSeenBy: "dom" }]);
});
it("expires late confirmation after eight seconds and never merges different destinations", () => {
  const m = setup(); m.onTelemetry(telemetry()); vi.advanceTimersByTime(8001); vision(m); vision(m, { to: "030" });
  expect(events).toHaveLength(3); expect(update).not.toHaveBeenCalled();
});
it("only cancels struck holds, leaving unrelated invoices and post-strike work intact", () => {
  const m = setup(); m.setVisionAlive(true); m.onTelemetry(telemetry()); vi.advanceTimersByTime(2000);
  m.onTelemetry(telemetry({ invoice: "1002" })); m.strike({ from: 0, to: 1 }); vi.advanceTimersByTime(3500);
  expect(events).toMatchObject([{ source: "dom", invoice: "1002", t: 2 }]);
  m.onTelemetry(telemetry()); vision(m); expect(events).toHaveLength(2);
});
it("cannot late-update a struck event and clears candidates and mode on reset", () => {
  const m = setup(); vision(m); m.strike({ from: 0, to: 1 }); vi.advanceTimersByTime(2000); m.onTelemetry(telemetry());
  expect(events).toHaveLength(2); expect(update).not.toHaveBeenCalled();
  const v = setup({ source: "vision" }); v.onTelemetry(telemetry({ mode: "independent" })); vision(v, {}, false); v.reset();
  vision(v, {}, false); expect(events).toHaveLength(2); vision(v, {}, false); expect(events.at(-1)?.mode).toBeUndefined();
});
it("keeps same-source reports honest and releases one held repeat at its original deadline", () => {
  const m = setup(); m.setVisionAlive(true); m.onTelemetry(telemetry()); vi.advanceTimersByTime(3000);
  m.onTelemetry(telemetry({ state: { amount: 12 } })); vi.advanceTimersByTime(500);
  expect(events).toMatchObject([{ source: "dom", t: 0, state: { amount: 12 } }]); expect(events[0].alsoSeenBy).toBeUndefined();
  vi.advanceTimersByTime(5000); expect(events).toHaveLength(1);
});
