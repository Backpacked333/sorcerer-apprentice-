import { getMap, getSession } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  let present = false;
  try {
    const records = await Promise.all(["demo_sabine", "demo_sabine_confirmed"]
      .flatMap((id) => [getSession(id), getMap(id)]));
    present = records.every(Boolean);
  } catch {
    // Readiness fails closed; filesystem errors must not expose server paths.
  }
  const sha = process.env.RAILWAY_GIT_COMMIT_SHA ?? process.env.COMMIT_SHA ?? "";
  return Response.json({
    ok: present, store: "fs", commit: /^[a-f0-9]{7,40}$/i.test(sha) ? sha : "unknown",
    keys: { elevenlabs: !!process.env.ELEVENLABS_API_KEY, gateway: !!process.env.AI_GATEWAY_API_KEY },
    agents: {
      interviewer: !!process.env.NEXT_PUBLIC_INTERVIEWER_AGENT_ID,
      tutor: !!process.env.NEXT_PUBLIC_TUTOR_AGENT_ID,
      private: process.env.ELEVENLABS_PRIVATE_AGENTS === "1",
      ttsModel: /^eleven_[a-z0-9_]+$/.test(process.env.ELEVENLABS_TTS_MODEL ?? "")
        ? process.env.ELEVENLABS_TTS_MODEL : "unconfigured",
    },
    sample: { present },
  }, { status: present ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
