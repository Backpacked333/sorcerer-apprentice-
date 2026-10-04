"use client";

import { useId } from "react";

export type CountRingProps = { value: number; total: number; size?: number; label: string };

const STOPS = ["#ffb8d9", "#ffd27a", "#9be7c4", "#8fd3ff", "#b7a6ff"];

function arcPath(c: number, r: number, frac: number): string {
  if (frac <= 0) return "";
  if (frac >= 0.9999) {
    // Full circle as two half arcs, starting at 12 o'clock.
    return `M ${c} ${c - r} A ${r} ${r} 0 1 1 ${c} ${c + r} A ${r} ${r} 0 1 1 ${c} ${c - r}`;
  }
  const a = frac * Math.PI * 2;
  const x = c + r * Math.sin(a);
  const y = c - r * Math.cos(a);
  return `M ${c} ${c - r} A ${r} ${r} 0 ${frac > 0.5 ? 1 : 0} 1 ${x.toFixed(3)} ${y.toFixed(3)}`;
}

/** "3 of 5" ring. Shows a count, never a percentage; the arc draws itself (tc-fillring) each time value changes. */
export function CountRing({ value, total, size = 64, label }: CountRingProps) {
  const gid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const safeTotal = Math.max(0, total);
  const v = Math.max(0, Math.min(value, safeTotal));
  const frac = safeTotal > 0 ? v / safeTotal : 0;
  const stroke = Math.max(3, size * 0.075);
  const c = size / 2;
  const r = c - stroke / 2 - 1;
  const d = arcPath(c, r, frac);
  const text = `${v} of ${safeTotal}`;
  return (
    <div
      role="img"
      aria-label={`${label}: ${text}`}
      title={`${label}: ${text}`}
      style={{ position: "relative", width: size, height: size, flex: "none" }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: "block", overflow: "visible" }} aria-hidden>
        <defs>
          <linearGradient id={`cr${gid}`} x1="0" y1="0" x2="1" y2="1">
            {STOPS.map((s, i) => (
              <stop key={s} offset={i / (STOPS.length - 1)} stopColor={s} />
            ))}
          </linearGradient>
        </defs>
        <circle cx={c} cy={c} r={r} fill="none" stroke="rgba(0,0,0,.06)" strokeWidth={stroke} />
        {d ? (
          <path
            key={`${v}/${safeTotal}`}
            d={d}
            fill="none"
            stroke={`url(#cr${gid})`}
            strokeWidth={stroke}
            strokeLinecap="round"
            pathLength={1}
            strokeDasharray="1"
            style={{ animation: "tc-fillring .9s var(--ease-rise, cubic-bezier(.2,.9,.3,1)) both", filter: "drop-shadow(0 0 3px rgba(180,160,255,.45))" }}
          />
        ) : null}
      </svg>
      <div
        aria-hidden
        style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}
      >
        <span style={{ fontSize: Math.round(size * 0.3), fontWeight: 700, letterSpacing: "-.02em", color: "#1d1d1f" }}>{v}</span>
        {" "}
        <span style={{ fontSize: Math.max(9, Math.round(size * 0.15)), fontWeight: 500, color: "#8e8e93", marginTop: 2 }}>of {safeTotal}</span>
      </div>
    </div>
  );
}
