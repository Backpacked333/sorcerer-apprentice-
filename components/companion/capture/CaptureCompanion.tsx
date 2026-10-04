"use client";
// The capture companion card: onboarding (pre-start), capsule (ambient), ask (question window + understood).
// Presentational: every value comes from the vm; moods come from lib/ui/capture-copy → captureMood.
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import {
  AnswerBubble,
  CompanionCard,
  CompanionHeader,
  Eyebrow,
  GlassButton,
  HealthChips,
  LearnedChip,
  Orb,
  Pill,
  SessionClock,
  StruckBand,
  UnderstoodCard,
} from "@/components/glass";
import { BrowserCheck } from "@/components/ui/BrowserCheck";
import type { CaptureVM } from "@/components/views/capture.vm";
import {
  askStatus,
  askSub,
  budgetText,
  captureApp,
  eyebrowFor,
  healthItems,
  rolePart,
  visionOnlyNote,
  type CardState,
} from "@/lib/ui/capture-copy";
import { ripplesOnEnter, type OrbMood } from "@/lib/ui/moods";

const META: CSSProperties = { fontSize: 11, fontWeight: 600, color: "#8e8e93" };
const MUTED: CSSProperties = { fontSize: 11.5, color: "#aeaeb2" };
const NOTE: CSSProperties = { fontSize: 12.5, lineHeight: 1.45, color: "#6e6e73" };

function useRipple(mood: OrbMood): number {
  const prev = useRef<OrbMood | null>(null);
  const [key, setKey] = useState(0);
  useEffect(() => {
    if (prev.current !== null && prev.current !== mood && ripplesOnEnter(prev.current, mood)) setKey((k) => k + 1);
    prev.current = mood;
  }, [mood]);
  return key;
}

export function CaptureCompanion(p: {
  vm: CaptureVM;
  card: CardState;
  layout: "workspace" | "companion";
  mechOpen: boolean;
  onToggleMech(): void;
}) {
  const { vm, card, layout } = p;
  const floating = layout === "workspace";
  const ripple = useRipple(card.mood);
  const cardMode = layout === "companion" ? "panel" : card.mode === "capsule" ? "capsule" : "ask";

  if (card.mode === "prestart") {
    return (
      <CompanionCard
        mood="quiet"
        mode={layout === "companion" ? "panel" : "ask"}
        floating={floating}
        label="Start a capture session"
        testId="capture-card"
        header={<CompanionHeader mood="quiet" title={card.title} sub={card.sub} />}
        footer={<PrestartFooter vm={vm} layout={layout} />}
      >
        <PrestartBody vm={vm} layout={layout} />
      </CompanionCard>
    );
  }

  const ask = card.mode === "ask";
  return (
    <CompanionCard
      mood={card.mood}
      mode={cardMode}
      floating={floating}
      label="Tacit, the apprentice"
      testId="capture-card"
      header={ask ? <AskHeader vm={vm} card={card} ripple={ripple} /> : <CompanionHeader mood={card.mood} title={card.title} sub={card.sub} startedAt={vm.startedAt ?? null} frozen={vm.holding} rippleKey={ripple} />}
      footer={<RunningFooter vm={vm} card={card} mechOpen={p.mechOpen} onToggleMech={p.onToggleMech} />}
    >
      {ask ? <AskBody vm={vm} card={card} /> : <CapsuleBody vm={vm} card={card} />}
    </CompanionCard>
  );
}

// ---------------------------------------------------------------- pre-start

