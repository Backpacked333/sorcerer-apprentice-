export interface SampleCandidate {
  id: string;
  startedAt: number;
  confirmedAt?: number | null;
}

/** Newest confirmed session whose id starts with demo_. */
export function pickSample(sessions: SampleCandidate[]): string | undefined {
  const hits = sessions.filter((s) => s.id.startsWith("demo_") && !!s.confirmedAt);
  hits.sort((a, b) => b.startedAt - a.startedAt);
  return hits[0]?.id;
}
