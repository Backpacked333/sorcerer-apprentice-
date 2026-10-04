"use client";

import { useMemo, useState } from "react";
import type { Frame } from "@/lib/events";
import { describeAct, describeCond, type Rule, type Step, type WorkMap } from "@/lib/workmap";
import { dedupeConfirmedBy, evidenceBadge, frameSrc, headlineCounts, lowConfidenceLine, quoteSourceLabel } from "@/lib/ui/mapview";
import { FrameThumb } from "@/components/ui/FrameThumb";
import { GuardrailCard } from "@/components/ui/GuardrailCard";
import { QuoteCard } from "@/components/ui/QuoteCard";

export function WorkMapView({
  map,
  frames,
  sessionId,
  onChange,
  editable,
  matrix,
}: {
  map: WorkMap;
  frames: Frame[];
  sessionId: string;
  onChange: (m: WorkMap) => void;
  editable: boolean;
  matrix?: { stepId: string; cells: { key: string; word: string }[] }[] | null;
  removeStep?: (id: string) => void;
  removeQuote?: (stepId: string) => void;
  removeGuardrail?: (stepId: string, id: string) => void;
}) {
  const steps = useMemo(() => [...map.steps].sort((a, b) => a.index - b.index), [map.steps]);
  const [selectedId, setSelectedId] = useState<string | null>(steps.find((s) => s.judgment)?.id ?? steps[0]?.id ?? null);
  const selected = steps.find((s) => s.id === selectedId) ?? steps[0];
  const frameOf = (s?: Step) => (s?.screenMoment.frameId ? frames.find((f) => f.id === s.screenMoment.frameId) : undefined);
  const ruleOf = (s?: Step): Rule | undefined => (s ? map.rules.find((r) => r.stepId === s.id) : undefined);
  void onChange;
  void editable;
  const frame = frameOf(selected);
  const rule = ruleOf(selected);
  const low = lowConfidenceLine(rule?.confidence ?? selected?.confidence);

  return (
    <div className="space-y-4">
      <p className="t-small text-muted">{headlineCounts({ steps: map.steps })}</p>
      <div className="timeline">
        {steps.map((s) => (
          <button key={s.id} type="button" className={`timeline-node ${selected?.id === s.id ? "is-on" : ""}`} onClick={() => setSelectedId(s.id)}>
            <span className="mono">{s.index + 1}</span>
            <span>{s.title}</span>
            {s.judgment && <span className="tag tag-amber">judgment</span>}
            {s.guardrails.length > 0 && <span className="tag">{s.guardrails.length}</span>}
            <FrameThumb src={frameSrc(frameOf(s) as { dataUrl: string; url?: string } | undefined)} t={s.screenMoment.t} size="sm" />
          </button>
        ))}
        {steps.length === 0 && <p className="t-small text-muted">No steps compiled yet.</p>}
      </div>

      {selected && (
        <article className="panel space-y-4 p-4" id={`step-${selected.id}`}>
          <FrameThumb
            src={frameSrc(frame as { dataUrl: string; url?: string } | undefined)}
            t={selected.screenMoment.t}
            blurred={frame?.piiRegionsBlurred}
            region={selected.screenMoment.region}
            size="lg"
          />
          <div>
            <p className="panel-title">Decision</p>
            <p className="mt-2 t-body">{selected.decision}</p>
            <p className="mono t-small text-muted">{"field" in selected.action ? `${selected.action.field}: ${selected.action.from || "empty"} → ${selected.action.to}` : selected.action.type}</p>
          </div>
          <div>
            <p className="panel-title">Reason, in {map.expert.name}&apos;s words</p>
            {selected.reason ? (
              <QuoteCard
                text={selected.reason.text}
                speaker={map.expert.name}
                source={quoteSourceLabel(selected.reason.source)}
                t={selected.reason.t}
                translation={selected.reason.translation}
                audioSrc={selected.reason.audioId ? `/api/sessions/${sessionId}/clips?audioId=${selected.reason.audioId}` : undefined}
              />
            ) : (
              <p className="mt-2 t-small text-muted">{selected.judgment ? "Not yet explained — the debrief will ask" : "Routine step."}</p>
            )}
          </div>
          <div className="space-y-2">
            <p className="panel-title">Guardrails</p>
            {selected.guardrails.length === 0 && <p className="t-small text-muted">None captured for this step.</p>}
            {selected.guardrails.map((g) => (
              <GuardrailCard
                key={g.id}
                kind={g.kind}
                text={g.text}
                evidence={g.quote ? evidenceBadge(g.quote) : undefined}
                quote={g.quote ? {
                  text: g.quote.text,
                  speaker: map.expert.name,
                  source: quoteSourceLabel(g.quote.source),
                  t: g.quote.t,
                  audioSrc: g.quote.audioId ? `/api/sessions/${sessionId}/clips?audioId=${g.quote.audioId}` : undefined,
                } : undefined}
              />
            ))}
          </div>
          {rule && (
            <div className="rounded border border-amber/40 bg-panel-2 p-3">
              <p className="panel-title">Rule the tutor will run</p>
              <p className="mt-1 font-medium">{rule.title}</p>
              <p className="mt-1 t-small text-muted">
                When {describeCond(rule.when)}
                {rule.unless ? `, unless ${describeCond(rule.unless)}` : ""} → {describeAct(rule.then)}
              </p>
              {rule.stopAndAsk && (
                <p className="mt-1 t-small text-red">
                  Stop and ask {rule.stopAndAsk.who ? rule.stopAndAsk.who : "— who to ask is still open"} when {describeCond(rule.stopAndAsk.when)}
                </p>
              )}
              <p className="mt-2 flex flex-wrap gap-1">
                {dedupeConfirmedBy(rule.confirmedBy).map((c) => (
                  <span key={c} className="tag">confirmed by {c}</span>
                ))}
              </p>
              {low && <p className="mt-2 t-small">{low}</p>}
            </div>
          )}
        </article>
      )}

      {matrix && matrix.length > 0 && (
        <table className="panel w-full t-small">
          <thead>
            <tr className="panel-title text-left">
              {["Reason", "Trigger rule", "Replay-verified", "Limit", "Who", "Confirmed"].map((h) => <th key={h} className="px-3 py-2">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {matrix.map((row) => (
              <tr key={row.stepId}>
                {row.cells.map((cell) => (
                  <td key={cell.key} className="px-3 py-2">
                    <button type="button" className="underline" onClick={() => { setSelectedId(row.stepId); document.getElementById(`step-${row.stepId}`)?.scrollIntoView({ behavior: "smooth" }); }}>{cell.word}</button>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {map.notes.length > 0 && (
        <section className="panel p-4">
          <p className="panel-title">Cases described, not demonstrated</p>
          <div className="mt-2 space-y-3">
            {map.notes.map((n) => (
              <div key={n.topic}>
                <p className="t-small text-muted">{n.question}</p>
                <QuoteCard text={n.quote.text} speaker={map.expert.name} source="debrief" evidence="described" t={n.quote.t} />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
