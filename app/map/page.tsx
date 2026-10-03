import Link from "next/link";
import { listSessions } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function MapIndex() {
  const sessions = (await listSessions()).filter((s) => s.mode === "capture");
  return (
    <main className="grid-bg min-h-screen">
      <div className="mx-auto max-w-3xl px-6 py-16">
        <p className="panel-title">2 · Map</p>
        <h1 className="mt-2 text-3xl font-semibold">Pick a capture session to debrief</h1>
        <ul className="panel mt-6 divide-y divide-line">
          {sessions.length === 0 && <li className="p-4 text-sm text-muted">No sessions yet. Run a capture first, or seed one with <span className="mono">npm run seed:session</span>.</li>}
          {sessions.map((s) => (
            <li key={s.id} className="flex items-center gap-4 p-4 text-sm">
              <span className="mono text-xs text-muted">{s.id}</span>
              <span className="flex-1">{s.expertName} · {s.task}</span>
              <span className="text-xs text-muted">{new Date(s.startedAt).toLocaleString()}</span>
              <Link href={`/map/${s.id}`} className="btn btn-primary">Open</Link>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
