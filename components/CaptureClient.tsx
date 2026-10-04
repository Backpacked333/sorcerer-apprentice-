"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Governor, type Decision, type GovernorConfig } from "@/lib/governor";
import { CandidateQueue, buildCandidates, extractThresholds, narrationFills, newContext, observe, type Candidate } from "@/lib/curiosity";
import { describeEvent, emptySession, type Frame, type QuestionWindow, type ScreenEvent, type SessionLog } from "@/lib/events";
import { redactText } from "@/lib/redact";
import { computeMetrics } from "@/lib/metrics";
import { useScreenPipeline, type EventSource } from "./useScreenPipeline";
import { VoiceProvider, useTranscriber, useVoice, type ToolHandlers } from "./voice";
import { CaptureView } from "./views/CaptureView";
import type { CaptureVM } from "./views/capture.vm";
import { buildMemory, MemoryFlight } from "@/lib/memory";
import { PreparedQuestions } from "@/lib/prepared-question";
import { recordTypedAnswer } from "@/lib/capture-answer";

const OFF_RECORD = /\b(off the record|scratch that|don'?t keep that|do not keep that|strike that)\b/i;

export function CaptureClient(props: { agentId?: string; source: EventSource; governor: Partial<GovernorConfig> }) {
  const tools = useRef<ToolHandlers>({});
  return (
    <VoiceProvider agentId={props.agentId} tools={tools}>
      <Capture {...props} tools={tools} />
    </VoiceProvider>
  );
}

function Capture({ source, governor: govConfig, tools }: { agentId?: string; source: EventSource; governor: Partial<GovernorConfig>; tools: React.MutableRefObject<ToolHandlers> }) {
  const router = useRouter();
  const voice = useVoice();
  const [expertName, setExpertName] = useState("");
  const [task, setTask] = useState("Process supplier invoices before month-end close");
  const [started, setStarted] = useState(false);
  const [tick, setTick] = useState(0);
  const [decision, setDecision] = useState<Decision>();
  const [partial, setPartial] = useState("");
  const [holding, setHolding] = useState(false);
  const [synced, setSynced] = useState<number | null>(null);
  const [consented, setConsented] = useState(false);

  const log = useRef<SessionLog>(emptySession("pending", "capture", task, expertName));
  const governor = useRef(new Governor(govConfig));
  const queue = useRef(new CandidateQueue(90));
  const ctx = useRef(newContext());
  const lastSpeechAt = useRef(-Infinity);
  const spokeStarted = useRef(false);
  const recorder = useRef<MediaRecorder | null>(null);
  const micStream = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const entitiesRedacted = useRef(0);
  const dirty = useRef(false);
  const reasoning = useRef(new MemoryFlight());
  const prepared = useRef(new PreparedQuestions());
  const reasoningOff = useRef(false);
  const ended = useRef(false);
  const voiceRef = useRef(voice);
  voiceRef.current = voice;

  const rerender = () => setTick((t) => t + 1);
  const nowSecs = useCallback(() => (Date.now() - log.current.startedAt) / 1000, []);

  const onEvent = useCallback((e: ScreenEvent, frame?: Frame) => {
    const L = log.current;
    L.events.push(e);
    if (frame) L.frames.push(frame);
    if (e.kind !== "typing") {
      const cs = buildCandidates(e, ctx.current, e.t);
      observe(e, ctx.current);
      queue.current.add(cs);
      voiceRef.current.sendContext(`[SCREEN t=${e.t.toFixed(0)}s] ${describeEvent(e)}`);
    }
    dirty.current = true;
    rerender();
  }, []);

  const pipeline = useScreenPipeline({ sessionStart: log.current.startedAt, source, onEvent });

  const holdingRef = useRef(false);
  holdingRef.current = holding;
  const transcriber = useTranscriber({
    enabled: started,
    onPartial: (text) => {
      if (holdingRef.current) return;
      if (!voiceRef.current.isSpeaking) lastSpeechAt.current = nowSecs();
      setPartial(text);
    },
    onCommitted: (text, start) => {
      if (holdingRef.current) return;
      setPartial("");
      const L = log.current;
      const t = start !== undefined && start > 0 ? start : nowSecs();
      if (voiceRef.current.isSpeaking) {
        L.transcript.push({ id: `tr_${L.transcript.length}`, t, text, speaker: "agent", final: true });
        return;
      }
      lastSpeechAt.current = nowSecs();
      const { text: clean, entities } = redactText(text);
      entitiesRedacted.current += entities.length;
      L.transcript.push({ id: `tr_${L.transcript.length}`, t, text: clean, speaker: "expert", final: true });
      const w = governor.current.window;
      if (w && w.phase === "answering") {
        const qw = L.windows.find((x) => x.id === w.id);
        if (qw) {
          qw.answerText = [qw.answerText, clean].filter(Boolean).join(" ");
          governor.current.markAnswered(nowSecs());
          qw.answeredAt ??= nowSecs();
        }
      }
      if (OFF_RECORD.test(text) && voiceRef.current.mode === "fallback") strike();
      for (const c of queue.current.items.filter((c) => c.status === "queued" && c.kind === "why")) {
        if (narrationFills(clean, c)) queue.current.fillByStep(c.stepRef);
      }
      for (const th of extractThresholds(clean)) if (!ctx.current.knownThresholds.includes(th)) ctx.current.knownThresholds.push(th);
      dirty.current = true;
      rerender();
    },
  });

  const startRecorder = useCallback(async () => {
    try {
      micStream.current ??= await navigator.mediaDevices.getUserMedia({ audio: true });
      chunks.current = [];
      const r = new MediaRecorder(micStream.current, { mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "audio/webm" });
      r.ondataavailable = (ev) => ev.data.size && chunks.current.push(ev.data);
      r.start(250);
      recorder.current = r;
    } catch {
      recorder.current = null;
    }
  }, []);

  const stopRecorder = useCallback(async (): Promise<string | undefined> => {
    const r = recorder.current;
    recorder.current = null;
    if (!r) return undefined;
    await new Promise<void>((resolve) => {
      r.onstop = () => resolve();
      r.stop();
    });
    const blob = new Blob(chunks.current, { type: "audio/webm" });
    if (blob.size < 2000) return undefined;
    const audioId = `clip_${Date.now().toString(36)}`;
    const fd = new FormData();
    fd.append("audioId", audioId);
    fd.append("file", blob, `${audioId}.webm`);
    await fetch(`/api/sessions/${log.current.id}/clips`, { method: "POST", body: fd }).catch(() => {});
    return audioId;
  }, []);

  const closeWindow = useCallback(
    async (outcome: QuestionWindow["outcome"], extra?: { logged?: QuestionWindow["logged"] }) => {
      const g = governor.current;
      const w = g.window;
      if (!w) return;
      const L = log.current;
      const qw = L.windows.find((x) => x.id === w.id);
      const t = nowSecs();
      voiceRef.current.setMicMuted(true);
      const audioId = await stopRecorder();
      if (qw) {
        qw.closedAt = t;
        qw.outcome = outcome;
        if (extra?.logged) qw.logged = extra.logged;
        if (outcome === "answered" && !qw.answerText && qw.logged?.reason) qw.answerText = qw.logged.reason;
        if (outcome === "answered") qw.answeredAt ??= t;
        qw.answerAudioId = L.transcript.some((s) => s.typedFor === qw.id) ? undefined : audioId;
      }
      if (outcome === "answered") queue.current.markFilled(w.candidateId);
      else {
        const c = queue.current.items.find((c) => c.id === w.candidateId);
        if (c) c.status = outcome === "off_record" ? "expired" : "debrief";
      }
      g.close(t);
      spokeStarted.current = false;
      dirty.current = true;
      rerender();
    },
    [nowSecs, stopRecorder],
  );

  const openQuestion = useCallback(
    (c: Candidate) => {
      const t = nowSecs();
      const question = prepared.current.get(buildMemory(log.current, queue.current.items), c.id) ?? c.question;
      const w = governor.current.open(c.id, t);
      queue.current.markAsked(c.id);
      const L = log.current;
      const recentEvents = L.events.filter((e) => !e.redacted && e.kind !== "typing").slice(-3).map(describeEvent).join("; ");
      L.windows.push({ id: w.id, candidateId: c.id, kind: c.kind, question, stepRef: c.stepRef, openedAt: t });
      spokeStarted.current = false;
      voiceRef.current.say("ASK", `${question} | stepRef=${c.stepRef} | on screen: ${recentEvents}`, question);
      dirty.current = true;
      rerender();
    },
    [nowSecs],
  );

  const strike = useCallback(
    (fromSecs?: number, toSecs?: number) => {
      reasoning.current.invalidate();
      prepared.current.clear();
      const L = log.current;
      const t = nowSecs();
      const w = governor.current.window;
      const from = fromSecs ?? (w ? w.openedAt : Math.max(0, t - 30));
      const to = toSecs ?? t;
      for (const s of L.transcript) if (s.t >= from && s.t <= to) Object.assign(s, { text: "", redacted: true });
      for (const e of L.events) if (e.t >= from && e.t <= to) Object.assign(e, { redacted: true, from: undefined, to: undefined, state: undefined });
      L.frames = L.frames.filter((f) => f.t < from || f.t > to);
      for (const qw of L.windows) if (qw.openedAt >= from && qw.openedAt <= to) Object.assign(qw, { answerText: "", outcome: "off_record", logged: undefined });
      for (const c of queue.current.items) if (c.createdAt >= from && c.createdAt <= to && c.status === "queued") c.status = "expired";
      L.offRecord.push({ from, to });
      pipeline.bumpEpoch();
      if (w) void closeWindow("off_record");
      dirty.current = true;
      rerender();
    },
    [closeWindow, nowSecs, pipeline],
  );

  const notNow = useCallback(() => {
    const g = governor.current;
    const w = g.window;
    if (!w) return;
    const c = queue.current.items.find((c) => c.id === w.candidateId);
    if (c) c.status = "debrief";
    void closeWindow("aborted");
  }, [closeWindow]);

  const endTask = useCallback(async () => {
    ended.current = true;
    reasoning.current.invalidate();
    prepared.current.clear();
    const L = log.current;
    if (governor.current.window) await closeWindow("timeout");
    L.endedAt = Date.now();
    queue.current.drainToDebrief();
    L.metrics = { ...L.metrics, ...computeMetrics(L), framesSeen: pipeline.framesSeen, entitiesRedacted: entitiesRedacted.current + pipeline.piiBlurred } as unknown as Record<string, number>;
    await fetch(`/api/sessions/${L.id}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(L) });
    voiceRef.current.disconnect();
    pipeline.stop();
    router.push(`/map/${L.id}`);
  }, [closeWindow, pipeline, router]);

  tools.current = {
    log_answer: async (p) => {
      await closeWindow("answered", { logged: { reason: String(p.reason ?? ""), guardrail: p.guardrail ? String(p.guardrail) : undefined, kind: p.kind ? String(p.kind) : undefined } });
      return "logged";
    },
    mark_off_record: (p) => {
      const secs = typeof p.seconds === "number" ? p.seconds : undefined;
      strike(secs !== undefined ? Math.max(0, nowSecs() - secs) : undefined);
      return "struck from the record";
    },
    end_task: async () => {
      void endTask();
      return "ending";
    },
  };

  useEffect(() => {
    if (!started) return;
    const id = window.setInterval(() => {
      const g = governor.current;
      const t = nowSecs();
      const sig = pipeline.signals.current;
      const s = { now: t, lastSpeechAt: lastSpeechAt.current, lastScreenChangeAt: sig.lastScreenChangeAt, lastTypingAt: sig.lastTypingAt, lastBoundaryAt: sig.lastBoundaryAt, lastInvoiceOpenedAt: sig.lastInvoiceOpenedAt, agentSpeaking: voiceRef.current.isSpeaking || holding };
      const d = g.evaluate(s);
      setDecision(d);
      queue.current.expire(t, pipeline.currentState.current.invoice);
      const w = g.window;
      if (w) {
        if (w.phase === "asking") {
          if (voiceRef.current.isSpeaking) spokeStarted.current = true;
          else if (spokeStarted.current) {
            g.markAsked(t);
            const qw = log.current.windows.find((x) => x.id === w.id);
            if (qw) qw.askedAt = t;
            voiceRef.current.setMicMuted(false);
            void startRecorder();
          } else if (t - w.openedAt > 8) {
            const c = queue.current.items.find((c) => c.id === w.candidateId);
            if (c) c.status = "queued";
            g.abort();
            log.current.windows = log.current.windows.filter((x) => x.id !== w.id);
          }
        } else if (g.timedOut(t)) {
          void closeWindow("timeout");
        }
        rerender();
        return;
      }
      const force = queue.current.askedCount >= 2 && !queue.current.guardrailAsked;
      const preferredId = prepared.current.preferred(buildMemory(log.current, queue.current.items));
      const c = queue.current.pick(force, t, 3, preferredId, (candidate) => g.canOpen(s, candidate.value));
      if (c && g.canOpen(s, c.value)) openQuestion(c);
    }, 500);
    return () => window.clearInterval(id);
  }, [started, holding, nowSecs, pipeline, openQuestion, closeWindow, startRecorder]);

  useEffect(() => {
    if (!started) return;
    const id = window.setInterval(async () => {
      if (!dirty.current) return;
      dirty.current = false;
      const L = log.current;
      L.metrics = { ...L.metrics, framesSeen: pipeline.framesSeen, entitiesRedacted: entitiesRedacted.current + pipeline.piiBlurred };
      const res = await fetch(`/api/sessions/${L.id}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(L) }).catch(() => null);
      if (res?.ok) setSynced(Date.now());
    }, 5000);
    return () => window.clearInterval(id);
  }, [started, pipeline.framesSeen, pipeline.piiBlurred]);

  useEffect(() => {
    const flight = reasoning.current, packets = prepared.current;
    if (!started || holding) return;
    const id = window.setInterval(() => {
      if (ended.current || reasoningOff.current) return;
      const read = () => buildMemory(log.current, queue.current.items);
      if (!read().questions.length) return;
      void flight.run(read, async (memory, signal) => {
        const res = await fetch("/api/reason", { method: "POST", signal: AbortSignal.any([signal, AbortSignal.timeout(28000)]),
          headers: { "content-type": "application/json" }, body: JSON.stringify(memory) });
        if (!res.ok) throw new Error("Reasoning unavailable");
        return res.json();
      }, (result) => {
        reasoningOff.current = result.mode === "off";
        if (result.mode === "live") packets.set(read(), result.questions);
        log.current.metrics = { ...log.current.metrics, reasoningLatencyMs: result.latencyMs ?? 0,
          reasoningQuestions: result.questions?.length ?? 0, reasoningRuns: (log.current.metrics?.reasoningRuns ?? 0) + 1 };
        dirty.current = true;
      }).catch(() => {
        log.current.metrics = { ...log.current.metrics, reasoningFailures: (log.current.metrics?.reasoningFailures ?? 0) + 1 };
        dirty.current = true;
      });
    }, 15000);
    return () => { window.clearInterval(id); flight.invalidate(); packets.clear(); };
  }, [started, holding]);

  const start = async () => {
    const res = await fetch("/api/sessions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ mode: "capture", task, expertName: expertName.trim() || "Expert" }) });
    const { session } = await res.json();
    log.current = session;
    log.current.startedAt = Date.now();
    setStarted(true);
    if (new URLSearchParams(window.location.search).get("share") !== "0") await pipeline.start().catch(() => {});
    await voice.connect({ firstMessage: "" });
    voice.setMicMuted(true);
  };

  useEffect(() => {
    pipeline.setPaused(holding);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [holding]);

  useEffect(() => {
    if (!started) return;
    pipeline.signals.current = { lastScreenChangeAt: -Infinity, lastTypingAt: -Infinity, lastBoundaryAt: -Infinity, lastInvoiceOpenedAt: -Infinity, activity: "still" };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started]);

  const L = log.current;
  const openWin = governor.current.window ? L.windows.find((w) => w.id === governor.current.window!.id) : undefined;
  const queued = queue.current.items.filter((c) => c.status === "queued").sort((a, b) => b.value - a.value);
  const struck = L.offRecord.reduce((a, r) => a + (r.to - r.from), 0);
  const events = useMemo(() => L.events.filter((e) => e.kind !== "typing").slice(-14).reverse(), [L.events, tick]); // eslint-disable-line react-hooks/exhaustive-deps
  const crop = pipeline as { setCropTarget?: (el: HTMLElement | null) => void; surface?: "browser" | "window" | "monitor" };

  const vm: CaptureVM = {
    started,
    expertName,
    task,
    consented,
    setExpertName,
    setTask,
    setConsented,
    start,
    endTask,
    sessionId: L.id,
    source,
    voice: { mode: voice.mode, connected: voice.connected, status: voice.status, isSpeaking: voice.isSpeaking },
    sttEngine: transcriber.engine,
    pipeline: {
      videoRef: pipeline.videoRef,
      sharing: pipeline.sharing,
      start: pipeline.start,
      activity: pipeline.activity,
      framesSeen: pipeline.framesSeen,
      framesSent: pipeline.framesSent,
      dropped: pipeline.dropped,
      visionLatency: pipeline.visionLatency,
      visionError: pipeline.visionError,
      masks: pipeline.masks,
      addMask: pipeline.addMask,
      clearMasks: pipeline.clearMasks,
      paused: pipeline.paused,
      ...(typeof crop.setCropTarget === "function" ? { setCropTarget: crop.setCropTarget, surface: crop.surface } : {}),
    },
    decision,
    questionsLast10Min: governor.current.questionsInLast10Min(nowSecs()),
    budget: governor.current.config.maxPer10Min,
    openWindow: openWin && governor.current.window ? { ...openWin, phase: governor.current.window.phase } : undefined,
    partial,
    queued,
    askedCount: queue.current.askedCount,
    guardrailAsked: queue.current.guardrailAsked,
    toDebrief: queue.current.items.filter((c) => c.status === "debrief").length,
    events,
    candidateFor: (eventId) => queue.current.items.find((c) => c.eventId === eventId && c.kind === "why") ?? queue.current.items.find((c) => c.eventId === eventId),
    transcript: L.transcript,
    ledger: { framesSeen: pipeline.framesSeen, framesKept: L.frames.length, entitiesRedacted: entitiesRedacted.current + pipeline.piiBlurred, secondsStruck: struck },
    strike: () => strike(),
    notNow,
    holding,
    setHolding,
    submitTypedAnswer: (text) => {
      if (!text.trim() && !openWin?.answerText) return;
      if (text.trim()) {
        const redacted = recordTypedAnswer(log.current, governor.current.window?.id, text, nowSecs());
        if (redacted === undefined) return;
        entitiesRedacted.current += redacted;
      }
      void closeWindow("answered");
    },
    synced,
  };
  return <CaptureView vm={vm} />;
}
