"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { SessionLog } from "@/lib/events";
import type { AutopilotStep } from "@/lib/autopilot";
import { computeMetrics } from "@/lib/metrics";
import { describeAct, describeCond, openSlots, understanding, type Slot, type Step, type WorkMap } from "@/lib/workmap";
import { VoiceProvider, useTranscriber, useVoice, type ToolHandlers } from "./voice";
import { WorkMapView } from "./WorkMapView";

export function MapClient({ sessionId, agentId }: { sessionId: string; agentId?: string }) {
  const tools = useRef<ToolHandlers>({});
  return (
    <VoiceProvider agentId={agentId} tools={tools}>
      <MapInner sessionId={sessionId} tools={tools} />
    </VoiceProvider>
  );
}

type Phase = "idle" | "asking" | "teachback" | "confirmed";

function MapInner({ sessionId, tools }: { sessionId: string; tools: React.MutableRefObject<ToolHandlers> }) {
  const voice = useVoice();
  const [session, setSession] = useState<SessionLog | null>(null);
  const [map, setMap] = useState<WorkMap | null>(null);
  const [note, setNote] = useState<string>("");
  const [compiling, setCompiling] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [current, setCurrent] = useState<Slot | null>(null);
  const [answer, setAnswer] = useState("");
  const [heard, setHeard] = useState("");
  const [teachback, setTeachback] = useState<{ text: string; sure: string[]; unsure: string[] } | null>(null);
  const [correction, setCorrection] = useState("");
  const [rounds, setRounds] = useState(0);
  const [debriefOn, setDebriefOn] = useState(false);
  const [autopilot, setAutopilot] = useState<AutopilotStep[] | null>(null);
  const [running, setRunning] = useState(false);
  const heardRef = useRef("");
  const currentRef = useRef<Slot | null>(null);
  currentRef.current = current;
  const voiceRef = useRef(voice);
  voiceRef.current = voice;
  const startedAt = useRef(Date.now());

  const load = useCallback(async () => {
    const res = await fetch(`/api/sessions/${sessionId}`);
    if (!res.ok) return;
    const data = await res.json();
    setSession(data.session);
    setMap(data.map);
    if (!data.map) {
      setCompiling(true);
      const c = await fetch("/api/compile", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ sessionId }) });
      const cd = await c.json();
      setMap(cd.map);
      setNote(cd.llm ? `compiled with ${process.env.NEXT_PUBLIC_COMPILE_LABEL ?? "the LLM pass"}` : cd.note ?? "deterministic compile");
      setCompiling(false);
    }
  }, [sessionId]);

  useEffect(() => {
    void load();
  }, [load]);

  const recompile = async (llm: boolean) => {
    setCompiling(true);
    const c = await fetch("/api/compile", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ sessionId, llm }) });
    const cd = await c.json();
    setMap(cd.map);
    setNote(cd.llm ? "compiled with the LLM pass" : cd.note ?? "deterministic compile");
    setCompiling(false);
  };

  // ---------- transcript during the debrief ----------
  const transcriber = useTranscriber({
    enabled: debriefOn,
    onPartial: () => {},
    onCommitted: (text) => {
      if (voiceRef.current.isSpeaking) return;
      heardRef.current = [heardRef.current, text].filter(Boolean).join(" ");
      setHeard(heardRef.current);
    },
  });

  // ---------- slot filling ----------
  const fill = useCallback(
    async (slot: Slot, text: string) => {
      const res = await fetch(`/api/sessions/${sessionId}/slot`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ slotId: slot.id, text, t: (Date.now() - startedAt.current) / 1000 }) });
      const data = await res.json();
      if (data.map) setMap(data.map);
      heardRef.current = "";
      setHeard("");
      setAnswer("");
      return data.map as WorkMap;
    },
    [sessionId],
  );

  const askNext = useCallback(
    (m: WorkMap) => {
      const next = openSlots(m)[0];
      if (!next) {
        setCurrent(null);
        void startTeachback(m);
        return;
      }
      setCurrent(next);
      setPhase("asking");
      heardRef.current = "";
      setHeard("");
      voiceRef.current.setMicMuted(false);
      voiceRef.current.say("DEBRIEF", `slot=${next.id} ${next.question}`, next.question);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const startTeachback = useCallback(
    async (m: WorkMap) => {
      const res = await fetch("/api/teachback", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ sessionId: m.sessionId }) });
      const tb = await res.json();
      setTeachback(tb);
      setPhase("teachback");
      voiceRef.current.setMicMuted(false);
      voiceRef.current.say("TEACHBACK", tb.text, tb.text);
    },
    [],
  );

  const confirm = useCallback(
    async (confirmed: boolean, text?: string) => {
      const res = await fetch(`/api/sessions/${sessionId}/confirm`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ confirmed, correction: text, t: (Date.now() - startedAt.current) / 1000 }) });
      const data = await res.json();
      setMap(data.map);
      if (confirmed) {
        setPhase("confirmed");
        voiceRef.current.say("CONFIRMED", "The expert confirmed the teach-back. Say thank you in one short sentence and stop.", "Thank you. That is how it works. I have it.");
        voiceRef.current.setMicMuted(true);
        return;
      }
      const prev = teachback?.text ?? "";
      const next = data.teachback as { text: string; sure: string[]; unsure: string[] };
      setTeachback(next);
      setRounds((r) => r + 1);
      const changed = diffSentences(prev, next.text);
      const spoken = changed.length ? `Understood. ${changed.join(" ")} Is that right now?` : `Understood. ${next.text}`;
      voiceRef.current.say("TEACHBACK", spoken, spoken);
      setCorrection("");
    },
    [sessionId, teachback],
  );

  tools.current = {
    log_answer: async (p) => {
      const slot = currentRef.current;
      if (!slot) return "no open slot";
      const verbatim = heardRef.current.trim() || String(p.reason ?? "");
      const m = await fill(slot, verbatim);
      askNext(m);
      return "logged";
    },
    confirm_teachback: async (p) => {
      const ok = p.confirmed === true || p.confirmed === "true";
      await confirm(ok, ok ? undefined : String(p.corrections ?? heardRef.current));
      return ok ? "confirmed" : "corrected";
    },
  };

  const startDebrief = async () => {
    if (!map) return;
    setDebriefOn(true);
    await voice.connect({ firstMessage: "Thanks, that was clear. I have a few things I am still unsure about." });
    window.setTimeout(() => askNext(map), 2500);
  };

  const metrics = useMemo(() => (session && map ? computeMetrics(session, map) : null), [session, map]);

  const runAutopilot = async () => {
    if (!map) return;
    setRunning(true);
    setAutopilot([]);
    const res = await fetch("/api/autopilot", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ sessionId: map.sessionId }) });
    const data = await res.json();
    for (const step of data.steps as AutopilotStep[]) {
      await new Promise((r) => setTimeout(r, 900));
      setAutopilot((xs) => [...(xs ?? []), step]);
    }
    setRunning(false);
  };

  if (!map) {
    return (
      <main className="grid-bg min-h-screen">
        <div className="mx-auto max-w-xl px-6 py-24 text-center">
          <p className="panel-title">2 · Map</p>
          <p className="mt-4 text-lg">{compiling ? "Compiling the Work Map from events, transcript and answers…" : "Loading session…"}</p>
        </div>
      </main>
    );
  }

  const open = openSlots(map);
  const closed = map.slots.length - open.length;
  const evidenceOk = map.steps.filter((s) => s.judgment).every((s) => !!s.reason);
  const ready = open.length === 0 && evidenceOk && !!map.confirmedAt;
  void understanding;
  const judgment = map.steps.filter((s) => s.judgment).length;
  const guardrails = map.steps.reduce((a, s) => a + s.guardrails.length, 0);

  return (
    <main className="min-h-screen">
      <header className="flex items-center gap-3 border-b border-line bg-panel px-4 py-2 text-sm">
        <span className="font-semibold">Tacit</span>
        <span className="text-muted">· map · {map.expert.name} · {map.task}</span>
        {map.onet && <span className="tag">O*NET {map.onet.code}</span>}
        <span className="mono ml-auto text-xs text-muted">{note}</span>
        <button className="btn" onClick={() => recompile(true)} disabled={compiling}>
          {compiling ? "compiling…" : "recompile"}
        </button>
        <Link href={`/teach?from=${sessionId}`} className={`btn ${map.confirmedAt ? "btn-primary" : ""}`}>
          3 · Teach →
        </Link>
      </header>

      <div className="grid gap-4 p-4 lg:grid-cols-[380px_1fr]">
        {/* left: understanding, debrief, teach-back */}
        <div className="space-y-4">
          <div className="panel p-4">
            <div className="flex items-center justify-between">
              <p className="panel-title">Gaps closed</p>
              <span className="mono text-sm">{closed} / {map.slots.length}</span>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded bg-bg">
              <div className={`h-full transition-all ${ready ? "bg-green" : "bg-amber"}`} style={{ width: `${map.slots.length ? (closed / map.slots.length) * 100 : 100}%` }} />
            </div>
            <div className="mt-3 grid grid-cols-4 gap-2 text-center text-xs">
              <Stat k="steps" v={map.steps.length} />
              <Stat k="judgment" v={judgment} />
              <Stat k="guardrails" v={guardrails} />
              <Stat k="map rev" v={map.revision} />
            </div>
            <ul className="mt-3 space-y-1 text-xs">
              <li className="flex items-center gap-2"><span className={`light ${evidenceOk ? "light-on" : "light-amber"}`} />every judgment step has {map.expert.name}&apos;s words</li>
              <li className="flex items-center gap-2"><span className={`light ${open.length === 0 ? "light-on" : "light-amber"}`} />{open.length === 0 ? "no open gaps" : `${open.length} gap${open.length > 1 ? "s" : ""} still open`}</li>
              <li className="flex items-center gap-2"><span className={`light ${map.confirmedAt ? "light-on" : "light-amber"}`} />{map.confirmedAt ? `teach-back confirmed by ${map.expert.name}` : "teach-back not yet confirmed"}</li>
            </ul>
            <p className={`mt-3 text-xs ${ready ? "text-green" : "text-muted"}`}>{ready ? "Ready to teach, for this task's scope. The tutor loads this revision." : "Ready to teach means: no open gaps, her words on every decision, and an explicit yes on the teach-back."}</p>
          </div>

          <div className={`panel p-4 ${phase === "asking" ? "border-amber" : ""}`}>
            <div className="flex items-center justify-between">
              <p className="panel-title">Debrief</p>
              <span className={`tag ${voice.connected ? "tag-green" : ""}`}>{voice.status}</span>
            </div>
            {!debriefOn && phase === "idle" && (
              <button className="btn btn-primary mt-3 w-full" onClick={startDebrief}>
                Start the spoken debrief ({open.length} open slot{open.length === 1 ? "" : "s"})
              </button>
            )}
            {current && phase === "asking" && (
              <div className="mt-3">
                <span className="tag tag-amber">{current.kind}</span>
                <p className="mt-2 text-sm">{current.question}</p>
                <p className="mt-2 min-h-5 text-sm text-green">{heard}</p>
                <form
                  className="mt-2 flex gap-2"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const text = (answer.trim() || heardRef.current.trim());
                    if (!text) return;
                    const m = await fill(current, text);
                    askNext(m);
                  }}
                >
                  <input className="flex-1" placeholder={voice.mode === "fallback" ? "Type the answer" : "or type it"} value={answer} onChange={(e) => setAnswer(e.target.value)} />
                  <button className="btn btn-primary" type="submit">
                    Log
                  </button>
                </form>
                <p className="mt-2 text-xs text-muted">{transcriber.engine === "scribe" ? "Scribe v2 is listening" : transcriber.engine === "webspeech" ? "browser STT is listening" : "no STT: type the answer"}</p>
              </div>
            )}
            <ul className="mt-3 space-y-1 text-xs">
              {map.slots.map((s) => (
                <li key={s.id} className="flex items-start gap-2">
                  <span className={`light mt-1 ${s.status === "filled" ? "light-on" : s.status === "skipped" ? "light-off" : "light-amber"}`} />
                  <span className={s.status === "filled" ? "text-muted line-through decoration-line" : ""}>{s.question}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className={`panel p-4 ${phase === "teachback" ? "border-amber" : ""}`}>
            <p className="panel-title">Teach-back</p>
            {teachback ? (
              <div className="mt-2 text-sm">
                <p>{teachback.text}</p>
                <p className="mt-2 text-xs text-muted">{wordCount(teachback.text)} words · {teachback.sure.length} confident · {teachback.unsure.length} unsure · round {rounds + 1}</p>
                {phase === "teachback" && (
                  <div className="mt-3 space-y-2">
                    <button className="btn btn-primary w-full" onClick={() => confirm(true)}>
                      Yes, that is how it works
                    </button>
                    <form
                      className="flex gap-2"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const c = correction.trim() || heardRef.current.trim();
                        if (c) void confirm(false, c);
                      }}
                    >
                      <input className="flex-1" placeholder="Correct one detail, e.g. only Bäcker, not every supplier" value={correction} onChange={(e) => setCorrection(e.target.value)} />
                      <button className="btn" type="submit">
                        Correct
                      </button>
                    </form>
                    {heard && <p className="text-xs text-green">heard: {heard}</p>}
                  </div>
                )}
                {phase === "confirmed" && <p className="mt-2 text-xs text-green">Confirmed. Open the Teach page.</p>}
              </div>
            ) : (
              <button className="btn mt-2" onClick={() => map && startTeachback(map)} disabled={open.length > 0 && phase !== "idle"}>
                Generate teach-back now
              </button>
            )}
          </div>

          {metrics && (
            <div className="panel p-4">
              <p className="panel-title">Measured</p>
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                <Stat k="live questions" v={metrics.liveQuestions} />
                <Stat k="per 10 min" v={metrics.questionsPer10Min} />
                <Stat k="interrupted typing" v={metrics.interruptionsWhileTyping} />
                <Stat k="pause to first word" v={metrics.medianPauseToFirstWordSecs === null ? "–" : `${metrics.medianPauseToFirstWordSecs}s`} />
                <Stat k="filled live / narration" v={`${metrics.slotsFilledLive} / ${metrics.slotsFilledNarration}`} />
                <Stat k="filled in debrief" v={metrics.slotsFilledDebrief} />
                <Stat k="frames seen / kept" v={`${metrics.framesSeen} / ${metrics.framesKept}`} />
                <Stat k="redacted / struck" v={`${metrics.entitiesRedacted} / ${metrics.secondsStruck}s`} />
              </div>
            </div>
          )}

          <div className="panel p-4">
            <div className="flex items-center justify-between">
              <p className="panel-title">Stretch · agent-ready guardrails</p>
              <span className="tag">export</span>
            </div>
            <p className="mt-2 text-xs text-muted">The Work Map as instructions an agent can load: the same steps, and it stops where {map.expert.name} would. People keep the judgment calls.</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <a className="btn" href={`/api/export?sessionId=${sessionId}&format=policy`}>policy.json</a>
              <a className="btn" href={`/api/export?sessionId=${sessionId}&format=prompt`}>agent prompt</a>
              <a className="btn" href={`/api/export?sessionId=${sessionId}&format=sop`}>SOP markdown</a>
            </div>
            <button className="btn btn-primary mt-3 w-full" onClick={runAutopilot} disabled={running || !map.confirmedAt} title={map.confirmedAt ? "" : "confirm the map first"}>
              {running ? "running…" : "Prove it: load policy.json and run the routine queue"}
            </button>
            {autopilot && (
              <ul className="mt-3 space-y-1 text-xs">
                {autopilot.map((s) => (
                  <li key={s.invoice} className="flex items-start gap-2">
                    <span className={`tag ${s.outcome === "halted" ? "tag-red" : s.outcome === "flagged" ? "tag-blue" : "tag-green"}`}>{s.outcome}</span>
                    <span className="mono text-muted">INV-{s.invoice}</span>
                    <span className="flex-1">
                      {s.supplier}, €{Math.abs(s.amount).toLocaleString("en-IE")}: {s.reason}
                      {s.quote && <span className="block text-muted">“{s.quote}”</span>}
                    </span>
                  </li>
                ))}
                {!running && autopilot.length > 0 && autopilot[autopilot.length - 1].outcome === "halted" && <li className="text-amber">Stopped where {map.expert.name} would. The rest of the queue waits for a human.</li>}
              </ul>
            )}
          </div>
        </div>

        {/* right: the Work Map */}
        <WorkMapView map={map} frames={session?.frames ?? []} sessionId={sessionId} onChange={setMap} editable={!map.confirmedAt} />
      </div>
    </main>
  );
}

function diffSentences(prev: string, next: string): string[] {
  const split = (s: string) => s.split(/(?<=[.?!])\s+/).map((x) => x.trim()).filter(Boolean);
  const before = new Set(split(prev));
  return split(next).filter((s) => !before.has(s) && !/^Is that how it works\?$/.test(s));
}

function wordCount(t: string) {
  return t.trim().split(/\s+/).filter(Boolean).length;
}

function Stat({ k, v }: { k: string; v: string | number }) {
  return (
    <div className="rounded border border-line bg-bg px-2 py-1.5 text-left">
      <p className="text-muted">{k}</p>
      <p className="mono text-base text-ink">{v}</p>
    </div>
  );
}

export type { Step };
export { describeAct, describeCond };