function PrestartBody({ vm, layout }: { vm: CaptureVM; layout: "workspace" | "companion" }) {
  const app = vm.app ?? captureApp("erp");
  const note = visionOnlyNote({ app, visionKey: vm.visionKey, sharing: false, started: false });
  const label: CSSProperties = { display: "flex", flexDirection: "column", gap: 4, fontSize: 12.5, color: "#6e6e73" };
  return (
    <>
      <BrowserCheck />
      {app.badge && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <Pill tone="blue" dot>{app.badge}</Pill>
          {note && <p style={NOTE}>{note}</p>}
        </div>
      )}
      <section>
        <Eyebrow text="Your part" mood="asking" />
        <p style={{ marginTop: 4, fontSize: 13.5, lineHeight: 1.5, color: "#3a3a3c" }}>{rolePart(app, vm.expertName)}</p>
      </section>
      <ul style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 12.5, lineHeight: 1.4, color: "#3a3a3c", paddingLeft: 16, listStyle: "disc" }}>
        <li>Browser: desktop Chrome or Edge, with screen share.</li>
        <li>Headphones on. The apprentice must not hear itself.</li>
        <li>{layout === "workspace" ? "In the share dialog, choose This tab." : app.shareHint}</li>
        {app.telemetry && <li>Close other ERP tabs. They post into the same session.</li>}
      </ul>
      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 8 }}>
        <label style={label}>
          <span>Your name</span>
          <input className="input" placeholder="Your name" value={vm.expertName} onChange={(e) => vm.setExpertName(e.target.value)} />
        </label>
        <label style={label}>
          <span>Task</span>
          <input className="input" value={vm.task} onChange={(e) => vm.setTask(e.target.value)} />
        </label>
      </div>
      <section style={{ padding: "12px 13px", borderRadius: 16, background: "rgba(255,255,255,.55)", boxShadow: "inset 0 0 0 .5px rgba(0,0,0,.07)" }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: "#1d1d1f" }}>What is captured, and what is kept</p>
        <p style={{ ...NOTE, marginTop: 4 }}>Your microphone, for the transcript and the agent. The screen surface you choose, as a still every one to two seconds, sent to a vision model and turned into events. Only the handful of frames tied to a decision are stored, after you can mask regions and after personal data is blurred. &quot;Scratch that&quot; removes the current exchange and its frames. The voice provider keeps conversation transcripts and audio per the account&apos;s retention settings; this app does not change those.</p>
        <label style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, color: "#1d1d1f", cursor: "pointer" }}>
          <input type="checkbox" data-testid="capture-consent" checked={vm.consented} onChange={(e) => vm.setConsented(e.target.checked)} style={{ width: 16, height: 16, accentColor: "#f5a623" }} /> I understand; start the session
        </label>
      </section>
      {vm.startError && <p role="alert" style={{ ...NOTE, color: "#8a5200", background: "rgba(245,166,35,.14)", padding: "8px 10px", borderRadius: 12 }}>{vm.startError}</p>}
    </>
  );
}

function PrestartFooter({ vm, layout }: { vm: CaptureVM; layout: "workspace" | "companion" }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <GlassButton
        variant="amber"
        size={44}
        data-testid="capture-start"
        style={{ width: "100%" }}
        disabled={!vm.consented || !!vm.starting}
        loading={!!vm.starting}
        title={vm.consented ? "" : "Tick the consent box to start."}
        // synchronous call inside the click: the share prompt needs the user activation
        onClick={() => void vm.start({ mode: layout === "workspace" ? "workspace" : "tab" })}
      >
        Start session and share the ERP tab
      </GlassButton>
      {!vm.consented && <p style={{ ...NOTE, fontSize: 12, textAlign: "center" }}>Tick the consent box to start.</p>}
    </div>
  );
}

// ---------------------------------------------------------------- running

function Chips({ vm }: { vm: CaptureVM }) {
  const app = vm.app ?? captureApp("erp");
  const items = healthItems({
    started: vm.started,
    app,
    voice: vm.voice,
    sttEngine: vm.sttEngine,
    sharing: vm.pipeline.sharing,
    visionError: vm.pipeline.visionError,
    degraded: vm.pipeline.degraded,
    dropped: vm.pipeline.dropped,
    queued: vm.queued.length,
  });
  return <HealthChips items={items} />;
}

