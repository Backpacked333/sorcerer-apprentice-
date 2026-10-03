import { VoiceCheck } from "./VoiceCheck";

export default async function VoiceCheckPage({ searchParams }: { searchParams: Promise<{ role?: string; keyless?: string }> }) {
  const query = await searchParams;
  const role = query.role === "tutor" ? "tutor" : "interviewer";
  const configuredAgentId = role === "tutor" ? process.env.NEXT_PUBLIC_TUTOR_AGENT_ID : process.env.NEXT_PUBLIC_INTERVIEWER_AGENT_ID;
  return <VoiceCheck role={role} agentId={query.keyless === "1" ? undefined : configuredAgentId} />;
}
