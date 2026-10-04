"use client";

import { useMemo, useState } from "react";
import type { Frame } from "@/lib/events";
import { describeAct, describeCond, type Rule, type Step, type WorkMap } from "@/lib/workmap";
import {
  dedupeConfirmedBy,
  evidenceBadge,
  frameSrc,
  lowConfidenceLine,
  mmssOf,
  quoteCaption,
  quoteSourceLabel,
  railHeadline,
  railMeta,
  stepHeading,
} from "@/lib/ui/mapview";
import { GuardrailCard } from "@/components/ui/GuardrailCard";
import { QuoteCard } from "@/components/ui/QuoteCard";
import { Pill } from "@/components/glass";

type Matrix = { stepId: string; cells: { key: string; word: string }[] }[] | null | undefined;

const RISE = "tc-rise .55s var(--ease-rise, cubic-bezier(.2,.9,.3,1)) both";

export function sortedSteps(map: WorkMap): Step[] {
  return [...map.steps].sort((a, b) => a.index - b.index);
}

/** Left glass rail: every step with mm:ss · from → to, a judgment dot, and the selected state. */
export function WorkMapRail({ map, selectedId, onSelect, askingStepId }: { map: WorkMap; selectedId: string | null; onSelect: (id: string) => void; askingStepId?: string | null }) {
  const steps = useMemo(() => sortedSteps(map), [map]);
  return (
    <nav aria-label="Steps of the Work Map" className="flex flex-col gap-0.5">
      <p className="px-2.5 pb-1.5 text-[11px] font-semibold text-[#6e6e73]">{railHeadline(steps)}</p>
      {steps.length === 0 && <p className="px-2.5 text-[13px] text-[#6e6e73]">No steps compiled yet.</p>}
      <ol className="m-0 flex list-none flex-col gap-0.5 p-0">
        {steps.map((s) => {
          const on = s.id === selectedId;
          return (
            <li key={s.id}>
              <button
                type="button"
                aria-current={on ? "step" : undefined}
                data-testid="map-rail-step"
                onClick={() => onSelect(s.id)}
                className="flex w-full cursor-pointer items-start gap-3 rounded-[12px] px-2.5 py-[9px] text-left outline-none focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[rgba(245,166,35,.75)] hover:bg-[rgba(255,255,255,.6)]"
                style={{
                  background: on ? "#fff" : undefined,
                  boxShadow: on ? "0 1px 3px rgba(0,0,0,.08),0 0 0 .5px rgba(0,0,0,.05)" : "none",
                  transition: "background-color .3s, box-shadow .3s",
                }}
              >
                <span className="w-[18px] flex-none pt-[2px] font-mono text-[12px]" style={{ color: on ? "#a35f00" : "#8e8e93" }}>{s.index + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] leading-[1.3] text-[#1d1d1f]" style={{ fontWeight: on ? 600 : 400 }}>{s.title}</span>
                  <span className="mt-0.5 block text-[12px] text-[#6e6e73]" style={{ fontVariantNumeric: "tabular-nums" }}>{railMeta(s)}</span>
                </span>
                {s.judgment && (
                  <span
                    aria-label="judgment call"
                    title={askingStepId === s.id ? "Judgment call · being asked now" : "Judgment call"}
                    className="mt-[7px] flex-none rounded-full"
                    style={{ width: 7, height: 7, background: "#f5a623", boxShadow: askingStepId === s.id ? "0 0 0 3px rgba(245,166,35,.22)" : "none", transition: "box-shadow .5s" }}
                  />
                )}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function StepStill({ frame, step }: { frame?: Frame; step: Step }) {
  const src = frameSrc(frame);
  if (!src) {
    return (
      <div className="grid h-[118px] place-items-center rounded-[14px] text-[13px] text-[#6e6e73]" style={{ background: "rgba(0,0,0,.03)", boxShadow: "inset 0 0 0 .5px rgba(0,0,0,.08)" }}>
        No still kept for this step
      </div>
    );
  }
  const r = step.screenMoment.region;
  const ar = frame && frame.width > 0 && frame.height > 0 ? frame.width / frame.height : null;
  return (
    <figure className="m-0">
      {/* The box takes the still's own aspect (never cropped): full column width, capped in height for tall stills,
          so the region box stays aligned with the image. */}
      <div
        className="relative mx-auto max-w-full overflow-hidden rounded-[14px]"
        style={{ background: "#f4f6f8", boxShadow: "0 0 0 .5px rgba(0,0,0,.1)", ...(ar ? { aspectRatio: String(ar), width: `min(100%, calc(min(52vh, 460px) * ${ar.toFixed(4)}))` } : { width: "100%" }) }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- data: or same-origin still */}
        <img src={src} alt={`Captured still of step ${step.index + 1}`} className={ar ? "block h-full w-full object-contain" : "block h-auto w-full"} style={{ border: 0, borderRadius: 0 }} />
        {r && (
          <span
            aria-hidden
            className="pointer-events-none absolute"
            style={{ left: `${r.x * 100}%`, top: `${r.y * 100}%`, width: `${r.w * 100}%`, height: `${r.h * 100}%`, border: "1.5px solid #f5a623", borderRadius: 4, boxShadow: "0 0 10px rgba(245,166,35,.7)" }}
          />
        )}
        <span
          className="absolute bottom-2 left-2 inline-flex h-6 items-center rounded-[12px] px-2.5 text-[11.5px] font-medium text-[#1d1d1f]"
          style={{ background: "rgba(255,255,255,.82)", boxShadow: "0 0 0 .5px rgba(0,0,0,.1),0 4px 12px rgba(0,0,0,.12)", fontVariantNumeric: "tabular-nums" }}
          title="Time of the screen moment in the capture"
        >
          {mmssOf(step.screenMoment.t)}
        </span>
      </div>
      <figcaption className="mt-1 text-[12px] text-[#6e6e73]">
        captured still{frame?.piiRegionsBlurred != null ? ` · ${frame.piiRegionsBlurred} regions blurred` : ""}
      </figcaption>
    </figure>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[12px] font-semibold text-[#6e6e73]">{children}</p>;
}

/** Right column: the selected step's evidence (still, verbatim quote, guardrails, rule, notes). */
export function WorkMapDetail({ map, frames, sessionId, step, matrix, onSelect }: { map: WorkMap; frames: Frame[]; sessionId: string; step?: Step; matrix?: Matrix; onSelect?: (id: string) => void }) {
  const total = map.steps.length;
  const name = map.expert.name;
  const frame = step?.screenMoment.frameId ? frames.find((f) => f.id === step.screenMoment.frameId) : undefined;
  const rule: Rule | undefined = step ? map.rules.find((r) => r.stepId === step.id) : undefined;
  const low = lowConfidenceLine(rule?.confidence ?? step?.confidence);
  const clip = (audioId?: string) => (audioId ? `/api/sessions/${sessionId}/clips?audioId=${audioId}` : undefined);

  return (
    <div className="flex flex-col gap-5">
      {!!map.roleProfile?.relationships.length && (
        <details className="space-y-3 rounded-xl border p-4">
          <summary>Proposed role profile · {map.roleProfile.relationships.length} evidence-linked relationships</summary>
          <p className="text-sm text-muted">Draft interpretations, not company policy. These never execute as tutor rules, even after map confirmation.</p>
          {map.roleProfile.relationships.map((r, i) => (
            <blockquote key={`${r.evidenceId}-${i}`} className="text-sm">
              <p>{r.subject} · {r.relation.replaceAll("_", " ")} · {r.object}</p>
              <p className="text-muted">“{r.quote}” — {r.t.toFixed(1)}s · {r.evidenceId}</p>
            </blockquote>
          ))}
        </details>
      )}
      {step ? (
        <article key={step.id} id={`step-${step.id}`} className="flex flex-col gap-2.5" style={{ animation: RISE }}>
          <p className="text-[12px] font-semibold" style={{ color: step.judgment ? "#a35f00" : "#8e8e93" }}>{stepHeading(step, total)}</p>
          <h2 className="text-[19px] font-semibold leading-[1.25] tracking-[-.012em] text-[#1d1d1f]">{step.title}</h2>
          <StepStill frame={frame} step={step} />
          <div className="mt-1">
            <SectionLabel>Decision</SectionLabel>
            <p className="mt-1 text-[14.5px] leading-[1.45] text-[#1d1d1f]">{step.decision}</p>
            <p className="mt-0.5 font-mono text-[12px] text-[#6e6e73]">{"field" in step.action ? `${step.action.field}: ${step.action.from || "empty"} → ${step.action.to}` : step.action.type}</p>
          </div>
          <div className="mt-1">
            <SectionLabel>Reason, in {name}&apos;s words</SectionLabel>
            {step.reason ? (
              <div className="mt-1.5">
                <p className="text-[15px] font-medium leading-[1.45] text-[#1d1d1f]" style={{ textWrap: "pretty" }}>“{step.reason.text}”</p>
                <p className="mt-1 text-[12px] text-[#6e6e73]">{quoteCaption(name, step.reason)}</p>
                {step.reason.translation && <p className="mt-0.5 text-[12px] text-[#6e6e73]">{step.reason.translation}</p>}
                {clip(step.reason.audioId) && <audio className="mt-2 w-full" controls src={clip(step.reason.audioId)} />}
              </div>
            ) : (
              <p className="mt-1 text-[13.5px] text-[#6e6e73]">{step.judgment ? "Not yet explained — the debrief will ask" : "Routine step."}</p>
            )}
          </div>
          <div className="mt-1 flex flex-col gap-2">
            <SectionLabel>Guardrails</SectionLabel>
            {step.guardrails.length === 0 && <p className="text-[13.5px] text-[#6e6e73]">None captured for this step.</p>}
            {step.guardrails.map((g) => (
              <GuardrailCard
                key={g.id}
                kind={g.kind}
                text={g.text}
                evidence={g.quote ? evidenceBadge(g.quote) : undefined}
                quote={g.quote ? { text: g.quote.text, speaker: name, source: quoteSourceLabel(g.quote.source), t: g.quote.t, audioSrc: clip(g.quote.audioId) } : undefined}
              />
            ))}
          </div>
          {rule && (
            <div
              className="mt-1 rounded-[18px] p-3.5"
              style={{ background: "linear-gradient(180deg,rgba(255,250,238,.9),rgba(255,244,222,.6))", boxShadow: "inset 0 1px 0 #fff, inset 0 0 0 .5px rgba(200,120,0,.18)" }}
            >
              <p className="text-[12px] font-semibold text-[#a35f00]">Rule the tutor will run</p>
              <p className="mt-1 text-[14.5px] font-semibold text-[#1d1d1f]">{rule.title}</p>
              <p className="mt-1 text-[13px] leading-[1.45] text-[#3a3a3c]">
                When {describeCond(rule.when)}
                {rule.unless ? `, unless ${describeCond(rule.unless)}` : ""} → {describeAct(rule.then)}
              </p>
              {rule.stopAndAsk && (
                <p className="mt-1 text-[13px] leading-[1.45] text-[#c9342f]">
                  Stop and ask {rule.stopAndAsk.who ? rule.stopAndAsk.who : "— who to ask is still open"} when {describeCond(rule.stopAndAsk.when)}
                </p>
              )}
              <p className="mt-2 flex flex-wrap gap-1">
                {dedupeConfirmedBy(rule.confirmedBy).map((c) => (
                  <Pill key={c}>confirmed by {c}</Pill>
                ))}
              </p>
              {low && <p className="mt-2 text-[13px] text-[#6e6e73]">{low}</p>}
            </div>
          )}
        </article>
      ) : (
        <p className="text-[14px] text-[#6e6e73]">No steps compiled yet.</p>
      )}

      {matrix && matrix.length > 0 && (
        <table className="w-full text-[13px]">
          <thead>
            <tr className="text-left text-[12px] text-[#6e6e73]">
              {["Reason", "Trigger rule", "Replay-verified", "Limit", "Who", "Confirmed"].map((h) => <th key={h} className="px-2 py-1.5 font-semibold">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {matrix.map((row) => (
              <tr key={row.stepId}>
                {row.cells.map((cell) => (
                  <td key={cell.key} className="px-2 py-1.5">
                    <button type="button" className="cursor-pointer underline" onClick={() => onSelect?.(row.stepId)}>{cell.word}</button>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {map.notes.length > 0 && (
        <section className="flex flex-col gap-2" style={{ borderTop: ".5px solid rgba(0,0,0,.08)", paddingTop: 14 }}>
          <SectionLabel>Cases described, not demonstrated</SectionLabel>
          {map.notes.map((n) => (
            <div key={n.topic}>
              <p className="text-[13px] text-[#6e6e73]">{n.question}</p>
              <QuoteCard text={n.quote.text} speaker={name} source="debrief" evidence="described" t={n.quote.t} />
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

/** Rail + detail together (self-contained selection unless `selectedStepId` controls it). */
export function WorkMapView({
  map,
  frames,
  sessionId,
  onChange,
  editable,
  matrix,
  selectedStepId,
  onSelectStep,
}: {
  map: WorkMap;
  frames: Frame[];
  sessionId: string;
  onChange: (m: WorkMap) => void;
  editable: boolean;
  matrix?: Matrix;
  selectedStepId?: string | null;
  onSelectStep?: (id: string) => void;
  removeStep?: (id: string) => void;
  removeQuote?: (stepId: string) => void;
  removeGuardrail?: (stepId: string, id: string) => void;
}) {
  void onChange;
  void editable;
  const steps = useMemo(() => sortedSteps(map), [map]);
  const [own, setOwn] = useState<string | null>(steps.find((s) => s.judgment)?.id ?? steps[0]?.id ?? null);
  const selectedId = selectedStepId ?? own;
  const select = (id: string) => (onSelectStep ? onSelectStep(id) : setOwn(id));
  const step = steps.find((s) => s.id === selectedId) ?? steps[0];
  return (
    <div className="grid gap-6 md:grid-cols-[280px_minmax(0,1fr)]">
      <WorkMapRail map={map} selectedId={step?.id ?? null} onSelect={select} />
      <WorkMapDetail map={map} frames={frames} sessionId={sessionId} step={step} matrix={matrix} onSelect={select} />
    </div>
  );
}
