import { NextResponse } from "next/server";
import { compileDeterministic, refineWithLLM } from "@/lib/compile";
import { getSession, saveCompiledMap } from "@/lib/store";
import { compileRoleProfile } from "@/lib/role-profile";
import { generateTeachback } from "@/lib/teachback";
import { understanding } from "@/lib/workmap";
import { jsonError, readJson } from "@/lib/request";

export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const body = await readJson<{ sessionId?: string; llm?: boolean }>(req);
    if (!body || typeof body.sessionId !== "string") return NextResponse.json({ error: "invalid compile request" }, { status: 400 });
    const session = await getSession(body.sessionId);
    if (!session) return NextResponse.json({ error: "session not found" }, { status: 404 });
    const draft = compileDeterministic(session);
    const [{ map, used, note }, profile] = await Promise.all([
      body.llm === false ? { map: draft, used: false, note: "deterministic only" } : refineWithLLM(session, draft),
      body.llm === false ? { profile: undefined, note: "deterministic only" } : compileRoleProfile(session, req.signal),
    ]);
    map.roleProfile = profile.profile;
    if (!(await saveCompiledMap(map, session))) return NextResponse.json({ error: "session changed during compile; retry" }, { status: 409 });
    return NextResponse.json({ map, llm: used, note, profileNote: profile.note, understanding: understanding(map), teachback: generateTeachback(map) });
  } catch (error) {
    return jsonError(error);
  }
}
