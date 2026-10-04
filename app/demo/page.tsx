import { getMap, listSessions } from "@/lib/store";
import { pickSample } from "@/lib/ui/landing";
import { DemoRoom } from "@/components/demo/DemoRoom";

export const dynamic = "force-dynamic";

export default async function DemoPage() {
  const sessions = await listSessions();
  const latestMap = sessions.find((s) => s.mode === "capture")?.id;
  const samples = [];
  for (const s of sessions) {
    if (!s.id.startsWith("demo_")) continue;
    const map = await getMap(s.id);
    samples.push({ id: s.id, startedAt: s.startedAt, confirmedAt: map?.confirmedAt ?? null });
  }
  return <DemoRoom latestMap={latestMap} sampleMap={pickSample(samples)} />;
}
