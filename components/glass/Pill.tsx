"use client";

import type { ReactNode } from "react";

export type PillTone = "neutral" | "amber" | "green" | "red" | "violet" | "blue";

export type PillProps = {
  tone?: PillTone;
  dot?: boolean;
  /** Animates only the dot (never the pill box). */
  pulse?: boolean;
  children?: ReactNode;
  className?: string;
  title?: string;
};

// Red tone only for off-the-record, stop and blocked (BRIEF honesty rule 5).
const TONE: Record<PillTone, { bg: string; fg: string; dot: string }> = {
  neutral: { bg: "rgba(0,0,0,.05)", fg: "#3a3a3c", dot: "#8e8e93" },
  amber: { bg: "rgba(245,166,35,.14)", fg: "#a35f00", dot: "#f5a623" },
  green: { bg: "rgba(34,180,94,.12)", fg: "#1b8a4b", dot: "#22b45e" },
  red: { bg: "rgba(229,72,77,.12)", fg: "#c9342f", dot: "#e5484d" },
  violet: { bg: "rgba(143,123,255,.14)", fg: "#6a55d8", dot: "#8f7bff" },
  blue: { bg: "rgba(59,130,246,.12)", fg: "#1f5fcf", dot: "#3b82f6" },
};

export function Pill({ tone = "neutral", dot, pulse, children, className, title }: PillProps) {
  const t = TONE[tone];
  return (
    <span
      title={title}
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        height: 26,
        padding: "0 11px",
        borderRadius: 13,
        fontSize: 12.5,
        fontWeight: 500,
        lineHeight: 1,
        whiteSpace: "nowrap",
        background: t.bg,
        color: t.fg,
        transition: "background-color .6s, color .6s",
      }}
    >
      {dot || pulse ? (
        <span
          aria-hidden
          style={{
            width: 6,
            height: 6,
            flex: "none",
            borderRadius: "50%",
            background: t.dot,
            boxShadow: `0 0 6px ${t.dot}`,
            transition: "background-color .6s, box-shadow .6s",
            animation: pulse ? "tc-dotpulse 1.8s ease-in-out infinite" : undefined,
          }}
        />
      ) : null}
      {children}
    </span>
  );
}

export const StatusPill = Pill;
export type StatusPillProps = PillProps;
