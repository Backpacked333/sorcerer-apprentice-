"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { describeEvent } from "@/lib/events";
import { tutorLine, visibleRules } from "@/lib/ui/teachview";
import { frameSrc } from "@/lib/ui/mapview";
import { AppShell } from "@/components/ui/AppShell";
import { BrowserCheck } from "@/components/ui/BrowserCheck";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { FrameThumb } from "@/components/ui/FrameThumb";
import { OpenErpButton } from "@/components/ui/OpenErpButton";
import { PersonaCard } from "@/components/ui/PersonaCard";
import { Presence } from "@/components/ui/Presence";
import { QuoteCard } from "@/components/ui/QuoteCard";
import { useLayoutMode } from "@/components/ui/useLayoutMode";
import { usePresenter } from "@/components/ui/usePresenter";
import { Workspace } from "@/components/ui/Workspace";
import type { TeachVM } from "./teach.vm";

export function TeachView({ vm }: { vm: TeachVM }) {
  const presenter = usePresenter();
  const canCrop = typeof vm.pipeline.setCropTarget === "function";
  const mode = useLayoutMode({ canCrop, source: vm.source, started: vm.started });
  const [reloadKey, setReloadKey] = useState("idle");
  useEffect(() => {
    if (!vm.started) return;
    const id = window.setTimeout(() => setReloadKey("live"), 1500);
    return () => window.clearTimeout(id);
  }, [vm.started]);

  const column = <Column vm={vm} presenter={presenter} mode={mode} />;
  if (mode === "workspace") {
    return (
      <Workspace erpSrc="/erp?queue=newhire" locked={!vm.started} lockedHint="Start the session to begin" reloadKey={reloadKey} onFrameElement={vm.pipeline.setCropTarget} presenter={presenter}>
        {column}
      </Workspace>
    );
  }
  return (
    <div className="companion-only">
      <p className="t-small text-muted">Open the ERP in its own window.</p>
      <div className="mb-3"><OpenErpButton queue="newhire">Open the ERP window</OpenErpButton></div>
      {column}
    </div>
  );
}

