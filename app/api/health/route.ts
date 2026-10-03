import { NextResponse } from "next/server";
import { gatewayConfigured } from "@/lib/model-contracts";
import { listSessions, storageBackend } from "@/lib/store";

export async function GET() {
  const voiceConfiguration = {
    apiKey: Boolean(process.env.ELEVENLABS_API_KEY),
    interviewerAgent: Boolean(process.env.NEXT_PUBLIC_INTERVIEWER_AGENT_ID),
    tutorAgent: Boolean(process.env.NEXT_PUBLIC_TUTOR_AGENT_ID),
  };
  const voiceConfigured = Object.values(voiceConfiguration).every(Boolean);
  const gatewayIsConfigured = gatewayConfigured();
  const integrations = {
    voice: {
      configured: voiceConfigured,
      ...voiceConfiguration,
      status: voiceConfigured ? "configured" : "degraded",
    },
    gateway: { configured: gatewayIsConfigured, status: gatewayIsConfigured ? "configured" : "degraded" },
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
