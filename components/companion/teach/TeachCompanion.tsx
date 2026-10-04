"use client";
// The floating teach companion (design §6.1 capsule / §6.4 tutor). Every line comes from the vm:
// real invoice state, the matcher's own messages, the expert's verbatim quote, the T3 labels.
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { CompanionCard, Eyebrow, GlassButton, LearnedChip, Orb, Pill, SessionClock, type CompanionMode } from "@/components/glass";
import { BrowserCheck } from "@/components/ui/BrowserCheck";
import { Drawer } from "@/components/ui/Drawer";
import { PersonaCard } from "@/components/ui/PersonaCard";
import { describeEvent, labelField } from "@/lib/events";
import { teachMood, PRAISE_MS, type OrbMood } from "@/lib/ui/moods";
import { decisionContext, learnedChips, phaseLabel, teachKindOf, teachSub, tutorLine, watchingLine } from "@/lib/ui/teachview";
import type { TeachVM } from "@/components/views/teach.vm";
import { ReplayRow } from "./ReplayRow";

export interface TeachCardState {
  mood: OrbMood;
  /** True while the latest decision belongs to the invoice on screen. */
  active: boolean;
}

/** Card mood + whether the latest decision is still the live one. Shared with the over-ERP overlay. */
export function useTeachCardState(vm: TeachVM): TeachCardState {
  const latest = vm.decisions[vm.decisions.length - 1];
  const onScreen = vm.currentState?.invoice;
  const active = !!latest && !vm.ended && (!onScreen || !latest.invoice || latest.invoice === onScreen);
  const count = vm.decisions.length;
  const [fresh, setFresh] = useState(false);
  useEffect(() => {
    if (count === 0) return;
    setFresh(true);
    const id = window.setTimeout(() => setFresh(false), PRAISE_MS);
    return () => window.clearTimeout(id);
  }, [count]);
  const mood = teachMood({
    latestKind: active ? teachKindOf(latest) : "none",
    latestAgoMs: fresh ? 0 : PRAISE_MS + 1,
    isSpeaking: vm.voice.isSpeaking,
    ended: vm.ended,
  });
  return { mood, active };
}

const small = { fontSize: 12, color: "#6e6e73", margin: 0 } as const;

/**
 * The replay belongs to the moment it was opened for. Once the new hire moves to another invoice, or a newer
 * tutor decision arrives (e.g. the praise after the fix, which already quotes the expert), it folds away so the
 * card stays short and off the ERP. "Show the moment again" brings it back. View-only: vm.replay is untouched.
 */
function useReplayVisible(vm: TeachVM): { visible: boolean; restore: () => void } {
  const onScreen = vm.currentState?.invoice ?? vm.currentInvoice ?? null;
  const count = vm.decisions.length;
  const [mark, setMark] = useState<{ r: TeachVM["replay"]; n: number; inv: string | null }>({ r: vm.replay, n: count, inv: onScreen });
  if (mark.r !== vm.replay) setMark({ r: vm.replay, n: count, inv: onScreen });
  const sameInvoice = !mark.inv || !onScreen || mark.inv === onScreen;
  const visible = !!vm.replay && !vm.ended && sameInvoice && count <= mark.n;
  return { visible, restore: () => setMark({ r: vm.replay, n: count, inv: onScreen }) };
}

