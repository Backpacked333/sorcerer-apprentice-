import Link from "next/link";

export function SessionList({ sessions }: { sessions: { id: string; expertName: string; task: string; startedAt: number }[] }) {
  if (sessions.length === 0) {
    return <p className="panel p-4 t-small text-muted">No sessions yet. Run a capture first, or seed one with npm run seed:session.</p>;
  }
  return (
    <ul className="panel divide-y divide-line">
      {sessions.map((s) => (
        <li key={s.id} className="flex items-center gap-3 p-4 t-small">
          <time className="mono text-muted">{new Date(s.startedAt).toLocaleString()}</time>
          <span className="flex-1">{s.expertName} · {s.task}</span>
          {s.id.startsWith("demo_") && <span className="tag">sample</span>}
          <Link className="btn btn-primary" href={`/map/${s.id}`}>Open</Link>
        </li>
      ))}
    </ul>
  );
}
