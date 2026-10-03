/**
 * Session and Work Map persistence. File-backed JSON under .data/ so a laptop demo survives reloads.
 * Swap the four functions below for Supabase if you deploy to serverless.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import type { SessionLog } from "./events";
import { WorkMapSchema, type WorkMap } from "./workmap";

const DATA_DIR = path.join(process.cwd(), ".data");
const dir = (sub: string) => path.join(DATA_DIR, sub);

type Cache = { sessions: Map<string, SessionLog>; maps: Map<string, WorkMap> };
const g = globalThis as unknown as { __tacitStore?: Cache };
g.__tacitStore ??= { sessions: new Map(), maps: new Map() };
const cache = g.__tacitStore;

async function readJson<T>(file: string): Promise<T | undefined> {
  try {
    return JSON.parse(await fs.readFile(file, "utf8")) as T;
  } catch {
    return undefined;
  }
}

const locks = new Map<string, Promise<void>>();

/** Atomic and serialized per file: a unique temp name, then rename, one writer at a time. */
async function writeJson(file: string, data: unknown) {
  const prev = locks.get(file) ?? Promise.resolve();
  const next = prev
    .catch(() => {})
    .then(async () => {
      await fs.mkdir(path.dirname(file), { recursive: true });
      const tmp = `${file}.${process.pid}.${Math.random().toString(36).slice(2, 8)}.tmp`;
      await fs.writeFile(tmp, JSON.stringify(data));
      await fs.rename(tmp, file);
    });
  locks.set(file, next);
  try {
    await next;
  } finally {
    if (locks.get(file) === next) locks.delete(file);
  }
}

/** Always read from disk: the seed script and other processes write the same files. The cache is a fallback only. */
export async function getSession(id: string): Promise<SessionLog | undefined> {
  const s = await readJson<SessionLog>(path.join(dir("sessions"), `${id}.json`));
  if (s) cache.sessions.set(id, s);
  return s ?? cache.sessions.get(id);
}

export async function saveSession(s: SessionLog): Promise<void> {
  cache.sessions.set(s.id, s);
  await writeJson(path.join(dir("sessions"), `${s.id}.json`), s);
}

export async function listSessions(): Promise<Pick<SessionLog, "id" | "mode" | "task" | "expertName" | "startedAt" | "endedAt">[]> {
  try {
    const files = await fs.readdir(dir("sessions"));
    const out = [];
    for (const f of files.filter((f) => f.endsWith(".json"))) {
      const s = await getSession(f.replace(/\.json$/, ""));
      if (s) out.push({ id: s.id, mode: s.mode, task: s.task, expertName: s.expertName, startedAt: s.startedAt, endedAt: s.endedAt });
    }
    return out.sort((a, b) => b.startedAt - a.startedAt);
  } catch {
    return [];
  }
}

export async function getMap(sessionId: string): Promise<WorkMap | undefined> {
  const raw = await readJson<unknown>(path.join(dir("maps"), `${sessionId}.json`));
  if (!raw) return cache.maps.get(sessionId);
  const parsed = WorkMapSchema.safeParse(raw);
  if (!parsed.success) return cache.maps.get(sessionId);
  cache.maps.set(sessionId, parsed.data);
  return parsed.data;
}

export async function saveMap(map: WorkMap): Promise<void> {
  map.revision = (map.revision ?? 0) + 1;
  cache.maps.set(map.sessionId, map);
  await writeJson(path.join(dir("maps"), `${map.sessionId}.json`), map);
}

export async function saveClip(sessionId: string, audioId: string, bytes: Uint8Array): Promise<string> {
  const file = path.join(dir("clips"), sessionId, `${audioId}.webm`);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, bytes);
  return file;
}

export async function readClip(sessionId: string, audioId: string): Promise<Uint8Array | undefined> {
  try {
    return await fs.readFile(path.join(dir("clips"), sessionId, `${audioId}.webm`));
  } catch {
    return undefined;
  }
}
