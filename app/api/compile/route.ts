import { NextResponse } from "next/server";
import { compileDeterministic, refineWithLLM } from "@/lib/compile";
import { getSession, saveMap } from "@/lib/store";
import { generateTeachback } from "@/lib/teachback";
import { understanding } from "@/lib/workmap";
import { compileRoleProfile } from "@/lib/role-profile";

export const maxDuration = 60;

export async function POST(req: Request) {
  const body = (await req.json()) as { sessionId: string; llm?: boolean };
  const session = await getSession(body.sessionId);
  if (!session) return NextResponse.json({ error: "session not found" }, { status: 404 });
  const draft = compileDeterministic(session);
  const [{ map, used, note }, profile] = await Promise.all([
    body.llm === false ? { map: draft, used: false, note: "deterministic only" } : refineWithLLM(session, draft),
    body.llm === false ? { note: "deterministic only", profile: undefined } : compileRoleProfile(session, req.signal),
  ]);
  if (JSON.stringify(await getSession(session.id)) !== JSON.stringify(session)) return NextResponse.json({ error: "session changed during compile; retry" }, { status: 409 });
  map.roleProfile = profile.profile;
  await saveMap(map);
  return NextResponse.json({ map, llm: used, note, profileNote: profile.note, understanding: understanding(map), teachback: generateTeachback(map) });
}
