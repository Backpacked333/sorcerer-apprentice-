"use client";

import { useEffect, useRef, useState } from "react";
import { describeEvent } from "@/lib/events";
import { presenceOf } from "@/lib/ui/presence";
import { Meter } from "@/components/Meter";
import { AppShell } from "@/components/ui/AppShell";
import { BrowserCheck } from "@/components/ui/BrowserCheck";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { OpenErpButton } from "@/components/ui/OpenErpButton";
import { PersonaCard } from "@/components/ui/PersonaCard";
import { Presence } from "@/components/ui/Presence";
import { useLayoutMode } from "@/components/ui/useLayoutMode";
import { usePresenter } from "@/components/ui/usePresenter";
import { Workspace } from "@/components/ui/Workspace";
import type { CaptureVM } from "./capture.vm";

const KIND: Record<string, string> = {
  why: "Why",
  counterfactual: "What if",
  limit: "Where's the limit",
  stop: "When to stop",
  who: "Who decides",
};

export function CaptureView({ vm }: { vm: CaptureVM }) {
  const presenter = usePresenter();
  const canCrop = typeof vm.pipeline.setCropTarget === "function";
  const mode = useLayoutMode({ canCrop, source: vm.source, started: vm.started });
  const [reloadKey, setReloadKey] = useState(vm.started ? "live" : "idle");
  useEffect(() => {
    if (!vm.started) return;
    const id = window.setTimeout(() => setReloadKey("live"), 1500);
    return () => window.clearTimeout(id);
  }, [vm.started]);

  const body = (
    <Companion vm={vm} presenter={presenter} mode={mode} />
  );

  if (mode === "workspace") {
    return (
      <Workspace
        erpSrc="/erp?queue=expert"
        locked={!vm.started}
        lockedHint="Start the session to begin"
        reloadKey={reloadKey}
        onFrameElement={vm.pipeline.setCropTarget}
        presenter={presenter}
      >
        {body}
      </Workspace>
    );
  }

  return (
    <div className="companion-only">
      <p className="t-small text-muted">Open the ERP in its own window.</p>
      <div className="mb-3"><OpenErpButton queue="expert">Open the ERP window</OpenErpButton></div>
      {body}
    </div>
  );
}

