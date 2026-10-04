"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SessionLog } from "@/lib/events";
import type { AutopilotStep } from "@/lib/autopilot";
import { computeMetrics } from "@/lib/metrics";
import { openSlots, type Slot, type Step, type WorkMap } from "@/lib/workmap";
import { describeAct, describeCond } from "@/lib/workmap";
import { VoiceProvider, useTranscriber, useVoice, type ToolHandlers } from "./voice";
import { MapView } from "./views/MapView";
import type { MapPhase, MapVM } from "./views/map.vm";

export function MapClient({ sessionId, agentId }: { sessionId: string; agentId?: string }) {
  const tools = useRef<ToolHandlers>({});
  return (
    <VoiceProvider agentId={agentId} tools={tools}>
      <MapInner sessionId={sessionId} tools={tools} />
    </VoiceProvider>
  );
}

function MapInner({ sessionId, tools }: { sessionId: string; tools: React.MutableRefObject<ToolHandlers> }) {
  const voice = useVoice();
  const [session, setSession] = useState<SessionLog | null>(null);
  const [map, setMap] = useState<WorkMap | null>(null);
  const [note, setNote] = useState<string>("");
  const [compiling, setCompiling] = useState(false);
  const [phase, setPhase] = useState<MapPhase>("idle");
  const [current, setCurrent] = useState<Slot | null>(null);
  const [heard, setHeard] = useState("");
  const [teachback, setTeachback] = useState<{ text: string; sure: string[]; unsure: string[] } | null>(null);
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

  const recompile = useCallback(async (llm: boolean) => {
    setCompiling(true);
    try {
      const c = await fetch("/api/compile", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ sessionId, llm }) });
      if (!c.ok) throw new Error(c.status === 409 ? "Session changed during compilation. Retry with the latest evidence." : "Compilation failed. Please retry.");
      const cd = await c.json();
      if (!cd.map) throw new Error("No map returned. Please retry.");
      setMap(cd.map);
      setNote(cd.llm ? `compiled with ${process.env.NEXT_PUBLIC_COMPILE_LABEL ?? "the LLM pass"}` : cd.note ?? "deterministic compile");
    } catch (error) {
      setNote(error instanceof Error ? error.message : "Compilation failed. Please retry.");
    } finally {
      setCompiling(false);
    }
  }, [sessionId]);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/sessions/${sessionId}`);
      if (!res.ok) throw new Error("Session could not be loaded. Please retry.");
      const data = await res.json();
      setSession(data.session);
      setMap(data.map ?? null);
      if (!data.map) await recompile(true);
    } catch { setNote("Session could not be loaded. Please retry."); }
  }, [sessionId, recompile]);

  useEffect(() => {
    void load();
  }, [load]);

  const transcriber = useTranscriber({
    enabled: debriefOn,
    onPartial: () => {},
    onCommitted: (text) => {
      if (voiceRef.current.isSpeaking) return;
      heardRef.current = [heardRef.current, text].filter(Boolean).join(" ");
      setHeard(heardRef.current);
    },
  });

  const onMapChange = useCallback(
    (next: WorkMap) => {
      setMap(next);
      void fetch(`/api/sessions/${sessionId}/map`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(next) });
    },
    [sessionId],
  );

  const fill = useCallback(
    async (slot: Slot, text: string) => {
      const res = await fetch(`/api/sessions/${sessionId}/slot`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ slotId: slot.id, text, t: (Date.now() - startedAt.current) / 1000 }) });
      const data = await res.json();
      if (data.map) setMap(data.map);
      heardRef.current = "";
      setHeard("");
      return data.map as WorkMap;
    },
    [sessionId],
  );

  const runTeachback = useCallback(async (m: WorkMap) => {
    const res = await fetch("/api/teachback", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ sessionId: m.sessionId }) });
    const tb = await res.json();
    setTeachback(tb);
    setPhase("teachback");
    voiceRef.current.setMicMuted(false);
    voiceRef.current.say("TEACHBACK", tb.text, tb.text);
  }, []);

  const askNext = useCallback(
    (m: WorkMap) => {
      const next = openSlots(m)[0];
      if (!next) {
        setCurrent(null);
        void runTeachback(m);
        return;
      }
      setCurrent(next);
      setPhase("asking");
      heardRef.current = "";
      setHeard("");
      voiceRef.current.setMicMuted(false);
      voiceRef.current.say("DEBRIEF", `slot=${next.id} ${next.question}`, next.question);
    },
    [runTeachback],
  );

  const confirmMap = useCallback(
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
      await confirmMap(ok, ok ? undefined : String(p.corrections ?? heardRef.current));
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

  const progress = map
    ? (() => {
        const open = openSlots(map);
        const closed = map.slots.length - open.length;
        const evidenceOk = map.steps.filter((s) => s.judgment).every((s) => !!s.reason);
        const ready = open.length === 0 && evidenceOk && !!map.confirmedAt;
        return {
          open: open.length,
          closed,
          total: map.slots.length,
          evidenceOk,
          ready,
          judgment: map.steps.filter((s) => s.judgment).length,
          guardrails: map.steps.reduce((a, s) => a + s.guardrails.length, 0),
        };
      })()
    : null;

  const vm: MapVM = {
    sessionId,
    map,
    frames: session?.frames ?? [],
    compiling,
    note,
    phase,
    debriefOn,
    currentSlot: current,
    heard,
    teachback,
    rounds,
    progress,
    metrics,
    autopilot,
    autopilotRunning: running,
    voice: { mode: voice.mode, connected: voice.connected, status: voice.status, isSpeaking: voice.isSpeaking },
    sttEngine: transcriber.engine,
    startDebrief,
    submitAnswer: async (text) => {
      const slot = currentRef.current;
      const t = text.trim() || heardRef.current.trim();
      if (!slot || !t) return;
      const m = await fill(slot, t);
      askNext(m);
    },
    startTeachback: () => {
      if (map) void runTeachback(map);
    },
    confirm: (yes, c) => (yes ? confirmMap(true) : (() => {
      const t = (c ?? "").trim() || heardRef.current.trim();
      return t ? confirmMap(false, t) : Promise.resolve();
    })()),
    recompile,
    runAutopilot,
    onMapChange,
  };
  return <MapView vm={vm} />;
}

function diffSentences(prev: string, next: string): string[] {
  const split = (s: string) => s.split(/(?<=[.?!])\s+/).map((x) => x.trim()).filter(Boolean);
  const before = new Set(split(prev));
  return split(next).filter((s) => !before.has(s) && !/^Is that how it works\?$/.test(s));
}

export type { Step };
export { describeAct, describeCond };
