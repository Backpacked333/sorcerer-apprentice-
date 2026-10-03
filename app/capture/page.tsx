import { CaptureClient } from "@/components/CaptureClient";

export default function CapturePage() {
  return (
    <CaptureClient
      agentId={process.env.NEXT_PUBLIC_INTERVIEWER_AGENT_ID || undefined}
      source={(process.env.NEXT_PUBLIC_EVENT_SOURCE as "vision" | "dom" | "both") || "both"}
      governor={{
        silenceSecs: Number(process.env.NEXT_PUBLIC_SILENCE_SECS ?? 2.5),
        stillSecs: Number(process.env.NEXT_PUBLIC_STILL_SECS ?? 2),
        cooldownSecs: Number(process.env.NEXT_PUBLIC_COOLDOWN_SECS ?? 60),
        maxPer10Min: Number(process.env.NEXT_PUBLIC_MAX_QUESTIONS_PER_10MIN ?? 5),
      }}
    />
  );
}
