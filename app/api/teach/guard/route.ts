import { NextResponse } from "next/server";
import { armTeachGuard, disarmTeachGuard, getTeachGuard } from "@/lib/erp";

/** Arms or disarms the sandbox's pre-save guard for a teach session. The guard enforces only the confirmed map. */
export async function POST(req: Request) {
  const body = (await req.json()) as { action: "arm" | "disarm"; mapSessionId?: string; teachSessionId?: string };
  if (body.action === "arm" && body.mapSessionId && body.teachSessionId) return NextResponse.json({ guard: await armTeachGuard({ mapSessionId: body.mapSessionId, teachSessionId: body.teachSessionId }) });
  await disarmTeachGuard();
  return NextResponse.json({ guard: null });
}

export async function GET() {
  return NextResponse.json({ guard: await getTeachGuard() });
}