export function TeachCompanion({ vm, presenter, panel, workspace, state }: { vm: TeachVM; presenter: boolean; panel: boolean; workspace: boolean; state: TeachCardState }) {
  const [mech, setMech] = useState(false);
  const replay = useReplayVisible(vm);
  const [endError, setEndError] = useState<string | null>(null);
  useEffect(() => {
    if (presenter) setMech(true);
  }, [presenter]);

  const learner = vm.learnerName || vm.log?.expertName || "New hire";
  const expert = vm.expertName ?? vm.map?.expert.name ?? "the expert";
  const { mood, active } = state;
  const latest = vm.decisions[vm.decisions.length - 1];
  const shown = active ? latest : undefined;
  const earlier = shown ? vm.decisions.slice(0, -1) : vm.decisions;
  const line = shown ? tutorLine(shown) : null;
  const kind = teachKindOf(shown);

  const mode: CompanionMode = panel ? "panel" : !vm.started ? "teach" : vm.ended ? "capsule" : shown || replay.visible ? "teach" : "capsule";

  // ---------- loading / no source map ----------
  if (!vm.log || !vm.map) {
    const noMap = !!vm.log && !vm.map;
    return (
      <CompanionCard mood="quiet" mode={panel ? "panel" : "capsule"} floating={workspace} label="Tutor" header={<Head mood="quiet" title={noMap ? "No source map" : "Loading…"} sub={noMap ? "Compile and confirm a Work Map first." : undefined} />}>
        {noMap ? (
          <p style={{ fontSize: 13.5, color: "#3a3a3c", margin: 0 }}>
            This teach session has no source map. Compile and confirm a Work Map first.{" "}
            <Link className="underline" href="/teach">Pick a confirmed map</Link>
          </p>
        ) : null}
      </CompanionCard>
    );
  }

  const map = vm.map;
  const chips = learnedChips(vm.card);

  // ---------- pre-start ----------
  if (!vm.started) {
    return (
      <CompanionCard
        mood="quiet"
        mode={mode}
        floating={workspace}
        label="Tutor"
        header={<Head mood="quiet" title={`${learner}, learning from ${expert}`} sub={map.confirmedAt ? `${expert}'s confirmed Work Map · rev ${map.revision}` : `${expert}'s Work Map · not confirmed`} />}
        footer={
          <GlassButton variant="amber" size={44} className="w-full" data-testid="teach-begin" disabled={!map.confirmedAt} onClick={() => void vm.start({ workspace })}>
            Start and share the ERP tab
          </GlassButton>
        }
      >
        <BrowserCheck />
        <PersonaCard role="newhire" name={learner} expert={expert} />
        <p style={{ fontSize: 14, lineHeight: 1.45, color: "#3a3a3c", margin: "0 2px" }}>
          Loaded {map.rules.length} rules from {expert}&apos;s confirmed Work Map{map.confirmedAt ? `, rev\u00a0${map.revision}` : ""}.
        </p>
        {presenter ? (
          <ul style={{ ...small, padding: "0 2px", listStyle: "none", display: "flex", flexDirection: "column", gap: 2 }}>
            {map.rules.map((r) => (
              <li key={r.id}>{r.title}</li>
            ))}
          </ul>
        ) : null}
        <ul style={{ fontSize: 12.5, color: "#6e6e73", margin: 0, padding: "0 2px", listStyle: "none", display: "flex", flexDirection: "column", gap: 2 }}>
          <li>Headphones on.</li>
          <li>{workspace ? "In the share dialog, choose This tab." : "In the share dialog, pick the tab named MB-ERP."}</li>
        </ul>
        {!map.confirmedAt ? (
          <p style={{ fontSize: 12.5, color: "#a35f00", margin: "0 2px" }}>
            Only a confirmed map teaches.{" "}
            <Link className="underline" href={`/map/${map.sessionId}`}>Open the map</Link>
          </p>
        ) : null}
        {vm.syncError ? (
          <p role="alert" style={{ fontSize: 12.5, color: "#8a5200", margin: "0 2px", padding: "8px 10px", borderRadius: 12, background: "rgba(245,166,35,.14)" }}>{vm.syncError}</p>
        ) : null}
      </CompanionCard>
    );
  }

  // ---------- started ----------
  const watching = watchingLine(learner, vm.currentState);
  const exercised = vm.card.filter((c) => c.status !== "untested").length;
  const head = vm.ended ? (
    <Head mood={mood} eyebrow="Tutor · session ended" testId="teach-tutor" title="Session ended" sub={`${exercised} of ${vm.card.length} rules exercised`} right={<SessionClock startedAt={vm.startedAt ?? null} frozen />} rippleKey="ended" />
  ) : line && shown ? (
    <Head mood={mood} eyebrow={`Tutor · ${line.word}`} testId="teach-tutor" sub={teachSub(shown, learner, expert)} right={<SessionClock startedAt={vm.startedAt ?? null} />} rippleKey={vm.decisions.length} />
  ) : (
    <Head mood={mood} eyebrow="Tutor · watching" testId="teach-tutor" title={watching.title} sub={watching.sub} right={<SessionClock startedAt={vm.startedAt ?? null} />} />
  );

  const context = shown ? decisionContext(shown.cause, learner, labelField) : null;
  const fixable = kind === "intervene" || kind === "stop" || kind === "save-blocked";

  return (
    <CompanionCard
      mood={mood}
      mode={mode}
      floating={workspace}
      label="Tutor"
      header={head}
      footer={
        vm.ended ? null : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {vm.reopenReplay || (vm.replay && !replay.visible) ? (
              <GlassButton size={30} variant="ghost" style={{ alignSelf: "flex-start" }} onClick={vm.replay ? replay.restore : vm.reopenReplay}>
                Show the moment again
              </GlassButton>
            ) : null}
            <GlassButton variant="amber" size={34} style={{ width: "100%" }} data-testid="teach-end" onClick={() => { setEndError(null); vm.endSession().catch(() => setEndError("Could not save; try again")); }}>
              End session · show the mastery card
            </GlassButton>
            {endError || vm.syncError ? <p role="alert" style={{ fontSize: 12, color: "#8a5200", textAlign: "center", margin: 0 }}>{endError ?? vm.syncError}</p> : null}
          </div>
        )
      }
    >
      {/* Stable polite live region (display:contents, no extra gap): the tutor's line, an intervention or
          "Not posted" is announced as it replaces the previous one. */}
      <div aria-live="polite" style={{ display: "contents" }}>
      {shown && line ? (
        <div key={`d${vm.decisions.length}`} style={{ display: "flex", flexDirection: "column", gap: 8, padding: "0 2px" }}>
          {context ? <p style={{ ...small, animation: "tc-rise .5s var(--ease-rise) both" }}>{context}</p> : null}
          <p style={{ fontSize: 18, lineHeight: 1.32, fontWeight: 600, letterSpacing: "-.012em", margin: 0, textWrap: "pretty", animation: "tc-rise .6s var(--ease-rise) .1s both" }}>{line.message}</p>
          {line.quote && !replay.visible && !line.message.includes(line.quote) ? (
            <div style={{ padding: "10px 12px", borderRadius: 16, background: "rgba(255,255,255,.55)", boxShadow: "inset 0 0 0 .5px rgba(0,0,0,.06)", animation: "tc-rise .55s var(--ease-rise) .2s both" }}>
              <p style={{ fontSize: 14, lineHeight: 1.4, fontWeight: 500, margin: 0 }}>“{line.quote}”</p>
              <p style={{ ...small, fontSize: 11.5, marginTop: 3 }}>{expert}, in their own words</p>
            </div>
          ) : null}
          {kind === "save-blocked" ? <p style={{ fontSize: 12.5, color: "#6e6e73", margin: 0 }}>The save was held: it contradicts {expert}&apos;s confirmed map. Fix it when you are ready.</p> : null}
          {fixable && kind !== "save-blocked" ? <p style={{ fontSize: 12.5, color: "#b4501f", margin: 0 }}>Fix it when you are ready.</p> : null}
          {kind === "predict" ? <p style={{ fontSize: 12.5, color: "#6e6e73", margin: 0 }}>Say what {expert} would do, and why.</p> : null}
        </div>
      ) : null}
      </div>

      {replay.visible && vm.replay ? <ReplayRow replay={vm.replay} expert={expert} onClose={vm.closeReplay} /> : null}

      {vm.pipeline.degraded === "wrong_surface" ? (
        <p style={{ fontSize: 12.5, color: "#a35f00", margin: "0 2px" }}>A different surface is shared, so no frames are sent. ERP telemetry continues.</p>
      ) : null}

      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, padding: "0 2px", minHeight: 24 }}>
        <Pill tone={vm.phase === "independent" ? "blue" : "amber"} dot>
          {phaseLabel(vm.phase)}
        </Pill>
        <span style={{ fontSize: 11, fontWeight: 600, color: "#6e6e73", marginLeft: 2 }}>{learner}</span>
        {chips.length ? chips.map((c) => <LearnedChip key={`${c.id}|${c.text}`} kind={c.kind} text={c.text} />) : <span style={{ fontSize: 11.5, color: "#6e6e73" }}>{expert}&apos;s {map.rules.length} rules loaded</span>}
      </div>

      {earlier.length > 0 ? (
        <details style={{ padding: "0 2px" }}>
          <summary style={{ fontSize: 12, color: "#6e6e73", cursor: "pointer" }}>Earlier ({earlier.length})</summary>
          <ul style={{ margin: "6px 0 0", padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 6 }}>
            {earlier
              .slice()
              .reverse()
              .map((d, i) => (
                <li key={`${d.t}-${i}`} style={{ fontSize: 12.5, lineHeight: 1.4, color: "#3a3a3c" }}>
                  <span style={{ fontWeight: 600, color: "#6e6e73" }}>{tutorLine(d).word} · </span>
                  {d.message}
                </li>
              ))}
          </ul>
        </details>
      ) : null}

      {presenter || mech ? (
        <Drawer open={mech} onToggle={() => setMech((v) => !v)} title="Show the mechanism">
          <p style={small}>
            invoice {vm.currentInvoice ?? "–"} · activity {vm.pipeline.activity}
            {vm.pipeline.visionLatency != null ? ` · vision ${vm.pipeline.visionLatency} ms` : ""} · events: {vm.source} · voice: {vm.voice.mode === "agent" ? "ElevenAgents" : "Browser voice (fallback)"}
          </p>
          {vm.pipeline.lastSentUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={vm.pipeline.lastSentUrl} alt="Last frame sent to vision" style={{ width: "100%", borderRadius: 10, boxShadow: "0 0 0 .5px rgba(0,0,0,.1)" }} />
          ) : null}
          <ul style={{ ...small, padding: 0, listStyle: "none" }}>
            {vm.events.map((e) => (
              <li key={e.id}>
                <span className="mono">{e.t.toFixed(0)}s</span> {describeEvent(e)}
              </li>
            ))}
          </ul>
          {!vm.pipeline.sharing && !workspace ? <GlassButton size={30} onClick={() => void vm.pipeline.start({ mode: "tab", app: "erp", queue: "newhire" })}>Share screen</GlassButton> : null}
        </Drawer>
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 2px" }}>
          <button type="button" onClick={() => setMech(true)} style={{ fontSize: 11.5, color: "#6e6e73", padding: 0, background: "none", border: 0, cursor: "pointer" }}>
            Show the mechanism
          </button>
          <span style={{ marginLeft: "auto", fontSize: 10.5, color: "#6e6e73" }}>speaks only when {expert} would</span>
        </div>
      )}
    </CompanionCard>
  );
}

