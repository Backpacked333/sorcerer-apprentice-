"use client";

export type SourceBadgeProps = {
  source: "vision" | "dom";
  alsoSeenBy?: "vision" | "dom";
};

/**
 * Honest provenance badge (AGENTS.md non-negotiable 5): vision events say `seen`,
 * ERP telemetry says `erp`; `seen ✓` only when a vision event was also confirmed by the telemetry.
 */
export function SourceBadge({ source, alsoSeenBy }: SourceBadgeProps) {
  const vision = source === "vision";
  const confirmed = vision && alsoSeenBy === "dom";
  const text = vision ? (confirmed ? "seen ✓" : "seen") : "erp";
  const title = vision
    ? confirmed
      ? "Seen by the vision model, confirmed by the sandbox ERP telemetry"
      : "Seen by the vision model"
    : "Reported by the sandbox ERP telemetry";
  return (
    <span
      title={title}
      style={{
        display: "inline-flex",
        alignItems: "center",
        height: 20,
        padding: "0 7px",
        borderRadius: 10,
        fontSize: 11,
        fontWeight: 600,
        lineHeight: 1,
        letterSpacing: ".02em",
        whiteSpace: "nowrap",
        fontVariantNumeric: "tabular-nums",
        color: vision ? "#1f5fcf" : "#52606d",
        background: vision ? "rgba(59,130,246,.1)" : "rgba(0,0,0,.05)",
        boxShadow: vision ? "inset 0 0 0 .5px rgba(59,130,246,.25)" : "inset 0 0 0 .5px rgba(0,0,0,.1)",
      }}
    >
      {text}
    </span>
  );
}
