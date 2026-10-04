import type { Metadata } from "next";
import { PlatformShell } from "@/components/platform/PlatformShell";
import { SessionsView } from "@/components/platform/SessionsView";
import { loadPlatform } from "@/lib/platform/load";
import { listSessions } from "@/lib/store";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Sessions · Tacit" };

export default async function SessionsPage() {
  const data = await loadPlatform();
  let sessions: { id: string; mode: string; task: string; expertName: string; startedAt: number; endedAt?: number | null }[] = [];
  let failed = false;
  try {
    sessions = (await listSessions({ skipInvalid: true })).map((s) => ({ id: s.id, mode: s.mode, task: s.task, expertName: s.expertName, startedAt: s.startedAt, endedAt: s.endedAt ?? null }));
  } catch {
    failed = true;
  }
  return (
    <PlatformShell data={data} active={{ page: "sessions" }} openAt={1320} scroll>
      <SessionsView sessions={sessions} failed={failed} />
    </PlatformShell>
  );
}
