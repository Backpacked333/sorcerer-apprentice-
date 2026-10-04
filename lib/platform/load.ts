/**
 * Server-only loaders for the platform pages. Read through lib/store.ts only; tolerant of missing or corrupt files
 * (each unreadable file is counted, never thrown). Frames' image data and transcripts are dropped right after
 * reading; the derivation returns view models only (no frames, transcript or raw event state reach the client).
 *
 * Demo mode never goes through here: pages import demoPlatform / demoRole / demoOntology from ./demo-data.
 */
import "server-only";
import type { SessionLog } from "../events";
import type { WorkMap } from "../workmap";
import { getMap, getSession, listSessions } from "../store";
import { deriveOntology, derivePlatform, deriveRole, type PlatformInput } from "./derive";
import type { Ontology, PlatformData, RoleMemory } from "./types";

/** Lighten a session for derivation: no image data, no transcript text. Event state stays server-side (ontology values). */
function lighten(s: SessionLog): SessionLog {
  return { ...s, frames: s.frames.map((f) => ({ id: f.id, t: f.t, width: f.width, height: f.height, piiRegionsBlurred: f.piiRegionsBlurred })), transcript: [] };
}

/**
 * Session ids on disk. listSessions() throws if any one file is corrupt; persistence goes through lib/store.ts only
 * (no fs here), so a corrupt file degrades to an empty platform with `unreadable: 1` instead of a 500.
 */
async function sessionIds(): Promise<{ ids: string[]; unreadable: number }> {
  try {
    return { ids: (await listSessions()).map((s) => s.id), unreadable: 0 };
  } catch {
    return { ids: [], unreadable: 1 };
  }
}

export async function loadInput(now = Date.now()): Promise<PlatformInput> {
  const { ids, unreadable: listFail } = await sessionIds();
  let unreadable = listFail;
  const sessions = (await Promise.all(ids.map(async (id) => {
    try {
      const s = await getSession(id);
      return s ? lighten(s) : undefined;
    } catch {
      unreadable++;
      return undefined;
    }
  }))).filter((s): s is SessionLog => !!s);
  const maps: Record<string, WorkMap> = {};
  await Promise.all(sessions.filter((s) => s.mode === "capture").map(async (s) => {
    try {
      const m = await getMap(s.id);
      if (m) maps[s.id] = m;
    } catch {
      unreadable++;
    }
  }));
  return { sessions, maps, unreadable, now };
}

export async function loadPlatform(): Promise<PlatformData> {
  return derivePlatform(await loadInput());
}

export async function loadRole(roleId: string): Promise<{ data: PlatformData; role: RoleMemory | null }> {
  return deriveRole(await loadInput(), roleId);
}

export async function loadOntology(roleId: string): Promise<{ data: PlatformData; ontology: Ontology | null }> {
  return deriveOntology(await loadInput(), roleId);
}
