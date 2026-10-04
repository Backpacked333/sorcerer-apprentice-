import { listSessions } from "@/lib/store";
import { AppShell } from "@/components/ui/AppShell";
import { SessionList } from "@/components/ui/SessionList";

export const dynamic = "force-dynamic";

export default async function MapIndex() {
  const sessions = (await listSessions()).filter((s) => s.mode === "capture");
  return (
    <AppShell step={2}>
      <main className="min-h-[calc(100dvh-52px)]" style={{ background: "#fbfbfd" }}>
        <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
          <p className="text-[13px] font-semibold text-[#8e8e93]">2 · Map</p>
          <h1 className="mt-1 text-[26px] font-bold leading-[1.15] tracking-[-.022em] text-[#1d1d1f] sm:text-[30px]">Pick a capture session to debrief</h1>
          <p className="mt-2 max-w-xl text-[14.5px] leading-[1.5] text-[#6e6e73]">
            Each capture compiles into a Work Map. The debrief asks only what the capture left open, then the expert confirms the teach-back.
          </p>
          <p className="mt-6 pb-2 text-[12px] font-semibold text-[#8e8e93]">
            {sessions.length} capture session{sessions.length === 1 ? "" : "s"}
          </p>
          <SessionList sessions={sessions} />
        </div>
      </main>
    </AppShell>
  );
}