function Column({ vm, presenter, mode }: { vm: TeachVM; presenter: boolean; mode: "workspace" | "companion" }) {
  const [mech, setMech] = useState(false);
  useEffect(() => { if (presenter) setMech(true); }, [presenter]);
  const learner = vm.log?.expertName || "New hire";
  const expert = vm.map?.expert.name ?? "the expert";
  const latest = vm.decisions[vm.decisions.length - 1];
  const earlier = vm.decisions.slice(0, -1);
  const line = latest ? tutorLine(latest) : null;
  const rules = visibleRules(vm.card, presenter);
  const word = vm.tutorState === "listening" ? "Listening" : vm.voice.isSpeaking || vm.tutorState === "speaking" ? "Speaking" : "Watching";
  const presenceState = word === "Listening" ? "listening" : word === "Speaking" ? "asking" : "quiet";

  if (!vm.log || !vm.map) {
    return (
      <AppShell step={3} fill={mode === "workspace"}>
        <p className="p-8 t-body text-muted">{vm.log && !vm.map ? "This teach session has no source map. Compile and confirm a Work Map first." : "Loading…"}</p>
      </AppShell>
    );
  }

  return (
    <AppShell step={3} fill={mode === "workspace"} sessionId={vm.map.sessionId} confirmed={!!vm.map.confirmedAt} presenter={presenter}>
      <div className="side-col">
        <div className="side-scroll space-y-4 p-4">
          <div>
          {!vm.started && (
            <div className="space-y-4">
              <BrowserCheck />
              <PersonaCard role="newhire" name={learner} expert={expert} />
              <p className="t-body">Loaded {vm.map.rules.length} rules from {expert}&apos;s confirmed Work Map{vm.map.confirmedAt ? `, rev ${vm.map.revision}` : ""}.</p>
              {presenter && (
                <ul className="space-y-1 t-small text-muted">
                  {vm.map.rules.map((r) => <li key={r.id}>{r.title}</li>)}
                </ul>
              )}
              <ul className="space-y-1 t-small">
                <li>Headphones on.</li>
                <li>{mode === "workspace" ? "In the share dialog, choose This tab." : "In the share dialog, pick the tab named MB-ERP."}</li>
              </ul>
              {!vm.map.confirmedAt && (
                <p className="t-small text-amber">Only a confirmed map teaches. <Link className="underline" href={`/map/${vm.map.sessionId}`}>Open the map</Link></p>
              )}
              <Button variant="primary" className="w-full" data-testid="teach-begin" disabled={!vm.map.confirmedAt} onClick={() => void vm.start()}>Start and share the ERP tab</Button>
            </div>
          )}

          {vm.started && (
            <div className="space-y-4">
              <header className="flex flex-wrap items-center gap-2">
                <span className="t-meta">3 Teach</span>
                <h1 className="t-h2">{learner} learning from {expert}</h1>
                <span className={`tag ${vm.phase === "independent" ? "tag-blue" : "tag-amber"}`}>{vm.phase === "independent" ? "On your own — the tutor stays quiet" : "Coached"}</span>
                <span className={`tag ${vm.voice.connected ? "tag-green" : "tag-amber"}`}>{vm.voice.mode === "agent" ? "ElevenAgents" : "Browser voice (fallback)"}</span>
              </header>
              <Presence state={presenceState} label={word} sub={vm.currentInvoice ? `Invoice ${vm.currentInvoice}` : "Watching. Open the first invoice in your queue."} />

              <section className="panel p-4">
                <p className="panel-title" data-testid="teach-tutor">Tutor</p>
                {!line && <p className="mt-2 t-body text-muted">Watching. Open the first invoice in your queue.</p>}
                {line && (
                  <div className="mt-2">
                    <p className="t-meta">{line.word}</p>
                    <p className="t-h2">{line.message}</p>
                    {line.quote && <QuoteCard text={line.quote} speaker={expert} source="live answer" />}
                  </div>
                )}
                {earlier.length > 0 && (
                  <details className="mt-3">
                    <summary className="t-small">Earlier</summary>
                    <ul className="mt-2 space-y-2 t-small">
                      {earlier.map((d, i) => (
                        <li key={i}>{d.message}</li>
                      ))}
                    </ul>
                  </details>
                )}
              </section>

              {vm.replay && (
                <section className="panel replay-in border-amber p-4">
                  <p className="panel-title" data-testid="teach-replay">Replay · {expert}&apos;s screen{vm.replay.step ? `, ${vm.replay.step.screenMoment.t.toFixed(0)} s into their session` : ""} — captured still</p>
                  <FrameThumb src={frameSrc(vm.replay.frame)} width={vm.replay.frame?.width} height={vm.replay.frame?.height} t={vm.replay.step?.screenMoment.t} region={vm.replay.step?.screenMoment.region} blurred={vm.replay.frame?.piiRegionsBlurred} size="lg" />
                  {vm.replay.step && (
                    <p className="mt-2 t-body">What {expert} did: {vm.replay.step.title}. {vm.replay.step.decision}
                      {"field" in vm.replay.step.action && <span className="tag ml-2">{vm.replay.step.action.field}: {vm.replay.step.action.from || "empty"} → {vm.replay.step.action.to}</span>}
                    </p>
                  )}
                  {vm.replay.quote && <p className="mt-2 text-[22px] leading-[30px]">“{vm.replay.quote}” <span className="block t-small text-muted">{expert}, in their own words</span></p>}
                  {vm.replay.audioUrl ? <audio className="mt-2 w-full" controls autoPlay src={vm.replay.audioUrl} /> : <p className="mt-2 t-small text-muted">No recording of this moment — the tutor reads the quote</p>}
                  <div className="mt-3 flex items-center justify-between">
                    <p className="t-body text-amber">Fix it when you are ready.</p>
                    <Button onClick={vm.closeReplay}>Close</Button>
                  </div>
                </section>
              )}

              <section className="panel p-4">
                <p className="panel-title">Rules from {expert}&apos;s map: {vm.card.length}</p>
                <ul className="mt-2 space-y-1 t-small">
                  {rules.shown.map((c) => (
                    <li key={c.ruleId} className="flex items-center gap-2">
                      <span className={`light ${c.status === "mastered" ? "light-on" : c.status === "practicing" ? "light-amber" : c.status === "needs_practice" ? "light-red" : "light-off"}`} />
                      <span className="flex-1">{c.title}</span>
                      <span className="text-muted">{c.label}</span>
                    </li>
                  ))}
                </ul>
                {rules.hidden > 0 && <p className="mt-2 t-small text-muted">{rules.hidden} not yet encountered</p>}
              </section>

              {vm.ended && (
                <section className="panel p-4" data-testid="teach-outcome">
                  <p className="panel-title">Mastery card</p>
                  <h2 className="mt-2 t-h2">What {learner} can do alone</h2>
                  <ul className="mt-3 space-y-2 t-body">
                    {vm.card.map((c) => (
                      <li key={c.ruleId} className="flex flex-wrap items-center gap-2">
                        <span className={`tag ${c.status === "mastered" ? "tag-green" : c.status === "practicing" ? "tag-amber" : c.status === "needs_practice" ? "tag-red" : ""}`}>{c.label}</span>
                        <span className="flex-1">{c.title}</span>
                        {c.independent && <span className={`tag ${c.independent === "correct without help" ? "tag-green" : "tag-red"}`}>independent: {c.independent}</span>}
                        <span className="t-small text-muted">{c.detail}</span>
                        {vm.practice && <Button onClick={() => vm.practice?.(c.ruleId)}>Practice this</Button>}
                      </li>
                    ))}
                    {vm.flaggedCount > 0 && <li>{vm.flaggedCount} case{vm.flaggedCount > 1 ? "s" : ""} sent to {expert}&apos;s map as open questions</li>}
                  </ul>
                  {(vm.missed.length > 0 || vm.card.some((c) => c.status === "untested")) && (
                    <div className="mt-4">
                      <p className="panel-title">Practice next</p>
                      <ul className="mt-2 space-y-1 t-small text-muted">
                        {vm.missed.map((c) => <li key={c.ruleId}>{c.title}: another case of this kind, with {expert}&apos;s words at hand</li>)}
                        {vm.card.filter((c) => c.status === "untested").map((c) => <li key={c.ruleId}>{c.title}: not exercised today</li>)}
                      </ul>
                    </div>
                  )}
                </section>
              )}

              <Drawer open={mech} onToggle={() => setMech((v) => !v)} title="Show the mechanism">
                <p className="t-small text-muted">invoice {vm.currentInvoice ?? "–"} · activity {vm.pipeline.activity}{vm.pipeline.visionLatency != null ? ` · vision ${vm.pipeline.visionLatency} ms` : ""} · events: {vm.source}</p>
                <ul className="space-y-1 t-small text-muted">
                  {vm.events.map((e) => (
                    <li key={e.id}><span className="mono">{e.t.toFixed(0)}s</span> {describeEvent(e)}</li>
                  ))}
                </ul>
                {!vm.pipeline.sharing && mode !== "workspace" && <Button onClick={() => void vm.pipeline.start()}>Share screen</Button>}
              </Drawer>
            </div>
          )}
          </div>
          {vm.syncError && <p role="alert" className="banner banner-degraded">{vm.syncError}</p>}
          <video ref={vm.pipeline.videoRef} muted playsInline className="see-thumb" />
        </div>
        {vm.started && (
          <div className="side-controls">
            {!vm.ended ? (
              <Button variant="primary" className="w-full" data-testid="teach-end" onClick={() => void vm.endSession()}>End session · show the mastery card</Button>
            ) : (
              <Link className="btn w-full text-center" href={`/map/${vm.map.sessionId}`}>Back to the map</Link>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
