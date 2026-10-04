"use client";

import { useEffect, useRef, useState } from "react";
import { GlassButton, HeardCard, useOccluder } from "@/components/glass";
import { CaptureCompanion } from "@/components/companion/capture/CaptureCompanion";
import { CaptureOverlay } from "@/components/companion/capture/CaptureOverlay";
import { MechanismSheet } from "@/components/companion/capture/MechanismSheet";
import { AppShell } from "@/components/ui/AppShell";
import { LayoutReveal } from "@/components/ui/LayoutReveal";
import { OpenErpButton } from "@/components/ui/OpenErpButton";
import { useLayoutModeState } from "@/components/ui/useLayoutMode";
import { useErpReloadKey } from "@/components/ui/useErpReloadKey";
import { usePresenter } from "@/components/ui/usePresenter";
import { Workspace } from "@/components/ui/Workspace";
import { captureApp, cardState, erpTargetFor, HEARD_MS, NOTICE_MS } from "@/lib/ui/capture-copy";
import { presenceOf } from "@/lib/ui/presence";
import type { CaptureVM } from "./capture.vm";

/** A clock for lingering one-shot states (understood, heard, notice, struck). Null until mounted (hydration-safe). */
function useNow(active: boolean, ms = 400): number | null {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    if (!active) return;
    const id = window.setInterval(() => setNow(Date.now()), ms);
    return () => window.clearInterval(id);
  }, [active, ms]);
  return now;
}

