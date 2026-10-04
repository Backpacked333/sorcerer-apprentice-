import { NextResponse } from "next/server";
import { compileDeterministic, refineWithLLM } from "@/lib/compile";
import { getSession, saveMap } from "@/lib/store";
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
    const { map, used, note } = body.llm === false ? { map: draft, used: false, note: "deterministic only" } : await refineWithLLM(session, draft);
    await saveMap(map);
    return NextResponse.json({ map, llm: used, note, understanding: understanding(map), teachback: generateTeachback(map) });
  } catch (error) {
    return jsonError(error);
  }
}
