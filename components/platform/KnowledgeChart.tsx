"use client";
// "Knowledge over time": stacked step areas per item kind, clipped to the playhead.
import { useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { seriesAt, type ItemKind, type KnowledgeSeries, type Timeline } from "@/lib/platform/types";

const H = 160;
const X0 = 26;
const TOP = 14;
const BASE = H - 34;

export function KnowledgeChart({ knowledge, timeline, t }: { knowledge: KnowledgeSeries; timeline: Timeline; t: number }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [w, setW] = useState(640);
  const clip = `kc${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setW(el.clientWidth || 640);
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => setW(el.clientWidth || 640));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { start, end } = timeline;
  const span = Math.max(1, end - start);
  const X = (at: number) => X0 + ((Math.min(end, Math.max(start, at)) - start) / span) * (w - X0 - 10);
  const top = Math.max(4, knowledge.total);
  const Y = (n: number) => BASE - (n / top) * (BASE - TOP);
  const order = knowledge.kinds.map((k) => k.kind);

  const layers = useMemo(() => {
    const pts = [...knowledge.points].sort((a, b) => a.at - b.at);
    const bounds = [start, ...pts.map((p) => p.at), end];
    return order.map((kind, li) => {
      const below = order.slice(0, li);
      const seg: { x0: number; x1: number; lo: number; hi: number }[] = [];
      for (let j = 0; j < bounds.length - 1; j++) {
        const c = j === 0 ? null : pts[j - 1].counts;
        const lo = c ? below.reduce((s, k) => s + (c[k as ItemKind] ?? 0), 0) : 0;
        const hi = c ? lo + (c[kind] ?? 0) : 0;
        seg.push({ x0: X(bounds[j]), x1: X(bounds[j + 1]), lo, hi });
      }
      const topEdge = seg.map((s) => `${s.x0.toFixed(1)},${Y(s.hi).toFixed(1)} ${s.x1.toFixed(1)},${Y(s.hi).toFixed(1)}`).join(" ");
      const bottomEdge = [...seg].reverse().map((s) => `${s.x1.toFixed(1)},${Y(s.lo).toFixed(1)} ${s.x0.toFixed(1)},${Y(s.lo).toFixed(1)}`).join(" ");
      return { kind, points: `${topEdge} ${bottomEdge}` };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [knowledge.points, start, end, w, top]);

  const now = seriesAt(knowledge.points, t);
  const xt = X(t);
  const grid = [0, Math.round(top / 2), top];

  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 14px", marginBottom: 6 }}>
        {knowledge.kinds.map((k) => (
          <span key={k.kind} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "#3a3a3c" }}>
            <span aria-hidden style={{ width: 9, height: 9, borderRadius: 2, background: k.color }} />
            {k.label}
            <span style={{ color: "#8e8e93", fontVariantNumeric: "tabular-nums" }}>· {now?.counts[k.kind] ?? 0}</span>
          </span>
        ))}
      </div>
      <div ref={ref} style={{ width: "100%" }}>
        <svg width={w} height={H} role="img" aria-label={`Knowledge over time: ${now ? order.map((k) => `${now.counts[k]} ${k}`).join(", ") : "nothing yet"}`} style={{ display: "block", overflow: "visible" }}>
          <defs>
            <clipPath id={clip}>
              <rect x={0} y={0} width={Math.max(0, xt)} height={H} />
            </clipPath>
          </defs>
          {grid.map((g) => (
            <g key={g}>
              <line x1={X0} x2={w - 10} y1={Y(g)} y2={Y(g)} stroke="rgba(0,0,0,.06)" />
              <text x={X0 - 8} y={Y(g) + 3.5} fontSize="10.5" fill="#aeaeb2" textAnchor="end">{g}</text>
            </g>
          ))}
          <g clipPath={`url(#${clip})`}>
            {layers.map((l) => {
              const c = knowledge.kinds.find((k) => k.kind === l.kind)?.color ?? "#8e8e93";
              return <polygon key={l.kind} points={l.points} fill={c} opacity={0.78} />;
            })}
          </g>
          {timeline.beads.filter((b) => b.type !== "planned").map((b) => (
            <circle key={b.id} cx={X(b.at)} cy={H - 22} r={4} fill={b.at <= t ? (b.type === "teach" ? "#22b45e" : b.type === "capture" ? "#f5a623" : "#8f7bff") : "#d1d1d6"} style={{ transition: "fill .3s" }}>
              <title>{b.title}</title>
            </circle>
          ))}
          {timeline.ticks.map((k) => (
            <text key={k.at} x={X(k.at)} y={H - 4} fontSize="11" fill="#8e8e93" textAnchor="middle">{k.label}</text>
          ))}
          <line x1={xt} x2={xt} y1={TOP - 6} y2={H - 28} stroke="rgba(120,110,255,.6)" strokeWidth={1.5} />
        </svg>
      </div>
    </div>
  );
}