function Head({ mood, eyebrow, title, sub, right, testId, rippleKey }: { mood: OrbMood; eyebrow?: string; title?: string; sub?: string; right?: ReactNode; testId?: string; rippleKey?: string | number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "1px 2px", minWidth: 0 }}>
      <Orb mood={mood} size={38} rippleKey={rippleKey} />
      <div style={{ flex: 1, minWidth: 0, minHeight: 38, display: "flex", flexDirection: "column", justifyContent: "center" }}>
        {eyebrow ? (
          <div key={`e|${eyebrow}`} data-testid={testId} style={{ animation: "tc-rise .55s var(--ease-rise, cubic-bezier(.2,.9,.3,1)) both" }}>
            <Eyebrow text={eyebrow} mood={mood} />
          </div>
        ) : null}
        <div key={`t|${title ?? ""}|${sub ?? ""}`} style={{ animation: "tc-rise .55s var(--ease-rise, cubic-bezier(.2,.9,.3,1)) both", minWidth: 0 }}>
          {title ? (
            <div title={title} style={{ fontSize: 15, fontWeight: 600, letterSpacing: "-.01em", lineHeight: 1.3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {title}
            </div>
          ) : null}
          {sub ? (
            <div title={sub} style={{ fontSize: 12, color: title ? "#6e6e73" : "#6e6e73", marginTop: 1, lineHeight: 1.35, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {sub}
            </div>
          ) : null}
        </div>
      </div>
      {right}
    </div>
  );
}
