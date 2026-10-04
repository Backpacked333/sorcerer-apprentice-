"use client";

/**
 * The screen pipeline, shared by Capture and Teach.
 * Screen share -> 500 ms frame diff -> (vision model | ERP telemetry) -> ScreenEvents with screen moments.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { describeEvent, type Frame, type ScreenEvent } from "@/lib/events";
import { classifyActivity, diffGray, toGray, worthSending, DIFF_H, DIFF_W, type Activity, type DiffResult } from "@/lib/framediff";
import { blurRegions, type PiiRegion } from "@/lib/redact";
import { drawFrame, frameSize, iframeContentBox, isSelfCapture, OccluderHistory, piiToCss, planFrame, type FrameSpec, type Rect, type Size, type Surface } from "@/lib/capture-frame";
import { collectPiiRects, piiSourceId, subscribePiiRects, type PiiRectsMessage } from "@/lib/pii-masks";
import { subscribeTelemetry, type TelemetryMessage } from "@/lib/telemetry";
import type { InvoiceState } from "@/lib/workmap";
import { diffVision, normalizeInvoiceId, normalizeVisionState, type VisionFrame } from "@/lib/visiondiff";

export type EventSource = "vision" | "dom" | "both";

export interface PipelineSignals {
  lastScreenChangeAt: number; // seconds since session start
  lastTypingAt: number;
  lastBoundaryAt: number;
  lastInvoiceOpenedAt: number;
  activity: Activity;
}

export type CaptureMode = "tab" | "workspace";
export type CaptureApp = "erp" | "claims";
export interface StartOptions {
  /** "tab" (default): the original share prompt, unchanged. "workspace": current-tab capture with picker hints;
   * a non-self surface is `degraded: "wrong_surface"` (no vision frames or stills, telemetry continues). */
  mode?: CaptureMode;
  /** Which sandbox is on screen; sent to /api/vision as `app` (default "erp"). */
  app?: CaptureApp;
  /** Two-window DOM PII pairing: the sandbox queue shown in the captured window (default "expert" for erp). */
  queue?: string;
}
export type PiiMode = "dom" | "manual-only";
/** PII rects from another window older than this are not trusted (the publisher heartbeats every second). */
const PII_FRESH_MS = 3000;
const OCCLUDER_SAMPLE_MS = 100;
const STILL_W = 960;
const VISION_W = 1024;

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
const normalizeIdentity = <T extends { invoice?: string; state?: InvoiceState }>(e: T): T => ({
  ...e, invoice: normalizeInvoiceId(e.invoice),
  state: e.state?.invoice === undefined ? e.state : { ...e.state, invoice: normalizeInvoiceId(e.state.invoice) },
});

