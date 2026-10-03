/**
 * File-backed persistence for a single Node instance with a persistent DATA_DIR.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import type { SessionLog } from "./events";
import { WorkMapSchema, type WorkMap } from "./workmap";
import type { Invoice } from "./erp-model";
import { currentWorkspace } from "./workspace";

export function dataDir(): string { return process.env.DATA_DIR ?? path.join(process.cwd(), ".data"); }
const dir = (sub: string) => path.join(dataDir(), sub);

function validId(id: string): string {
  if (typeof id !== "string" || !/^[\w-]{1,64}$/.test(id)) throw new Error("Invalid storage id");
  return id;
}

async function orMissing<T>(action: () => Promise<T>): Promise<T | undefined> {
  try {
    return await action();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    return undefined;
  }
}

async function readJson<T>(file: string): Promise<T | undefined> {
  const raw = await orMissing(() => fs.readFile(file, "utf8"));
  return raw === undefined ? undefined : JSON.parse(raw) as T;
}

const locks = new Map<string, Promise<unknown>>();

/** Atomic and serialized per file: a unique temp name, then rename, one writer at a time. */
async function serialized<T>(file: string, action: () => Promise<T>): Promise<T> {
  const prev = locks.get(file) ?? Promise.resolve();
  const next = prev.catch(() => {}).then(action);
  locks.set(file, next);
  try {
    return await next;
  } finally {
    if (locks.get(file) === next) locks.delete(file);
  }
}