function Notices({ vm }: { vm: CaptureVM }) {
  const app = vm.app ?? captureApp("erp");
  const note = visionOnlyNote({ app, visionKey: vm.visionKey, sharing: vm.pipeline.sharing, started: vm.started });
  const out: ReactNode[] = [];
  if (app.badge) out.push(<Pill key="badge" tone="blue" dot title="The claims workbench posts no ERP telemetry; only frames the vision model reads become events.">{app.badge}</Pill>);
  if (note) out.push(<p key="note" style={NOTE}>{note}</p>);
  if (vm.pipeline.degraded === "wrong_surface")
    out.push(
      <p key="surface" style={{ ...NOTE, color: "#8a5200" }}>
        The shared surface is not this tab, so no vision frames are sent{app.telemetry ? "; ERP telemetry continues" : ""}.
      </p>,
    );
  if (vm.voice.lastError) out.push(<p key="voice" style={{ ...NOTE, color: "#8a5200" }}>{vm.voice.lastError}</p>);
  return out.length ? <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-start" }}>{out}</div> : null;
}

function CapsuleBody({ vm, card }: { vm: CaptureVM; card: CardState }) {
  const understood = (vm.understood ?? []).slice(-3);
  const heard = (vm.reasonHeard ?? []).slice(-2);
  const empty = understood.length === 0 && heard.length === 0;
  return (
    <>
      <Chips vm={vm} />
      <Notices vm={vm} />
      {vm.holding && <p role="status" style={{ ...NOTE, color: "#3a3a3c", fontWeight: 500 }}>Paused — the screen is not sent and speech is ignored</p>}
      <div style={{ position: "relative", display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, minHeight: 24, padding: "0 2px", borderRadius: 12 }}>
        <span style={META}>Understood</span>
        {understood.map((u) => <LearnedChip key={u.windowId} kind={u.kind} text={u.text} />)}
        {heard.map((h) => <LearnedChip key={`h${h.t}`} kind="heard" text={h.about ? `heard · ${h.about}` : "heard"} />)}
        {empty && <span style={MUTED}>Nothing new yet</span>}
        <span style={{ ...MUTED, fontSize: 10.5, marginLeft: "auto" }}>{budgetText(vm.questionsLast10Min, vm.budget)}</span>
        <StruckBand active={card.struck} />
      </div>
    </>
  );
}

