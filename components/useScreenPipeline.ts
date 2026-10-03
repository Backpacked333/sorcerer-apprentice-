"use client";

/**
 * The screen pipeline, shared by Capture and Teach.
 * Screen share -> 500 ms frame diff -> (vision model | ERP telemetry) -> ScreenEvents with screen moments.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { describeEvent, type Frame, type ScreenEvent } from "@/lib/events";
import { classifyActivity, diffGray, toGray, worthSending, DIFF_H, DIFF_W, type Activity, type DiffResult } from "@/lib/framediff";
import { blurRegions, type PiiRegion } from "@/lib/redact";
import { subscribeTelemetry, type TelemetryMessage } from "@/lib/telemetry";
import type { InvoiceState } from "@/lib/workmap";
import { diffVision, type VisionFrame } from "@/lib/visiondiff";

export type EventSource = "vision" | "dom" | "both";

export interface PipelineSignals {
  lastScreenChangeAt: number; // seconds since session start
  lastTypingAt: number;
  lastBoundaryAt: number;
  lastInvoiceOpenedAt: number;
  activity: Activity;
}

export interface PipelineOptions {
  sessionStart: number; // epoch ms
  source: EventSource;
  onEvent: (e: ScreenEvent, frame?: Frame) => void;
  onVision?: (info: { latencyMs: number; model?: string; error?: string }) => void;
}

const uid = (p: string) => `${p}_${Math.random().toString(36).slice(2, 9)}`;
/** In "both" mode a DOM event waits this long for the vision model to report the same change. */
const DOM_HOLD_MS = 2500;
/** The brief's cadence: a frame every one to two seconds; a visible change sends sooner. */
const VISION_CADENCE_SECS = 1.5;

export function paintMasks(canvas: HTMLCanvasElement, masks: PiiRegion[]) {
  const ctx = canvas.getContext("2d");
  if (!ctx || masks.length === 0) return;
  ctx.fillStyle = "#0a0d10";
  for (const m of masks) ctx.fillRect(Math.floor(m.x * canvas.width), Math.floor(m.y * canvas.height), Math.ceil(m.w * canvas.width), Math.ceil(m.h * canvas.height));
}

