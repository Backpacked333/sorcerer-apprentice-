"use client";
// Small presentational pieces shared by the demo gallery and the scripted tour. Demo mode only.
import type { CSSProperties, ReactNode } from "react";
import { Eyebrow, Orb } from "@/components/glass";
import type { OrbMood } from "@/lib/ui/moods";

/** Looks like a GlassButton but does nothing: demo cards never pretend to be live controls. */
export function InertButton({ children, tone = "glass", flex = 1 }: { children: ReactNode; tone?: "glass" | "danger" | "amber" | "green"; flex?: number }) {
  const t: Record<string, CSSProperties> = {
    glass: { color: "#1d1d1f", background: "rgba(255,255,255,.5)", boxShadow: "inset 0 0 0 .5px rgba(0,0,0,.07)" },
    danger: { color: "#c9342f", background: "rgba(255,255,255,.5)", boxShadow: "inset 0 0 0 .5px rgba(0,0,0,.07)" },
    amber: { color: "#6b3f00", fontWeight: 600, background: "linear-gradient(180deg,rgba(255,222,160,.75),rgba(255,196,95,.5))", boxShadow: "inset 0 1px 0 rgba(255,255,255,.8),inset 0 0 0 .5px rgba(200,120,0,.18)" },
    green: { color: "#0d4a2b", fontWeight: 600, background: "linear-gradient(180deg,rgba(196,244,216,.9),rgba(140,226,178,.62))", boxShadow: "inset 0 1px 0 rgba(255,255,255,.8),inset 0 0 0 .5px rgba(20,130,70,.2)" },
  };
  return (
    <span aria-hidden tabIndex={-1} style={{ flex, height: 34, borderRadius: 17, display: "grid", placeItems: "center", fontSize: 12.5, fontWeight: 500, whiteSpace: "nowrap", padding: "0 12px", pointerEvents: "none", ...t[tone] }}>
      {children}
    </span>
  );
}

export function CapsuleFooter({ second = "Off the record", primary = "Done" }: { second?: string; primary?: string }) {
  return (
    <div style={{ display: "flex", gap: 6 }}>
      <InertButton>Pause</InertButton>
      <InertButton tone={second === "Off the record" ? "danger" : "glass"} flex={1.25}>{second}</InertButton>
      <InertButton tone="amber" flex={1.15}>{primary}</InertButton>
    </div>
  );
}

/** Ask / teach header: orb · eyebrow + sub · optional badge. */
export function KindHeader({ mood, eyebrow, sub, badge, rippleKey }: { mood: OrbMood; eyebrow: string; sub: string; badge?: string; rippleKey?: string | number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "1px 2px" }}>
      <Orb mood={mood} size={38} rippleKey={rippleKey} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div key={`${eyebrow}|${sub}`} style={{ animation: "tc-rise .55s var(--ease-rise) both" }}>
          <Eyebrow text={eyebrow} mood={mood} />
          <div style={{ fontSize: 12, color: "#6e6e73", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{sub}</div>
        </div>
      </div>
      {badge ? (
        <span style={{ height: 22, padding: "0 9px", borderRadius: 11, display: "inline-flex", alignItems: "center", fontSize: 11, fontWeight: 500, color: "#52606d", background: "rgba(255,255,255,.7)", boxShadow: "inset 0 0 0 .5px rgba(0,0,0,.08)" }}>{badge}</span>
      ) : null}
    </div>
  );
}

export function Question({ text }: { text: string }) {
  return (
    <div key={text} style={{ fontSize: 18, fontWeight: 600, lineHeight: 1.32, letterSpacing: "-.01em", minHeight: 46, animation: "tc-rise .6s var(--ease-rise) .1s both", textWrap: "pretty" }}>
      {text}
    </div>
  );
}

export function MetaRow({ label, children }: { label: string; children?: ReactNode }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, minHeight: 24, padding: "0 2px" }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: "#6e6e73" }}>{label}</span>
      {children}
    </div>
  );
}

export function Muted({ children }: { children: ReactNode }) {
  return <span style={{ fontSize: 11.5, color: "#6e6e73" }}>{children}</span>;
}
