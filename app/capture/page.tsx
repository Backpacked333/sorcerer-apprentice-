import { CaptureClient } from "@/components/CaptureClient";
import { captureConfig, type CaptureSearchParams } from "@/lib/capture-config";

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function CapturePage({ searchParams }: { searchParams: Promise<CaptureSearchParams> }) {
  const sp = await searchParams;
  const governor = captureConfig(process.env, sp);

  return (
    <CaptureClient
      agentId={process.env.NEXT_PUBLIC_INTERVIEWER_AGENT_ID || undefined}
      source={(process.env.NEXT_PUBLIC_EVENT_SOURCE as "vision" | "dom" | "both") || "both"}
      governor={governor}
      app={first(sp.app) === "claims" ? "claims" : "erp"}
      share0={first(sp.share) === "0"}
    />
  );
}
