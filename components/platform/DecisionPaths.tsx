"use client";
// Decision paths panel (left): one row per rule, known as of t; clicking traces the rule through the ontology.
import { useState } from "react";
import type { Ontology } from "@/lib/platform/types";
import { KIND, PROV, when } from "./meta";
import { RuleDot } from "./OntologyInspector";

export function DecisionPaths({ ont, t, active, onTrace, defaultOpen = true }: { ont: Ontology; t: number; active: string | null; onTrace: (id: string | null) => void; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const known = ont.rules.filter((r) => r.at <= t).length;
  const head = (
    <button
      type="button"
      onClick={() => setOpen((v) => !v)}
      aria-expanded={open}
      style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", height: 44, padding: "0 14px 0 10px", border: 0, background: "transparent", cursor: "pointer", font: "inherit", color: "#1d1d1f", textAlign: "left", borderRadius: 22 }}
    >
      <span aria-hidden style={{ display: "inline-flex" }}>
        {(["rule", "guardrail", "exception"] as const).map((k, i) => (
          <span key={k} style={{ width: 18, height: 18, borderRadius: 9, marginLeft: i ? -7 : 0, background: KIND[k].color, boxShadow: "0 0 0 2px #fff" }} />
        ))}
      </span>
      <span style={{ fontSize: 14, fontWeight: 600 }}>Decision paths</span>
      <span style={{ fontSize: 13, color: "#8e8e93" }}>{known} of {ont.rules.length} known</span>
      <span aria-hidden style={{ marginLeft: "auto", fontSize: 11, color: "#8e8e93", transform: open ? "rotate(180deg)" : "none", transition: "transform .25s" }}>⌄</span>
    </button>
  );
  const legend: { label: string; border: string; bg?: string }[] = [
    { label: PROV.seen.label.toLowerCase(), border: "1px solid rgba(0,0,0,.18)" },
    { label: PROV.erp.label.toLowerCase(), border: "1px solid rgba(74,100,136,.55)" },
    { label: ont.saidLabel, border: "1.5px solid transparent", bg: "linear-gradient(#fff,#fff) padding-box,conic-gradient(from 200deg,#ffb8d9,#ffe2a8,#b9f0d3,#b5dcff,#d4c6ff,#ffb8d9) border-box" },
    { label: "described only", border: "1.5px dashed rgba(0,0,0,.35)" },
    { label: "confirmed in the teach-back", border: "1.5px dashed rgba(34,180,94,.7)" },
    { label: "inferred", border: "1.5px dashed rgba(143,123,255,.8)" },
  ];
  return (
    <section
      data-panel=""
      aria-label="Decision paths"
      className="glass-nav"
      style={{ width: 276, maxWidth: "100%", borderRadius: open ? 24 : 22, display: "flex", flexDirection: "column", maxHeight: "100%", overflow: "hidden", transition: "border-radius .3s" }}
    >
      {head}
      {open ? (
        <div data-scroll="" style={{ overflowY: "auto", padding: "0 8px 10px", animation: "tc-rise .35s var(--ease-rise) both" }}>
          {ont.rules.length === 0 ? <p style={{ margin: "2px 8px 8px", fontSize: 13, color: "#6e6e73" }}>No rules yet.</p> : null}
          {ont.rules.map((r) => {
            const on = active === r.id;
            const known = r.at <= t;
            return (
              <button
                key={r.id}
                type="button"
                aria-pressed={on}
                onClick={() => onTrace(on ? null : r.id)}
                className="hover:bg-[rgba(255,255,255,.6)]"
                style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "7px 8px", border: 0, borderRadius: 14, cursor: "pointer", font: "inherit", color: "inherit", textAlign: "left", background: on ? "#fff" : "transparent", boxShadow: on ? "0 0 0 1.5px rgba(143,123,255,.5),0 2px 8px rgba(0,0,0,.06)" : "none", opacity: known ? 1 : 0.4, transition: "opacity .4s, background .2s" }}
              >
                <RuleDot rule={r} />
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 13.5, fontWeight: 600, lineHeight: 1.3 }}>{r.title}</span>
                  <span style={{ display: "block", fontSize: 11.5, color: "#8e8e93" }}>{KIND[r.kind].label} · {when(ont.timeline, r.at, r.approx)}</span>
                </span>
              </button>
            );
          })}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 10px", padding: "10px 8px 2px", marginTop: 4, borderTop: ".5px solid rgba(0,0,0,.06)" }}>
            {legend.map((l) => (
              <span key={l.label} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "#6e6e73" }}>
                <span aria-hidden style={{ width: 16, height: 10, borderRadius: 3, border: l.border, background: l.bg ?? "#fff", boxSizing: "border-box" }} />
                {l.label}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
