"use client";
// "Ask this role": deterministic retrieval from confirmed memory, no model. Answers are the expert's verbatim words
// (AskEntry.answer), rendered instantly (no fake "thinking" delay), and respect the playhead: an item learned after
// t is "not known yet".
import { useState } from "react";
import { IridescentRim, Orb } from "@/components/glass";
import type { AskEntry, Timeline } from "@/lib/platform/types";
import { KIND, PASTEL, when } from "./meta";

export function AskRole({ asks, empty, timeline, t, playing }: { asks: AskEntry[]; empty: string | null; timeline: Timeline; t: number; playing: boolean }) {
  const [pick, setPick] = useState<string | null>(null);
  const a = asks.find((x) => x.id === pick) ?? null;

  let body: React.ReactNode = null;
  if (a) {
    if (a.learnedAt > t) {
      body = (
        <>
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5, color: "#3a3a3c" }}>Not known as of {when(timeline, t)}.</p>
          <p style={{ margin: "6px 0 0", fontSize: 12.5, color: "#8e8e93" }}>No confirmed memory yet · learned {when(timeline, a.learnedAt, a.approx)}</p>
        </>
      );
    } else if (a.early && t < a.early.until) {
      body = (
        <>
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5 }}>“{a.early.answer}”</p>
          <p style={{ margin: "6px 0 0", fontSize: 12.5, color: "#a35f00" }}>{a.early.note}</p>
        </>
      );
    } else {
      const k = KIND[a.kind];
      body = (
        <>
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5 }}>“{a.answer}”</p>
          <p style={{ margin: "8px 0 0", fontSize: 12.5, color: "#6e6e73", display: "flex", alignItems: "center", gap: 6 }}>
            <span aria-hidden style={{ width: 7, height: 7, borderRadius: 4, background: k.color, flex: "none" }} />
            {a.source} · {when(timeline, a.learnedAt, a.approx)}
          </p>
        </>
      );
    }
  }

  return (
    <section aria-label="Ask this role" style={card}>
      <IridescentRim radius={28} colors={PASTEL} opacity={a ? 0.9 : 0.55} speed={14} />
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Orb mood={playing ? "reading" : a ? "understood" : "quiet"} size={34} follow={false} />
        <div>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Ask this role</h2>
          <div style={{ fontSize: 12.5, color: "#6e6e73" }}>Answers only from confirmed memory, as of {when(timeline, t)}</div>
        </div>
      </div>
      {asks.length === 0 ? (
        <p style={{ margin: "14px 0 0", fontSize: 13.5, color: "#6e6e73" }}>{empty ?? "Nothing confirmed to answer from yet."}</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 14 }}>
          {asks.slice(0, 6).map((q) => (
            <button
              key={q.id}
              type="button"
              aria-pressed={pick === q.id}
              onClick={() => setPick((p) => (p === q.id ? null : q.id))}
              className="hover:translate-x-[2px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgba(245,166,35,.75)]"
              style={{ minHeight: 38, padding: "8px 14px", borderRadius: 17, border: 0, textAlign: "left", font: "inherit", fontSize: 13.5, color: "#1d1d1f", cursor: "pointer", background: pick === q.id ? "#fff" : "rgba(255,255,255,.7)", boxShadow: pick === q.id ? "0 0 0 1.5px rgba(143,123,255,.45),0 2px 8px rgba(0,0,0,.06)" : "inset 0 0 0 .5px rgba(0,0,0,.08)", transition: "translate .2s, background .2s, box-shadow .2s" }}
            >
              {q.question}
            </button>
          ))}
        </div>
      )}
      {a ? (
        <div key={`${a.id}-${a.learnedAt > t ? "u" : a.early && t < a.early.until ? "e" : "k"}`} aria-live="polite" style={{ marginTop: 12, padding: 14, borderRadius: 18, background: "rgba(255,255,255,.85)", boxShadow: "inset 0 0 0 .5px rgba(0,0,0,.06)", animation: "tc-rise .55s var(--ease-rise) both" }}>
          {body}
        </div>
      ) : null}
    </section>
  );
}

const card: React.CSSProperties = {
  position: "relative",
  padding: 20,
  borderRadius: 28,
  background: "linear-gradient(180deg,rgba(255,255,255,.84),rgba(255,255,255,.6))",
  boxShadow: "inset 0 1px 0 #fff,0 0 0 .5px rgba(0,0,0,.07),0 12px 34px rgba(15,23,42,.08)",
};
