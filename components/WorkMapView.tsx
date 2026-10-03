"use client";

import { useMemo, useState } from "react";
import type { Frame } from "@/lib/events";
import { describeAct, describeCond, type Rule, type Step, type WorkMap } from "@/lib/workmap";

/**
 * The clickable timeline: every step shows the screen moment, the decision, the reason in the expert's words
 * and the guardrails around it. The expert can delete anything before confirming.
 */
export function WorkMapView({ map, frames, sessionId, onChange, editable }: { map: WorkMap; frames: Frame[]; sessionId: string; onChange: (m: WorkMap) => void; editable: boolean }) {
  const steps = useMemo(() => [...map.steps].sort((a, b) => a.index - b.index), [map.steps]);
  const [selectedId, setSelectedId] = useState<string | null>(steps.find((s) => s.judgment)?.id ?? steps[0]?.id ?? null);
  const selected = steps.find((s) => s.id === selectedId) ?? steps[0];
  const frameOf = (s?: Step) => (s?.screenMoment.frameId ? frames.find((f) => f.id === s.screenMoment.frameId) : undefined);
  const ruleOf = (s?: Step): Rule | undefined => (s ? map.rules.find((r) => r.stepId === s.id) : undefined);

  const save = async (next: WorkMap) => {
    onChange(next);
    await fetch(`/api/sessions/${sessionId}/map`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(next) });
  };
  const deleteStep = (id: string) => {
    const next = { ...map, steps: map.steps.filter((s) => s.id !== id).map((s, i) => ({ ...s, index: i })), rules: map.rules.filter((r) => r.stepId !== id), slots: map.slots.filter((s) => s.stepId !== id) };
    void save(next);
    setSelectedId(null);
  };
  const deleteQuote = (stepId: string) => {
    const next = { ...map, steps: map.steps.map((s) => (s.id === stepId ? { ...s, reason: undefined } : s)) };
    void save(next);
  };
  const deleteGuardrail = (stepId: string, grId: string) => {
    const next = { ...map, steps: map.steps.map((s) => (s.id === stepId ? { ...s, guardrails: s.guardrails.filter((g) => g.id !== grId) } : s)) };
    void save(next);
  };

  const frame = frameOf(selected);
  const rule = ruleOf(selected);

  return (
    <div className="grid gap-4 xl:grid-cols-[300px_1fr]">
      <div className="panel p-3">
        <p className="panel-title px-1">Work Map · {steps.length} steps</p>
        <ol className="mt-2 space-y-1">
          {steps.map((s) => (
            <li key={s.id}>
              <button className={`flex w-full items-start gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-panel-2 ${selected?.id === s.id ? "bg-panel-2 outline outline-1 outline-amber/60" : ""}`} onClick={() => setSelectedId(s.id)}>
                <span className="mono w-6 shrink-0 text-xs text-muted">{s.index + 1}</span>
                <span className="flex-1">
                  <span className="block">{s.title}</span>
                  <span className="mt-0.5 flex flex-wrap gap-1">
                    {s.judgment && <span className="tag tag-amber">judgment</span>}
                    {s.guardrails.length > 0 && <span className="tag">{s.guardrails.length} guardrail{s.guardrails.length > 1 ? "s" : ""}</span>}
                    {s.reason && <span className={`tag ${s.reason.source === "narration" ? "tag-blue" : "tag-green"}`}>{s.reason.source}</span>}
                  </span>
                </span>
                <span className="mono text-xs text-muted">{s.screenMoment.t.toFixed(0)}s</span>
              </button>
            </li>
          ))}
        </ol>
      </div>

      {selected ? (
        <div className="space-y-4">
          <div className="panel overflow-hidden">
            {frame ? (
              <img src={frame.dataUrl} alt={`screen moment at ${selected.screenMoment.t.toFixed(1)}s`} className="w-full" />
            ) : (
              <div className="flex aspect-video items-center justify-center text-sm text-muted">no frame kept for this step</div>
            )}
            <div className="flex items-center gap-3 border-t border-line px-3 py-2 text-xs text-muted">
              <span>captured still at <span className="mono text-ink">{selected.screenMoment.t.toFixed(1)}s</span> (sampled frame, not video)</span>
              {frame && <span>{frame.piiRegionsBlurred} region{frame.piiRegionsBlurred === 1 ? "" : "s"} blurred</span>}
              {editable && (
                <button className="btn btn-danger ml-auto" onClick={() => deleteStep(selected.id)}>
                  delete step
                </button>
              )}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="panel p-4">
              <p className="panel-title">Decision</p>
              <p className="mt-2 text-base">{selected.decision}</p>
              <p className="mt-1 text-xs text-muted">{"field" in selected.action ? `${selected.action.field}: ${selected.action.from || "empty"} → ${selected.action.to}` : selected.action.type}</p>
              <p className="panel-title mt-4">Reason, in {map.expert.name}&apos;s words</p>
              {selected.reason ? (
                <blockquote className="mt-2 border-l-2 border-amber pl-3 text-sm">
                  “{selected.reason.text}”
                  <span className="mt-1 block text-xs text-muted">
                    {selected.reason.source} · {selected.reason.t.toFixed(0)}s
                    {selected.reason.audioId && <audio className="mt-1 block h-8 w-full" controls src={`/api/sessions/${sessionId}/clips?audioId=${selected.reason.audioId}`} />}
                  </span>
                  {editable && (
                    <button className="btn mt-2 text-xs" onClick={() => deleteQuote(selected.id)}>
                      remove quote
                    </button>
                  )}
                </blockquote>
              ) : (
                <p className="mt-2 text-sm text-muted">{selected.judgment ? "Not yet explained. The debrief will ask." : "Routine step, no reason needed."}</p>
              )}
            </div>
            <div className="panel p-4">
              <p className="panel-title">Guardrails</p>
              {selected.guardrails.length === 0 && <p className="mt-2 text-sm text-muted">None captured for this step.</p>}
              <ul className="mt-2 space-y-2 text-sm">
                {selected.guardrails.map((g) => (
                  <li key={g.id} className="rounded border border-line p-2">
                    <span className={`tag ${g.kind === "escalation" ? "tag-red" : g.kind === "limit" ? "tag-amber" : "tag-blue"}`}>{g.kind}</span>
                    {g.quote?.source === "debrief" && <span className="tag ml-1">described by the expert; not directly demonstrated</span>}
                    {g.quote?.source === "counterfactual" && <span className="tag ml-1">answered as a what-if</span>}
                    <p className="mt-1">“{g.text}”</p>
                    {g.quote?.audioId && <audio className="mt-1 block h-8 w-full" controls src={`/api/sessions/${sessionId}/clips?audioId=${g.quote.audioId}`} />}
                    {editable && (
                      <button className="btn mt-1 text-xs" onClick={() => deleteGuardrail(selected.id, g.id)}>
                        remove
                      </button>
                    )}
                  </li>
                ))}
              </ul>
              {rule && (
                <div className="mt-4 rounded border border-amber/40 bg-panel-2 p-3 text-sm">
                  <p className="panel-title">Rule the tutor will run</p>
                  <p className="mt-1 font-medium">{rule.title}</p>
                  <p className="mt-1 text-muted">
                    when {describeCond(rule.when)}
                    {rule.unless ? `, unless ${describeCond(rule.unless)}` : ""} → {describeAct(rule.then)}
                  </p>
                  {rule.stopAndAsk && <p className="mt-1 text-red">stop and ask {rule.stopAndAsk.who} when {describeCond(rule.stopAndAsk.when)}</p>}
                  <p className="mt-2 flex flex-wrap gap-1">
                    <span className={`tag ${rule.confidence === "high" ? "tag-green" : rule.confidence === "medium" ? "tag-amber" : "tag-red"}`}>{rule.confidence} confidence</span>
                    {rule.confirmedBy.map((c) => (
                      <span key={c} className="tag">confirmed by {c}</span>
                    ))}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="panel flex items-center justify-center p-10 text-muted">No steps compiled yet.</div>
      )}
      {map.notes.length > 0 && (
        <div className="panel p-4 xl:col-span-2">
          <p className="panel-title">Cases described by the expert, not demonstrated</p>
          <ul className="mt-2 space-y-2 text-sm">
            {map.notes.map((n) => (
              <li key={n.topic}>
                <span className="text-muted">{n.question}</span>
                <blockquote className="mt-1 border-l-2 border-line pl-3">“{n.quote.text}”</blockquote>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
