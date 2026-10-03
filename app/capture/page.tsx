import { CaptureClient } from "@/components/CaptureClient";
import { captureConfig, type CaptureSearchParams } from "@/lib/capture-config";

export default async function CapturePage({ searchParams }: { searchParams: Promise<CaptureSearchParams> }) {
  const governor = captureConfig(process.env, await searchParams);

  return (
    <CaptureClient
      agentId={process.env.NEXT_PUBLIC_INTERVIEWER_AGENT_ID || undefined}
      source={(process.env.NEXT_PUBLIC_EVENT_SOURCE as "vision" | "dom" | "both") || "both"}
      governor={governor}
    />
  );
}
