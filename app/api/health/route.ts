import { NextResponse } from "next/server";
import { listSessions, storageBackend } from "@/lib/store";

export async function GET() {
  const voiceAvailable = Boolean(process.env.ELEVENLABS_API_KEY);
  const gatewayAvailable = Boolean(process.env.AI_GATEWAY_API_KEY);
  const integrations = {
    voice: { available: voiceAvailable, status: voiceAvailable ? "ready" : "degraded" },
    gateway: { available: gatewayAvailable, status: gatewayAvailable ? "ready" : "degraded" },
  };
  let backend: string;
  try {
    backend = storageBackend();
  } catch {
    return NextResponse.json({ ok: false, storage: { configured: false, reachable: false }, integrations }, { status: 503 });
  }
  try {
    await listSessions();
    return NextResponse.json({ ok: true, storage: { configured: true, reachable: true, backend }, integrations });
  } catch {
    return NextResponse.json({ ok: false, storage: { configured: true, reachable: false, backend }, integrations }, { status: 503 });
  }
}
