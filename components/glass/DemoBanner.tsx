"use client";

import Link from "next/link";

export type DemoBannerProps = { text?: string; href?: string };

/** Persistent label on every demo-mode page: fictional data, never presented as learned. */
export function DemoBanner({ text = "Demo data — fictional. Nothing here was learned by Tacit.", href = "/" }: DemoBannerProps) {
  return (
    <div
      role="note"
      aria-label="Demo mode"
      style={{
        position: "sticky",
        top: 0,
        zIndex: 40,
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        justifyContent: "center",
        gap: "4px 12px",
        minHeight: 36,
        padding: "7px 16px",
        boxSizing: "border-box",
        fontSize: 13,
        lineHeight: 1.35,
        textAlign: "center",
        color: "#3a3a3c",
        // Near-opaque: content scrolling underneath must not ghost through the label.
        background: "linear-gradient(180deg,rgba(238,233,255,.985),rgba(231,225,255,.97))",
        backdropFilter: "blur(16px) saturate(1.6)",
        WebkitBackdropFilter: "blur(16px) saturate(1.6)",
        boxShadow: "inset 0 -.5px 0 rgba(106,85,216,.25),0 4px 14px rgba(80,60,180,.06)",
      }}
    >
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          height: 20,
          padding: "0 8px",
          borderRadius: 10,
          fontSize: 10.5,
          fontWeight: 700,
          letterSpacing: ".11em",
          color: "#6a55d8",
          background: "rgba(255,255,255,.7)",
          boxShadow: "inset 0 0 0 .5px rgba(106,85,216,.3)",
        }}
      >
        DEMO MODE
      </span>
      <span>{text}</span>
      <Link href={href} className="hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a35f00]" style={{ color: "#6a55d8", fontWeight: 600, whiteSpace: "nowrap", borderRadius: 4 }}>
        Back to the real product →
      </Link>
    </div>
  );
}
