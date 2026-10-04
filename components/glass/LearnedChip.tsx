"use client";

export type LearnedKind = "reason" | "guardrail" | "heard" | "learned" | "practice";
export type LearnedChipProps = { kind: LearnedKind; text: string };

// DOT map (design §1.7, v3:348). "practice" uses ember (the mockup's rescued colour).
const DOT: Record<LearnedKind, string> = {
  reason: "#f5a623",
  guardrail: "#e5484d",
  learned: "#22b45e",
  practice: "#f0642f",
  heard: "#8f7bff",
};

const BORDER = "linear-gradient(90deg,#ffb8d9,#ffe2a8,#b9f0d3,#b5dcff,#d4c6ff)";

/** Pastel-rimmed chip with a glowing dot; rises in once when mounted (re-key to replay). */
export function LearnedChip({ kind, text }: LearnedChipProps) {
  const dot = DOT[kind];
  return (
    <span
      data-kind={kind}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        height: 24,
        maxWidth: "100%",
        padding: "0 10px",
        borderRadius: 12,
        fontSize: 11.5,
        fontWeight: 500,
        lineHeight: 1,
        color: "#1d1d1f",
        border: ".75px solid transparent",
        background: `linear-gradient(180deg,rgba(255,255,255,.85),rgba(255,255,255,.6)) padding-box,${BORDER} border-box`,
        animation: "tc-rise .55s var(--ease-rise, cubic-bezier(.2,.9,.3,1)) both",
      }}
    >
      <span aria-hidden style={{ width: 5, height: 5, flex: "none", borderRadius: "50%", background: dot, boxShadow: `0 0 6px ${dot}` }} />
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{text}</span>
    </span>
  );
}
