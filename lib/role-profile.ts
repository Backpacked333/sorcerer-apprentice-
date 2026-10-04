import type { SessionLog } from "./events";
import { buildMemory, visibleAt, type RoleProfile } from "./memory";
import { reasonAbout, reasoningAvailable } from "./reasoning";

export async function compileRoleProfile(log: SessionLog, signal?: AbortSignal): Promise<{ profile?: RoleProfile; note: string }> {
  if (!reasoningAvailable()) return { note: "profile reasoning disabled or unconfigured" };
  const memory = buildMemory(log);
  if (!memory.evidence.length) return { note: "no eligible expert evidence" };
  try {
    return { profile: (await reasonAbout(memory, signal)).profile, note: "proposed profile; expert review required" };
  } catch {
    return { note: "profile reasoning unavailable; map preserved" };
  }
}

/** Recheck against the authoritative source whenever a persisted profile is read. */
export function currentProfile(log: SessionLog, profile: RoleProfile): RoleProfile {
  return { ...profile, relationships: profile.relationships.filter((r) => log.transcript.some((s) =>
    s.id === r.evidenceId && s.speaker === "expert" && s.final && !s.redacted && s.t === r.t
    && visibleAt(log, s.t, s.tEnd) && r.quote.trim().length >= 8 && s.text.includes(r.quote))) };
}
