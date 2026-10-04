"use client";
// Session clock: mm:ss, ticks once a second inside an effect, frozen while paused.
// Hydration-safe: renders "--:--" until mounted.
import { useEffect, useState } from "react";
import { mmss } from "@/lib/ui/geometry";

export function SessionClock(p: { startedAt: number | null; frozen?: boolean }) {
  const { startedAt, frozen = false } = p;
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    if (startedAt == null) return;
    setNow(Date.now());
    if (frozen) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [startedAt, frozen]);
  const text = startedAt == null || now == null ? "--:--" : mmss((now - startedAt) / 1000);
  return (
    <span
      className="tc-clock"
      aria-label={startedAt == null ? "Session not started" : `Session time ${text}`}
      style={{
        font: "11.5px ui-monospace,Menlo,monospace",
        color: "#6e6e73",
        fontVariantNumeric: "tabular-nums",
        flex: "none",
        whiteSpace: "nowrap",
      }}
    >
      {text}
    </span>
  );
}
