import { NextResponse } from "next/server";
import { emptySession, type SessionLog } from "@/lib/events";
import { listSessions, saveSession } from "@/lib/store";
import { jsonError, readJson } from "@/lib/request";
import { getMap } from "@/lib/store";

export async function GET() {
  try {
    return NextResponse.json({ sessions: await listSessions() });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(req: Request) {
  try {
    const body = await readJson<Partial<Pick<SessionLog, "mode" | "task" | "expertName" | "sourceMapSessionId">>>(req);
    if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "invalid request" }, { status: 400 });
    const mode = body.mode === "teach" ? "teach" : "capture";
    const id = `${mode === "teach" ? "t" : "s"}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    const s = emptySession(id, mode, body.task ?? "Process supplier invoices before month-end close", body.expertName ?? "Sabine");
    if (mode === "teach") {
      if (!body.sourceMapSessionId) return NextResponse.json({ error: "a confirmed source map is required" }, { status: 409 });
      const map = await getMap(body.sourceMapSessionId);
      if (!map?.confirmedAt) return NextResponse.json({ error: "a confirmed source map is required" }, { status: 409 });
      s.sourceMapSessionId = map.sessionId;
      s.sourceMapRevision = map.revision;
    }
    await saveSession(s);
    return NextResponse.json({ session: s });
  } catch (error) {
    return jsonError(error);
  }
}