/** @deprecated kept for compatibility; every frame is now drawn by drawFrame (lib/capture-frame.ts). */
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
  const captureExpired = useRef(false);
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
  // ---- WP1: crop, occluders, DOM PII, surface ----
  const cropTarget = useRef<HTMLElement | null>(null);
  const occluderEls = useRef<HTMLElement[]>([]);
  const occluderHistory = useRef<OccluderHistory | null>(null);
  const [hasOccluders, setHasOccluders] = useState(false);
  const startOpts = useRef<Required<Pick<StartOptions, "mode" | "app">> & { queue?: string }>({ mode: "tab", app: "erp" });
  const [surface, setSurface] = useState<Surface | undefined>(undefined);
  const surfaceRef = useRef<Surface | undefined>(undefined);
  const [selfCapture, setSelfCapture] = useState(false);
  /** undefined until the surface is decided for the current stream */
  const selfRef = useRef<boolean | undefined>(undefined);
  const captureHandle = useRef<string | null>(null);
  const [degraded, setDegraded] = useState<"wrong_surface" | null>(null);
  const degradedRef = useRef<"wrong_surface" | null>(null);
  const [lastSentUrl, setLastSentUrl] = useState<string | null>(null);
  const [piiMode, setPiiModeState] = useState<PiiMode>("manual-only");
  const piiModeRef = useRef<PiiMode>("manual-only");
  const channelPii = useRef<PiiRectsMessage | null>(null);
  const optsRef = useRef(opts);
  optsRef.current = opts;

  const now = useCallback(() => (Date.now() - optsRef.current.sessionStart) / 1000, []);

  const viewport = (): Size | null => {
    const w = typeof window !== "undefined" ? window.innerWidth : 0, h = typeof window !== "undefined" ? window.innerHeight : 0;
    return w > 0 && h > 0 ? { w, h } : null;
  };

  /** Decide once per stream whether the capture is this tab (capture handle if the browser reports one, else aspect). */
  const decideSurface = useCallback(() => {
    if (selfRef.current !== undefined) return;
    const stream = streamRef.current;
    const track = stream?.getVideoTracks?.()[0] as (MediaStreamTrack & { getCaptureHandle?: () => { handle?: string } | null }) | undefined;
    const settings = (track?.getSettings?.() ?? {}) as MediaTrackSettings & { displaySurface?: string };
    const v = videoRef.current;
    const vw = v?.videoWidth || settings.width || 0, vh = v?.videoHeight || settings.height || 0;
    if (!track || !(vw > 0 && vh > 0)) return; // not yet known; retried on the next tick
    let self = isSelfCapture(settings.displaySurface, vw, vh, viewport());
    // Capture Handle (feature-detected, Chrome): a handle that is not ours proves another tab; ours proves this one.
    try {
      const handle = track.getCaptureHandle?.()?.handle;
      if (typeof handle === "string" && captureHandle.current) self = settings.displaySurface === "browser" && handle === captureHandle.current;
    } catch { /* unsupported */ }
    selfRef.current = self;
    setSelfCapture(self);
    const s = settings.displaySurface;
    surfaceRef.current = s === "browser" || s === "window" || s === "monitor" ? s : undefined;
    setSurface(surfaceRef.current);
    const d = startOpts.current.mode === "workspace" && !self ? "wrong_surface" : null;
    degradedRef.current = d;
    setDegraded(d);
  }, []);

  const sampleOccluders = useCallback((t = Date.now()) => {
    const els = occluderEls.current;
    if (!els.length) return;
    const hist = (occluderHistory.current ??= new OccluderHistory());
    const items: { key: unknown; rect: Rect }[] = [];
    for (const el of els) {
      if (!el?.isConnected) continue;
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) items.push({ key: el, rect: { x: r.left, y: r.top, w: r.width, h: r.height } });
    }
    hist.record(t, items);
  }, []);

  /** DOM PII of the same-origin iframe inside (or equal to) the crop target, in this tab's CSS px. */
  const readIframePii = (): (Rect & { kind: string })[] | null => {
    const target = cropTarget.current;
    if (!target?.isConnected) return null;
    const iframe = (target.tagName === "IFRAME" ? target : target.querySelector?.("iframe")) as HTMLIFrameElement | null;
    if (!iframe) return null;
    try {
      const doc = iframe.contentDocument;
      if (!doc) return null;
      const rects = collectPiiRects(doc);
      if (!rects) return null;
      const r = iframe.getBoundingClientRect();
      const box = iframeContentBox({ x: r.left, y: r.top, w: r.width, h: r.height }, { left: iframe.clientLeft, top: iframe.clientTop }, { w: iframe.clientWidth, h: iframe.clientHeight }, { w: iframe.offsetWidth, h: iframe.offsetHeight });
      return box.w > 0 && box.h > 0 ? piiToCss(rects, box) : null;
    } catch { return null; } // cross-origin: manual masks only
  };

  const setPiiMode = (m: PiiMode) => {
    if (piiModeRef.current === m) return;
    piiModeRef.current = m;
    setPiiModeState(m);
  };

  /** The one place a frame's crop and paint list is computed; every consumer draws with it. */
  const planCurrentFrame = useCallback((v: HTMLVideoElement): FrameSpec => {
    decideSurface();
    const self = selfRef.current === true;
    const vp = viewport();
    let cropCss: Rect | null = null, occludersCss: Rect[] = [], piiCss: (Rect & { kind: string })[] = [], piiFrame: PiiRegion[] = [];
    let mode: PiiMode = "manual-only";
    if (self && vp) {
      const t = Date.now();
      sampleOccluders(t);
      occludersCss = occluderHistory.current?.rects(t) ?? [];
      const target = cropTarget.current;
      if (target?.isConnected) {
        const r = target.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) cropCss = { x: r.left, y: r.top, w: r.width, h: r.height };
      }
      const dom = readIframePii();
      if (dom) { piiCss = dom; mode = "dom"; }
    } else if (selfRef.current === false && surfaceRef.current === "browser") {
      const m = channelPii.current;
      if (m && Date.now() - m.at <= PII_FRESH_MS) { piiFrame = m.rects; mode = "dom"; }
    }
    setPiiMode(mode);
    return planFrame({ videoW: v.videoWidth, videoH: v.videoHeight, viewport: vp, self, cropCss, occludersCss, piiCss, manual: masksRef.current, piiFrame });
  }, [decideSurface, sampleOccluders]);

  /** A screen moment: the current frame, cropped, masked, PII blurred. Only called when an event happens. */
  const captureFrame = useCallback((): Frame | undefined => {
    const v = videoRef.current;
    if (!v || !v.videoWidth || !streamRef.current || pausedRef.current) return undefined;
    const spec = planCurrentFrame(v);
    if (degradedRef.current) return undefined; // wrong surface: nothing of it is kept
    const { w, h } = frameSize(spec.crop, STILL_W);
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d");
    if (!ctx) return undefined;
    drawFrame(ctx, v, w, h, spec); // draw -> paint occluders, masks, DOM PII -> (blur) -> encode
    const n = blurRegions(c, piiRegions.current);
    if (n) setPiiBlurred((x) => x + n);
    const dataUrl = c.toDataURL("image/jpeg", 0.6);
    setLastSentUrl(dataUrl);
    return { id: uid("frame"), t: now(), dataUrl, width: w, height: h, piiRegionsBlurred: n + spec.masks.length + spec.pii.length };
  }, [now, planCurrentFrame]);

  const emit = useCallback(
    (e: Omit<ScreenEvent, "id" | "t"> & { t?: number }) => {
      if (captureExpired.current) return;
      e = normalizeIdentity(e);
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
      const current = normalizeVisionState(state.current);
      const combined = result.state.invoice && current.invoice === result.state.invoice
        ? { ...current, ...normalizeVisionState(next.state) } : result.state;
      state.current = combined;
      for (const spec of result.specs) {
        const eventState = next.screen === "invoice_list"
          ? { ...spec.state, ...(current.invoice === spec.invoice ? current : {}) } : combined;
        emit({ ...spec, state: spec.state ? eventState : undefined, t });
      }
      state.current = combined;
    },
    [emit, now],
  );

  const sendToVision = useCallback(async () => {
    const v = videoRef.current;
    if (!v || !v.videoWidth || pausedRef.current || visionDisabled.current || !streamRef.current || degradedRef.current) return;
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
      const spec = planCurrentFrame(v);
      const { w, h } = frameSize(spec.crop, VISION_W);
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      const ctx = c.getContext("2d");
      if (ctx) drawFrame(ctx, v, w, h, spec); // crop, then occluders + masks + DOM PII painted before the frame leaves the browser
      const image = c.toDataURL("image/jpeg", 0.7);
      setLastSentUrl(image);
      const res = await fetch("/api/vision", { method: "POST", signal: controller.signal, headers: { "content-type": "application/json" }, body: JSON.stringify({ seq: mySeq, image, t: now(), app: startOpts.current.app }) });
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
  }, [applyVisionState, now, planCurrentFrame]);

  // ---- the 500 ms tick: diff, activity, maybe vision ----
  useEffect(() => {
    if (!sharing) return;
    const c = document.createElement("canvas");
    c.width = DIFF_W;
    c.height = DIFF_H;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    const id = window.setInterval(() => {
      const v = videoRef.current;
      if (!v || !v.videoWidth || !ctx || captureExpired.current) return;
      // the floating card and other Tacit surfaces are painted out here too, or their animation reads as typing
      drawFrame(ctx, v, DIFF_W, DIFF_H, planCurrentFrame(v));
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
            // Labelled "dom" for historical reasons although it comes from the pixel diff; consumers filter
            // `kind: "typing"` out of the feed and compile, so the label never reaches a badge (no behaviour change).
            optsRef.current.onEvent({ id: uid("ev"), t, source: "dom", kind: "typing", invoice: state.current.invoice, uiActivity: "typing" });
          }
        }
      }
      prevGray.current = gray;
      const src = optsRef.current.source;
      if ((src === "vision" || src === "both") && !pausedRef.current && worthSending(diff, now() - lastSendAt.current, VISION_CADENCE_SECS)) void sendToVision();
    }, 500);
    return () => window.clearInterval(id);
  }, [sharing, now, sendToVision, planCurrentFrame]);

  // ---- occluder sampling between frames, so a moving card is covered by its recent union ----
  useEffect(() => {
    if (!sharing || !hasOccluders) return;
    const id = window.setInterval(() => { if (selfRef.current) sampleOccluders(); }, OCCLUDER_SAMPLE_MS);
    return () => window.clearInterval(id);
  }, [sharing, hasOccluders, sampleOccluders]);

  // ---- two-window DOM PII: paired rects published by the sandbox window ----
  useEffect(() => {
    if (!sharing) return;
    const origin = typeof location !== "undefined" ? location.origin : "";
    if (!origin || origin === "null") return;
    const { app, queue } = startOpts.current;
    channelPii.current = null;
    return subscribePiiRects(piiSourceId({ origin, app, queue: queue ?? (app === "erp" ? "expert" : undefined) }), (m) => { channelPii.current = m; });
  }, [sharing]);

  // ---- ERP telemetry over BroadcastChannel (exact events, keyless) ----
  useEffect(() => {
    const src = opts.source;
    if (src === "vision") return;
    return subscribeTelemetry((m: TelemetryMessage) => {
      const t = (m.at - optsRef.current.sessionStart) / 1000;
      if (t < 0 || pausedRef.current || captureExpired.current) return;
      const event = normalizeIdentity({ source: "dom" as const, kind: m.kind, invoice: m.invoice, field: m.field, from: m.from, to: m.to, state: m.state, boundary: m.boundary, mode: m.mode, blocked: m.blocked, t });
      const visionCanSee = ["invoice_opened", "invoice_closed", "field_changed", "route_changed", "status_changed", "save_clicked"].includes(m.kind) && m.field !== "notes" && m.field !== "assetNumber";
      // save_blocked is the sandbox's own verdict; it is never a vision event
      if (optsRef.current.source === "both" && visionAlive.current && visionCanSee) {
        // give the vision model a moment to see it first; the ERP only confirms
        const key = `${event.kind}:${event.invoice ?? ""}:${event.field ?? ""}:${event.to ?? ""}`;
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
    for (const h of heldDom.current.values()) window.clearTimeout(h.timer);
    heldDom.current.clear();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    selfRef.current = undefined;
    degradedRef.current = null;
    surfaceRef.current = undefined;
    setDegraded(null);
    setSelfCapture(false);
    setSurface(undefined);
    setSharing(false);
  }, []);

  /** Must be called synchronously inside a click: getDisplayMedia runs before any await (transient activation). */
  const start = useCallback((o?: StartOptions): Promise<void> => {
    // tolerate being passed straight to onClick (a click event is not options)
    const so = o && typeof o === "object" && !("target" in o) ? o : undefined;
    stop();
    const mode: CaptureMode = so?.mode === "workspace" ? "workspace" : "tab";
    startOpts.current = { mode, app: so?.app === "claims" ? "claims" : "erp", queue: so?.queue };
    const md = navigator.mediaDevices as MediaDevices & { setCaptureHandleConfig?: (c: { handle: string; exposeOrigin: boolean; permittedOrigins: string[] }) => void };
    if (mode === "workspace" && typeof md.setCaptureHandleConfig === "function") {
      try {
        captureHandle.current ??= uid("tacit");
        md.setCaptureHandleConfig({ handle: captureHandle.current, exposeOrigin: false, permittedOrigins: [location.origin] });
      } catch { captureHandle.current = null; }
    }
    let pending: Promise<MediaStream>;
    try {
      pending = mode === "workspace"
        ? md.getDisplayMedia({
            video: { displaySurface: "browser", frameRate: { ideal: 5, max: 10 } },
            audio: false, preferCurrentTab: true, surfaceSwitching: "exclude", monitorTypeSurfaces: "exclude",
          } as DisplayMediaStreamOptions)
        : md.getDisplayMedia({ video: { frameRate: 4 }, audio: false });
    } catch (err) {
      return Promise.reject(err);
    }
    return (async () => {
      const stream = await pending;
      streamRef.current = stream;
      captureExpired.current = false;
      visionDisabled.current = false;
      visionAlive.current = false;
      visionFrame.current = null;
      lastSendAt.current = -Infinity;
      selfRef.current = undefined;
      degradedRef.current = null;
      occluderHistory.current?.clear();
      setDegraded(null);
      setSelfCapture(false);
      setLastSentUrl(null);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      stream.getVideoTracks()[0].addEventListener("ended", stop);
      decideSurface();
      setSharing(true);
    })();
  }, [stop, decideSurface]);

  useEffect(() => {
    if (!sharing) return;
    const cap = window.setTimeout(() => { captureExpired.current = true; stop(); }, 15 * 60 * 1000);
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

  /** The ERP frame element (or its wrapper). Frames are cropped to it on a self-tab capture; null = no crop. */
  const setCropTarget = useCallback((el: HTMLElement | null) => { cropTarget.current = el; }, []);
  /** Every Tacit surface floating over the ERP. Their rects (unioned over 750 ms, padded) are painted out of every frame. */
  const setOccluders = useCallback((els: HTMLElement[]) => {
    occluderEls.current = (els ?? []).filter(Boolean);
    setHasOccluders(occluderEls.current.length > 0);
  }, []);

  return {
    videoRef, sharing, start, stop, signals, framesSeen, framesSent, dropped, piiBlurred, visionLatency, visionError, activity, currentState: state, describeEvent, masks, addMask, clearMasks, paused, setPaused, bumpEpoch,
    setCropTarget, setOccluders, surface, selfCapture, degraded, lastSentUrl, piiMode,
  };
}
