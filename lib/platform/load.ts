/**
 * Server-only loaders for the platform pages. Read through lib/store.ts only; tolerant of missing or corrupt files
 * (each unreadable file is counted, never thrown). Frames' image data and transcripts are dropped right after
 * reading; the derivation returns view models only (no frames, transcript or raw event state reach the client).
 *
 * Server-only by construction (imports lib/store.ts, which uses node:fs); never import it from a client component.
 * Demo mode never goes through here: pages import demoPlatform / demoRole / demoOntology from ./demo-data.
 */
import type { SessionLog } from "../events";
import type { WorkMap } from "../workmap";
import { getMap, getSession, listSessions } from "../store";
import { deriveOntology, derivePlatform, deriveRole, type PlatformInput } from "./derive";
import type { Ontology, PlatformData, RoleMemory } from "./types";

/** Lighten a session for derivation: no image data, no transcript text. Event state stays server-side (ontology values). */
function lighten(s: SessionLog): SessionLog {
  return { ...s, frames: s.frames.map((f) => ({ id: f.id, t: f.t, width: f.width, height: f.height, piiRegionsBlurred: f.piiRegionsBlurred })), transcript: [] };
}

/** Session ids on disk. Corrupt files are skipped, so one bad session never empties the platform. */
async function sessionIds(): Promise<{ ids: string[]; unreadable: number }> {
  try {
    return { ids: (await listSessions({ skipInvalid: true })).map((s) => s.id), unreadable: 0 };
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
