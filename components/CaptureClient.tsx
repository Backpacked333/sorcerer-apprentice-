"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Governor, type Decision, type GovernorConfig } from "@/lib/governor";
import { CandidateQueue, buildCandidates, extractThresholds, narrationFills, newContext, observe, type Candidate } from "@/lib/curiosity";
import { describeEvent, emptySession, type Frame, type QuestionWindow, type ScreenEvent, type SessionLog, type TranscriptSegment } from "@/lib/events";
import { redactText } from "@/lib/redact";
import { computeMetrics } from "@/lib/metrics";
import { Meter } from "./Meter";
import { useScreenPipeline, type EventSource } from "./useScreenPipeline";
import { VoiceProvider, useTranscriber, useVoice, type ToolHandlers } from "./voice";

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
  const [expertName, setExpertName] = useState("Sabine");
  const [task, setTask] = useState("Process supplier invoices before month-end close");
  const [started, setStarted] = useState(false);
  const [tick, setTick] = useState(0);
  const [decision, setDecision] = useState<Decision>();
  const [answerDraft, setAnswerDraft] = useState("");
  const [partial, setPartial] = useState("");
  const [holding, setHolding] = useState(false);
  const [synced, setSynced] = useState<number | null>(null);
  const [showMechanism, setShowMechanism] = useState(false);
  const [drawing, setDrawing] = useState<{ x: number; y: number } | null>(null);
  const [draft, setDraft] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
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
  const voiceRef = useRef(voice);
  voiceRef.current = voice;

  const rerender = () => setTick((t) => t + 1);
  const nowSecs = useCallback(() => (Date.now() - log.current.startedAt) / 1000, []);

  // ---------- events from the screen ----------
  const onEvent = useCallback(
    (e: ScreenEvent, frame?: Frame) => {
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
    },
    [],
  );

  const pipeline = useScreenPipeline({ sessionStart: log.current.startedAt, source, onEvent });

  // ---------- transcript ----------
  const holdingRef = useRef(false);
  holdingRef.current = holding;
  const transcriber = useTranscriber({
    enabled: started,
    onPartial: (text) => {
      if (holdingRef.current) return; // paused: nothing is heard or kept
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
      // an open window collects the answer verbatim
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
      // narration can answer a why without a question
      for (const c of queue.current.items.filter((c) => c.status === "queued" && c.kind === "why")) {
        if (narrationFills(clean, c)) queue.current.fillByStep(c.stepRef);
      }
      for (const th of extractThresholds(clean)) if (!ctx.current.knownThresholds.includes(th)) ctx.current.knownThresholds.push(th);
      dirty.current = true;
      rerender();
    },
  });

  // ---------- windows ----------
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
    async (outcome: QuestionWindow["outcome"], extra?: { answerText?: string; logged?: QuestionWindow["logged"] }) => {
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
        if (extra?.answerText) qw.answerText = [qw.answerText, extra.answerText].filter(Boolean).join(" ");
        if (outcome === "answered" && !qw.answerText && qw.logged?.reason) qw.answerText = qw.logged.reason;
        if (outcome === "answered") qw.answeredAt ??= t;
        qw.answerAudioId = audioId;
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

  const openWindow = useCallback(
    (c: Candidate) => {
      const t = nowSecs();
      const w = governor.current.open(c.id, t);
      queue.current.markAsked(c.id);
      const L = log.current;
      const recentEvents = L.events.filter((e) => !e.redacted && e.kind !== "typing").slice(-3).map(describeEvent).join("; ");
      L.windows.push({ id: w.id, candidateId: c.id, kind: c.kind, question: c.question, stepRef: c.stepRef, openedAt: t });
      spokeStarted.current = false;
      voiceRef.current.say("ASK", `${c.question} | stepRef=${c.stepRef} | on screen: ${recentEvents}`, c.question);
      dirty.current = true;
      rerender();
    },
    [nowSecs],
  );

  // ---------- off the record ----------
  const strike = useCallback(
    (fromSecs?: number, toSecs?: number) => {
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
      pipeline.bumpEpoch(); // anything the vision model returns for struck frames is discarded
      if (w) void closeWindow("off_record");
      dirty.current = true;
      rerender();
    },
    [closeWindow, nowSecs, pipeline],
  );

  // "Not now": defer the open question to the debrief without consuming the budget
  const notNow = useCallback(() => {
    const g = governor.current;
    const w = g.window;
    if (!w) return;
    const c = queue.current.items.find((c) => c.id === w.candidateId);
    if (c) c.status = "debrief";
    void closeWindow("aborted");
  }, [closeWindow]);

  // ---------- end ----------
  const endTask = useCallback(async () => {
    const L = log.current;
    if (governor.current.window) await closeWindow("timeout");
    L.endedAt = Date.now();
    queue.current.drainToDebrief();
    L.metrics = { ...computeMetrics(L), framesSeen: pipeline.framesSeen, entitiesRedacted: entitiesRedacted.current + pipeline.piiBlurred } as unknown as Record<string, number>;
    await fetch(`/api/sessions/${L.id}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(L) });
    voiceRef.current.disconnect();
    pipeline.stop();
    router.push(`/map/${L.id}`);
  }, [closeWindow, pipeline, router]);

  // ---------- client tools the agent can call ----------
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

  // ---------- the governor tick ----------
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
            // the agent never spoke: give the candidate back and try later
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
      const c = queue.current.pick(force, t);
      if (c && g.canOpen(s, c.value)) openWindow(c);
    }, 500);
    return () => window.clearInterval(id);
  }, [started, holding, nowSecs, pipeline, openWindow, closeWindow, startRecorder]);

  // ---------- periodic sync ----------
  useEffect(() => {
    if (!started) return;
    const id = window.setInterval(async () => {
      if (!dirty.current) return;
      dirty.current = false;
      const L = log.current;
      L.metrics = { framesSeen: pipeline.framesSeen, entitiesRedacted: entitiesRedacted.current + pipeline.piiBlurred };
      const res = await fetch(`/api/sessions/${L.id}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(L) }).catch(() => null);
      if (res?.ok) setSynced(Date.now());
    }, 5000);
    return () => window.clearInterval(id);
  }, [started, pipeline.framesSeen, pipeline.piiBlurred]);

  // ---------- start ----------
  const start = async () => {
    const res = await fetch("/api/sessions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ mode: "capture", task, expertName }) });
    const { session } = await res.json();
    log.current = session;
    log.current.startedAt = Date.now();
    setStarted(true);
    // ?share=0 skips the screen share (phones, smoke tests); the ERP telemetry channel still delivers exact events
    if (new URLSearchParams(window.location.search).get("share") !== "0") await pipeline.start().catch(() => {});
    await voice.connect({ firstMessage: "" });
    voice.setMicMuted(true);
  };

  useEffect(() => {
    pipeline.setPaused(holding);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [holding]);

  // pipeline needs the real session start; re-create its clock by remounting signals
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

  if (!started) {
    return (
      <main className="grid-bg min-h-screen">
        <div className="mx-auto max-w-xl px-6 py-20">
          <p className="panel-title">1 · Capture</p>
          <h1 className="mt-2 text-3xl font-semibold">Share the screen. Do the work. The apprentice asks why.</h1>
          <div className="panel mt-8 space-y-4 p-6">
            <label className="block text-sm">
              <span className="text-muted">Expert</span>
              <input className="mt-1 w-full" value={expertName} onChange={(e) => setExpertName(e.target.value)} />
            </label>
            <label className="block text-sm">
              <span className="text-muted">Task</span>
              <input className="mt-1 w-full" value={task} onChange={(e) => setTask(e.target.value)} />
            </label>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className={`tag ${voice.mode === "agent" ? "tag-green" : "tag-amber"}`}>{voice.mode === "agent" ? "ElevenAgents interviewer" : "no agent id: browser speech fallback"}</span>
              <span className="tag">events: {source}</span>
            </div>
            <div className="rounded border border-line bg-bg p-3 text-xs text-muted">
              <p className="text-ink">What is captured, and what is kept</p>
              <p className="mt-1">Your microphone, for the transcript and the agent. The screen surface you choose, as a still every one to two seconds, sent to a vision model and turned into events. Only the handful of frames tied to a decision are stored, after you can mask regions and after personal data is blurred. &quot;Scratch that&quot; removes the current exchange and its frames. The voice provider keeps conversation transcripts and audio per the account&apos;s retention settings; this app does not change those.</p>
              <label className="mt-2 flex items-center gap-2 text-ink">
                <input type="checkbox" checked={consented} onChange={(e) => setConsented(e.target.checked)} /> I understand; start the session
              </label>
            </div>
            <button className="btn btn-primary w-full" onClick={start} disabled={!consented}>
              Start session and share the ERP tab
            </button>
            <p className="text-xs text-muted">Open the sandbox ERP in another tab first. Use headphones: the apprentice must not hear itself.</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen">
      <header className="flex items-center gap-3 border-b border-line bg-panel px-4 py-2 text-sm">
        <span className="font-semibold">Tacit</span>
        <span className="text-muted">· capture · {expertName} · {task}</span>
        <span className="mono ml-auto text-xs text-muted">{L.id}</span>
        <span className={`tag ${voice.connected ? "tag-green" : "tag-amber"}`}>{voice.status}</span>
        <span className={`tag ${transcriber.engine === "scribe" ? "tag-green" : transcriber.engine === "webspeech" ? "tag-amber" : "tag-red"}`}>{transcriber.engine === "scribe" ? "Scribe v2" : transcriber.engine === "webspeech" ? "browser STT" : "no STT"}</span>
        <span className={`tag ${pipeline.sharing ? "tag-green" : "tag-red"}`}>{pipeline.sharing ? "screen shared" : "no screen"}</span>
        {synced && <span className="text-xs text-muted">synced</span>}
      </header>

      <div className="grid gap-4 p-4 lg:grid-cols-[1fr_400px]">
        {/* left: the screen and the event feed */}
        <div className="space-y-4">
          <div className="panel overflow-hidden">
            <div
              className="relative"
              onMouseDown={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                setDrawing({ x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height });
              }}
              onMouseMove={(e) => {
                if (!drawing) return;
                const r = e.currentTarget.getBoundingClientRect();
                const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
                setDraft({ x: Math.min(x, drawing.x), y: Math.min(y, drawing.y), w: Math.abs(x - drawing.x), h: Math.abs(y - drawing.y) });
              }}
              onMouseUp={() => {
                if (draft && draft.w > 0.01 && draft.h > 0.01) pipeline.addMask({ ...draft, kind: "mask" });
                setDrawing(null);
                setDraft(null);
              }}
              title="Drag to mask a sensitive region before it is transmitted"
            >
              <video ref={pipeline.videoRef} muted playsInline className="aspect-video w-full bg-black" />
              {pipeline.masks.map((m, i) => (
                <div key={i} className="absolute border border-amber bg-bg" style={{ left: `${m.x * 100}%`, top: `${m.y * 100}%`, width: `${m.w * 100}%`, height: `${m.h * 100}%` }} />
              ))}
              {draft && <div className="absolute border border-dashed border-amber" style={{ left: `${draft.x * 100}%`, top: `${draft.y * 100}%`, width: `${draft.w * 100}%`, height: `${draft.h * 100}%` }} />}
              {pipeline.paused && <div className="absolute inset-0 flex items-center justify-center bg-bg/80 text-sm text-amber">paused: nothing is transmitted or kept</div>}
            </div>
            <div className="flex flex-wrap items-center gap-3 border-t border-line px-3 py-2 text-xs text-muted">
              <span>activity: <span className="text-ink">{pipeline.activity}</span></span>
              <span>frames sent: <span className="mono text-ink">{pipeline.framesSent}</span></span>
              {pipeline.dropped > 0 && <span className="text-amber">observation degraded: {pipeline.dropped} frames not sent while the model was behind</span>}
              <span>kept: <span className="mono text-ink">{L.frames.length}</span></span>
              {pipeline.visionLatency !== null && <span>vision: <span className="mono text-ink">{pipeline.visionLatency} ms</span></span>}
              {pipeline.visionError && <span className="text-amber">vision: {pipeline.visionError}</span>}
              <span>masks: <span className="mono text-ink">{pipeline.masks.length}</span>{pipeline.masks.length > 0 && <button className="ml-1 underline" onClick={pipeline.clearMasks}>clear</button>}</span>
              {!pipeline.sharing && (
                <button className="btn ml-auto" onClick={() => pipeline.start()}>
                  Share screen
                </button>
              )}
            </div>
          </div>
          {showMechanism && (
          <div className="panel p-4">
            <div className="flex items-center justify-between">
              <p className="panel-title">Screen events</p>
              <span className="text-xs text-muted">judgment value in amber</span>
            </div>
            <ul className="mt-2 divide-y divide-line text-sm">
              {events.length === 0 && <li className="py-2 text-muted">Nothing yet. Open an invoice in the ERP tab.</li>}
              {events.map((e) => {
                const cand = queue.current.items.find((c) => c.eventId === e.id && c.kind === "why") ?? queue.current.items.find((c) => c.eventId === e.id);
                return (
                  <li key={e.id} className={`flex items-center gap-3 py-1.5 ${e.redacted ? "strike-band text-muted" : ""}`}>
                    <span className="mono w-14 text-xs text-muted">{e.t.toFixed(1)}s</span>
                    <span className={`tag ${e.source === "vision" ? "tag-blue" : ""}`} title={e.alsoSeenBy ? "seen by the vision model, confirmed by the ERP" : e.source === "vision" ? "seen by the vision model" : "reported by the ERP"}>{e.source === "vision" ? (e.alsoSeenBy ? "seen ✓" : "seen") : "erp"}</span>
                    <span className="flex-1">{e.redacted ? "off the record" : describeEvent(e)}</span>
                    {cand && !e.redacted && <span className={`mono text-xs ${cand.value >= 0.8 ? "text-amber" : "text-muted"}`}>{cand.value.toFixed(2)}</span>}
                  </li>
                );
              })}
            </ul>
          </div>
          )}
        </div>

        {/* right: the apprentice */}
        <div className="space-y-4">
          <Meter decision={decision} questions={governor.current.questionsInLast10Min(nowSecs())} budget={governor.current.config.maxPer10Min} />

          <div className={`panel p-4 ${openWin ? "border-amber" : ""}`}>
            <p className="panel-title">Question window</p>
            {openWin ? (
              <div className="mt-2">
                <span className="tag tag-amber">{openWin.kind}</span>
                <p className="mt-2 text-sm">{openWin.question}</p>
                <p className="mt-2 min-h-5 text-sm text-green">{openWin.answerText}{partial ? <span className="text-muted"> {partial}</span> : null}</p>
                {voice.mode === "fallback" && governor.current.window?.phase === "answering" && (
                  <form
                    className="mt-2 flex gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!answerDraft.trim() && !openWin.answerText) return;
                      void closeWindow("answered", { answerText: answerDraft.trim() || undefined });
                      setAnswerDraft("");
                    }}
                  >
                    <input className="flex-1" placeholder="Type the answer (or speak, if STT is on)" value={answerDraft} onChange={(e) => setAnswerDraft(e.target.value)} />
                    <button className="btn btn-primary" type="submit">
                      Log
                    </button>
                  </form>
                )}
                <div className="mt-2 flex items-center justify-between">
                  <p className="text-xs text-muted">{governor.current.window?.phase === "asking" ? "asking…" : "mic open, recording the answer"}</p>
                  <button className="btn text-xs" onClick={notNow}>
                    Not now
                  </button>
                </div>
              </div>
            ) : (
              <p className="mt-2 text-sm text-muted">{queued.length ? `${queued.length} candidate${queued.length > 1 ? "s" : ""} queued, waiting for a pause` : "No judgment call seen yet"}</p>
            )}
          </div>

          <button className="btn w-full text-xs" onClick={() => setShowMechanism((v) => !v)}>
            {showMechanism ? "Hide the mechanism" : "Show the mechanism (events, candidate queue)"}
          </button>

          {showMechanism && (
          <div className="panel p-4">
            <p className="panel-title">Candidate questions</p>
            <ul className="mt-2 space-y-1 text-xs">
              {queued.slice(0, 5).map((c) => (
                <li key={c.id} className="flex gap-2">
                  <span className={`mono ${c.value >= 0.8 ? "text-amber" : "text-muted"}`}>{c.value.toFixed(2)}</span>
                  <span className="tag">{c.kind}</span>
                  <span className="flex-1 text-muted">{c.question}</span>
                </li>
              ))}
              {queued.length === 0 && <li className="text-muted">queue empty</li>}
            </ul>
            <p className="mt-2 text-xs text-muted">
              asked {queue.current.askedCount} · guardrail asked: {queue.current.guardrailAsked ? "yes" : "not yet"} · to debrief: {queue.current.items.filter((c) => c.status === "debrief").length}
            </p>
          </div>
          )}

          <div className="panel p-4">
            <p className="panel-title">Privacy ledger</p>
            <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
              <Stat k="frames seen" v={pipeline.framesSeen} />
              <Stat k="frames kept" v={L.frames.length} />
              <Stat k="entities redacted" v={entitiesRedacted.current + pipeline.piiBlurred} />
              <Stat k="seconds struck" v={struck.toFixed(0)} />
            </div>
            <p className="mt-2 text-xs text-muted">Kept by this app: the frames above, masked and blurred, plus the transcript. Kept by the voice provider: conversation transcript and audio per the account&apos;s retention settings, not changed by this app.</p>
            <div className="mt-3 flex gap-2">
              <button className="btn btn-danger" onClick={() => strike()}>
                Scratch that
              </button>
              <button className={`btn ${holding ? "btn-primary" : ""}`} onMouseDown={() => setHolding(true)} onMouseUp={() => setHolding(false)} onMouseLeave={() => setHolding(false)}>
                Hold to pause
              </button>
            </div>
          </div>

          <div className="panel p-4">
            <p className="panel-title">Transcript</p>
            <ul className="scroll-thin mt-2 max-h-40 space-y-1 overflow-auto text-xs">
              {L.transcript.slice(-8).map((s: TranscriptSegment) => (
                <li key={s.id} className={s.redacted ? "strike-band text-muted" : s.speaker === "agent" ? "text-amber" : ""}>
                  <span className="mono text-muted">{s.t.toFixed(0)}s</span> {s.redacted ? "off the record" : s.text}
                </li>
              ))}
            </ul>
          </div>

          <button className="btn btn-primary w-full" onClick={endTask}>
            Done · start the debrief
          </button>
        </div>
      </div>
    </main>
  );
}

function Stat({ k, v }: { k: string; v: string | number }) {
  return (
    <div className="rounded border border-line bg-bg px-2 py-1.5">
      <p className="text-muted">{k}</p>
      <p className="mono text-base text-ink">{v}</p>
    </div>
  );
}
