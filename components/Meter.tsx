"use client";

import type { Decision } from "@/lib/governor";

/** The governor, made visible: five lights and one word. Judges asked "when to ask"; this is the answer on screen. */
export function Meter({ decision, questions, budget }: { decision?: Decision; questions: number; budget: number }) {
  const l = decision?.lights;
  const state = decision?.state ?? "listening";
  const label = state === "asking" ? "asking" : state === "answering" ? "listening to the answer" : state === "waiting" ? "pause detected" : "listening";
  const dot = state === "asking" || state === "answering" ? "#f5a623" : state === "waiting" ? "#22b45e" : "#aeaeb2";
  return (
    <section style={{ padding: "12px 14px", borderRadius: 18, background: "rgba(255,255,255,.62)", boxShadow: "inset 0 0 0 .5px rgba(0,0,0,.07), inset 0 1px 0 #fff" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: "#1d1d1f" }}>Governor</p>
        <span style={{ font: "11.5px ui-monospace,Menlo,monospace", color: "#8e8e93", fontVariantNumeric: "tabular-nums" }}>
          {questions}/{budget} questions · 10 min
        </span>
      </div>
      <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8 }}>
        <span aria-hidden style={{ width: 9, height: 9, borderRadius: "50%", background: dot, boxShadow: `0 0 8px ${dot}`, transition: "background-color .4s, box-shadow .4s" }} />
        <span style={{ fontSize: 14, color: "#1d1d1f" }}>{label}</span>
      </div>
      <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(92px,1fr))", gap: "6px 10px", fontSize: 12, color: "#6e6e73" }}>
        <Light on={!!l?.silence} label="not talking" />
        <Light on={!!l?.still} label="still screen" />
        <Light on={!!l?.notTyping} label="not typing" />
        <Light on={!!l?.notReading} label="not reading" />
        <Light on={!!l?.budget} label="budget" />
      </div>
      {decision?.reasons.length ? <p style={{ marginTop: 8, fontSize: 12, color: "#6e6e73" }}>waiting: {decision.reasons.join(", ")}</p> : null}
      {decision?.boundaryBonus ? <p style={{ marginTop: 4, fontSize: 12, color: "#1b8a4b" }}>step boundary: preferred pause</p> : null}
    </section>
  );
}

function Light({ on, label }: { on: boolean; label: string }) {
  // A light that is off is a reason not to ask, not an error: amber, never red.
  const c = on ? "#22b45e" : "#f5a623";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span aria-hidden style={{ width: 7, height: 7, borderRadius: "50%", flex: "none", background: c, boxShadow: on ? `0 0 6px ${c}` : "none", transition: "background-color .4s, box-shadow .4s" }} />
      <span>{label}</span>
    </div>
  );
}
