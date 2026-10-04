import { NextResponse } from "next/server";
import type { SessionLog } from "@/lib/events";
import { getMap, getSession, saveSession } from "@/lib/store";
import { jsonError, readJson } from "@/lib/request";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const session = await getSession(id);
    if (!session) return NextResponse.json({ error: "not found" }, { status: 404 });
    const map = await getMap(id);
    return NextResponse.json({ session, map: map ?? null });
  } catch (error) {
    return jsonError(error);
  }
}

/** The browser owns the log during a session and syncs the whole thing; last write wins. */
export async function PUT(req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    if (!await getSession(id)) return NextResponse.json({ error: "not found" }, { status: 404 });
    const body = await readJson<SessionLog>(req);
    if (!body || typeof body !== "object" || body.id !== id || !Array.isArray(body.events) || !Array.isArray(body.transcript) || !Array.isArray(body.windows) || !Array.isArray(body.frames) || !Array.isArray(body.offRecord)) return NextResponse.json({ error: "invalid session log" }, { status: 400 });
    const invalidFrame = body.frames.some((frame) => !frame || typeof frame.id !== "string" || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(frame.id) || typeof frame.dataUrl !== "string" || frame.dataUrl !== `/api/sessions/${encodeURIComponent(id)}/frames?frameId=${encodeURIComponent(frame.id)}`);
    const invalidClip = body.windows.some((window) => !window || typeof window !== "object" || (window.answerAudioId !== undefined && (typeof window.answerAudioId !== "string" || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(window.answerAudioId))));
    if (invalidFrame || invalidClip) return NextResponse.json({ error: "invalid media reference" }, { status: 400 });
    await saveSession(body);
    return NextResponse.json({ ok: true, events: body.events.length, frames: body.frames.length });
  } catch (error) {
    return jsonError(error);
  }
}
