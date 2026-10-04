"use client";

export type StruckBandProps = { active: boolean; label?: string };

const HATCH = "repeating-linear-gradient(135deg,rgba(229,72,77,.22) 0 6px,rgba(229,72,77,.07) 6px 12px)";
const STRIKE = "tc-strike .6s cubic-bezier(.4,0,.2,1) both";

/**
 * Red hatched band that wipes left→right (tc-strike) when something is struck from the record.
 * Without `label` it is an absolute overlay (parent must be `position:relative`), e.g. over an AnswerBubble.
 * With `label` it is a block band carrying that text.
 */
export function StruckBand({ active, label }: StruckBandProps) {
  if (!active) return null;
  if (!label) {
    return (
      <span
        aria-hidden
        style={{ position: "absolute", inset: 0, borderRadius: "inherit", background: HATCH, transformOrigin: "left", animation: STRIKE, pointerEvents: "none" }}
      />
    );
  }
  return (
    <div role="status" style={{ position: "relative", borderRadius: 12, overflow: "hidden", padding: "8px 12px" }}>
      <span aria-hidden style={{ position: "absolute", inset: 0, background: HATCH, transformOrigin: "left", animation: STRIKE, pointerEvents: "none" }} />
      <span style={{ position: "relative", fontSize: 13, fontWeight: 600, color: "#c9342f" }}>{label}</span>
    </div>
  );
}
