"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { VoiceProvider, useTranscriber, useVoice, type ToolHandlers, type VoiceDebugEvent } from "@/components/voice";

const ASK_SAMPLE = "You changed the code on item 9001 from 1000 to 2000. What made you do that? | stepRef=9001:code | kind=why | on screen: item 9001: code 1000 -> 2000";

export function VoiceCheck({ role, agentId }: { role: "interviewer" | "tutor"; agentId?: string }) {
  const tools = useRef<ToolHandlers>({});
  const [events, setEvents] = useState<VoiceDebugEvent[]>([]);
  const onDebugEvent = useCallback((event: VoiceDebugEvent) => setEvents((old) => [...old.slice(-499), event]), []);
  const clearEvents = useCallback(() => setEvents([]), []);
  return (
    <VoiceProvider agentId={agentId} tools={tools} onDebugEvent={onDebugEvent}>
      <VoiceCheckInner role={role} agentId={agentId} events={events} log={onDebugEvent} clearEvents={clearEvents} />
    </VoiceProvider>
  );
}

function VoiceCheckInner({ role, agentId, events, log, clearEvents }: { role: string; agentId?: string; events: VoiceDebugEvent[]; log: (event: VoiceDebugEvent) => void; clearEvents: () => void }) {
  const voice = useVoice();
  const [sample, setSample] = useState(ASK_SAMPLE);
  const [lastCommit, setLastCommit] = useState("");
  const [mic, setMic] = useState("checking");
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState("");
  const [connectStartedAt, setConnectStartedAt] = useState<number>();
  const [soakUntil, setSoakUntil] = useState<number>();
  const [soakRemaining, setSoakRemaining] = useState(0);
  const stt = useTranscriber({
    enabled: !voice.micMuted,
    onPartial: () => {},
    onCommitted: (text) => setLastCommit(text),
  });
  const metrics = deriveMetrics(events);

  const refreshDevices = useCallback(async () => {
    const inputs = (await navigator.mediaDevices?.enumerateDevices?.() ?? []).filter((device) => device.kind === "audioinput");
    setDevices(inputs);
    const stored = localStorage.getItem("tacit.micDeviceId") ?? "";
    setDeviceId(inputs.some((device) => device.deviceId === stored) ? stored : inputs[0]?.deviceId ?? "");
  }, []);

  useEffect(() => {
    void navigator.permissions?.query({ name: "microphone" as PermissionName })
      .then((permission) => setMic(permission.state))
      .catch(() => setMic("unknown"));
    void refreshDevices();
  }, [refreshDevices]);

  useEffect(() => {
    if (!soakUntil) return;
    const update = () => {
      const remaining = Math.max(0, soakUntil - Date.now());
      setSoakRemaining(remaining);
      if (remaining === 0) {
        setSoakUntil(undefined);
        log({ at: Date.now(), src: "gate", type: "silence_soak_complete" });
      }
    };
    update();
    const timer = window.setInterval(update, 1_000);
    return () => window.clearInterval(timer);
  }, [log, soakUntil]);

  const requestMic = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: deviceId ? { deviceId: { exact: deviceId } } : true });
      stream.getTracks().forEach((track) => track.stop());
      setMic("granted");
      await refreshDevices();
    } catch (error) {
      setMic(`denied (${error instanceof Error ? error.message : String(error)})`);
    }
  };
  const connect = async () => {
    const at = Date.now();
    setConnectStartedAt(at);
    log({ at, src: "turn", type: "connect_clicked", data: { role } });
    await voice.connect({ dynamicVariables: { expert_name: "the expert", newhire_name: "the new hire", task: "voice diagnostics" } });
    log({ at: Date.now(), src: "turn", type: "connect_resolved", data: { id: voice.getId() } });
  };
  const download = () => {
    const blob = new Blob([JSON.stringify({ role, agentIdPresent: !!agentId, status: voice.status, degraded: voice.degraded, lastError: voice.lastError, stt, metrics, events }, null, 2)], { type: "application/json" });
    const anchor = document.createElement("a");
    anchor.href = URL.createObjectURL(blob);
    anchor.download = `voice-check-${Date.now()}.json`;
    anchor.click();
    URL.revokeObjectURL(anchor.href);
  };
  const clear = () => {
    clearEvents();
    setLastCommit("");
    setConnectStartedAt(undefined);
  };
  const startSilenceSoak = () => {
    voice.setMicMuted(true);
    const until = Date.now() + 180_000;
    setSoakUntil(until);
    log({ at: Date.now(), src: "gate", type: "silence_soak_started", data: { durationSecs: 180 } });
  };

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-6 text-slate-100">
      <div><h1 className="text-3xl font-semibold">Voice check · {role}</h1><p className="text-sm text-slate-400">M0 connection and event diagnostics. Keyed audio still requires a human mic/listening test.</p></div>
      <section className="grid gap-3 rounded-2xl border border-slate-700 bg-slate-900 p-4 md:grid-cols-2">
        <Row label="Agent ID" value={agentId ? "present" : "keyless fallback"} />
        <Row label="STT" value={`${stt.engine} · ${stt.connected ? "connected" : "off"}`} />
        <Row label="Mic permission" value={mic} />
        <Row label="Input" value={devices.find((device) => device.deviceId === deviceId)?.label || (deviceId ? "selected input" : "none detected")} />
        <select className="rounded bg-slate-800 p-2" value={deviceId} onChange={(event) => { setDeviceId(event.target.value); localStorage.setItem("tacit.micDeviceId", event.target.value); }}>
          <option value="">Default microphone</option>{devices.map((device, index) => <option key={device.deviceId || index} value={device.deviceId}>{device.label || `Microphone ${index + 1}`}</option>)}
        </select>
        <button className="rounded bg-slate-700 px-3 py-2" onClick={() => void requestMic()}>Request / refresh microphone</button>
      </section>
      <section className="space-y-3 rounded-2xl border border-slate-700 bg-slate-900 p-4">
        <div className="flex flex-wrap gap-2">
          <button className="rounded bg-emerald-600 px-3 py-2" onClick={() => void connect()}>Connect</button>
          <button className="rounded bg-slate-700 px-3 py-2" onClick={voice.disconnect}>Disconnect</button>
          <button className="rounded bg-slate-700 px-3 py-2" onClick={() => voice.setMicMuted(!voice.micMuted)}>{voice.micMuted ? "Open mic" : "Close mic"}</button>
          <button className="rounded bg-slate-700 px-3 py-2" onClick={() => voice.sendContext("[SCREEN] Voice diagnostics context only.")}>Send [SCREEN] context</button>
          <button className="rounded bg-slate-700 px-3 py-2" onClick={() => voice.say("ASK", sample)}>Send [ASK] sample</button>
          <button className="rounded bg-indigo-600 px-3 py-2 disabled:opacity-50" disabled={soakUntil !== undefined} onClick={startSilenceSoak}>{soakUntil ? `Silence soak · ${Math.ceil(soakRemaining / 1000)}s` : "Silence soak (3 min)"}</button>
          <button className="rounded bg-slate-700 px-3 py-2" onClick={download}>Download log (JSON)</button>
        </div>
        <textarea className="min-h-28 w-full rounded bg-slate-950 p-3 text-sm" value={sample} onChange={(event) => setSample(event.target.value)} />
        <div className="grid gap-2 text-sm md:grid-cols-4"><Row label="Mode" value={voice.mode} /><Row label="Status" value={voice.status} /><Row label="Conversation" value={voice.getId() ?? "none"} /><Row label="Connect elapsed" value={connectStartedAt ? `${Date.now() - connectStartedAt} ms` : "—"} /></div>
        <div className="grid gap-2 text-sm md:grid-cols-5"><Row label="Connect → ready" value={formatMs(metrics.connectMs)} /><Row label="Sent / spoke" value={`${metrics.sends} / ${metrics.speaking}`} /><Row label="Sent → spoke p50/p90" value={`${formatMs(metrics.sentToSpokeP50)} / ${formatMs(metrics.sentToSpokeP90)}`} /><Row label="Partials / commits" value={`${metrics.partials} / ${metrics.commits}`} /><Row label="log_answer tools" value={String(metrics.answers)} /></div>
        <div className="grid gap-2 text-sm md:grid-cols-4"><Row label="Output gate" value={voice.gateOpen ? "OPEN" : "CLOSED"} /><Row label="Gated utterances" value={String(metrics.gatedUtterances)} /><Row label="Audible unsolicited" value={String(metrics.audibleUnsolicited)} /><Row label="Heartbeats" value={String(metrics.heartbeats)} /></div>
        {soakUntil && <p className="rounded bg-indigo-950 p-3 text-sm text-indigo-200">Silence soak running. Keep this page connected for three minutes: 60 seconds quiet, 60 seconds typing elsewhere, then 60 seconds reading aloud. Expected: gate CLOSED, audible unsolicited 0, heartbeats at least 15.</p>}
        {lastCommit && <p className="rounded bg-slate-950 p-3 text-sm"><span className="text-slate-500">Last STT commit: </span>{lastCommit}</p>}
        {voice.lastError && <p className="rounded bg-amber-950 p-3 text-amber-200">Degraded: {voice.lastError}</p>}
      </section>
      <section className="rounded-2xl border border-slate-700 bg-slate-900 p-4"><div className="mb-3 flex items-center justify-between"><h2 className="font-semibold">Raw events ({events.length})</h2><button className="text-sm text-slate-400" onClick={clear}>Clear</button></div><div className="max-h-[32rem] overflow-auto font-mono text-xs">{events.length === 0 ? <p className="text-slate-500">No events yet.</p> : events.map((event, index) => <div key={`${event.at}-${index}`} className="grid grid-cols-[6rem_4rem_10rem_1fr] gap-2 border-t border-slate-800 py-2"><span>{connectStartedAt ? `${event.at - connectStartedAt} ms` : new Date(event.at).toLocaleTimeString()}</span><span>{event.src}</span><span>{event.type}</span><span className="break-all text-slate-400">{safeJson(event.data)}</span></div>)}</div></section>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) { return <div><span className="text-slate-500">{label}: </span><span>{value}</span></div>; }