function Companion({ vm, presenter, mode }: { vm: CaptureVM; presenter: boolean; mode: "workspace" | "companion" }) {
  const [mech, setMech] = useState(false);
  const [draft, setDraft] = useState("");
  const [masking, setMasking] = useState(false);
  const [drawing, setDrawing] = useState<{ x: number; y: number } | null>(null);
  const [box, setBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [band, setBand] = useState(false);
  const struck = useRef(vm.ledger.secondsStruck);
  const struckAt = useRef<number | null>(null);

  useEffect(() => {
    if (presenter) setMech(true);
  }, [presenter]);

  useEffect(() => {
    if (vm.ledger.secondsStruck > struck.current) {
      struck.current = vm.ledger.secondsStruck;
      struckAt.current = Date.now();
      setBand(true);
      const id = window.setTimeout(() => setBand(false), 4000);
      return () => window.clearTimeout(id);
    }
    struck.current = vm.ledger.secondsStruck;
  }, [vm.ledger.secondsStruck]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "p" && e.key !== "P") return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      vm.setHolding(!vm.holding);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [vm]);

  const ago = struckAt.current == null ? null : Date.now() - struckAt.current;
  const presence = presenceOf({
    holding: vm.holding,
    struckAgoMs: band ? ago : null,
    phase: vm.openWindow?.phase,
    sharing: vm.pipeline.sharing,
    queued: vm.queued.length,
    waitingReason: vm.decision?.reasons[0],
  });

  const voiceWord = vm.voice.degraded
    ? "Voice offline"
    : vm.voice.mode === "agent"
      ? vm.voice.connected ? "ElevenAgents" : "Voice offline"
      : "Browser voice (fallback)";
  const earWord = vm.sttEngine === "scribe" ? "Scribe v2" : vm.sttEngine === "webspeech" ? "Browser STT (fallback)" : "No transcript";
  const eyeWord = vm.pipeline.visionError
    ? `Vision degraded: ${vm.pipeline.visionError}`
    : vm.pipeline.dropped > 0
      ? `${vm.pipeline.dropped} frames skipped`
      : vm.pipeline.sharing
        ? "Seeing the ERP"
        : mode === "workspace"
          ? "ERP telemetry only"
          : "No screen";

  return (
    <AppShell step={1} fill={mode === "workspace"} presenter={presenter} status={<span className="t-meta">{vm.started ? vm.sessionId : "1 Capture"}</span>}>
      <div className="side-col">
        <div className="side-scroll">
          {!vm.started && (
            <div className="space-y-4 p-4">
              <BrowserCheck />
              <PersonaCard role="expert" name={vm.expertName} />
              <ul className="space-y-2 t-small">
                <li>Browser: desktop Chrome or Edge, with screen share.</li>
                <li>Headphones on. The apprentice must not hear itself.</li>
                <li>{mode === "workspace" ? "In the share dialog, choose This tab." : "In the share dialog, pick the tab named MB-ERP."}</li>
                <li>Close other ERP tabs. They post into the same session.</li>
              </ul>
              <label className="block t-small">
                <span className="text-muted">Your name</span>
                <input className="mt-1 w-full" placeholder="Your name" value={vm.expertName} onChange={(e) => vm.setExpertName(e.target.value)} />
              </label>
              <label className="block t-small">
                <span className="text-muted">Task</span>
                <input className="mt-1 w-full" value={vm.task} onChange={(e) => vm.setTask(e.target.value)} />
              </label>
              <div className="rounded border border-line bg-bg p-3 t-small text-muted">
                <p className="text-ink">What is captured, and what is kept</p>
                <p className="mt-1">Your microphone, for the transcript and the agent. The screen surface you choose, as a still every one to two seconds, sent to a vision model and turned into events. Only the handful of frames tied to a decision are stored, after you can mask regions and after personal data is blurred. &quot;Scratch that&quot; removes the current exchange and its frames. The voice provider keeps conversation transcripts and audio per the account&apos;s retention settings; this app does not change those.</p>
                <label className="mt-2 flex items-center gap-2 text-ink">
                  <input type="checkbox" data-testid="capture-consent" checked={vm.consented} onChange={(e) => vm.setConsented(e.target.checked)} /> I understand; start the session
                </label>
              </div>
              <Button variant="primary" className="w-full" data-testid="capture-start" onClick={() => void vm.start()} disabled={!vm.consented} title={vm.consented ? "" : "Tick the consent box to start."}>
                Start session and share the ERP tab
              </Button>
              {!vm.consented && <p className="t-small text-muted">Tick the consent box to start.</p>}
            </div>
          )}

          {vm.started && (
            <div className="space-y-4 p-4">
              <header className="flex flex-wrap items-center gap-2">
                <span className="t-meta">1 Capture</span>
                <Dot word={voiceWord} ok={vm.voice.mode === "agent" && vm.voice.connected} />
                <Dot word={earWord} ok={vm.sttEngine === "scribe"} />
                <Dot word={eyeWord} ok={vm.pipeline.sharing} />
                {!vm.pipeline.sharing && mode !== "workspace" && (
                  <Button onClick={() => void vm.pipeline.start()}>Share screen</Button>
                )}
              </header>
              {vm.voice.lastError && <p className="banner banner-degraded">{vm.voice.lastError}</p>}
              <Presence state={presence.state} label={presence.label} sub={presence.sub} />
              {vm.holding && <p className="banner banner-degraded">Paused — the screen is not sent and speech is ignored</p>}
              {band && <p className="strike-band px-3 py-2 t-small">Struck from the record</p>}

              {vm.openWindow ? (
                <section className="panel border-amber p-4" data-testid="capture-question">
                  <span className="tag tag-amber">{KIND[vm.openWindow.kind] ?? vm.openWindow.kind}</span>
                  <p className="mt-2 t-h2">{vm.openWindow.question}</p>
                  <p className="mt-2 min-h-5 t-body text-green">
                    {vm.openWindow.answerText}
                    {vm.partial ? <span className="text-muted"> {vm.partial}</span> : null}
                  </p>
                  {vm.voice.mode === "fallback" && vm.openWindow.phase === "answering" && (
                    <form
                      className="mt-2 flex gap-2"
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (!draft.trim() && !vm.openWindow?.answerText) return;
                        vm.submitTypedAnswer(draft);
                        setDraft("");
                      }}
                    >
                      <input className="flex-1" data-testid="capture-answer-input" placeholder="Type the answer…" value={draft} onChange={(e) => setDraft(e.target.value)} />
                      <Button variant="primary" type="submit" data-testid="capture-answer-log">Log</Button>
                    </form>
                  )}
                  <p className="mt-2 t-small text-muted" data-testid="capture-window-phase">{vm.openWindow.phase === "asking" ? "asking…" : "mic open, recording the answer"}</p>
                </section>
              ) : (
                <p className="t-small text-muted">
                  {vm.queued.length ? `${vm.queued.length} question${vm.queued.length > 1 ? "s" : ""} waiting for a pause` : "Nothing to ask yet"}
                </p>
              )}
              {vm.reasonHeard && <p className="tag">Reason heard — not asking: “{vm.reasonHeard}”</p>}

              <section className="panel p-4">
                <p className="panel-title">Privacy ledger</p>
                <p className="mt-2 t-small">seen {vm.ledger.framesSeen} · kept {vm.ledger.framesKept} · redacted {vm.ledger.entitiesRedacted} · struck {Number(vm.ledger.secondsStruck).toFixed(0)} s</p>
                <button type="button" className="btn mt-2" onClick={() => setMasking((v) => !v)}>{masking ? "Shrink the preview" : "Enlarge to mask"}</button>
                {vm.pipeline.masks.length > 0 && <button type="button" className="btn mt-2 ml-2" onClick={vm.pipeline.clearMasks}>Clear masks</button>}
                <p className="mt-2 t-small text-muted">Kept by this app: the frames above, masked and blurred, plus the transcript. Kept by the voice provider: conversation transcript and audio per the account&apos;s retention settings, not changed by this app.</p>
              </section>

              <Drawer open={mech} onToggle={() => setMech((v) => !v)} title="Show the mechanism" testId="capture-mechanism-toggle">
                <Meter decision={vm.decision} questions={vm.questionsLast10Min} budget={vm.budget} />
                <section className="panel p-4">
                  <p className="panel-title">Candidate questions</p>
                  <ul className="mt-2 space-y-1 t-small">
                    {vm.queued.slice(0, 5).map((c) => (
                      <li key={c.id} className="flex gap-2">
                        <span className={`mono ${c.value >= 0.8 ? "text-amber" : "text-muted"}`}>{c.value.toFixed(2)}</span>
                        <span className="tag">{c.kind}</span>
                        <span className="flex-1 text-muted">{c.question}</span>
                      </li>
                    ))}
                    {vm.queued.length === 0 && <li className="text-muted">queue empty</li>}
                  </ul>
                  <p className="mt-2 t-small text-muted">asked {vm.askedCount} · guardrail asked: {vm.guardrailAsked ? "yes" : "not yet"} · to debrief {vm.toDebrief}</p>
                </section>
                <section className="panel p-4">
                  <p className="panel-title">Screen events</p>
                  <ul className="mt-2 divide-y divide-line t-small">
                    {vm.events.length === 0 && <li className="py-2 text-muted">Nothing yet. Open an invoice in the ERP.</li>}
                    {vm.events.map((e) => {
                      const cand = vm.candidateFor(e.id);
                      const latency = (e as { latencyMs?: number }).latencyMs;
                      return (
                        <li key={e.id} className={`flex items-center gap-2 py-1.5 ${e.redacted ? "strike-band text-muted" : ""}`}>
                          <span className="mono text-muted">{e.t.toFixed(1)}s</span>
                          <span className={`tag ${e.source === "vision" ? "tag-blue" : ""}`} title={e.alsoSeenBy ? "seen by the vision model, confirmed by the ERP" : e.source === "vision" ? "seen by the vision model" : "reported by the ERP"}>{e.source === "vision" ? (e.alsoSeenBy ? "seen ✓" : "seen") : "erp"}</span>
                          <span className="flex-1">{e.redacted ? "off the record" : describeEvent(e)}</span>
                          {latency != null && <span className="mono text-muted">{latency} ms</span>}
                          {cand && !e.redacted && <span className={`mono ${cand.value >= 0.8 ? "text-amber" : "text-muted"}`}>{cand.value.toFixed(2)}</span>}
                        </li>
                      );
                    })}
                  </ul>
                  <p className="mt-2 t-small text-muted">events: {vm.source} · frames sent {vm.pipeline.framesSent} · activity {vm.pipeline.activity}{vm.pipeline.visionLatency != null ? ` · vision ${vm.pipeline.visionLatency} ms` : ""}{vm.synced ? " · synced" : ""}</p>
                </section>
                <section className="panel p-4">
                  <p className="panel-title">Transcript</p>
                  <ul className="mt-2 space-y-1 t-small">
                    {vm.transcript.slice(-8).map((s) => (
                      <li key={s.id} className={s.redacted ? "strike-band text-muted" : s.speaker === "agent" ? "text-amber" : ""}>
                        <span className="mono text-muted">{s.t.toFixed(0)}s</span> {s.redacted ? "off the record" : s.text}
                      </li>
                    ))}
                  </ul>
                </section>
              </Drawer>
            </div>
          )}

          {vm.syncError && <p role="alert" className="banner banner-degraded">{vm.syncError}</p>}
          <Preview vm={vm} masking={masking} drawing={drawing} setDrawing={setDrawing} box={box} setBox={setBox} />
        </div>

        {vm.started && (
          <div className="side-controls">
            <div className="flex flex-wrap gap-2">
              <Button data-testid="capture-not-now" onClick={vm.notNow} disabled={!vm.openWindow}>Not now</Button>
              <Button variant="danger" data-testid="capture-strike" onClick={() => vm.strike()}>Scratch that</Button>
              <Button data-testid="capture-pause" pressed={vm.holding} aria-pressed={vm.holding} onClick={() => vm.setHolding(!vm.holding)}>
                {vm.holding ? "Paused — resume" : "Pause"}
              </Button>
            </div>
            <Button variant="primary" className="mt-2 w-full" data-testid="capture-done" onClick={() => void vm.endTask()}>Done · start the debrief</Button>
          </div>
        )}
      </div>
    </AppShell>
  );
}

