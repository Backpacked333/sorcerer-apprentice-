"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { headlineCounts } from "@/lib/ui/mapview";
import { AppShell } from "@/components/ui/AppShell";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { Stat } from "@/components/ui/Stat";
import { usePresenter } from "@/components/ui/usePresenter";
import { WorkMapView } from "@/components/WorkMapView";
import type { MapVM } from "./map.vm";

function wordCount(t: string) {
  return t.trim().split(/\s+/).filter(Boolean).length;
}

export function MapView({ vm }: { vm: MapVM }) {
  const presenter = usePresenter();
  const [answer, setAnswer] = useState("");
  const [correction, setCorrection] = useState("");
  const [prevText, setPrevText] = useState("");
  const [tools, setTools] = useState(false);
  const [busy, setBusy] = useState(false);
  const locked = !!vm.pending || busy;
  const run = async (fn: () => Promise<void>) => {
    if (locked) return;
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => setAnswer(""), [vm.map?.revision]);
  useEffect(() => setCorrection(""), [vm.rounds]);

  if (!vm.map) {
    return (
      <AppShell step={2}>
        <main className="grid-bg mx-auto max-w-xl px-6 py-24 text-center">
          <p className="panel-title">2 · Map</p>
          <p className="mt-4 t-h2">{vm.compiling ? "Compiling the Work Map from events, transcript and answers…" : "Loading session…"}</p>
          {!vm.compiling && vm.note && <><p role="alert" className="mt-4">{vm.note}</p><Button className="mt-4" disabled={locked} onClick={() => void run(() => vm.recompile(true))}>Retry compilation</Button></>}
        </main>
      </AppShell>
    );
  }

  const map = vm.map;
  const progress = vm.progress;
  const name = map.expert.name;
  const sample = vm.sessionId.startsWith("demo_");

  return (
    <AppShell step={2} sessionId={vm.sessionId} confirmed={!!map.confirmedAt} presenter={presenter} status={<span className="mono t-small text-muted">{vm.note}</span>}>
      <main className="mx-auto max-w-6xl space-y-4 p-4">
        <header className="flex flex-wrap items-center gap-3">
          <div>
            <p className="t-meta">2 Map</p>
            <h1 className="t-h1">{name}&apos;s Work Map · {map.task}</h1>
          </div>
          {sample && <span className="tag">Sample</span>}
          <span className="tag">rev {map.revision}</span>
          <span className={`tag ${map.confirmedAt ? "tag-green" : "tag-amber"}`}>
            <span data-testid={map.confirmedAt ? "map-confirmed" : undefined}>{map.confirmedAt ? `Confirmed by ${name} · rev ${map.revision}` : "Draft — not confirmed"}</span>
          </span>
          {vm.knowledge && <span className="tag tag-green">Synced to tutor</span>}
          {map.confirmedAt && <Link className="btn btn-primary ml-auto" href={`/teach?from=${vm.sessionId}`}>3 · Teach →</Link>}
        </header>

        {progress && (
          <section className="panel p-4" data-testid="map-progress">
            <div className="flex items-center justify-between">
              <p className="panel-title">Gaps closed</p>
              <span className="t-small">{progress.closed} of {progress.total} answered by {name}</span>
            </div>
            <div className="mt-3 flex h-2 gap-1">
              {map.slots.map((s) => (
                <span key={s.id} className={`h-full flex-1 rounded ${s.status === "filled" ? "bg-green" : s.status === "skipped" ? "bg-line" : "bg-amber"}`} />
              ))}
              {map.slots.length === 0 && <span className="h-full flex-1 rounded bg-green" />}
            </div>
            <ul className="mt-3 space-y-1 t-small">
              <li>{progress.evidenceOk ? `Every judgment step has ${name}'s words` : `A judgment step is still missing ${name}'s words`}</li>
              <li>{progress.open === 0 ? "No open gaps" : `${progress.open} gap${progress.open > 1 ? "s" : ""} still open`}</li>
              <li>{map.confirmedAt ? `Teach-back confirmed by ${name}` : "Teach-back not yet confirmed"}</li>
            </ul>
            <p className={`mt-3 t-small ${progress.ready ? "text-green" : "text-muted"}`}>
              {progress.ready ? "Ready to teach, for this task's scope. The tutor loads this revision." : "Ready to teach means no open gaps, the expert's words on every decision, and an explicit yes on the teach-back."}
            </p>
            <p className="mt-2 t-small text-muted">{headlineCounts({ steps: map.steps, canonical: vm.canonical })}</p>
          </section>
        )}

        <section className={`panel p-4 ${vm.phase === "asking" ? "border-amber" : ""}`}>
          <div className="flex items-center justify-between">
            <p className="panel-title">Debrief</p>
            <span className={`tag ${vm.voice.connected ? "tag-green" : ""}`}>{vm.voice.status}</span>
          </div>
          {!vm.debriefOn && vm.phase === "idle" && (
            <Button variant="primary" className="mt-3 w-full" data-testid="map-start-debrief" onClick={() => void vm.startDebrief()}>
              Start the spoken debrief ({progress?.open ?? 0} open slot{(progress?.open ?? 0) === 1 ? "" : "s"})
            </Button>
          )}
          {vm.currentSlot && vm.phase === "asking" && (
            <div className="mt-3">
              <span className="tag tag-amber">{vm.currentSlot.kind}</span>
              <p className="mt-2 t-h2">{vm.currentSlot.question}</p>
              <p className="mt-2 min-h-5 t-body text-green">{vm.heard}</p>
              <form
                className="mt-2 flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  const text = answer.trim() || vm.heard.trim();
                  if (!text) return;
                  void vm.submitAnswer(text);
                }}
              >
                <input className="flex-1" data-testid="map-answer-input" placeholder={vm.voice.mode === "fallback" ? "Type the answer" : "or type it"} value={answer} onChange={(e) => setAnswer(e.target.value)} />
                <Button variant="primary" type="submit" data-testid="map-answer-log">Log</Button>
              </form>
              <p className="mt-2 t-small text-muted">{vm.sttEngine === "scribe" ? "Scribe v2 is listening" : vm.sttEngine === "webspeech" ? "browser STT is listening" : "no STT: type the answer"}</p>
            </div>
          )}
          <ul className="mt-3 space-y-1 t-small">
            {map.slots.map((s) => (
              <li key={s.id} className="flex items-start gap-2">
                <span className={`light mt-1 ${s.status === "filled" ? "light-on" : s.status === "skipped" ? "light-off" : "light-amber"}`} />
                <span className={s.status === "filled" ? "text-muted line-through" : ""}>{s.status === "skipped" ? `${s.question} — skipped` : s.question}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className={`panel p-4 ${vm.phase === "teachback" ? "border-amber" : ""}`}>
          <p className="panel-title">Teach-back</p>
          {vm.teachback ? (
            <div className="mt-2">
              <TeachbackText text={vm.teachback.text} previous={prevText} />
              <p className="mt-2 t-small text-muted">{wordCount(vm.teachback.text)} words · about {Math.round(wordCount(vm.teachback.text) / 2.4)} s · {vm.teachback.sure.length} confident · {vm.teachback.unsure.length} unsure · round {vm.rounds + 1}</p>
              {vm.lastPatch && vm.lastPatch.length > 0 && (
                <ul className="mt-2 space-y-1 t-small">
                  {vm.lastPatch.map((p) => (
                    <li key={p.ruleTitle}><span className="text-muted">{p.ruleTitle}:</span> {p.before} → {p.after}</li>
                  ))}
                </ul>
              )}
              {vm.phase === "teachback" && (
                <div className="mt-3 space-y-2">
                  <Button variant="primary" className="w-full" data-testid="map-confirm-yes" disabled={locked} onClick={() => void run(() => vm.confirm(true))}>Yes, that is how it works</Button>
                  <form
                    className="flex gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const c = correction.trim() || vm.heard.trim();
                      if (!c || locked) return;
                      setPrevText(vm.teachback?.text ?? "");
                      void run(() => vm.confirm(false, c));
                    }}
                  >
                    <input className="flex-1" data-testid="map-correct-input" placeholder="Correct one detail (say it or type it)" value={correction} onChange={(e) => setCorrection(e.target.value)} />
                    <Button type="submit" data-testid="map-correct-submit" disabled={locked}>Correct</Button>
                  </form>
                  {vm.heard && <p className="t-small text-green">heard: {vm.heard}</p>}
                </div>
              )}
              {vm.phase === "confirmed" && <p className="mt-2 t-small text-green">Confirmed · rev {map.revision}. Open the Teach page.</p>}
            </div>
          ) : (
            <Button className="mt-2" onClick={() => vm.startTeachback()} disabled={(progress?.open ?? 0) > 0 && vm.phase !== "idle"}>Generate teach-back now</Button>
          )}
        </section>

        <WorkMapView map={map} frames={vm.frames} sessionId={vm.sessionId} onChange={vm.onMapChange} editable={!map.confirmedAt} matrix={vm.matrix} />

        <section className="panel p-4">
          <p className="panel-title">Stretch · agent-ready guardrails</p>
          <p className="mt-2 t-small text-muted">The Work Map as instructions an agent can load. People keep the judgment calls.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <a className="btn" href={`/api/export?sessionId=${vm.sessionId}&format=policy`}>policy.json</a>
            <a className="btn" href={`/api/export?sessionId=${vm.sessionId}&format=prompt`}>agent prompt</a>
            <a className="btn" href={`/api/export?sessionId=${vm.sessionId}&format=sop`}>SOP markdown</a>
          </div>
          <Button variant="primary" className="mt-3 w-full" data-testid="map-autopilot-run" onClick={() => void vm.runAutopilot()} disabled={vm.autopilotRunning || !map.confirmedAt} title={map.confirmedAt ? "" : "confirm the map first"}>
            {vm.autopilotRunning ? "running…" : "Prove it: load policy.json and run the routine queue"}
          </Button>
          {vm.autopilot && (
            <ul className="mt-3 space-y-1 t-small">
              {vm.autopilot.map((s) => (
                <li key={s.invoice} className="flex items-start gap-2">
                  <span className={`tag ${s.outcome === "halted" ? "tag-red" : s.outcome === "flagged" ? "tag-blue" : "tag-green"}`}>{s.outcome}</span>
                  <span className="mono text-muted">INV-{s.invoice}</span>
                  <span className="flex-1">
                    {s.supplier}, €{Math.abs(s.amount).toLocaleString("en-IE")}: {s.reason}
                    {s.quote && <span className="block text-muted">“{s.quote}”</span>}
                  </span>
                </li>
              ))}
              {!vm.autopilotRunning && vm.autopilot.length > 0 && vm.autopilot[vm.autopilot.length - 1].outcome === "halted" && (
                <li className="text-amber">Stopped where {name} would. The rest of the queue waits for a person.</li>
              )}
            </ul>
          )}
        </section>

        {presenter && (
          <Drawer open={tools} onToggle={() => setTools((v) => !v)} title="Show the mechanism">
            <Button onClick={() => void vm.recompile(true)} disabled={vm.compiling}>{vm.compiling ? "compiling…" : "Recompile"}</Button>
            {vm.metrics && (
              <div className="grid grid-cols-2 gap-2">
                <Stat label="live questions" value={vm.metrics.liveQuestions} />
                <Stat label="per 10 min" value={vm.metrics.questionsPer10Min} />
                <Stat label="interrupted typing" value={vm.metrics.interruptionsWhileTyping} />
                <Stat label="pause to first word" value={vm.metrics.medianPauseToFirstWordSecs === null ? "–" : `${vm.metrics.medianPauseToFirstWordSecs}s`} />
                <Stat label="filled live / narration" value={`${vm.metrics.slotsFilledLive} / ${vm.metrics.slotsFilledNarration}`} />
                <Stat label="filled in debrief" value={vm.metrics.slotsFilledDebrief} />
                <Stat label="frames seen / kept" value={`${vm.metrics.framesSeen} / ${vm.metrics.framesKept}`} />
                <Stat label="redacted / struck" value={`${vm.metrics.entitiesRedacted} / ${vm.metrics.secondsStruck}s`} />
              </div>
            )}
          </Drawer>
        )}
      </main>
    </AppShell>
  );
}

function TeachbackText({ text, previous }: { text: string; previous: string }) {
  if (!previous) return <p className="t-body">{text}</p>;
  const split = (s: string) => s.split(/(?<=[.?!])\s+/).map((x) => x.trim()).filter(Boolean);
  const before = new Set(split(previous));
  return (
    <p className="t-body">
      {split(text).map((s, i) => (
        <span key={i} className={before.has(s) ? "" : "rounded bg-amber/20"}>
          {s}{" "}
        </span>
      ))}
    </p>
  );
}
