"use client";

import { IridescentRim } from "./IridescentRim";
import { MOODS } from "@/lib/ui/moods";

export type HeardCardProps = {
  /** Verbatim Quote.text only. */
  quote: string;
  meta?: string;
};

/** "Heard you say" card: a reason heard in passing, verbatim, with a violet rim. */
export function HeardCard({ quote, meta }: HeardCardProps) {
  return (
    <div
      style={{
        position: "relative",
        boxSizing: "border-box",
        padding: "11px 14px",
        borderRadius: 20,
        background: "linear-gradient(180deg,rgba(255,255,255,.72),rgba(255,255,255,.5))",
        backdropFilter: "blur(24px) saturate(1.8)",
        WebkitBackdropFilter: "blur(24px) saturate(1.8)",
        boxShadow: "inset 0 1px 0 #fff,0 10px 30px rgba(80,60,180,.12)",
        animation: "tc-rise .6s var(--ease-rise, cubic-bezier(.2,.9,.3,1)) both",
      }}
    >
      <IridescentRim radius={20} colors={MOODS.heard.rim.colors} opacity={0.8} />
      <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 600, color: "#6a55d8" }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
          <rect x="9" y="3" width="6" height="11" rx="3" />
          <path d="M5 11a7 7 0 0014 0M12 18v3" />
        </svg>
        <span>Heard you say{meta ? ` · ${meta}` : ""}</span>
      </div>
      <div style={{ position: "relative", fontSize: 13.5, lineHeight: 1.4, color: "#1d1d1f", marginTop: 4, textWrap: "pretty", overflowWrap: "anywhere" }}>
        {`“${quote}”`}
      </div>
    </div>
  );
}