async function atomicWrite(file: string, data: string | Uint8Array): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${crypto.randomUUID()}.tmp`;
  try {
    await fs.writeFile(tmp, data);
    await fs.rename(tmp, file);
  } finally {
    await orMissing(() => fs.unlink(tmp));
  }
}

const writeJson = (file: string, data: unknown) => serialized(file, () => atomicWrite(file, JSON.stringify(data)));

/** Always read from disk; missing or corrupt records must never fall back to stale cached data. */
export async function getSession(id: string): Promise<SessionLog | undefined> {
  const s = await readJson<SessionLog>(path.join(dir("sessions"), `${validId(id)}.json`));
  if (s !== undefined && (!s || s.id !== id || !["capture", "teach"].includes(s.mode) || !Number.isFinite(s.startedAt)
    || typeof s.task !== "string" || typeof s.expertName !== "string"
    || (["events", "transcript", "windows", "frames", "offRecord"] as const).some((k) => !Array.isArray(s[k])))) throw new Error("Invalid session");
  return s;
}

export async function saveSession(s: SessionLog): Promise<void> {
  await writeJson(path.join(dir("sessions"), `${validId(s.id)}.json`), s);
}

export async function listSessions(): Promise<Pick<SessionLog, "id" | "mode" | "task" | "expertName" | "startedAt" | "endedAt">[]> {
  const files = await orMissing(() => fs.readdir(dir("sessions"))) ?? [];
  const out = [];
  for (const f of files.filter((f) => f.endsWith(".json"))) {
    const s = await getSession(f.replace(/\.json$/, ""));
    if (s) out.push({ id: s.id, mode: s.mode, task: s.task, expertName: s.expertName, startedAt: s.startedAt, endedAt: s.endedAt });
  }
  return out.sort((a, b) => b.startedAt - a.startedAt);
}

export async function getMap(sessionId: string): Promise<WorkMap | undefined> {
  const raw = await readJson<unknown>(path.join(dir("maps"), `${validId(sessionId)}.json`));
  return raw === undefined ? undefined : WorkMapSchema.parse(raw);
}

export async function saveMap(map: WorkMap): Promise<void> {
  map.revision = (map.revision ?? 0) + 1;
  await writeJson(path.join(dir("maps"), `${validId(map.sessionId)}.json`), map);
}

export async function saveClip(sessionId: string, audioId: string, bytes: Uint8Array): Promise<string> {
  return saveBytes(mediaPath("clips", sessionId, audioId), bytes);
}

export async function readClip(sessionId: string, audioId: string): Promise<Uint8Array | undefined> {
  const file = mediaPath("clips", sessionId, audioId);
  return orMissing(() => fs.readFile(file));
}

function mediaPath(kind: "frames" | "clips", sessionId: string, id: string): string {
  return path.join(dir(kind), validId(sessionId), `${validId(id)}.${kind === "frames" ? "jpg" : "webm"}`);
}
async function saveBytes(file: string, bytes: Uint8Array): Promise<string> {
  await serialized(file, () => atomicWrite(file, bytes));
  return file;
}
const removeFile = (file: string) => serialized(file, async () => (await orMissing(async () => { await fs.unlink(file); return true; })) ?? false);

export async function saveFrame(sessionId: string, frameId: string, bytes: Uint8Array): Promise<string> {
  return saveBytes(mediaPath("frames", sessionId, frameId), bytes);
}
export async function readFrame(sessionId: string, frameId: string): Promise<Uint8Array | undefined> {
  const file = mediaPath("frames", sessionId, frameId);
  return orMissing(() => fs.readFile(file));
}
export async function deleteFrame(sessionId: string, frameId: string): Promise<boolean> { return removeFile(mediaPath("frames", sessionId, frameId)); }
export async function deleteClip(sessionId: string, audioId: string): Promise<boolean> { return removeFile(mediaPath("clips", sessionId, audioId)); }
export async function deleteFrames(sessionId: string, frameIds: string[]): Promise<void> {
  validId(sessionId);
  await Promise.all(frameIds.map((id) => mediaPath("frames", sessionId, id)).map(removeFile));
}
export async function deleteClips(sessionId: string, audioIds: string[]): Promise<void> {
  validId(sessionId);
  await Promise.all(audioIds.map((id) => mediaPath("clips", sessionId, id)).map(removeFile));
}
export async function listFrameIds(sessionId: string): Promise<string[]> {
  const folder = path.join(dir("frames"), validId(sessionId));
  return (await orMissing(() => fs.readdir(folder)) ?? []).filter((f) => /^[\w-]{1,64}\.jpg$/.test(f)).map((f) => f.slice(0, -4)).sort();
}

async function workspaceFile(name: string, ws?: string): Promise<string> {
  return path.join(dir("ws"), validId(ws ?? await currentWorkspace()), name);
}
export async function getErpState(ws?: string): Promise<Invoice[] | undefined> {
  const state = await readJson<Invoice[]>(await workspaceFile("erp.json", ws));
  if (state !== undefined && !Array.isArray(state)) throw new Error("Invalid ERP state");
  return state;
}
export async function saveErpState(invoices: Invoice[], ws?: string): Promise<void> { await writeJson(await workspaceFile("erp.json", ws), invoices); }

export interface GuardRecord { mapSessionId: string; teachSessionId: string; armedAt: number; expiresAt: number }
type Guards = Record<string, GuardRecord>;
async function readGuards(file: string): Promise<Guards> {
  const guards = await readJson<Guards>(file);
  if (guards === undefined) return {};
  if (!guards || typeof guards !== "object" || Array.isArray(guards)) throw new Error("Invalid guards");
  for (const [id, g] of Object.entries(guards)) {
    if (!g || g.teachSessionId !== id || !Number.isFinite(g.armedAt) || !Number.isFinite(g.expiresAt) || g.expiresAt < g.armedAt) throw new Error("Invalid guard");
    validId(id); validId(g.mapSessionId);
  }
  return guards;
}
export async function getGuard(teachSessionId?: string, ws?: string): Promise<GuardRecord | undefined> {
  if (teachSessionId !== undefined) validId(teachSessionId);
  const guards = await readGuards(await workspaceFile("guards.json", ws));
  return Object.values(guards).filter((g) => g.expiresAt > Date.now() && (teachSessionId === undefined || g.teachSessionId === teachSessionId)).sort((a, b) => b.armedAt - a.armedAt)[0];
}
export async function saveGuard(g: { mapSessionId: string; teachSessionId: string; ttlMs?: number }, ws?: string): Promise<GuardRecord> {
  validId(g.mapSessionId); validId(g.teachSessionId);
  const ttl = g.ttlMs ?? 30 * 60 * 1000;
  if (!Number.isFinite(ttl) || ttl < 0) throw new Error("Invalid guard TTL");
  const file = await workspaceFile("guards.json", ws);
  return serialized(file, async () => {
    const guards = await readGuards(file), armedAt = Date.now();
    const record = { mapSessionId: g.mapSessionId, teachSessionId: g.teachSessionId, armedAt, expiresAt: armedAt + ttl };
    await atomicWrite(file, JSON.stringify({ ...guards, [g.teachSessionId]: record }));
    return record;
  });
}
export async function clearGuard(teachSessionId?: string, ws?: string): Promise<void> {
  if (teachSessionId !== undefined) validId(teachSessionId);
  const file = await workspaceFile("guards.json", ws);
  await serialized(file, async () => {
    const guards = await readGuards(file);
    if (teachSessionId !== undefined) delete guards[teachSessionId];
    await atomicWrite(file, JSON.stringify(teachSessionId === undefined ? {} : guards));
  });
}
