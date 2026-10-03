"use client";

import type { Decision } from "@/lib/governor";
import { Presence } from "./ui/Presence";

export function Meter({ decision, questions, budget }: { decision?: Decision; questions: number; budget: number }) {
  const l = decision?.lights;
  const state = decision?.state;
  const label = state === "asking" ? "A question is open" : state === "answering" ? "Your turn" : state === "waiting" ? "A quiet moment" : state === "listening" ? "At your pace" : "Waiting for observation state";
  return (
    <div className="panel p-4">
      <div className="flex items-center gap-3" role="status" aria-live="polite" aria-atomic="true">
        <Presence state={state} />
        <div><p className="text-sm font-medium">{label}</p><p className="mt-0.5 text-sm text-muted">{state === "answering" ? "An answer window is open." : "A little space to think."}</p></div>
      </div>
      <details className="mt-4 border-t border-line pt-3 text-sm text-muted">
        <summary>Governor <span className="text-muted">· timing details</span></summary>
        <p className="mono mt-3">{questions}/{budget} questions · 10 min</p>
        {l ? <dl className="mt-3 space-y-1">
          <Signal on={l.silence} label="Silence window" />
          <Signal on={l.still} label="Still screen" />
          <Signal on={l.notTyping} label="Typing pause" />
          <Signal on={l.notReading} label="Reading pause" />
          <Signal on={l.budget} label="Question budget" />
        </dl> : <p className="mt-2">No timing information yet.</p>}
        {decision?.reasons.length ? <p className="mt-3">Waiting: {decision.reasons.join(", ")}</p> : null}
        {decision?.boundaryBonus ? <p className="mt-2">Step boundary: preferred pause</p> : null}
      </details>
    </div>
  );
}

function Signal({ on, label }: { on: boolean; label: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt>{label}</dt><dd>{on ? "Ready" : "Waiting"}</dd>
    </div>
  );
}
