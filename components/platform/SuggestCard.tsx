"use client";
// "Tacit suggests": real, actionable items in real mode (derived from sessions); fictional ones in demo mode.
// Dismiss only hides an item for this view; nothing is written.
import Link from "next/link";
import { useState } from "react";
import { IridescentRim, Orb } from "@/components/glass";
import type { Suggestion } from "@/lib/platform/types";
import { PASTEL } from "./meta";

const TONE: Record<Suggestion["tone"], string> = { amber: "#f5a623", violet: "#8f7bff", green: "#22b45e", red: "#e5484d", blue: "#3b82f6" };

export function SuggestCard({ items, onFocusRole, defaultOpen = true }: { items: Suggestion[]; onFocusRole?: (id: string) => void; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const [hidden, setHidden] = useState<Record<string, true>>({});
  const list = items.filter((s) => !hidden[s.id]);

  if (!open) {
    return (
      <button
        type="button"
        data-panel=""
        onClick={() => setOpen(true)}
        className="glass-nav cursor-pointer active:scale-[.97]"
        style={{ display: "inline-flex", alignItems: "center", gap: 9, height: 44, padding: "0 14px 0 8px", borderRadius: 22, border: 0, fontSize: 14, fontWeight: 600, color: "#1d1d1f", transition: "scale .25s var(--ease-press)" }}
      >
        <Orb mood={list.length ? "asking" : "quiet"} size={30} follow={false} />
        Tacit suggests
        {list.length ? (
          <span style={{ minWidth: 20, height: 20, padding: "0 6px", borderRadius: 10, background: "#8f7bff", color: "#fff", fontSize: 11.5, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{list.length}</span>
        ) : null}
      </button>
    );
  }

  return (
    <section
      data-panel=""
      data-scroll=""
      aria-label="Tacit suggests"
      style={{
        position: "relative",
        width: 300,
        maxWidth: "100%",
        maxHeight: "100%",
        overflowY: "auto",
        boxSizing: "border-box",
        padding: 14,
        borderRadius: 24,
        background: "linear-gradient(180deg,rgba(255,255,255,.88),rgba(255,255,255,.66))",
        backdropFilter: "blur(24px) saturate(1.8)",
        WebkitBackdropFilter: "blur(24px) saturate(1.8)",
        boxShadow: "inset 0 1px 0 #fff,0 0 0 .5px rgba(0,0,0,.07),0 12px 34px rgba(15,23,42,.08)",
        animation: "tc-rise .4s var(--ease-rise) both",
      }}
    >
      <IridescentRim radius={24} colors={PASTEL} opacity={0.7} />
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Orb mood={list.length ? "asking" : "quiet"} size={30} follow={false} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14.5, fontWeight: 600 }}>Tacit suggests</div>
          <div style={{ fontSize: 12, color: "#6e6e73" }}>From the sessions so far</div>
        </div>
        <button type="button" onClick={() => setOpen(false)} aria-label="Collapse suggestions" style={{ width: 28, height: 28, borderRadius: 14, border: 0, background: "transparent", color: "#8e8e93", cursor: "pointer", fontSize: 13 }}>
          ✕
        </button>
      </div>
      {list.length === 0 ? (
        <p style={{ margin: "12px 2px 2px", fontSize: 13, color: "#6e6e73", lineHeight: 1.45 }}>All caught up. New suggestions appear after each session.</p>
      ) : (
        list.slice(0, 3).map((s, i) => (
          <div key={s.id} style={{ marginTop: 10, padding: 12, borderRadius: 18, background: "rgba(255,255,255,.8)", boxShadow: "inset 0 0 0 .5px rgba(0,0,0,.06)", animation: `tc-rise .4s var(--ease-rise) ${i * 0.06}s both` }}>
            <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
              <span aria-hidden style={{ width: 7, height: 7, borderRadius: 4, marginTop: 7, flex: "none", background: TONE[s.tone] }} />
              <span style={{ fontSize: 13.5, lineHeight: 1.45, color: "#1d1d1f" }}>{s.text}</span>
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 9, paddingLeft: 15 }}>
              {s.action ? (
                s.action.href ? (
                  <Link href={s.action.href} style={pill(true)}>{s.action.label}</Link>
                ) : (
                  <button type="button" onClick={() => { if (s.roleId) onFocusRole?.(s.roleId); setHidden((h) => ({ ...h, [s.id]: true })); }} style={pill(true)}>
                    {s.action.label}
                  </button>
                )
              ) : null}
              {s.roleId && onFocusRole ? (
                <button type="button" onClick={() => onFocusRole(s.roleId!)} style={pill(false)}>Show</button>
              ) : null}
              <button type="button" onClick={() => setHidden((h) => ({ ...h, [s.id]: true }))} style={pill(false)}>Dismiss</button>
            </div>
          </div>
        ))
      )}
    </section>
  );
}

function pill(primary: boolean): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    height: 30,
    padding: "0 12px",
    borderRadius: 15,
    border: 0,
    cursor: "pointer",
    font: "inherit",
    fontSize: 12.5,
    fontWeight: 600,
    whiteSpace: "nowrap",
    textDecoration: "none",
    color: primary ? "#0d4a2b" : "#3a3a3c",
    background: primary ? "linear-gradient(180deg,rgba(190,245,212,.9),rgba(120,220,166,.6))" : "rgba(0,0,0,.05)",
  };
}
