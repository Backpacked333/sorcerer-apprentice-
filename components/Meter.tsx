"use client";

import type { Decision } from "@/lib/governor";

/** The governor, made visible: four lights and one word. Judges asked "when to ask"; this is the answer on screen. */
export function Meter({ decision, questions, budget }: { decision?: Decision; questions: number; budget: number }) {
  const l = decision?.lights;
  const state = decision?.state ?? "listening";
  const label = state === "asking" ? "asking" : state === "answering" ? "listening to the answer" : state === "waiting" ? "pause detected" : "listening";
  const color = state === "asking" ? "light-amber" : state === "answering" ? "light-amber" : state === "waiting" ? "light-on" : "light-off";
  return (
    <div className="panel p-4">
      <div className="flex items-center justify-between">
        <p className="panel-title">Governor</p>
        <span className="mono text-xs text-muted">
          {questions}/{budget} questions · 10 min
        </span>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <span className={`light ${color} ${state === "asking" ? "pulse" : ""}`} />
        <span className="text-sm">{label}</span>
      </div>
      <div className="mt-3 grid grid-cols-5 gap-2 text-[11px] text-muted">
        <Light on={!!l?.silence} label="not talking" />
        <Light on={!!l?.still} label="still screen" />
        <Light on={!!l?.notTyping} label="not typing" />
        <Light on={!!l?.notReading} label="not reading" />
        <Light on={!!l?.budget} label="budget" />
      </div>
      {decision?.reasons.length ? <p className="mt-2 text-xs text-muted">waiting: {decision.reasons.join(", ")}</p> : null}
      {decision?.boundaryBonus ? <p className="mt-1 text-xs text-green">step boundary: preferred pause</p> : null}
    </div>
  );
}

function Light({ on, label }: { on: boolean; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={`light ${on ? "light-on" : "light-red"}`} />
      <span>{label}</span>
    </div>
  );
}
