"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { Slot } from "@/lib/workmap";
import { mapMood, UNDERSTOOD_MS } from "@/lib/ui/moods";
import { newlyFilled, slotSegments, slotTag } from "@/lib/ui/mapview";
import { AppShell } from "@/components/ui/AppShell";
import { usePresenter } from "@/components/ui/usePresenter";
import { Pill, SegmentedBar } from "@/components/glass";
import { WorkMapDetail, WorkMapRail, sortedSteps } from "@/components/WorkMapView";
import { AutopilotSheet } from "@/components/companion/map/AutopilotSheet";
import { DebriefCard } from "@/components/companion/map/DebriefCard";
import { ExportMenu } from "@/components/companion/map/ExportMenu";
import { MapCable } from "@/components/companion/map/MapCable";
import type { MapVM } from "./map.vm";

const RISE = "tc-rise .55s var(--ease-rise, cubic-bezier(.2,.9,.3,1)) both";

function Check({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-2">
      <span aria-hidden className="flex-none rounded-full" style={{ width: 6, height: 6, background: ok ? "#22b45e" : "#f5a623", transition: "background-color .6s" }} />
      <span>{children}</span>
    </li>
  );
}

export function MapView({ vm }: { vm: MapVM }) {
  const presenter = usePresenter();
  const map = vm.map;
  const steps = useMemo(() => (map ? sortedSteps(map) : []), [map]);
  const [picked, setPicked] = useState<string | null>(null);
  const [justFilled, setJustFilled] = useState<{ slot: Slot; at: number } | null>(null);
  const [wide, setWide] = useState(false);
  const [cardH, setCardH] = useState(0);
  const cardRef = useRef<HTMLDivElement>(null);
  const prevSlots = useRef<{ id: string; status: string }[] | null>(null);

  // The detail follows the step the debrief is asking about; a click on the rail overrides it.
  useEffect(() => {
    if (vm.selectedStepId) setPicked(vm.selectedStepId);
  }, [vm.selectedStepId]);

  // "Understood" flash: a slot just went from open to filled (real state change only).
  useEffect(() => {
    if (!map) return;
    const next = map.slots.map((s) => ({ id: s.id, status: s.status }));
    const ids = prevSlots.current ? newlyFilled(prevSlots.current, next) : [];
    prevSlots.current = next;
    const slot = ids.length ? map.slots.find((s) => s.id === ids[ids.length - 1]) : undefined;
    if (!slot) return;
    setJustFilled({ slot, at: Date.now() });
    const t = window.setTimeout(() => setJustFilled(null), UNDERSTOOD_MS);
    return () => window.clearTimeout(t);
  }, [map]);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1280px)");
    const on = () => setWide(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  // At xl the companion floats bottom-right over the detail column: measure it so the column's scroll area ends above it
  // and no reading content sits underneath the card.
  const hasMap = !!map;
  useEffect(() => {
    const el = cardRef.current;
    if (!wide || !el) return;
    const ro = new ResizeObserver(() => setCardH(Math.ceil(el.getBoundingClientRect().height)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [wide, hasMap]);

  if (!map) {
    return (
      <AppShell step={2}>
        <main className="mx-auto max-w-xl px-6 py-24 text-center" style={{ background: "#fbfbfd" }}>
          <p className="text-[12px] font-semibold text-[#8e8e93]">2 · Map</p>
          <p className="mt-4 text-[19px] font-semibold text-[#1d1d1f]" style={{ animation: RISE }}>
            {vm.compiling ? "Compiling the Work Map from events, transcript and answers…" : "Loading session…"}
          </p>
        </main>
      </AppShell>
    );
  }

  const progress = vm.progress;
  const name = map.expert.name;
  const sample = vm.sessionId.startsWith("demo_");
  const confirmed = !!vm.confirmed || !!map.confirmedAt;
  const asking = vm.phase === "asking" ? vm.currentSlot : null;
  const selectedId = picked && steps.some((s) => s.id === picked) ? picked : (steps.find((s) => s.judgment)?.id ?? steps[0]?.id ?? null);
  const selected = steps.find((s) => s.id === selectedId);
  const mood = mapMood({ phase: vm.phase, isSpeaking: vm.voice.isSpeaking, debriefOn: vm.debriefOn, filledAgoMs: justFilled ? 0 : null, confirmed });
  const cableOn = wide && !!asking;

  return (
    <AppShell step={2} sessionId={vm.sessionId} confirmed={confirmed} presenter={presenter} status={<span className="truncate font-mono text-[12px] text-[#8e8e93]">{vm.note}</span>}>
      <div style={{ background: "#fbfbfd", minHeight: "calc(100dvh - 52px)" }}>
        <main className="mx-auto grid max-w-[1600px] gap-6 px-4 pb-10 pt-4 xl:grid-cols-[280px_minmax(0,500px)_minmax(0,1fr)] xl:gap-x-10 xl:px-3 xl:pt-3">
          {/* The companion comes first in the DOM (its buttons are the first matches), floating at xl. */}
          <div ref={cardRef} className="z-0 xl:fixed xl:z-30 xl:bottom-7 xl:right-7 [&_.glass-companion]:[background:linear-gradient(180deg,rgba(255,255,255,.92),rgba(255,255,255,.85))]" style={{ maxWidth: "calc(100vw - 32px)" }}>
            <DebriefCard vm={vm} mood={mood} justFilled={vm.phase === "asking" ? justFilled?.slot ?? null : null} floating={wide} />
          </div>

          {/* Centre: title, status, gaps, open questions, agent sheet. */}
          <section className="flex min-w-0 flex-col gap-[22px] xl:col-start-2 xl:row-start-1 xl:pt-[22px]">
            <header>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[13px] font-semibold text-[#8e8e93]">{name}&apos;s Work Map · rev {map.revision}</p>
                {!wide && (
                  <div className="flex items-center gap-2">
                    {confirmed && <ExportMenu sessionId={vm.sessionId} />}
                    <TeachLink sessionId={vm.sessionId} confirmed={confirmed} />
                  </div>
                )}
              </div>
              <h1 className="mt-1 text-[26px] font-bold leading-[1.15] tracking-[-.022em] text-[#1d1d1f]" style={{ textWrap: "pretty" }}>{map.task}</h1>
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                <Pill tone={confirmed ? "green" : "amber"} dot>
                  <span data-testid={confirmed ? "map-confirmed" : undefined}>{confirmed ? `Confirmed by ${name} · rev ${map.revision}` : "Draft — not confirmed"}</span>
                </Pill>
                {vm.knowledge && <Pill tone="green">Synced to tutor</Pill>}
                {sample && <Pill title="Seeded sample session">Sample</Pill>}
              </div>
            </header>

            {progress && (
              <div className="flex flex-col gap-2" data-testid="map-progress">
                <div className="flex items-baseline justify-between gap-3 text-[13px]">
                  <span className="font-semibold text-[#1d1d1f]">Gaps closed</span>
                  <span className="text-[#6e6e73]">{progress.closed} of {progress.total} answered by {name}</span>
                </div>
                <SegmentedBar segments={map.slots.length ? slotSegments(map.slots) : ["filled"]} label={`${progress.closed} of ${progress.total} answered`} />
                <ul className="m-0 mt-1 flex list-none flex-col gap-1 p-0 text-[12.5px] text-[#6e6e73]">
                  <Check ok={progress.evidenceOk}>{progress.evidenceOk ? `Every judgment step has ${name}'s words` : `A judgment step is still missing ${name}'s words`}</Check>
                  <Check ok={progress.open === 0}>{progress.open === 0 ? "No open gaps" : `${progress.open} gap${progress.open > 1 ? "s" : ""} still open`}</Check>
                  <Check ok={confirmed}>{confirmed ? `Teach-back confirmed by ${name}` : "Teach-back not yet confirmed"}</Check>
                </ul>
                <p className="text-[12.5px]" style={{ color: progress.ready ? "#1b8a4b" : "#8e8e93" }}>
                  {progress.ready ? "Ready to teach, for this task's scope. The tutor loads this revision." : "Ready to teach means no open gaps, the expert's words on every decision, and an explicit yes on the teach-back."}
                </p>
              </div>
            )}

            <div className="flex flex-col">
              <p className="pb-1.5 text-[12px] font-semibold text-[#8e8e93]">Open questions from the task</p>
              {map.slots.length === 0 && <p className="py-2 text-[13.5px] text-[#8e8e93]" style={{ borderTop: ".5px solid rgba(0,0,0,.08)" }}>The capture left no open questions.</p>}
              {map.slots.map((s) => {
                const filled = s.status === "filled";
                const on = asking?.id === s.id;
                const row = (
                  <>
                    <span
                      aria-hidden
                      className="flex-none rounded-full"
                      style={{
                        width: 8,
                        height: 8,
                        background: filled ? "#22b45e" : s.status === "skipped" ? "#c7c7cc" : "#f5a623",
                        boxShadow: filled ? "0 0 8px rgba(34,180,94,.6)" : s.status === "skipped" ? "none" : "0 0 6px rgba(245,166,35,.5)",
                        transition: "background-color .6s, box-shadow .6s",
                      }}
                    />
                    <span className="min-w-0 flex-1 text-[14px] leading-[1.4]" style={{ color: filled ? "#8e8e93" : "#1d1d1f", textDecoration: filled ? "line-through" : "none", transition: "color .6s" }}>
                      {s.question}
                    </span>
                    <span className="flex-none text-[11.5px] text-[#8e8e93]">{on ? "asking now" : slotTag(s)}</span>
                  </>
                );
                const style = {
                  borderTop: ".5px solid rgba(0,0,0,.08)",
                  background: on ? "#fff" : undefined,
                  boxShadow: on ? "0 1px 3px rgba(0,0,0,.08),0 0 0 .5px rgba(245,166,35,.45)" : "none",
                  transition: "background-color .4s, box-shadow .4s",
                } as const;
                return s.stepId ? (
                  <button
                    key={s.id}
                    type="button"
                    data-slot-row={s.id}
                    onClick={() => setPicked(s.stepId!)}
                    className="flex w-full cursor-pointer items-center gap-3 rounded-[10px] px-1 py-[11px] text-left hover:bg-[rgba(255,255,255,.7)]"
                    style={style}
                    title="Show the step this question is about"
                  >
                    {row}
                  </button>
                ) : (
                  <div key={s.id} data-slot-row={s.id} className="flex items-center gap-3 rounded-[10px] px-1 py-[11px]" style={style}>
                    {row}
                  </div>
                );
              })}
            </div>

            <AutopilotSheet vm={vm} presenter={presenter} />
          </section>

          {/* Left rail. */}
          <aside className="glass-sidebar min-w-0 self-start p-3 xl:sticky xl:top-[64px] xl:col-start-1 xl:row-start-1 xl:max-h-[calc(100dvh-76px)] xl:overflow-y-auto" style={{ borderRadius: 24 }}>
            <WorkMapRail map={map} selectedId={selectedId} onSelect={setPicked} askingStepId={asking?.stepId ?? null} />
          </aside>

          {/* Right: actions + step detail (its scroll area stops above the floating card). */}
          <section
            className="min-w-0 xl:sticky xl:top-[64px] xl:col-start-3 xl:row-start-1 xl:self-start xl:overflow-y-auto xl:pb-6 xl:pr-3 scroll-thin"
            aria-label="Step detail"
            style={wide ? { maxHeight: `calc(100dvh - 64px - ${cardH ? cardH + 28 + 14 : 0}px)`, maskImage: "linear-gradient(180deg,#000 calc(100% - 28px),transparent)", WebkitMaskImage: "linear-gradient(180deg,#000 calc(100% - 28px),transparent)" } : undefined}
          >
            {wide && (
              <div className="mb-5 flex items-center justify-end gap-2 pt-1.5">
                {confirmed && <ExportMenu sessionId={vm.sessionId} />}
                <TeachLink sessionId={vm.sessionId} confirmed={confirmed} />
              </div>
            )}
            <WorkMapDetail map={map} frames={vm.frames} sessionId={vm.sessionId} step={selected} matrix={vm.matrix} onSelect={setPicked} />
          </section>
        </main>
        <MapCable cardRef={cardRef} rowSelector={asking ? `[data-slot-row="${asking.id}"]` : null} mood={mood} active={cableOn} />
      </div>
    </AppShell>
  );
}

/** "Teach →": dimmed and inert until the map is confirmed, then a link to the real teach start. */
function TeachLink({ sessionId, confirmed }: { sessionId: string; confirmed: boolean }) {
  const style = {
    height: 34,
    padding: "0 16px",
    borderRadius: 17,
    fontSize: 13,
    fontWeight: 600,
    color: "#6b3f00",
    background: "linear-gradient(180deg,rgba(255,222,160,.85),rgba(255,196,95,.6))",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,.8),inset 0 0 0 .5px rgba(200,120,0,.2)",
    transition: "opacity .6s, translate .25s",
  } as const;
  if (!confirmed) {
    return (
      <span aria-disabled="true" title="Confirm the Work Map first" className="inline-flex cursor-not-allowed select-none items-center" style={{ ...style, opacity: 0.4 }}>
        Teach →
      </span>
    );
  }
  return (
    <Link href={`/teach?from=${sessionId}`} data-testid="map-teach" className="inline-flex items-center no-underline hover:-translate-y-px" style={{ ...style, opacity: 1 }}>
      Teach →
    </Link>
  );
}
