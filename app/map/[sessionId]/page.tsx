import { MapClient } from "@/components/MapClient";

export default async function MapPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  return <MapClient sessionId={sessionId} agentId={process.env.NEXT_PUBLIC_INTERVIEWER_AGENT_ID || undefined} />;
}
