import type { ReactNode } from "react";

const TONE = {
  info: { bg: "linear-gradient(180deg,rgba(232,242,255,.9),rgba(222,236,255,.7))", fg: "#1f4f9a", ring: "rgba(59,130,246,.22)", dot: "#3b82f6" },
  degraded: { bg: "linear-gradient(180deg,rgba(255,244,220,.92),rgba(255,236,200,.72))", fg: "#7a4b00", ring: "rgba(245,166,35,.3)", dot: "#f5a623" },
  error: { bg: "linear-gradient(180deg,rgba(255,236,236,.95),rgba(255,226,226,.78))", fg: "#a3302c", ring: "rgba(229,72,77,.28)", dot: "#e5484d" },
} as const;

export function Banner({ tone = "info", children, action }: { tone?: "info" | "degraded" | "error"; children: ReactNode; action?: ReactNode }) {
  const t = TONE[tone];
  return (
    <div
      className="flex items-center gap-3"
      role={tone === "error" ? "alert" : "status"}
      style={{ padding: "11px 14px", borderRadius: 16, fontSize: 14, lineHeight: "20px", background: t.bg, color: t.fg, boxShadow: `inset 0 1px 0 rgba(255,255,255,.7), inset 0 0 0 .5px ${t.ring}` }}
    >
      <span aria-hidden style={{ width: 7, height: 7, flex: "none", borderRadius: "50%", background: t.dot, boxShadow: `0 0 6px ${t.dot}` }} />
      <div className="min-w-0 flex-1">{children}</div>
      {action}
    </div>
  );
}