export function useScreenPipeline(opts: PipelineOptions) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [sharing, setSharing] = useState(false);
  const [framesSeen, setFramesSeen] = useState(0);
  const [piiBlurred, setPiiBlurred] = useState(0);
  const [visionLatency, setVisionLatency] = useState<number | null>(null);
  const [visionError, setVisionError] = useState<string | null>(null);
  const [activity, setActivity] = useState<Activity>("still");
  const signals = useRef<PipelineSignals>({ lastScreenChangeAt: -Infinity, lastTypingAt: -Infinity, lastBoundaryAt: -Infinity, lastInvoiceOpenedAt: -Infinity, activity: "still" });
  const heldDom = useRef<Map<string, { event: Omit<ScreenEvent, "id" | "t"> & { t?: number }; timer: number }>>(new Map());
  const visionAlive = useRef(false);
  const visionDisabled = useRef(false);
  const visionFrame = useRef<VisionFrame | null>(null);
  const request = useRef<AbortController | null>(null);
  /** designated sensitive regions, normalized; painted out before any frame leaves the browser */
  const [masks, setMasks] = useState<PiiRegion[]>([]);
  const masksRef = useRef<PiiRegion[]>([]);
  masksRef.current = masks;
  /** consent epoch: a pause or a strike bumps it, and any result from an older epoch is dropped */
  const epoch = useRef(0);
  const [paused, setPausedState] = useState(false);
  const pausedRef = useRef(false);
  const [dropped, setDropped] = useState(0);
  const [framesSent, setFramesSent] = useState(0);
  const prevGray = useRef<Uint8ClampedArray | null>(null);
  const history = useRef<DiffResult[]>([]);
  const lastSendAt = useRef(-Infinity);
  const inFlight = useRef(false);
  const seq = useRef(0);
  const lastAppliedSeq = useRef(0);
  const state = useRef<InvoiceState>({});
  const piiRegions = useRef<PiiRegion[]>([]);
  const recent = useRef<Map<string, number>>(new Map());
  const optsRef = useRef(opts);
  optsRef.current = opts;

  const now = useCallback(() => (Date.now() - optsRef.current.sessionStart) / 1000, []);

  /** A screen moment: the current frame, downscaled, PII blurred. Only called when an event happens. */
  const captureFrame = useCallback((): Frame | undefined => {
    const v = videoRef.current;
    if (!v || !v.videoWidth || !streamRef.current || pausedRef.current) return undefined;
    const w = 960;
    const h = Math.round((v.videoHeight / v.videoWidth) * w);
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d");
    if (!ctx) return undefined;
    ctx.drawImage(v, 0, 0, w, h);
    paintMasks(c, masksRef.current);
    const n = blurRegions(c, piiRegions.current);
    if (n) setPiiBlurred((x) => x + n);
    return { id: uid("frame"), t: now(), dataUrl: c.toDataURL("image/jpeg", 0.6), width: w, height: h, piiRegionsBlurred: n + masksRef.current.length };
  }, [now]);

  const emit = useCallback(
    (e: Omit<ScreenEvent, "id" | "t"> & { t?: number }) => {
      const key = `${e.kind}:${e.invoice ?? ""}:${e.field ?? ""}:${e.to ?? ""}`;
      const t = e.t ?? now();
      const held = heldDom.current.get(key);
      if (held && e.source === "vision") {
        // the vision model confirmed what the ERP reported: the event is "seen on screen", with the ERP as witness
        window.clearTimeout(held.timer);
        heldDom.current.delete(key);
        e = { ...e, alsoSeenBy: "dom" };
      }
      const last = recent.current.get(key);
      if (last !== undefined && t - last < 5 && e.kind !== "typing") return; // vision and DOM saw the same change
      recent.current.set(key, t);
      if (e.state) state.current = { ...state.current, ...e.state };
      if (e.kind !== "typing") signals.current.lastScreenChangeAt = t; // an event means the screen just changed
      if (e.kind === "invoice_opened") signals.current.lastInvoiceOpenedAt = t;
      if (e.boundary) signals.current.lastBoundaryAt = t;
      if (e.kind === "typing" || e.uiActivity === "typing") signals.current.lastTypingAt = t;
      const wantsFrame = ["invoice_opened", "field_changed", "status_changed", "route_changed", "save_clicked", "save_blocked"].includes(e.kind);
      const frame = wantsFrame ? captureFrame() : undefined;
      const full: ScreenEvent = { id: uid("ev"), t, ...e, frameId: frame?.id };
      optsRef.current.onEvent(full, frame);
    },
    [captureFrame, now],
  );

  /** Vision returned a state: diff it against what we knew and emit events. */
  const applyVisionState = useCallback(
    (next: VisionFrame, regions: PiiRegion[]) => {
      piiRegions.current = regions;
      const t = now();
      if (next.uiActivity === "typing") signals.current.lastTypingAt = t;
      const result = diffVision(visionFrame.current, next);
      if (result.frame === visionFrame.current) return;
      visionFrame.current = result.frame;
      for (const spec of result.specs) emit({ ...spec, t });
      state.current = result.state;
    },
    [emit, now],
  );

  const sendToVision = useCallback(async () => {
    const v = videoRef.current;
    if (!v || !v.videoWidth || pausedRef.current || visionDisabled.current || !streamRef.current) return;
    if (inFlight.current) {
      // the model is behind: keep observing, count what was not sent, never queue a stale backlog
      setDropped((n) => n + 1);
      return;
    }
    inFlight.current = true;
    const mySeq = ++seq.current;
    const myEpoch = epoch.current;
    const myStream = streamRef.current;
    lastSendAt.current = now();
    const controller = new AbortController();
    request.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 9000);
    try {
      const w = 1024;
      const h = Math.round((v.videoHeight / v.videoWidth) * w);
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      c.getContext("2d")?.drawImage(v, 0, 0, w, h);
      paintMasks(c, masksRef.current); // masks are applied before the frame leaves the browser
      const image = c.toDataURL("image/jpeg", 0.7);
      const res = await fetch("/api/vision", { method: "POST", signal: controller.signal, headers: { "content-type": "application/json" }, body: JSON.stringify({ seq: mySeq, image, t: now() }) });
      const data = await res.json();
      if (myStream === streamRef.current && res.status === 503 && data.mock === true) visionDisabled.current = true;
      if (myEpoch !== epoch.current || controller.signal.aborted) return; // stale/aborted observations are discarded
      if (res.status !== 200) {
        visionAlive.current = false;
        setVisionError(data.error ?? `vision ${res.status}`);
        optsRef.current.onVision?.({ latencyMs: 0, error: data.error });
        return;
      }
      setFramesSeen((n) => n + 1);
      setFramesSent((n) => n + 1);
      visionAlive.current = true;
      if (mySeq <= lastAppliedSeq.current) return; // a newer frame already landed
      lastAppliedSeq.current = mySeq;
      setVisionLatency(data.latencyMs);
      setVisionError(null);
      optsRef.current.onVision?.({ latencyMs: data.latencyMs, model: data.model });
      applyVisionState({ ...data, state: data.state ?? {} }, data.piiRegions ?? []);
    } catch (err) {
      if (myEpoch !== epoch.current) return;
      visionAlive.current = false;
      setVisionError((err as Error).message);
    } finally {
      window.clearTimeout(timeout);
      if (request.current === controller) request.current = null;
      inFlight.current = false;
    }
  }, [applyVisionState, now]);

  // ---- the 500 ms tick: diff, activity, maybe vision ----
  useEffect(() => {
    if (!sharing) return;
    const c = document.createElement("canvas");
    c.width = DIFF_W;
    c.height = DIFF_H;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    const id = window.setInterval(() => {
      const v = videoRef.current;
      if (!v || !v.videoWidth || !ctx) return;
      ctx.drawImage(v, 0, 0, DIFF_W, DIFF_H);
      const gray = toGray(ctx.getImageData(0, 0, DIFF_W, DIFF_H).data, DIFF_W, DIFF_H, DIFF_W, DIFF_H);
      let diff: DiffResult | null = null;
      if (prevGray.current) {
        diff = diffGray(prevGray.current, gray);
        history.current.push(diff);
        if (history.current.length > 8) history.current.shift();
        const t = now();
        if (diff.mean >= 1.5 || diff.changedCells >= 1) signals.current.lastScreenChangeAt = t;
        const act = classifyActivity(history.current);
        signals.current.activity = act;
        setActivity(act);
        if (act === "typing") {
          signals.current.lastTypingAt = t;
          if (t - (recent.current.get("typing") ?? -Infinity) > 4) {
            recent.current.set("typing", t);
            optsRef.current.onEvent({ id: uid("ev"), t, source: "dom", kind: "typing", invoice: state.current.invoice, uiActivity: "typing" });
          }
        }
      }
      prevGray.current = gray;
      const src = optsRef.current.source;
      if ((src === "vision" || src === "both") && !pausedRef.current && worthSending(diff, now() - lastSendAt.current, VISION_CADENCE_SECS)) void sendToVision();
    }, 500);
    return () => window.clearInterval(id);
  }, [sharing, now, sendToVision]);

  // ---- ERP telemetry over BroadcastChannel (exact events, keyless) ----
  useEffect(() => {
    const src = opts.source;
    if (src === "vision") return;
    return subscribeTelemetry((m: TelemetryMessage) => {
      const t = (m.at - optsRef.current.sessionStart) / 1000;
      if (t < 0 || pausedRef.current) return;
      const event = { source: "dom" as const, kind: m.kind, invoice: m.invoice, field: m.field, from: m.from, to: m.to, state: m.state, boundary: m.boundary, mode: m.mode, blocked: m.blocked, t };
      const visionCanSee = ["invoice_opened", "invoice_closed", "field_changed", "route_changed", "status_changed", "save_clicked"].includes(m.kind) && m.field !== "notes" && m.field !== "assetNumber";
      // save_blocked is the sandbox's own verdict; it is never a vision event
      if (optsRef.current.source === "both" && visionAlive.current && visionCanSee) {
        // give the vision model a moment to see it first; the ERP only confirms
        const key = `${m.kind}:${m.invoice ?? ""}:${m.field ?? ""}:${m.to ?? ""}`;
        const timer = window.setTimeout(() => {
          heldDom.current.delete(key);
          emit(event);
        }, DOM_HOLD_MS);
        heldDom.current.set(key, { event, timer });
        return;
      }
      emit(event);
    });
  }, [opts.source, emit]);

  const stop = useCallback(() => {
    epoch.current += 1;
    visionAlive.current = false;
    request.current?.abort();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setSharing(false);
  }, []);

  const start = useCallback(async () => {
    stop();
    const stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 4 }, audio: false });
    streamRef.current = stream;
    visionDisabled.current = false;
    visionAlive.current = false;
    visionFrame.current = null;
    lastSendAt.current = -Infinity;
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
    }
    stream.getVideoTracks()[0].addEventListener("ended", stop);
    setSharing(true);
  }, [stop]);

  useEffect(() => {
    if (!sharing) return;
    const cap = window.setTimeout(stop, 15 * 60 * 1000);
    return () => window.clearTimeout(cap);
  }, [sharing, stop]);
  useEffect(() => stop, [stop]);

  /** Pause stops new frames and telemetry and invalidates anything in flight. Resume starts a fresh epoch. */
  const setPaused = useCallback((p: boolean) => {
    pausedRef.current = p;
    setPausedState(p);
    epoch.current += 1;
    for (const h of heldDom.current.values()) window.clearTimeout(h.timer);
    heldDom.current.clear();
  }, []);

  /** A strike invalidates in-flight results without pausing. */
  const bumpEpoch = useCallback(() => {
    epoch.current += 1;
  }, []);

  const addMask = useCallback((m: PiiRegion) => setMasks((xs) => [...xs, m]), []);
  const clearMasks = useCallback(() => setMasks([]), []);

  return { videoRef, sharing, start, stop, signals, framesSeen, framesSent, dropped, piiBlurred, visionLatency, visionError, activity, currentState: state, describeEvent, masks, addMask, clearMasks, paused, setPaused, bumpEpoch };
}
