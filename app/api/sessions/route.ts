import { NextResponse } from "next/server";
import { emptySession, type SessionLog } from "@/lib/events";
import { listSessions, saveSession } from "@/lib/store";

export async function GET() {
  return NextResponse.json({ sessions: await listSessions() });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Partial<Pick<SessionLog, "mode" | "task" | "expertName" | "sourceMapSessionId">>;
  const id = `${body.mode === "teach" ? "t" : "s"}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const s = emptySession(id, body.mode === "teach" ? "teach" : "capture", body.task ?? "Process supplier invoices before month-end close", body.expertName ?? "Sabine");
  if (body.sourceMapSessionId) s.sourceMapSessionId = body.sourceMapSessionId;
  await saveSession(s);
  return NextResponse.json({ session: s });
}