function safeJson(value: unknown) { try { return value === undefined ? "" : JSON.stringify(value); } catch { return "[unserializable]"; } }
function formatMs(value?: number) { return value === undefined ? "—" : `${Math.round(value)} ms`; }
function deriveMetrics(events: VoiceDebugEvent[]) {
  const connectClick = events.find((event) => event.type === "connect_clicked")?.at;
  const connected = events.find((event) => event.src === "agent" && event.type === "connect")?.at;
  const sends = events.filter((event) => event.type === "outgoing" && safeJson(event.data).includes("user_message"));
  const speaking = events.filter((event) => event.type === "mode" && safeJson(event.data).includes("speaking"));
  const latencies = sends.flatMap((sent) => { const spokeAt = speaking.find((event) => event.at >= sent.at)?.at; return spokeAt === undefined ? [] : [spokeAt - sent.at]; }).sort((a, b) => a - b);
  const percentile = (p: number) => latencies.length ? latencies[Math.min(latencies.length - 1, Math.floor((latencies.length - 1) * p))] : undefined;
  return {
    connectMs: connectClick !== undefined && connected !== undefined ? connected - connectClick : undefined,
    sends: sends.length, speaking: speaking.length,
    sentToSpokeP50: percentile(0.5), sentToSpokeP90: percentile(0.9),
    partials: events.filter((event) => event.src === "scribe" && event.type === "partial").length,
    commits: events.filter((event) => event.src === "scribe" && event.type === "commit").length,
    answers: events.filter((event) => event.src === "tool" && event.type === "dispatch" && safeJson(event.data).includes("log_answer")).length,
    gatedUtterances: events.filter((event) => event.src === "gate" && event.type === "gated_utterance").length,
    audibleUnsolicited: events.filter((event) => event.src === "gate" && event.type === "audible_unsolicited").length,
    heartbeats: events.filter((event) => event.src === "gate" && event.type === "heartbeat").length,
  };
}
