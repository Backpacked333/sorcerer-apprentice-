import type { ReactNode } from "react";

export type TagTone = "neutral" | "amber" | "green" | "red" | "blue" | "violet";

// Red only for off the record, stop and blocked.
const TONE: Record<TagTone, { bg: string; fg: string }> = {
  neutral: { bg: "rgba(0,0,0,.05)", fg: "#52606d" },
  amber: { bg: "rgba(245,166,35,.14)", fg: "#a35f00" },
  green: { bg: "rgba(34,180,94,.12)", fg: "#1b8a4b" },
  red: { bg: "rgba(229,72,77,.12)", fg: "#c9342f" },
  blue: { bg: "rgba(59,130,246,.12)", fg: "#1f5fcf" },
  violet: { bg: "rgba(143,123,255,.14)", fg: "#6a55d8" },
};

export function Tag({ tone = "neutral", dot, title, children }: { tone?: TagTone; dot?: boolean; title?: string; children: ReactNode }) {
  const t = TONE[tone];
  return (
    <span
      title={title}
      className="inline-flex items-center gap-1.5 whitespace-nowrap align-middle"
      style={{ height: 22, padding: "0 8px", borderRadius: 11, fontSize: 11.5, fontWeight: 500, lineHeight: 1, background: t.bg, color: t.fg }}
    >
      {dot ? <span aria-hidden style={{ width: 5, height: 5, borderRadius: "50%", background: "currentColor", boxShadow: "0 0 6px currentColor" }} /> : null}
      {children}
    </span>
  );
}
