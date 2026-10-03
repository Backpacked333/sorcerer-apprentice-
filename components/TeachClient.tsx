"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Frame, QuestionWindow, ScreenEvent, SessionLog } from "@/lib/events";
import { describeEvent } from "@/lib/events";
import { Matcher, type TutorDecision } from "@/lib/matcher";
import { describeCond, type InvoiceState, type Step, type WorkMap, uid } from "@/lib/workmap";
import { useScreenPipeline, type EventSource } from "./useScreenPipeline";
import { VoiceProvider, useTranscriber, useVoice, type ToolHandlers } from "./voice";

export function TeachClient(props: { sessionId: string; agentId?: string; source: EventSource }) {
  const tools = useRef<ToolHandlers>({});
  return (
    <VoiceProvider agentId={props.agentId} tools={tools}>
      <Teach {...props} tools={tools} />
    </VoiceProvider>
  );
}

interface Replay {
  step?: Step;
  frame?: Frame;
  quote?: string;
  audioUrl?: string;
  rule?: string;
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
  const [replay, setReplay] = useState<Replay | null>(null);
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

  // ---------- load the teach session, its source map and the expert's frames ----------
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
        // the replay is the emotional beat: the agent calls show_replay after the answer; in fallback mode show it after a pause
        if (voiceRef.current.mode === "fallback") window.setTimeout(() => showReplay(d.stepId, d.rule?.title), 6000);
      }
      if (d.kind === "novel" && !d.quote) void flagForExpert(d.message);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [nowSecs, showReplay],
  );

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

  // ---------- the pipeline on the new hire's screen ----------
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

  // mark when the tutor actually started speaking (intervention latency)
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

  // the new hire's answer to a prediction or an intervention
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
    // the sandbox's pre-save guard: a backstop against a fast click, enforcing only the confirmed map
    if (map?.confirmedAt) await fetch("/api/teach/guard", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "arm", mapSessionId: map.sessionId, teachSessionId: L.id }) }).catch(() => {});
    if (new URLSearchParams(window.location.search).get("share") !== "0") await pipeline.start().catch(() => {});
    await voice.connect({ firstMessage: `I'll watch while you work. I only speak when ${map?.expert.name ?? "the expert"} would.` });
    voice.setMicMuted(true);
  };

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

  if (!log || !map) {
    return (
      <main className="grid-bg min-h-screen">
        <div className="mx-auto max-w-xl px-6 py-24 text-center text-muted">{log && !map ? "This teach session has no source map. Compile and confirm a Work Map first." : "Loading…"}</div>
      </main>
    );
  }

  const card = matcher.current?.masteryCard() ?? [];
  const missed = card.filter((c) => c.status === "needs_practice");
  void tick;

  if (!started) {
    return (
      <main className="grid-bg min-h-screen">
        <div className="mx-auto max-w-xl px-6 py-20">
          <p className="panel-title">3 · Teach</p>
          <h1 className="mt-2 text-3xl font-semibold">{log.expertName} works Lena&apos;s queue. The tutor watches like {map.expert.name} would.</h1>
          <div className="panel mt-8 space-y-3 p-6 text-sm">
            <p>
              Loaded <span className="text-ink">{map.rules.length} rules</span> and <span className="text-ink">{map.steps.length} steps</span> from {map.expert.name}&apos;s Work Map{map.confirmedAt ? ", confirmed" : " (not yet confirmed)"}.
            </p>
            <ul className="space-y-1 text-xs text-muted">
              {map.rules.map((r) => (
                <li key={r.id}>· {r.title}: when {describeCond(r.when)}</li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className={`tag ${voice.mode === "agent" ? "tag-green" : "tag-amber"}`}>{voice.mode === "agent" ? "ElevenAgents tutor" : "no agent id: browser speech fallback"}</span>
              <span className="tag">events: {source}</span>
            </div>
            <button className="btn btn-primary w-full" onClick={start}>
              Start and share the ERP tab
            </button>
            <p className="text-xs text-muted">Open the ERP on Lena&apos;s queue in another tab. Coached: 4490 (equipment over the threshold), 4491 (December, another supplier), 4492 (a credit note). Independent follow-up, tutor silent: 4493 and 4494. Help, if any, is recorded before each decision.</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen">
      <header className="flex items-center gap-3 border-b border-line bg-panel px-4 py-2 text-sm">
        <span className="font-semibold">Tacit</span>
        <span className="text-muted">· teach · {log.expertName} learning from {map.expert.name} · map rev {map.revision}{map.confirmedAt ? ", confirmed" : ", unconfirmed"}</span>
        <span className="mono ml-auto text-xs text-muted">{log.id}</span>
        <span className={`tag ${phase === "independent" ? "tag-blue" : "tag-amber"}`}>{phase === "independent" ? "independent follow-up: tutor silent, guard armed" : "coached"}</span>
        <span className={`tag ${voice.connected ? "tag-green" : "tag-amber"}`}>{voice.status}</span>
        <span className={`tag ${pipeline.sharing ? "tag-green" : "tag-red"}`}>{pipeline.sharing ? "screen shared" : "no screen"}</span>
      </header>

      <div className="grid gap-4 p-4 lg:grid-cols-[1fr_420px]">
        <div className="space-y-4">
          <div className="panel overflow-hidden">
            <video ref={pipeline.videoRef} muted playsInline className="aspect-video w-full bg-black" />
            <div className="flex items-center gap-3 border-t border-line px-3 py-2 text-xs text-muted">
              <span>activity: <span className="text-ink">{pipeline.activity}</span></span>
              <span>invoice: <span className="mono text-ink">{pipelineState.current.invoice ?? "–"}</span></span>
              {pipeline.visionLatency !== null && <span>vision: <span className="mono text-ink">{pipeline.visionLatency} ms</span></span>}
              {!pipeline.sharing && (
                <button className="btn ml-auto" onClick={() => pipeline.start()}>
                  Share screen
                </button>
              )}
            </div>
          </div>

          {replay && (
            <div className="panel border-amber p-4">
              <div className="flex items-center justify-between">
                <p className="panel-title">Replay · {map.expert.name}&apos;s screen moment (captured still{replay.step ? `, ${replay.step.screenMoment.t.toFixed(0)} s into her session` : ""})</p>
                <button className="btn text-xs" onClick={() => setReplay(null)}>
                  close
                </button>
              </div>
              {replay.frame ? <img src={replay.frame.dataUrl} alt="expert screen moment" className="mt-2 w-full rounded border border-line" /> : <p className="mt-2 text-xs text-muted">no frame stored for this step</p>}
              {replay.step && <p className="mt-2 text-sm">{replay.step.title}: {replay.step.decision}</p>}
              {replay.quote && (
                <blockquote className="mt-2 border-l-2 border-amber pl-3 text-base">
                  “{replay.quote}”
                  <span className="block text-xs text-muted">{map.expert.name}, in her own words</span>
                </blockquote>
              )}
              {replay.audioUrl ? <audio className="mt-2 w-full" controls autoPlay src={replay.audioUrl} /> : <p className="mt-2 text-xs text-muted">no audio clip for this moment; the tutor reads the quote</p>}
              <p className="mt-2 text-sm text-amber">Fix it when you are ready.</p>
            </div>
          )}

          {ended && (
            <div className="panel p-4">
              <p className="panel-title">Session outcome · {log.expertName} · help disclosed per decision</p>
              <ul className="mt-2 space-y-2 text-sm">
                {card.map((c) => (
                  <li key={c.ruleId} className="flex items-center gap-3">
                    <span className={`tag ${c.status === "mastered" ? "tag-green" : c.status === "practicing" ? "tag-amber" : c.status === "needs_practice" ? "tag-red" : ""}`}>{c.label}</span>
                    <span className="flex-1">{c.title}</span>
                    {c.independent && <span className={`tag ${c.independent === "correct without help" ? "tag-green" : "tag-red"}`}>independent: {c.independent}</span>}
                    <span className="text-xs text-muted">{c.detail}</span>
                  </li>
                ))}
                {(log.flagged?.length ?? 0) > 0 && (
                  <li className="flex items-center gap-3">
                    <span className="tag tag-blue">flagged</span>
                    <span className="flex-1">{log.flagged!.length} case{log.flagged!.length > 1 ? "s" : ""} nobody taught yet, sent to {map.expert.name}&apos;s map as open slots</span>
                  </li>
                )}
              </ul>
              {(missed.length > 0 || card.some((c) => c.status === "untested")) && (
                <div className="mt-4">
                  <p className="panel-title">Practice next</p>
                  <ul className="mt-2 space-y-1 text-xs text-muted">
                    {missed.map((c) => (
                      <li key={c.ruleId}>· {c.title}: another case of this kind, with {map.expert.name}&apos;s words at hand</li>
                    ))}
                    {card.filter((c) => c.status === "untested").map((c) => (
                      <li key={c.ruleId}>· {c.title}: not exercised today</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

        </div>

        <div className="space-y-4">
          <div className="panel p-4">
            <p className="panel-title">Tutor</p>
            <ul className="mt-2 space-y-2 text-sm">
              {decisions.length === 0 && <li className="text-muted">Watching. Open invoice 4490.</li>}
              {[...decisions].reverse().map((d, i) => (
                <li key={i} className="rounded border border-line p-2">
                  <span className={`tag ${d.kind === "intervene" || d.kind === "stop" ? "tag-red" : d.kind === "praise" ? "tag-green" : d.kind === "novel" ? "tag-blue" : "tag-amber"}`}>{d.kind}</span>
                  <span className="mono ml-2 text-xs text-muted">{d.t.toFixed(0)}s</span>
                  <p className="mt-1">{d.message}</p>
                  {d.quote && <p className="mt-1 text-xs text-muted">“{d.quote}”</p>}
                </li>
              ))}
            </ul>
          </div>
          <div className="panel p-4">
            <p className="panel-title">Rules in play</p>
            <ul className="mt-2 space-y-1 text-xs">
              {card.map((c) => (
                <li key={c.ruleId} className="flex items-center gap-2">
                  <span className={`light ${c.status === "mastered" ? "light-on" : c.status === "practicing" ? "light-amber" : c.status === "needs_practice" ? "light-red" : "light-off"}`} />
                  <span className="flex-1">{c.title}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="panel p-4">
            <p className="panel-title">Recent events</p>
            <ul className="mt-2 space-y-1 text-xs text-muted">
              {log.events.filter((e) => e.kind !== "typing").slice(-8).reverse().map((e) => (
                <li key={e.id}>
                  <span className="mono">{e.t.toFixed(0)}s</span> {describeEvent(e)}
                </li>
              ))}
            </ul>
          </div>
          {!ended ? (
            <button className="btn btn-primary w-full" onClick={endSession}>
              End session · show the mastery card
            </button>
          ) : (
            <a className="btn w-full text-center" href={`/map/${map.sessionId}`}>
              Back to {map.expert.name}&apos;s map
            </a>
          )}
        </div>
      </div>
    </main>
  );
}
