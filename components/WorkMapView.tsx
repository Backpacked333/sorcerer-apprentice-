"use client";

import { useMemo, useState } from "react";
import type { Frame } from "@/lib/events";
import { describeAct, describeCond, type Rule, type Step, type WorkMap } from "@/lib/workmap";
import { dedupeConfirmedBy, frameSrc } from "@/lib/ui/mapview";
import { FrameThumb } from "@/components/ui/FrameThumb";

/**
 * The clickable timeline: every step shows the screen moment, the decision, the reason in the expert's words
 * and the guardrails around it. The expert can delete anything before confirming.
 */
export function WorkMapView({ map, frames, sessionId, onChange, editable, matrix }: { map: WorkMap; frames: Frame[]; sessionId: string; onChange: (m: WorkMap) => void; editable: boolean; matrix?: { stepId: string; cells: { key: string; word: string }[] }[] | null }) {
  const steps = useMemo(() => [...map.steps].sort((a, b) => a.index - b.index), [map.steps]);
  const [selectedId, setSelectedId] = useState<string | null>(steps.find((s) => s.judgment)?.id ?? steps[0]?.id ?? null);
  const selected = steps.find((s) => s.id === selectedId) ?? steps[0];
  const frameOf = (s?: Step) => (s?.screenMoment.frameId ? frames.find((f) => f.id === s.screenMoment.frameId) : undefined);
  const ruleOf = (s?: Step): Rule | undefined => (s ? map.rules.find((r) => r.stepId === s.id) : undefined);

  const deleteStep = (id: string) => {
    const next = { ...map, steps: map.steps.filter((s) => s.id !== id).map((s, i) => ({ ...s, index: i })), rules: map.rules.filter((r) => r.stepId !== id), slots: map.slots.filter((s) => s.stepId !== id) };
    onChange(next);
    setSelectedId(null);
  };
  const deleteQuote = (stepId: string) => {
    const next = { ...map, steps: map.steps.map((s) => (s.id === stepId ? { ...s, reason: undefined } : s)) };
    onChange(next);
  };
  const deleteGuardrail = (stepId: string, grId: string) => {
    const next = { ...map, steps: map.steps.map((s) => (s.id === stepId ? { ...s, guardrails: s.guardrails.filter((g) => g.id !== grId) } : s)) };
    onChange(next);
  };

  const frame = frameOf(selected);
  const src = frameSrc(frame);
  const rule = ruleOf(selected);
  const explanations = steps.filter((s) => s.reason?.text).length;
  const guardrails = steps.reduce((n, s) => n + s.guardrails.length, 0);
  const followUps = map.slots.filter((s) => s.status === "open").length;

  return (
    <div className="grid min-w-0 gap-5 xl:grid-cols-[280px_minmax(0,1fr)]">
      <header className="panel flex flex-wrap items-start justify-between gap-5 p-6 xl:col-span-2">
        <div className="min-w-0">
          <p className="panel-title">Work Map · knowledge from {map.expert.name}</p>
          <h2 className="mt-2 break-words text-2xl font-medium tracking-tight">{map.task}</h2>
          <p className="mt-2 text-sm text-muted">Explore a decision. Understand the why. Know its boundaries.</p>
        </div>
        <div className="space-y-2 text-sm">
          <p className={map.confirmedAt ? "text-green" : "text-amber"}>{map.confirmedAt ? "Expert-confirmed map" : "Draft · awaiting expert confirmation"}</p>
          <p className="text-muted">{steps.length} recorded step{steps.length === 1 ? "" : "s"} · {explanations} explanation{explanations === 1 ? "" : "s"}</p>
          <p className="text-muted">{guardrails} guardrail{guardrails === 1 ? "" : "s"} · {followUps} open follow-up{followUps === 1 ? "" : "s"}</p>
        </div>
      </header>
      <nav aria-label="Work Map decisions" className="panel min-w-0 self-start p-3">
        <p className="panel-title px-1">Explore the decisions</p>
        <ol className="mt-2 space-y-1">
          {steps.map((s) => (
            <li key={s.id}>
              <button type="button" aria-current={selected?.id === s.id ? "step" : undefined} className={`flex w-full items-start gap-2 rounded-lg px-3 py-3 text-left text-sm hover:bg-panel-2 ${selected?.id === s.id ? "bg-panel-2 outline outline-1 outline-amber/60" : ""}`} onClick={() => setSelectedId(s.id)}>
                <span className="mono w-6 shrink-0 text-sm text-muted">{s.index + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="block break-words">{s.title}</span>
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
      </nav>

      {selected ? (
        <div className="min-w-0 space-y-5 break-words" id={`step-${selected.id}`}>
          <div className="grid gap-5 min-[1600px]:grid-cols-2">
            <div className="panel min-w-0 p-6">
              <p className="panel-title">Decision</p>
              <h3 className="mt-2 text-xl font-medium">{selected.decision}</h3>
              <p className="mt-2 text-sm text-muted">{"field" in selected.action ? `${selected.action.field}: ${selected.action.from || "empty"} → ${selected.action.to}` : selected.action.type}</p>
              <p className="panel-title mt-6">Reason, in {map.expert.name}&apos;s words</p>
              {selected.reason ? (
                <blockquote className="mt-3 border-l-2 border-amber pl-4 text-base leading-relaxed">
                  “{selected.reason.text}”
                  {selected.reason.translation && <p className="mt-2 text-sm text-muted">{selected.reason.translation}</p>}
                  <span className="mt-3 block text-sm text-muted">
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
            <div className="panel min-w-0 p-6">
              <p className="panel-title">Guardrails</p>
              <p className="mt-1 text-sm text-muted">Where the approach changes, and when to ask.</p>
              {selected.guardrails.length === 0 && <p className="mt-2 text-sm text-muted">None captured for this step.</p>}
              <ul className="mt-2 space-y-2 text-sm">
                {selected.guardrails.map((g) => (
                  <li key={g.id} className="rounded border border-line p-2">
                    <span className={`tag ${g.kind === "escalation" ? "tag-red" : g.kind === "limit" ? "tag-amber" : "tag-blue"}`}>{g.kind}</span>
                    {g.quote?.source === "debrief" && <span className="tag ml-1">described by the expert; not directly demonstrated</span>}
                    {g.quote?.source === "counterfactual" && <span className="tag ml-1">answered as a what-if</span>}
                    <p className="mt-2">{g.text}</p>
                    {g.quote?.text ? <blockquote className="mt-3 border-l-2 border-line pl-3">
                      “{g.quote.text}”
                      <span className="mt-2 block text-sm text-muted">{map.expert.name} · {g.quote.source} · {g.quote.t.toFixed(0)}s</span>
                    </blockquote> : <p className="mt-2 text-sm text-muted">No expert quote attached.</p>}
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
                  <p className="panel-title">Learned rule</p>
                  <p className="mt-1 font-medium">{rule.title}</p>
                  <p className="mt-1 text-muted">
                    when {describeCond(rule.when)}
                    {rule.unless ? `, unless ${describeCond(rule.unless)}` : ""} → {describeAct(rule.then)}
                  </p>
                  {rule.stopAndAsk && <p className="mt-1 text-red">stop and ask {rule.stopAndAsk.who || "— who to ask is still open"} when {describeCond(rule.stopAndAsk.when)}</p>}
                  <p className="mt-2 flex flex-wrap gap-1">
                    <span className="tag">{rule.quotes.length} supporting quote{rule.quotes.length === 1 ? "" : "s"}</span>
                    {dedupeConfirmedBy(rule.confirmedBy).map((c) => (
                      <span key={c} className="tag">confirmed by {c}</span>
                    ))}
                  </p>
                </div>
              )}
            </div>
          </div>
          <div className="panel overflow-hidden">
            <div className="border-b border-line px-6 py-4"><p className="panel-title">The screen moment</p><p className="mt-1 text-sm text-muted">Evidence attached to this decision, not a live screen.</p></div>
            {src ? (
              <FrameThumb src={src} width={frame?.width} height={frame?.height} t={selected.screenMoment.t} blurred={frame?.piiRegionsBlurred} region={selected.screenMoment.region} size="lg" />
            ) : (
              <div className="flex min-h-32 items-center justify-center p-6 text-sm text-muted">No screen evidence attached to this step.</div>
            )}
            <div className="flex flex-wrap items-center gap-3 border-t border-line px-6 py-4 text-sm text-muted">
              <span>Recorded moment: <span className="mono text-ink">{selected.screenMoment.t.toFixed(1)}s</span> (sampled frame, not video)</span>
              {src && frame && <span>{frame.piiRegionsBlurred} region{frame.piiRegionsBlurred === 1 ? "" : "s"} blurred</span>}
              {editable && <button className="btn btn-danger ml-auto" onClick={() => deleteStep(selected.id)}>delete step</button>}
            </div>
          </div>
        </div>
      ) : (
        <div className="panel flex items-center justify-center p-10 text-muted">No steps compiled yet.</div>
      )}
      {matrix && matrix.length > 0 && (
        <div className="panel overflow-x-auto xl:col-span-2">
          <table className="w-full text-sm">
            <thead>
              <tr className="panel-title text-left">
                {["Reason", "Trigger rule", "Replay-verified", "Limit", "Who", "Confirmed"].map((h) => <th key={h} scope="col" className="px-3 py-2">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {matrix.map((row) => (
                <tr key={row.stepId}>
                  {row.cells.map((cell) => (
                    <td key={cell.key} className="px-3 py-2">
                      <button type="button" className="underline" onClick={() => {
                        setSelectedId(row.stepId);
                        requestAnimationFrame(() => document.getElementById(`step-${row.stepId}`)?.scrollIntoView({ block: "nearest" }));
                      }}>{cell.word}</button>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
