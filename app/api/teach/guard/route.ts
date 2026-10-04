import { NextResponse } from "next/server";
import { armTeachGuard, disarmTeachGuard, getTeachGuard } from "@/lib/erp";
import { getMap, getSession } from "@/lib/store";

/** Arms or disarms the sandbox's pre-save guard for a teach session. The guard enforces only the confirmed map. */
export async function POST(req: Request) {
  const body = (await req.json()) as { action: "arm" | "disarm"; mapSessionId?: string; teachSessionId?: string };
  if (body.action === "arm" && body.mapSessionId && body.teachSessionId) {
    const map = await getMap(body.mapSessionId);
    const session = await getSession(body.teachSessionId);
    if (!map?.confirmedAt || session?.mode !== "teach" || session.sourceMapSessionId !== map.sessionId || session.sourceMapRevision !== map.revision) return NextResponse.json({ error: "A current, confirmed map and its teach session are required" }, { status: 409 });
    return NextResponse.json({ guard: await armTeachGuard({ mapSessionId: body.mapSessionId, teachSessionId: body.teachSessionId }) });
  }
  if (body.action !== "disarm") return NextResponse.json({ error: "invalid guard action" }, { status: 400 });
  await disarmTeachGuard();
  return NextResponse.json({ guard: null });
}

export async function GET() {
  return NextResponse.json({ guard: await getTeachGuard() });
}
