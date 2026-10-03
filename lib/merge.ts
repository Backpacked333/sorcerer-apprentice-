import type { ScreenEvent } from "./events";
import type { TelemetryMessage } from "./telemetry";
import type { Queue } from "./erp-model";

// Additive bridge until the shared telemetry contracts land; no runtime dependency on them.
export type MergeEvent = Omit<ScreenEvent, "kind"> & { kind: ScreenEvent["kind"] | "save_intent"; latencyMs?: number };
export type MergeTelemetry = Omit<TelemetryMessage, "kind"> & Pick<MergeEvent, "kind"> & { queue?: Queue; sandboxSession?: string };
type Spec = Omit<MergeEvent, "id" | "t">;
type Pending = { event: Omit<MergeEvent, "id">; at: number; timer: unknown };
type Recent = { event: MergeEvent; at: number; erpAt?: number };
type Range = { from: number; to: number };
export interface MergerDeps {
  now(): number;
  wallMs(): number;
  setTimer(fn: () => void, ms: number): unknown;
  clearTimer(handle: unknown): void;
  emit(event: Omit<MergeEvent, "id">, frame: "post-repaint" | "sent" | "none"): MergeEvent;
  update(event: MergeEvent): void;
}
export interface MergerConfig {
  source: "dom" | "vision" | "both";
  holdMs?: number;
  acceptQueues?: Queue[];
  sessionId?: string;
  enabled?: boolean;
}
const norm = (id?: string) => id?.trim().replace(/^inv(oice)?[\s#:.-]*/i, "").trim() || undefined;
const normalize = <T extends { invoice?: string; state?: ScreenEvent["state"] }>(e: T): T => ({
  ...e, invoice: norm(e.invoice), state: e.state && { ...e.state, ...(e.state.invoice === undefined ? {} : { invoice: norm(e.state.invoice) }) },
});
const control = (e: Spec) => e.kind === "save_blocked" || e.kind === "save_intent";
const textEdit = (e: Spec) => e.kind === "field_changed" && (e.field === "notes" || e.field === "assetNumber");
const key = (e: Spec) => JSON.stringify([e.kind, norm(e.invoice),
  ...(["invoice_opened", "invoice_closed", "save_clicked"].includes(e.kind) ? [] : [e.field, ...(textEdit(e) ? [] : [e.to])])]);

export class EventMerger {
  counters = { telemetryDropped: 0, merged: 0, lateConfirmed: 0, domOnly: 0, visionOnly: 0, stateMismatches: 0 };
  lastTypingAt = -Infinity;
  private typingEmittedAt = -Infinity;
  private pending = new Map<string, Pending>();
  private recent = new Map<string, Recent>();
  private candidates = new Set<string>();
  private modes = new Map<string, MergeEvent["mode"]>();
  private ranges: Range[] = [];
  private alive = false;
  private latencies: number[] = [];
  private active: boolean;
  constructor(private deps: MergerDeps, private cfg: MergerConfig) { this.active = cfg.enabled !== false; }
  private struck(t: number) { return this.ranges.some((r) => t >= r.from && t <= r.to); }
  private remember(e: Omit<MergeEvent, "id">, frame: "post-repaint" | "sent" | "none", erpAt?: number) {
    const event = this.deps.emit(e, frame);
    this.recent.set(key(e), { event, at: this.deps.wallMs(), erpAt });
    if (!control(e) && e.kind !== "typing" && !e.alsoSeenBy) this.counters[e.source === "dom" ? "domOnly" : "visionOnly"]++;
  }
  private prune() {
    for (const [k, r] of this.recent) if (this.deps.wallMs() - r.at > 8000) this.recent.delete(k);
  }
  private typing(e: Omit<MergeEvent, "id">) {
    this.lastTypingAt = this.deps.now();
    if (this.lastTypingAt - this.typingEmittedAt < 4) return;
    this.typingEmittedAt = this.lastTypingAt;
    this.deps.emit({ t: e.t, source: e.source, kind: "typing", invoice: e.invoice, uiActivity: "typing" }, "none");
  }
  private overlay(visual: ScreenEvent["state"], erp: ScreenEvent["state"]) {
    for (const [field, value] of Object.entries(erp ?? {})) {
      const seen = visual?.[field as keyof NonNullable<ScreenEvent["state"]>];
      if (seen !== undefined && value !== undefined && seen !== value) this.counters.stateMismatches++;
    }
    return { ...visual, ...erp };
  }
  private hold(e: Omit<MergeEvent, "id">, at: number, delay: number, debounce = false) {
    const k = key(e), old = this.pending.get(k);
    if (old) {
      old.event = { ...old.event, ...e, t: old.event.t, from: old.event.from };
      if (!debounce) return;
      this.deps.clearTimer(old.timer);
    }
    const item: Pending = { event: old?.event ?? e, at: old?.at ?? at, timer: undefined };
    item.timer = this.deps.setTimer(() => {
      this.pending.delete(k);
      if (this.active && !this.struck(item.event.t)) this.remember(item.event, item.event.field === "notes" ? "none" : "post-repaint", item.at);
    }, delay);
    this.pending.set(k, item);
  }
  onTelemetry(message: MergeTelemetry): void {
    const t = this.deps.now() - (this.deps.wallMs() - message.at) / 1000;
    if (!this.active || !Number.isFinite(t) || t < 0 || this.struck(t) ||
      (this.cfg.acceptQueues && (!message.queue || !this.cfg.acceptQueues.includes(message.queue))) ||
      (message.sandboxSession !== undefined && message.sandboxSession !== this.cfg.sessionId)) {
      this.counters.telemetryDropped++; return;
    }
    const { at, queue, sandboxSession, ...payload } = normalize(message);
    const e = { ...payload, source: "dom" as const, t };
    this.prune();
    const k = key(e), recent = this.recent.get(k);
    if (e.invoice && e.mode) this.modes.set(e.invoice, e.mode);
    if (control(e)) {
      if (!recent || this.deps.wallMs() - recent.at >= 1000) this.remember(e, e.kind === "save_intent" ? "none" : "post-repaint");
      return;
    }
    if (e.kind === "typing") { this.typing(e); return; }
    if (textEdit(e)) { this.typing(e); this.hold(e, at, 1200, true); return; }
    if (this.cfg.source === "vision") return;
    if (recent?.event.source === "vision") {
      const r = recent.event;
      r.state = this.overlay(r.state, e.state);
      if (e.mode) r.mode = e.mode;
      if (!r.alsoSeenBy) { this.counters.lateConfirmed++; this.counters.visionOnly--; }
      r.alsoSeenBy = "dom";
      this.deps.update(r); return;
    }
    const p50 = [...this.latencies].sort((a, b) => a - b)[Math.floor(this.latencies.length / 2)];
    const holdMs = this.cfg.holdMs ?? (this.latencies.length < 5 ? 3500 : Math.max(2500, Math.min(5000, p50 + 1200)));
    if (this.cfg.source === "both" && this.alive && holdMs > 0) this.hold(e, at, holdMs);
    else this.remember(e, "post-repaint", at);
  }
  onVision(specs: Spec[], meta: { capturedAt: number; confidence: number; uiActivity: ScreenEvent["uiActivity"]; screenChangedRecently: boolean }): void {
    if (!this.active || this.cfg.source === "dom" || !Number.isFinite(meta.capturedAt) || meta.capturedAt < 0 || this.struck(meta.capturedAt)) return;
    this.prune();
    const candidates = new Set<string>();
    for (const spec of specs) {
      const e = normalize({ ...spec, t: meta.capturedAt, source: "vision" as const, confidence: meta.confidence, uiActivity: meta.uiActivity });
      if (control(e)) continue;
      if (e.kind === "typing") { this.typing(e); continue; }
      if (e.field === "notes") continue;
      const k = key(e), held = this.pending.get(k), recent = this.recent.get(k);
      if (held && textEdit(held.event)) continue;
      if (held && this.cfg.source === "both") {
        this.deps.clearTimer(held.timer); this.pending.delete(k);
        this.remember({ ...e, ...held.event, state: this.overlay(e.state, held.event.state), source: "vision", alsoSeenBy: "dom",
          confidence: meta.confidence, uiActivity: meta.uiActivity, latencyMs: Math.max(0, this.deps.wallMs() - held.at) }, "sent");
        this.counters.merged++; continue;
      }
      if (recent?.event.source === "dom") {
        const r = recent.event;
        if (!r.alsoSeenBy) { this.counters.lateConfirmed++; this.counters.domOnly--; }
        r.alsoSeenBy = "vision";
        r.latencyMs = Math.max(0, this.deps.wallMs() - (recent.erpAt ?? recent.at));
        this.deps.update(r); continue;
      }
      if (recent && this.deps.wallMs() - recent.at <= 5000) continue;
      if (this.cfg.source === "vision" && !meta.screenChangedRecently && !this.candidates.has(k)) { candidates.add(k); continue; }
      this.remember({ ...e, mode: e.mode ?? (e.invoice ? this.modes.get(e.invoice) : undefined) }, "sent");
    }
    this.candidates = candidates;
  }
  setVisionAlive(alive: boolean, p50Ms?: number): void {
    this.alive = alive;
    if (p50Ms !== undefined && Number.isFinite(p50Ms) && p50Ms >= 0) this.latencies = [...this.latencies.slice(-19), p50Ms];
    if (!alive) for (const [k, p] of this.pending) if (!textEdit(p.event)) {
      this.deps.clearTimer(p.timer); this.pending.delete(k);
      if (this.active && !this.struck(p.event.t)) this.remember(p.event, "post-repaint", p.at);
    }
  }
  setActive(enabled: boolean, paused = false): void {
    if (this.active !== (enabled && !paused)) { this.strike(); this.lastTypingAt = this.typingEmittedAt = -Infinity; }
    this.active = enabled && !paused;
  }
  strike(range?: Range): void {
    if (range) this.ranges.push({ ...range });
    for (const [k, p] of this.pending) if (!range || this.struck(p.event.t)) { this.deps.clearTimer(p.timer); this.pending.delete(k); }
    for (const [k, r] of this.recent) if (!range || this.struck(r.event.t)) this.recent.delete(k);
    this.candidates.clear(); this.modes.clear();
  }
  reset(): void {
    this.strike(); this.ranges = []; this.alive = false; this.latencies = [];
    this.lastTypingAt = this.typingEmittedAt = -Infinity;
    for (const k of Object.keys(this.counters) as (keyof typeof this.counters)[]) this.counters[k] = 0;
  }
}