function AskHeader({ vm, card, ripple }: { vm: CaptureVM; card: CardState; ripple: number }) {
  const w = vm.openWindow;
  const last = (vm.understood ?? []).at(-1);
  const eyebrow = w ? eyebrowFor(w.kind, w.about) : last?.eyebrow ?? "Understood";
  const sub = w ? askSub(w.pauseSecs, w.evidence) : "";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "1px 2px", minWidth: 0 }}>
      <Orb mood={card.mood} size={38} rippleKey={ripple} />
      <div style={{ flex: 1, minWidth: 0, minHeight: 38, display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <div key={`e|${eyebrow}`} style={{ animation: "tc-rise .55s var(--ease-rise, cubic-bezier(.2,.9,.3,1)) both" }}>
          <Eyebrow text={eyebrow} mood={card.mood} />
        </div>
        {sub && <div style={{ fontSize: 12, color: "#8e8e93", marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{sub}</div>}
      </div>
      <SessionClock startedAt={vm.startedAt ?? null} frozen={vm.holding} />
    </div>
  );
}

function AskBody({ vm, card }: { vm: CaptureVM; card: CardState }) {
  const [draft, setDraft] = useState("");
  const w = vm.openWindow;
  const last = (vm.understood ?? []).at(-1);
  const question = w?.question ?? last?.question ?? "";
  const answering = w?.phase === "answering";
  const answer = w ? w.answerText ?? "" : last?.answerText ?? "";
  const listening = answering && !vm.holding;
  const showBubble = answering || !!answer || (card.understoodLinger && !!last?.answerText);
  const highlight = card.understoodLinger && last && !last.isQuote && last.text && answer.includes(last.text) ? last.text : undefined;
  return (
    <>
      <p key={question} style={{ fontSize: 18, fontWeight: 600, lineHeight: 1.32, letterSpacing: "-.01em", color: "#1d1d1f", minHeight: 46, animation: "tc-rise .6s var(--ease-rise, cubic-bezier(.2,.9,.3,1)) .1s both", overflowWrap: "anywhere" }}>
        {question}
      </p>
      {showBubble && <AnswerBubble text={answer} partial={answering ? vm.partial : undefined} listening={listening} highlight={highlight} struck={card.struck} />}
      {card.understoodLinger && last && <UnderstoodCard key={last.windowId} kind={last.kind} text={last.text} isQuote={last.isQuote} meta="→ Work Map" />}
      {w && vm.voice.mode === "fallback" && answering && (
        <form
          style={{ display: "flex", gap: 6 }}
          onSubmit={(e) => {
            e.preventDefault();
            if (!draft.trim() && !w.answerText) return;
            vm.submitTypedAnswer(draft);
            setDraft("");
          }}
        >
          <input className="input" style={{ flex: 1, minWidth: 0, minHeight: 36, fontSize: 14, padding: "6px 12px" }} data-testid="capture-answer-input" placeholder="Type the answer…" value={draft} onChange={(e) => setDraft(e.target.value)} />
          <GlassButton variant="green" size={34} type="submit" data-testid="capture-answer-log">Log</GlassButton>
        </form>
      )}
    </>
  );
}

function RunningFooter({ vm, card, mechOpen, onToggleMech }: { vm: CaptureVM; card: CardState; mechOpen: boolean; onToggleMech(): void }) {
  const ask = card.mode === "ask";
  const w = vm.openWindow;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {ask && (
        <p data-testid="capture-window-phase" style={{ fontSize: 12, color: "#6e6e73", padding: "0 2px" }}>
          {w ? (w.phase === "asking" ? "asking…" : "mic open, recording the answer") : askStatus(null, card.understoodLinger)}
        </p>
      )}
      <div style={{ display: "flex", gap: 6 }}>
        {ask ? (
          <GlassButton size={34} style={{ flex: 1 }} data-testid="capture-not-now" onClick={vm.notNow} disabled={!w}>Not now</GlassButton>
        ) : (
          <GlassButton size={34} style={{ flex: 1 }} data-testid="capture-pause" pressed={vm.holding} onClick={() => vm.setHolding(!vm.holding)}>
            {vm.holding ? "Resume" : "Pause"}
          </GlassButton>
        )}
        <GlassButton variant="danger" size={34} style={{ flex: 1.25 }} data-testid="capture-strike" onClick={() => vm.strike()}>Scratch that</GlassButton>
      </div>
      <GlassButton variant="amber" size={40} style={{ width: "100%" }} data-testid="capture-done" disabled={!!vm.ending} loading={!!vm.ending} onClick={() => void vm.endTask()}>
        Done · start the debrief
      </GlassButton>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 2px" }}>
        <button
          type="button"
          data-testid="capture-mechanism-toggle"
          aria-expanded={mechOpen}
          onClick={onToggleMech}
          style={{ fontSize: 12, fontWeight: 500, color: "#3a3a3c", background: "transparent", border: 0, padding: "4px 0", cursor: "pointer", textDecoration: "underline", textDecorationColor: "rgba(0,0,0,.2)", textUnderlineOffset: 3 }}
        >
          {mechOpen ? "Hide the mechanism" : "Show the mechanism"}
        </button>
        <span style={{ ...MUTED, marginLeft: "auto", fontVariantNumeric: "tabular-nums" }}>
          seen {vm.ledger.framesSeen} · kept {vm.ledger.framesKept} · struck {Number(vm.ledger.secondsStruck).toFixed(0)} s
        </span>
      </div>
    </div>
  );
}
