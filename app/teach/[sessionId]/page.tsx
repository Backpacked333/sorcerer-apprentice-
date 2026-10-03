import { TeachClient } from "@/components/TeachClient";

export default async function TeachPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  return <TeachClient sessionId={sessionId} agentId={process.env.NEXT_PUBLIC_TUTOR_AGENT_ID || undefined} source={(process.env.NEXT_PUBLIC_EVENT_SOURCE as "vision" | "dom" | "both") || "both"} />;
}
