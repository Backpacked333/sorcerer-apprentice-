"use client";

import { useEffect, useState } from "react";
import { healthItems, normalizeSource, type HealthItem } from "@/lib/demo/health-status";

const DOT: Record<HealthItem["tone"], { bg: string; fg: string; dot: string }> = {
  green: { bg: "rgba(34,180,94,.1)", fg: "#2f4a3a", dot: "#22b45e" },
  amber: { bg: "rgba(245,166,35,.14)", fg: "#6b4300", dot: "#f5a623" },
  neutral: { bg: "rgba(0,0,0,.05)", fg: "#6e6e73", dot: "#aeaeb2" },
};

/** Honest runtime status: voice, vision (honours the event source) and sample data. */
export function HealthStrip({ className }: { className?: string }) {
  const [items, setItems] = useState<HealthItem[]>([{ label: "Checking status…", tone: "neutral" }]);
  useEffect(() => {
    let cancelled = false;
    const source = normalizeSource(process.env.NEXT_PUBLIC_EVENT_SOURCE);
    fetch("/api/health", { cache: "no-store" })
      // /api/health answers 503 with a full body when samples are missing: always parse it.
      .then((res) => res.json().catch(() => null))
      .then((data) => healthItems(data, source))
      .catch(() => healthItems(null, source))
      .then((next) => { if (!cancelled) setItems(next); });
    return () => { cancelled = true; };
  }, []);
  return (
    <p
      data-testid="health-strip"
      aria-live="polite"
      className={className}
      style={{ display: "flex", flexWrap: "wrap", gap: 6, margin: 0 }}
    >
      {items.map((it, i) => {
        const c = DOT[it.tone];
        return (
          <span
            key={it.label}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 26, padding: "0 10px", borderRadius: 13, fontSize: 12.5, fontWeight: 500, color: c.fg, background: c.bg }}
          >
            <span aria-hidden style={{ width: 6, height: 6, borderRadius: 3, background: c.dot, boxShadow: `0 0 6px ${c.dot}` }} />
            {it.label}
            {i < items.length - 1 ? <span className="sr-only"> · </span> : null}
          </span>
        );
      })}
    </p>
  );
}
