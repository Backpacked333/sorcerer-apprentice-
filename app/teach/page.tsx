import { getMap, listSessions } from "@/lib/store";
import { TeachStart } from "@/components/TeachStart";

export const dynamic = "force-dynamic";

export default async function TeachIndex({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  const { from } = await searchParams;
  const sessions = (await listSessions()).filter((s) => s.mode === "capture");
  const maps = [];
  for (const s of sessions) {
    const m = await getMap(s.id);
    if (m) maps.push({ sessionId: s.id, expert: m.expert.name, task: m.task, confirmed: !!m.confirmedAt, rules: m.rules.length, steps: m.steps.length });
  }
  return <TeachStart maps={maps} preselect={from} />;
}