function Preview({ vm, masking, drawing, setDrawing, box, setBox }: {
  vm: CaptureVM;
  masking: boolean;
  drawing: { x: number; y: number } | null;
  setDrawing: (v: { x: number; y: number } | null) => void;
  box: { x: number; y: number; w: number; h: number } | null;
  setBox: (v: { x: number; y: number; w: number; h: number } | null) => void;
}) {
  return (
    <div
      className={`see-stage ${masking ? "see-large" : ""}`}
      onMouseDown={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        setDrawing({ x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height });
      }}
      onMouseMove={(e) => {
        if (!drawing) return;
        const r = e.currentTarget.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width;
        const y = (e.clientY - r.top) / r.height;
        setBox({ x: Math.min(x, drawing.x), y: Math.min(y, drawing.y), w: Math.abs(x - drawing.x), h: Math.abs(y - drawing.y) });
      }}
      onMouseUp={() => {
        if (box && box.w > 0.01 && box.h > 0.01) vm.pipeline.addMask({ ...box, kind: "mask" });
        setDrawing(null);
        setBox(null);
      }}
      title="Drag to mask a sensitive region before it is transmitted"
    >
      <p className="t-meta">What I see</p>
      <video ref={vm.pipeline.videoRef} muted playsInline className="see-thumb" />
      {vm.pipeline.masks.map((m, i) => (
        <span key={i} className="mask-box" style={{ left: `${m.x * 100}%`, top: `${m.y * 100}%`, width: `${m.w * 100}%`, height: `${m.h * 100}%` }} />
      ))}
      {box && <span className="mask-box mask-draft" style={{ left: `${box.x * 100}%`, top: `${box.y * 100}%`, width: `${box.w * 100}%`, height: `${box.h * 100}%` }} />}
    </div>
  );
}

function Dot({ word, ok }: { word: string; ok: boolean }) {
  return <span className={`tag ${ok ? "tag-green" : "tag-amber"}`}>{word}</span>;
}
