import { NextResponse } from "next/server";
import type { SessionLog } from "@/lib/events";
import { getMap, getSession, saveSession } from "@/lib/store";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const session = await getSession(id);
  if (!session) return NextResponse.json({ error: "not found" }, { status: 404 });
  const map = await getMap(id);
  return NextResponse.json({ session, map: map ?? null });
}

/** The browser owns the log during a session and syncs the whole thing; last write wins. */
export async function PUT(req: Request, { params }: Ctx) {
  const { id } = await params;
  const body = (await req.json()) as SessionLog;
  if (body.id !== id) return NextResponse.json({ error: "id mismatch" }, { status: 400 });
  await saveSession(body);
  return NextResponse.json({ ok: true, events: body.events.length, frames: body.frames.length });
}
