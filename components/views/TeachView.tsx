"use client";

import { useEffect, useState } from "react";
import { MasterySheet } from "@/components/companion/teach/MasterySheet";
import { TeachCompanion, useTeachCardState } from "@/components/companion/teach/TeachCompanion";
import { TeachOverlay } from "@/components/companion/teach/TeachOverlay";
import { AppShell } from "@/components/ui/AppShell";
import { LayoutReveal } from "@/components/ui/LayoutReveal";
import { OpenErpButton } from "@/components/ui/OpenErpButton";
import { useLayoutModeState } from "@/components/ui/useLayoutMode";
import { usePresenter } from "@/components/ui/usePresenter";
import { Workspace } from "@/components/ui/Workspace";
import { targetOfEvent } from "@/lib/ui/teachview";
import type { TeachVM } from "./teach.vm";

export function TeachView({ vm }: { vm: TeachVM }) {
  const presenter = usePresenter();
  const canCrop = typeof vm.pipeline.setCropTarget === "function";
  const { mode, ready } = useLayoutModeState({ canCrop, source: vm.source, started: vm.started });
  const [reloadKey, setReloadKey] = useState("idle");
  useEffect(() => {
    if (!vm.started) return;
    const id = window.setTimeout(() => setReloadKey("live"), 1500);
    return () => window.clearTimeout(id);
  }, [vm.started]);

  const state = useTeachCardState(vm);
  const workspace = mode === "workspace";
  const learner = vm.learnerName || vm.log?.expertName || "New hire";
  const expert = vm.expertName ?? vm.map?.expert.name ?? "the expert";

  // D1: over-ERP overlays only while no real frame capture is live (they would be painted out of it).
  const latestEvent = vm.events[0];
  const target = vm.started && !vm.ended && !vm.pipeline.sharing ? targetOfEvent(latestEvent) : null;
  const overlay = target ? <TeachOverlay target={target} invoice={latestEvent?.invoice} mood={state.mood} cable={state.active} /> : null;

  const card = <TeachCompanion vm={vm} presenter={presenter} panel={!workspace} workspace={workspace} state={state} />;
  // The pipeline needs a mounted <video>; it never shows (the capture is not a preview).
  const video = (
    <video
      ref={vm.pipeline.videoRef}
      muted
      playsInline
      aria-hidden
      className="see-thumb"
      style={{ position: "fixed", left: -10000, top: 0, width: 2, height: 2, opacity: 0, pointerEvents: "none" }}
    />
  );

  return (
    <LayoutReveal ready={ready}>
      {workspace ? (
        <Workspace
          erpSrc="/erp?queue=newhire"
          locked={!vm.started}
          lockedHint="Start the session to begin"
          reloadKey={reloadKey}
          onFrameElement={vm.pipeline.setCropTarget}
          onOccluders={vm.pipeline.setOccluders}
          presenter={presenter}
          overlay={overlay}
          companion={
            <>
              {vm.ended ? <MasterySheet vm={vm} learner={learner} expert={expert} floating /> : null}
              {card}
            </>
          }
        />
      ) : (
        <AppShell step={3} sessionId={vm.map?.sessionId} confirmed={!!vm.map?.confirmedAt} presenter={presenter}>
          <main className="mx-auto flex w-full max-w-[560px] flex-col gap-4 px-4 py-6">
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-[13px] text-[#6e6e73]">Open the ERP in its own window.</p>
              <OpenErpButton queue="newhire">Open the ERP window</OpenErpButton>
            </div>
            {card}
            {vm.ended ? <MasterySheet vm={vm} learner={learner} expert={expert} floating={false} /> : null}
          </main>
        </AppShell>
      )}
      {video}
    </LayoutReveal>
  );
}
