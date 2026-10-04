import { NextResponse } from "next/server";
import { gatewayConfigured } from "@/lib/model-contracts";
import { listSessions, storageBackend } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
  const sha = process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.COMMIT_SHA ?? process.env.RAILWAY_GIT_COMMIT_SHA ?? "";
  const identity = {
    commit: /^[a-f0-9]{7,40}$/i.test(sha) ? sha : "unknown",
    keys: { elevenlabs: voiceConfiguration.apiKey, gateway: gatewayIsConfigured },
    agents: {
      interviewer: voiceConfiguration.interviewerAgent, tutor: voiceConfiguration.tutorAgent,
      private: process.env.ELEVENLABS_PRIVATE_AGENTS === "1",
      ttsModel: /^eleven_[a-z0-9_]+$/.test(process.env.ELEVENLABS_TTS_MODEL ?? "") ? process.env.ELEVENLABS_TTS_MODEL : "unconfigured",
    },
  };
  const respond = (storage: { configured: boolean; reachable: boolean; backend?: string }) =>
    NextResponse.json({ ok: storage.reachable, store: storage.backend, storage, integrations, ...identity },
      { status: storage.reachable ? 200 : 503, headers: { "Cache-Control": "no-store" } });
  let backend: string;
  try {
    backend = storageBackend();
  } catch {
    return respond({ configured: false, reachable: false });
  }
  try {
    await listSessions();
    return respond({ configured: true, reachable: true, backend });
  } catch {
    return respond({ configured: true, reachable: false, backend });
  }
}
