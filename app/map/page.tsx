import { listSessions } from "@/lib/store";
import { SessionList } from "@/components/ui/SessionList";

export const dynamic = "force-dynamic";

export default async function MapIndex() {
  const sessions = (await listSessions()).filter((s) => s.mode === "capture");
  return (
    <main className="grid-bg min-h-screen">
      <div className="mx-auto max-w-3xl px-6 py-16">
        <p className="panel-title">2 · Map</p>
        <h1 className="mt-2 text-3xl font-semibold">Pick a capture session to debrief</h1>
        <div className="mt-6">
          <SessionList sessions={sessions} />
        </div>
      </div>
    </main>
  );
}