export function CaptureView({ vm }: { vm: CaptureVM }) {
  const presenter = usePresenter();
  const app = vm.app ?? captureApp("erp");
  const canCrop = typeof vm.pipeline.setCropTarget === "function";
  const { mode, ready } = useLayoutModeState({ canCrop, source: vm.source, started: vm.started });
  const reloadKey = useErpReloadKey(vm.started, vm.started ? "live" : "idle");
  const [mech, setMech] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const now = useNow(vm.started);

  useEffect(() => {
    if (presenter) setMech(true);
  }, [presenter]);

  useEffect(() => {
    if (!vm.started) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "p" && e.key !== "P") return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      vm.setHolding(!vm.holding);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [vm]);

  const struckAgo = now != null && vm.lastStrike ? now - vm.lastStrike.at : null;
  const presence = presenceOf({
    holding: vm.holding,
    struckAgoMs: struckAgo,
    phase: vm.openWindow?.phase,
    sharing: vm.pipeline.sharing,
    queued: vm.queued.length,
    waitingReason: vm.decision?.reasons[0],
  });
  const lastUnderstood = vm.understood?.at(-1);
  const lastHeard = vm.reasonHeardItems?.at(-1);
  const watching = vm.pipeline.sharing || (app.telemetry && vm.started);
  const card = cardState({
    started: vm.started,
    now,
    presence: presence.state,
    decision: vm.decision ?? null,
    watching,
    queued: vm.queued.length,
    holding: vm.holding,
    ending: vm.ending,
    window: vm.openWindow ? { phase: vm.openWindow.phase } : null,
    lastUnderstoodAt: lastUnderstood?.at ?? null,
    lastHeard: lastHeard?.at != null ? { at: lastHeard.at, about: lastHeard.about } : null,
    lastNotice: vm.lastNotice ? { at: vm.lastNotice.at, text: vm.lastNotice.text, queued: vm.lastNotice.queued } : null,
    lastStrikeAt: vm.lastStrike?.at ?? null,
    lastDeferredAt: vm.lastDeferred?.at ?? null,
    noun: app.noun,
  });

  const heardLive = !!lastHeard?.at && now != null && now - lastHeard.at < HEARD_MS && !vm.openWindow && !vm.holding && !card.struck;
  const workspace = mode === "workspace";
  const companion = (
    <CompanionStack
      vm={vm}
      card={card}
      layout={mode}
      mech={mech}
      onToggleMech={() => setMech((v) => !v)}
      cardRef={cardRef}
      heard={heardLive && lastHeard ? lastHeard.quote : null}
    />
  );

  if (workspace) {
    // Rule D1: over-ERP overlays only while no real frame capture is live.
    const overlaysAllowed = vm.started && !vm.pipeline.sharing && !vm.holding && !card.struck;
    const field = vm.openWindow
      ? vm.openWindow.stepRef?.split(":").slice(1).join(":")
      : card.understoodLinger && lastUnderstood
        ? lastUnderstood.stepRef.split(":").slice(1).join(":")
        : vm.lastNotice && now != null && now - vm.lastNotice.at < NOTICE_MS
          ? vm.lastNotice.field
          : null;
    const noticeLive = vm.lastNotice && now != null && now - vm.lastNotice.at < NOTICE_MS ? { id: vm.lastNotice.eventId, text: vm.lastNotice.text } : null;
    return (
      <LayoutReveal ready={ready}>
        <Workspace
          erpSrc={app.src}
          erpTitle={app.title}
          locked={!vm.started}
          lockedHint="Start the session to begin"
          reloadKey={reloadKey}
          onFrameElement={vm.pipeline.setCropTarget}
          onOccluders={vm.pipeline.setOccluders}
          presenter={presenter}
          overlay={overlaysAllowed ? <CaptureOverlay target={erpTargetFor(field)} mood={card.mood} cable={card.mode === "ask"} cardRef={cardRef} notice={noticeLive} /> : null}
          companion={companion}
        />
      </LayoutReveal>
    );
  }

  return (
    <LayoutReveal ready={ready}>
      <AppShell step={1} presenter={presenter} status={<span className="t-meta">{vm.started ? vm.sessionId : "1 Capture"}</span>}>
        <main style={{ boxSizing: "border-box", width: "min(560px, 100%)", margin: "0 auto", padding: "16px 16px 32px", display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
            <p style={{ fontSize: 13.5, color: "#6e6e73", flex: "1 1 180px" }}>
              {app.id === "claims" ? "Open the claims workbench in its own window." : "Open the ERP in its own window."}
            </p>
            {app.id === "claims" ? <OpenAppLink href={app.src}>Open the claims workbench</OpenAppLink> : <OpenErpButton queue="expert">Open the ERP window</OpenErpButton>}
          </div>
          {vm.started && !vm.pipeline.sharing && !vm.share0 && (
            <GlassButton size={34} onClick={() => void vm.pipeline.start({ mode: "tab", app: app.id, ...(app.id === "erp" ? { queue: "expert" } : {}) })}>Share screen</GlassButton>
          )}
          {companion}
        </main>
      </AppShell>
    </LayoutReveal>
  );
}

function CompanionStack(p: {
  vm: CaptureVM;
  card: ReturnType<typeof cardState>;
  layout: "workspace" | "companion";
  mech: boolean;
  onToggleMech(): void;
  cardRef: React.RefObject<HTMLDivElement | null>;
  heard: string | null;
}) {
  const { vm, card, layout, mech, cardRef, heard } = p;
  const floating = layout === "workspace";
  // DOM order: card first (its "Log" / "Scratch that" come before any transcript or event text), sheet after.
  // Visually the floating sheet sits to the left on desktop and below the card on narrow screens.
  return (
    <div
      className={floating ? "capture-floating-stack" : undefined}
      style={floating ? undefined : { display: "flex", flexDirection: "column", gap: 14 }}
    >
      <div style={{ display: "flex", flexDirection: "column", alignItems: floating ? "flex-end" : "stretch", gap: 12, minHeight: 0 }}>
        <div ref={cardRef} style={{ width: floating ? undefined : "100%", minHeight: 0 }}>
          <CaptureCompanion vm={vm} card={card} layout={layout} mechOpen={mech} onToggleMech={p.onToggleMech} />
        </div>
        {heard && <HeardBubble quote={heard} floating={floating} />}
      </div>
      <MechanismSheet vm={vm} open={mech && vm.started} floating={floating} />
    </div>
  );
}

function HeardBubble({ quote, floating }: { quote: string; floating: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useOccluder(ref, "capture-heard", floating);
  return (
    <div ref={ref} style={{ order: -1, width: floating ? "min(348px, calc(100vw - 32px))" : "100%" }}>
      <HeardCard quote={quote} meta="while you worked" />
    </div>
  );
}

function OpenAppLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="tacit-erp"
      className="inline-flex items-center justify-center no-underline"
      style={{ height: 40, padding: "0 18px", borderRadius: 20, fontSize: 14, fontWeight: 600, color: "#6b3f00", background: "linear-gradient(180deg,rgba(255,222,160,.85),rgba(255,196,95,.6))", boxShadow: "inset 0 1px 0 rgba(255,255,255,.8), inset 0 0 0 .5px rgba(200,120,0,.2)" }}
    >
      {children}
    </a>
  );
}
