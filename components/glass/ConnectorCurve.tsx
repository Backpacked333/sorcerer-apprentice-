"use client";

import { useId } from "react";
import { MOODS, RAINBOW, type OrbMood } from "@/lib/ui/moods";
import { connectorPath, type Rect } from "@/lib/ui/geometry";

export type ConnectorCurveProps = {
  from: Rect | null;
  to: Rect | null;
  mood: OrbMood;
  /** Change to redraw the cable (e.g. target + mode). */
  drawKey?: string | number;
};

const DRAW = "tc-draw .9s cubic-bezier(.3,.9,.3,1) both";

/**
 * Cable from the attended field to the companion card (design §6.6). Full-size SVG, pointer-events none.
 * Glow + line draw in (tc-draw), then a white dash flows along it (tc-flow); the origin dot pulses.
 */
export function ConnectorCurve({ from, to, mood, drawKey }: ConnectorCurveProps) {
  const gid = `cab${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  if (!from || !to) return null;
  const M = MOODS[mood] ?? MOODS.quiet;
  const colors = M.rim.colors;
  const { d, x0, y0, x1, y1 } = connectorPath(from, to);
  const n = colors.length;
  const pathT = { transition: "d .64s var(--ease-spring, cubic-bezier(.2,1.12,.3,1))" };
  return (
    <svg
      aria-hidden
      width="100%"
      height="100%"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", overflow: "visible", pointerEvents: "none", zIndex: 4 }}
    >
      <defs>
        <linearGradient id={gid} gradientUnits="userSpaceOnUse" x1={x0} y1={y0} x2={x1} y2={y1}>
          {colors.map((c, i) => (
            <stop key={i} offset={n > 1 ? i / (n - 1) : 0} stopColor={c} />
          ))}
        </linearGradient>
      </defs>
      <g key={drawKey ?? "cable"}>
        <path
          d={d}
          fill="none"
          stroke={`url(#${gid})`}
          strokeWidth={8}
          strokeOpacity={Math.max(0.028, 0.28 * RAINBOW)}
          strokeLinecap="round"
          pathLength={1}
          strokeDasharray="1"
          style={{ ...pathT, animation: DRAW, filter: "blur(4px)" }}
        />
        <path d={d} fill="none" stroke={`url(#${gid})`} strokeWidth={1.5} strokeLinecap="round" pathLength={1} strokeDasharray="1" style={{ ...pathT, animation: DRAW }} />
        <path
          d={d}
          fill="none"
          stroke="#fff"
          strokeWidth={2.4}
          strokeLinecap="round"
          pathLength={1}
          strokeDasharray=".04 .96"
          style={{ ...pathT, opacity: 0.95, animation: "tc-flow 2.4s linear .9s infinite" }}
        />
        <circle cx={x0} cy={y0} r={3} fill={colors[0]} style={{ transformBox: "fill-box", transformOrigin: "center", animation: "tc-dotpulse 1.6s ease-in-out infinite" }} />
      </g>
    </svg>
  );
}
