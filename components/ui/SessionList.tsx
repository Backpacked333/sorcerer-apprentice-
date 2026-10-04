import Link from "next/link";
import { Tag } from "./Tag";

const CARD = { borderRadius: 24, background: "linear-gradient(180deg,rgba(255,255,255,.8),rgba(255,255,255,.58))", boxShadow: "inset 0 1px 0 #fff, 0 0 0 .5px rgba(0,0,0,.07), 0 12px 36px rgba(15,23,42,.05)" } as const;

export function SessionList({ sessions }: { sessions: { id: string; expertName: string; task: string; startedAt: number }[] }) {
  if (sessions.length === 0) {
    return <p className="p-4 text-[14px] text-[#6e6e73]" style={CARD}>No sessions yet. Run a capture first, or seed one with npm run seed:session.</p>;
  }
  return (
    <ul className="overflow-hidden p-1.5" style={CARD}>
      {sessions.map((s, i) => (
        <li key={s.id} className="flex flex-wrap items-center gap-3 px-3 py-3 text-[14px]" style={{ borderTop: i === 0 ? "none" : ".5px solid rgba(0,0,0,.08)" }}>
          <time className="font-mono text-[12.5px] tabular-nums text-[#6e6e73]">{new Date(s.startedAt).toLocaleString()}</time>
          <span className="min-w-0 flex-1 text-[#1d1d1f]">{s.expertName} · {s.task}</span>
          {s.id.startsWith("demo_") && <Tag>sample</Tag>}
          <Link
            href={`/map/${s.id}`}
            className="inline-flex items-center justify-center no-underline transition-transform hover:-translate-y-px"
            style={{ height: 34, padding: "0 14px", borderRadius: 17, fontSize: 13, fontWeight: 600, color: "#6b3f00", background: "linear-gradient(180deg,rgba(255,222,160,.85),rgba(255,196,95,.6))", boxShadow: "inset 0 1px 0 rgba(255,255,255,.8), inset 0 0 0 .5px rgba(200,120,0,.2)" }}
          >
            Open
          </Link>
        </li>
      ))}
    </ul>
  );
}
