// Mini company map for the landing page, drawn ONLY from the confirmed sample map (lead decision D5).
// Server component: no state, no animation beyond the shared flow keyframe on aria-hidden edges.
export interface MiniMapData {
  task: string;
  expert: string;
  rules: number;
  steps: number;
  mentioned: string[];
}

const SLOTS = [
  { x: 84, y: 84 },
  { x: 436, y: 84 },
  { x: 84, y: 286 },
  { x: 436, y: 286 },
];
const EDGE = ["#ffd27a", "#b5dcff", "#d4c6ff", "#9be7c4"];

export function PlatformMiniMap({ data }: { data: MiniMapData }) {
  const sats = data.mentioned.slice(0, 4);
  return (
    <div
      className="glass-panel"
      style={{ position: "relative", width: "100%", aspectRatio: "520 / 360", borderRadius: 28, overflow: "hidden", background: "rgba(255,255,255,.62)", boxShadow: "inset 0 1px 0 #fff,0 0 0 .5px rgba(0,0,0,.06),0 24px 60px rgba(15,23,42,.08)" }}
    >
      <svg aria-hidden viewBox="0 0 520 360" preserveAspectRatio="xMidYMid meet" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
        {sats.map((_, i) => {
          const p = SLOTS[i];
          const d = `M260 180 L${p.x} ${p.y}`;
          return (
            <g key={i}>
              <path d={d} stroke={EDGE[i]} strokeWidth={2} fill="none" />
              <path d={d} stroke="#fff" strokeWidth={2} fill="none" pathLength={1} strokeDasharray=".05 .95" style={{ animation: `tc-flow ${3 + i * 0.5}s linear infinite` }} />
            </g>
          );
        })}
      </svg>
      <div style={{ position: "absolute", inset: 0 }}>
        <div
          style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)", width: "42%", padding: "12px 14px", borderRadius: 16, background: "rgba(255,255,255,.92)", boxShadow: "0 0 0 1px rgba(183,166,255,.55),0 12px 30px rgba(120,110,255,.16)", textAlign: "left" }}
        >
          <div style={{ fontSize: 11, fontWeight: 600, color: "#1b8a4b" }}>confirmed · {data.rules} {data.rules === 1 ? "rule" : "rules"} · {data.steps} steps</div>
          <div style={{ fontSize: 13.5, fontWeight: 600, lineHeight: 1.25, marginTop: 3, color: "#1d1d1f", overflowWrap: "anywhere" }}>{data.task}</div>
          <div style={{ fontSize: 11.5, color: "#6e6e73", marginTop: 3 }}>expert · {data.expert}</div>
        </div>
        {sats.map((name, i) => {
          const p = SLOTS[i];
          return (
            <span
              key={name}
              style={{ position: "absolute", left: `${(p.x / 520) * 100}%`, top: `${(p.y / 360) * 100}%`, transform: "translate(-50%,-50%)", maxWidth: "34%", padding: "6px 10px", borderRadius: 14, border: "1px dashed rgba(0,0,0,.22)", background: "rgba(255,255,255,.78)", fontSize: 12, fontWeight: 500, color: "#3a3a3c", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
            >
              {name}
            </span>
          );
        })}
      </div>
      <span style={{ position: "absolute", left: 14, bottom: 12, fontSize: 11.5, color: "#8e8e93" }}>From the confirmed sample session · roles the expert said to ask</span>
    </div>
  );
}
