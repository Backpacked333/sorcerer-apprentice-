"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Frame, QuestionWindow, ScreenEvent, SessionLog } from "@/lib/events";
import { describeEvent } from "@/lib/events";
import { Matcher, type TutorDecision } from "@/lib/matcher";
import { type InvoiceState, type WorkMap, uid } from "@/lib/workmap";
import { useScreenPipeline, type EventSource } from "./useScreenPipeline";
import { VoiceProvider, useTranscriber, useVoice, type ToolHandlers } from "./voice";
import { TeachView } from "./views/TeachView";
import type { TeachReplay, TeachVM } from "./views/teach.vm";

export function TeachClient(props: { sessionId: string; agentId?: string; source: EventSource }) {
  const tools = useRef<ToolHandlers>({});
  return (
    <VoiceProvider agentId={props.agentId} tools={tools}>
      <Teach {...props} tools={tools} />
    </VoiceProvider>
  );
}

function Teach({ sessionId, source, tools }: { sessionId: string; agentId?: string; source: EventSource; tools: React.MutableRefObject<ToolHandlers> }) {
  const voice = useVoice();
  const [log, setLog] = useState<SessionLog | null>(null);
  const [map, setMap] = useState<WorkMap | null>(null);
  const [expertLog, setExpertLog] = useState<SessionLog | null>(null);
  const [started, setStarted] = useState(false);
  const [tick, setTick] = useState(0);
  const [decisions, setDecisions] = useState<(TutorDecision & { t: number })[]>([]);
  const [phase, setPhase] = useState<"coached" | "independent">("coached");
  const [replay, setReplay] = useState<TeachReplay | null>(null);
  const [ended, setEnded] = useState(false);
  const matcher = useRef<Matcher | null>(null);
  const logRef = useRef<SessionLog | null>(null);
  const pending = useRef<{ decision: TutorDecision; windowId: string } | null>(null);
  const voiceRef = useRef(voice);
  voiceRef.current = voice;
  const mapRef = useRef<WorkMap | null>(null);
  mapRef.current = map;
  const expertRef = useRef<SessionLog | null>(null);
  expertRef.current = expertLog;

  const rerender = () => setTick((t) => t + 1);
  const nowSecs = useCallback(() => (logRef.current ? (Date.now() - logRef.current.startedAt) / 1000 : 0), []);

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/sessions/${sessionId}`);
      const data = await res.json();
      const s: SessionLog = data.session;
      logRef.current = s;
      setLog(s);
      if (s.sourceMapSessionId) {
        const m = await fetch(`/api/sessions/${s.sourceMapSessionId}`).then((r) => r.json());
        setMap(m.map);
        setExpertLog(m.session);
        if (m.map) matcher.current = new Matcher(m.map);
      }
    })();
  }, [sessionId]);

  const showReplay = useCallback((stepId?: string, ruleTitle?: string) => {
    const m = mapRef.current;
    const ex = expertRef.current;
    if (!m) return;
    const step = m.steps.find((s) => s.id === stepId) ?? m.steps.find((s) => m.rules.find((r) => r.title === ruleTitle)?.stepId === s.id);
    const frame = step?.screenMoment.frameId ? ex?.frames.find((f) => f.id === step.screenMoment.frameId) : undefined;
    const quote = step?.reason?.text ?? m.rules.find((r) => r.stepId === step?.id)?.quotes[0]?.text;
    const audioId = step?.reason?.audioId ?? m.rules.find((r) => r.stepId === step?.id)?.quotes.find((q) => q.audioId)?.audioId;
    setReplay({ step, frame, quote, audioUrl: audioId && ex ? `/api/sessions/${ex.id}/clips?audioId=${audioId}` : undefined, rule: ruleTitle });
  }, []);

  const flagForExpert = useCallback(async (context: string) => {
    const m = mapRef.current;
    const L = logRef.current;
    if (!m || !L) return;
    const slot = { id: uid("slot"), kind: "novel" as const, question: `Lena hit a case you never showed me: ${context.replace(/^.*?\((.*?)\).*$/, "$1")}. What do you do with it?`, status: "open" as const };
    const next = { ...m, slots: [...m.slots, slot] };
    mapRef.current = next;
    setMap(next);
    (L.flagged ??= []).push({ t: nowSecs(), context });
    await fetch(`/api/sessions/${m.sessionId}/map`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(next) });
  }, [nowSecs]);

  const speak = useCallback(
    (d: TutorDecision) => {
      const L = logRef.current;
      if (!L) return;
      const t = nowSecs();
      const w: QuestionWindow = { id: uid("win"), candidateId: d.rule?.id ?? d.kind, kind: d.kind === "intervene" || d.kind === "stop" ? "intervene" : d.kind === "predict" ? "predict" : "debrief", question: d.message, stepRef: d.invoice, openedAt: t };
      L.windows.push(w);
      pending.current = { decision: d, windowId: w.id };
      const tag = d.kind.toUpperCase();
      const payload = `${d.message}${d.quote ? ` | expert's words: "${d.quote}"` : ""}${d.stepId ? ` | stepId=${d.stepId}` : ""}${d.rule ? ` | rule: ${d.rule.title}` : ""}`;
      voiceRef.current.setMicMuted(d.kind === "praise" || d.kind === "novel" ? true : false);
      voiceRef.current.say(tag, payload, d.message);
      if (d.kind === "intervene" || d.kind === "stop") {
        if (voiceRef.current.mode === "fallback") window.setTimeout(() => showReplay(d.stepId, d.rule?.title), 6000);
      }
      if (d.kind === "novel" && !d.quote) void flagForExpert(d.message);
    },
    [nowSecs, showReplay, flagForExpert],
  );

  const onEvent = useCallback(
    (e: ScreenEvent, frame?: Frame) => {
      const L = logRef.current;
      const mt = matcher.current;
      if (!L || !mt) return;
      L.events.push(e);
      if (frame) L.frames.push(frame);
      if (e.kind === "typing") return;
      if (e.mode) setPhase(e.mode);
      voiceRef.current.sendContext(`[SCREEN t=${e.t.toFixed(0)}s] ${describeEvent(e)}${e.mode === "independent" ? " (independent follow-up: stay silent unless a save is blocked)" : ""}`);
      const state: InvoiceState = { ...(pipelineState.current ?? {}), ...(e.state ?? {}) };
      const d = mt.decide(e, state, e.t);
      if (d.kind !== "none") {
        setDecisions((xs) => [...xs, { ...d, t: e.t }]);
        speak(d);
      }
      rerender();
    },
    [speak],
  );
  const pipeline = useScreenPipeline({ sessionStart: log?.startedAt ?? Date.now(), source, onEvent });
  const pipelineState = pipeline.currentState;

  useEffect(() => {
    const p = pending.current;
    const L = logRef.current;
    if (!p || !L) return;
    if (voice.isSpeaking) {
      const w = L.windows.find((w) => w.id === p.windowId);
      if (w && w.askedAt === undefined) w.askedAt = nowSecs();
    } else if (L.windows.find((w) => w.id === p.windowId)?.askedAt !== undefined) {
      pending.current = null;
    }
  }, [voice.isSpeaking, nowSecs]);

  useTranscriber({
    enabled: started,
    onPartial: () => {},
    onCommitted: (text) => {
      const L = logRef.current;
      if (!L || voiceRef.current.isSpeaking) return;
      L.transcript.push({ id: `tr_${L.transcript.length}`, t: nowSecs(), text, speaker: "newhire", final: true });
      const last = [...L.windows].reverse().find((w) => w.kind === "intervene" || w.kind === "predict");
      if (last && !last.answerText && last.askedAt !== undefined) {
        last.answerText = text;
        last.answeredAt = nowSecs();
      }
    },
  });

  const endSession = async () => {
    const L = logRef.current;
    if (!L) return;
    L.endedAt = Date.now();
    L.mastery = matcher.current?.ledger.map((m) => ({ ruleId: m.ruleId, outcome: `${m.outcome} (${m.phase}${m.helpBefore ? ", help before the decision" : ""})`, t: m.t })) ?? [];
    await fetch("/api/teach/guard", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "disarm" }) }).catch(() => {});
    await fetch(`/api/sessions/${L.id}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(L) });
    voice.disconnect();
    pipeline.stop();
    setEnded(true);
  };

  tools.current = {
    show_replay: (p) => {
      showReplay(p.stepId ? String(p.stepId) : undefined, p.rule ? String(p.rule) : undefined);
      return "replay shown";
    },
    record_prediction: (p) => {
      const mt = matcher.current;
      const m = mapRef.current;
      if (!mt || !m) return "no map";
      const rule = m.rules.find((r) => r.id === p.ruleId) ?? m.rules.find((r) => r.title.toLowerCase().includes(String(p.rule ?? "").toLowerCase()));
      mt.recordPrediction(rule?.id ?? "unknown", p.correct === true || p.correct === "true", nowSecs(), pipelineState.current.invoice);
      rerender();
      return "recorded";
    },
    record_mastery: (p) => {
      const mt = matcher.current;
      if (!mt) return "no map";
      if (p.outcome === "escalation_recognized") mt.recordEscalation(String(p.ruleId ?? "unknown"), nowSecs(), pipelineState.current.invoice);
      rerender();
      return "recorded";
    },
    flag_for_expert: async (p) => {
      await flagForExpert(String(p.context ?? "an unfamiliar case"));
      return "flagged";
    },
    end_session: () => {
      void endSession();
      return "ending";
    },
  };

  const start = async () => {
    const L = logRef.current;
    if (!L) return;
    L.startedAt = Date.now();
    L.sourceMapRevision = map?.revision;
    setStarted(true);
    if (map?.confirmedAt) await fetch("/api/teach/guard", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "arm", mapSessionId: map.sessionId, teachSessionId: L.id }) }).catch(() => {});
    if (new URLSearchParams(window.location.search).get("share") !== "0") await pipeline.start().catch(() => {});
    await voice.connect({ firstMessage: `I'll watch while you work. I only speak when ${map?.expert.name ?? "the expert"} would.` });
    voice.setMicMuted(true);
  };

  const card = matcher.current?.masteryCard() ?? [];
  const missed = card.filter((c) => c.status === "needs_practice");
  const events = log ? log.events.filter((e) => e.kind !== "typing").slice(-8).reverse() : [];
  void tick;
  const crop = pipeline as { setCropTarget?: (el: HTMLElement | null) => void; surface?: "browser" | "window" | "monitor" };

  const vm: TeachVM = {
    log,
    map,
    started,
    ended,
    phase,
    source,
    decisions,
    replay,
    closeReplay: () => setReplay(null),
    card,
    missed,
    flaggedCount: log?.flagged?.length ?? 0,
    voice: { mode: voice.mode, connected: voice.connected, status: voice.status, isSpeaking: voice.isSpeaking },
    pipeline: {
      videoRef: pipeline.videoRef,
      sharing: pipeline.sharing,
      start: pipeline.start,
      activity: pipeline.activity,
      visionLatency: pipeline.visionLatency,
      ...(typeof crop.setCropTarget === "function" ? { setCropTarget: crop.setCropTarget, surface: crop.surface } : {}),
    },
    currentInvoice: pipelineState.current.invoice,
    events,
    start,
    endSession,
  };
  return <TeachView vm={vm} />;
}
