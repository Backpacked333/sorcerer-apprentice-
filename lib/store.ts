import { promises as fs } from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Invoice } from "./erp-model";
import type { SessionLog } from "./events";
import { getWorkspaceId } from "./workspace";
import { WorkMapSchema, type WorkMap } from "./workmap";

const DATA_DIR = path.join(process.cwd(), ".data");
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;
const SUPABASE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || "tacit-media";

export class StorageConfigError extends Error {
  constructor(message = "storage unavailable") {
    super(message);
    this.name = "StorageConfigError";
  }
}
export class StorageDataError extends Error {
  constructor(message = "stored data is invalid") {
    super(message);
    this.name = "StorageDataError";
  }
}
export class InvalidIdError extends Error {
  constructor() {
    super("invalid identifier");
    this.name = "InvalidIdError";
  }
}

type Backend = "local" | "supabase";
type ErpState = { invoices: Invoice[]; guard: unknown | null };
type Supabase = SupabaseClient;
let supabase: Supabase | undefined;

function backend(): Backend {
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const selection = process.env.STORAGE_BACKEND;
  if (!!url !== !!key) throw new StorageConfigError();
  if (selection && selection !== "local" && selection !== "supabase") throw new StorageConfigError();
  if (selection === "supabase" || process.env.VERCEL) {
    if (!url || !key) throw new StorageConfigError();
    return "supabase";
  }
  if (selection === "local") return "local";
  return url && key ? "supabase" : "local";
}

function db(): Supabase {
  if (typeof window !== "undefined") throw new StorageConfigError();
  if (supabase) return supabase;
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) throw new StorageConfigError();
  supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return supabase;
}

function assertId(value: string): void {
  if (!SAFE_ID.test(value)) throw new InvalidIdError();
}

async function owner(): Promise<string> {
  const value = await getWorkspaceId();
  assertId(value);
  return value;
}

function localPath(workspace: string, ...parts: string[]): string {
  assertId(workspace);
  parts.forEach(assertId);
  return path.join(DATA_DIR, workspace, ...parts);
}

function localMediaPath(workspace: string, sessionId: string, kind: "frames" | "clips", id: string, extension: "jpg" | "png" | "webm"): string {
  assertId(workspace);
  assertId(sessionId);
  assertId(id);
  return path.join(DATA_DIR, workspace, sessionId, kind, `${id}.${extension}`);
}

async function readJson<T>(file: string): Promise<T | undefined> {
  try {
    return JSON.parse(await fs.readFile(file, "utf8")) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

const locks = new Map<string, Promise<void>>();
async function writeJson(file: string, data: unknown): Promise<void> {
  const previous = locks.get(file) ?? Promise.resolve();
  const next = previous.catch(() => {}).then(async () => {
    await fs.mkdir(path.dirname(file), { recursive: true });
    const temporary = `${file}.${process.pid}.${Math.random().toString(36).slice(2, 8)}.tmp`;
    await fs.writeFile(temporary, JSON.stringify(data));
    await fs.rename(temporary, file);
  });
  locks.set(file, next);
  try {
    await next;
  } finally {
    if (locks.get(file) === next) locks.delete(file);
  }
}

function mediaRefs(log: SessionLog): { frames: Set<string>; clips: Set<string> } {
  return {
    frames: new Set(log.frames.map((frame) => frame.id)),
    clips: new Set(log.windows.flatMap((window) => (window.answerAudioId ? [window.answerAudioId] : []))),
  };
}

function evidenceWithdrawn(previous: SessionLog, next: SessionLog): boolean {
  const before = mediaRefs(previous);
  const after = mediaRefs(next);
  return [...before.frames].some((id) => !after.frames.has(id))
    || [...before.clips].some((id) => !after.clips.has(id))
    || JSON.stringify(previous.offRecord) !== JSON.stringify(next.offRecord);
}

function objectPath(workspace: string, sessionId: string, kind: "frames" | "clips", id: string, extension = kind === "frames" ? "jpg" : "webm"): string {
  assertId(sessionId);
  assertId(id);
  return `${workspace}/${sessionId}/${kind}/${id}.${extension}`;
}

async function deleteDerivedMap(workspace: string, sessionId: string): Promise<void> {
  if (backend() === "supabase") {
    const { error } = await db().from("work_maps").delete().eq("owner_id", workspace).eq("session_id", sessionId);
    if (error) throw error;
    return;
  }
  await fs.rm(localPath(workspace, "maps", sessionId), { force: true });
}

async function deleteRemovedMedia(workspace: string, previous: SessionLog | undefined, next: SessionLog): Promise<void> {
  if (!previous) return;
  const before = mediaRefs(previous);
  const after = mediaRefs(next);
  const removed = [
    ...[...before.frames].filter((id) => !after.frames.has(id)).flatMap((id) => [objectPath(workspace, next.id, "frames", id, "jpg"), objectPath(workspace, next.id, "frames", id, "png")]),
    ...[...before.clips].filter((id) => !after.clips.has(id)).map((id) => objectPath(workspace, next.id, "clips", id)),
  ];
  if (!removed.length) return;
  if (backend() === "supabase") {
    const { error } = await db().storage.from(SUPABASE_BUCKET).remove(removed);
    if (error) throw error;
    return;
  }
  await Promise.all(removed.map(async (key) => {
    const parts = key.split("/");
    const extension = parts[3].slice(parts[3].lastIndexOf(".") + 1) as "jpg" | "png" | "webm";
    const id = parts[3].slice(0, -(extension.length + 1));
    await fs.rm(localMediaPath(workspace, parts[1], parts[2] as "frames" | "clips", id, extension), { force: true });
  }));
}

export async function getSession(id: string): Promise<SessionLog | undefined> {
  assertId(id);
  const workspace = await owner();
  if (backend() === "supabase") {
    const { data, error } = await db().from("sessions").select("data").eq("owner_id", workspace).eq("id", id).maybeSingle();
    if (error) throw error;
    return (data?.data as SessionLog | undefined) ?? undefined;
  }
  return readJson<SessionLog>(localPath(workspace, "sessions", id));
}

export async function saveSession(session: SessionLog): Promise<void> {
  assertId(session.id);
  const workspace = await owner();
  const previous = await getSession(session.id);
  if (previous && evidenceWithdrawn(previous, session)) await deleteDerivedMap(workspace, session.id);
  await deleteRemovedMedia(workspace, previous, session);
  if (backend() === "supabase") {
    const { error } = await db().from("sessions").upsert({ owner_id: workspace, id: session.id, data: session }, { onConflict: "owner_id,id" });
    if (error) throw error;
  } else {
    await writeJson(localPath(workspace, "sessions", session.id), session);
  }
}

export async function listSessions(): Promise<Pick<SessionLog, "id" | "mode" | "task" | "expertName" | "startedAt" | "endedAt">[]> {
  const workspace = await owner();
  if (backend() === "supabase") {
    const { data, error } = await db().from("sessions").select("data").eq("owner_id", workspace);
    if (error) throw error;
    return (data ?? []).map((row) => row.data as SessionLog)
      .map(({ id, mode, task, expertName, startedAt, endedAt }) => ({ id, mode, task, expertName, startedAt, endedAt }))
      .sort((a, b) => b.startedAt - a.startedAt);
  }
  let files: string[];
  try {
    files = await fs.readdir(localPath(workspace, "sessions"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
  const sessions = await Promise.all(files.filter((file) => SAFE_ID.test(file)).map((file) => readJson<SessionLog>(localPath(workspace, "sessions", file))));
  return sessions.filter((session): session is SessionLog => !!session)
    .map(({ id, mode, task, expertName, startedAt, endedAt }) => ({ id, mode, task, expertName, startedAt, endedAt }))
    .sort((a, b) => b.startedAt - a.startedAt);
}

export async function getMap(sessionId: string): Promise<WorkMap | undefined> {
  assertId(sessionId);
  const workspace = await owner();
  let raw: unknown;
  if (backend() === "supabase") {
    const { data, error } = await db().from("work_maps").select("data,revision").eq("owner_id", workspace).eq("session_id", sessionId).maybeSingle();
    if (error) throw error;
    if (!data) return undefined;
    raw = { ...(data.data as object), revision: (data.data as { revision?: number }).revision ?? data.revision };
  } else {
    raw = await readJson<unknown>(localPath(workspace, "maps", sessionId));
    if (!raw) return undefined;
  }
  const parsed = WorkMapSchema.safeParse(raw);
  if (!parsed.success) throw new StorageDataError();
  return parsed.data;
}

export async function saveMap(map: WorkMap): Promise<void> {
  assertId(map.sessionId);
  const workspace = await owner();
  if (backend() === "supabase") {
    const { data, error } = await db().rpc("tacit_save_map", {
      p_owner: workspace,
      p_session: map.sessionId,
      p_data: { ...map, revision: map.revision ?? 0 },
    });
    if (error) throw error;
    const parsed = WorkMapSchema.safeParse(data);
    if (!parsed.success) throw new StorageDataError();
    Object.assign(map, parsed.data);
    return;
  }
  map.revision = (map.revision ?? 0) + 1;
  await writeJson(localPath(workspace, "maps", map.sessionId), map);
}

async function saveObject(kind: "frames" | "clips", sessionId: string, id: string, bytes: Uint8Array, contentType: string): Promise<string> {
  const workspace = await owner();
  const key = objectPath(workspace, sessionId, kind, id);
  if (backend() === "supabase") {
    const { error } = await db().storage.from(SUPABASE_BUCKET).upload(key, bytes, { contentType, upsert: true, cacheControl: "0" });
    if (error) throw error;
  } else {
    const extension = kind === "frames" ? "jpg" : "webm";
    const file = localMediaPath(workspace, sessionId, kind, id, extension);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, bytes);
  }
  return key;
}

async function readObject(kind: "frames" | "clips", sessionId: string, id: string, extension = kind === "frames" ? "jpg" : "webm"): Promise<Uint8Array | undefined> {
  const workspace = await owner();
  const key = objectPath(workspace, sessionId, kind, id, extension);
  if (backend() === "supabase") {
    // Storage CDN invalidation can lag deletion; withdrawn evidence must never use a cached object.
    const { data, error } = await db().storage.from(SUPABASE_BUCKET).download(key, { cacheNonce: randomUUID() }, { cache: "no-store" });
    if (error) {
      if (error.message.toLowerCase().includes("not found")) return undefined;
      throw error;
    }
    return new Uint8Array(await data.arrayBuffer());
  }
  try {
    const localExtension = extension as "jpg" | "png" | "webm";
    return new Uint8Array(await fs.readFile(localMediaPath(workspace, sessionId, kind, id, localExtension)));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

export async function saveClip(sessionId: string, audioId: string, bytes: Uint8Array): Promise<string> {
  return saveObject("clips", sessionId, audioId, bytes, "audio/webm");
}
export async function readClip(sessionId: string, audioId: string): Promise<Uint8Array | undefined> {
  return readObject("clips", sessionId, audioId);
}
export async function deleteClip(sessionId: string, audioId: string): Promise<void> {
  const workspace = await owner();
  const key = objectPath(workspace, sessionId, "clips", audioId);
  if (backend() === "supabase") {
    const { error } = await db().storage.from(SUPABASE_BUCKET).remove([key]);
    if (error) throw error;
    return;
  }
  await fs.rm(localMediaPath(workspace, sessionId, "clips", audioId, "webm"), { force: true });
}
export async function saveFrame(sessionId: string, frameId: string, bytes: Uint8Array, contentType: "image/jpeg" | "image/png" = "image/jpeg"): Promise<string> {
  const workspace = await owner();
  const extension = contentType === "image/png" ? "png" : "jpg";
  const key = objectPath(workspace, sessionId, "frames", frameId, extension);
  if (backend() === "supabase") {
    const { error } = await db().storage.from(SUPABASE_BUCKET).upload(key, bytes, { contentType, upsert: true, cacheControl: "0" });
    if (error) throw error;
  } else {
    const file = localMediaPath(workspace, sessionId, "frames", frameId, extension);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, bytes);
  }
  return key;
}
export async function readFrame(sessionId: string, frameId: string): Promise<Uint8Array | undefined> {
  return (await readObject("frames", sessionId, frameId, "jpg")) ?? readObject("frames", sessionId, frameId, "png");
}

export async function allowRateLimit(bucket: string, limit: number, seconds: number): Promise<boolean> {
  assertId(bucket);
  const workspace = await owner();
  if (backend() === "supabase") {
    const { data, error } = await db().rpc("tacit_rate_limit", { p_owner: workspace, p_bucket: bucket, p_limit: limit, p_seconds: seconds });
    if (error) throw error;
    return data === true;
  }
  const file = localPath(workspace, "rate-limits", bucket);
  const now = Math.floor(Date.now() / 1000 / seconds);
  const previous = (await readJson<{ window: number; count: number }>(file)) ?? { window: now, count: 0 };
  const value = previous.window === now ? { window: now, count: previous.count + 1 } : { window: now, count: 1 };
  await writeJson(file, value);
  return value.count <= limit;
}

export async function getErpState(): Promise<{ invoices: Invoice[]; guard: unknown | null }> {
  const workspace = await owner();
  if (backend() === "supabase") {
    const { data, error } = await db().from("erp_state").select("invoices,guard").eq("owner_id", workspace).maybeSingle();
    if (error) throw error;
    return { invoices: (data?.invoices as Invoice[] | undefined) ?? [], guard: data?.guard ?? null };
  }
  return (await readJson<{ invoices: Invoice[]; guard: unknown | null }>(localPath(workspace, "erp"))) ?? { invoices: [], guard: null };
}

export async function saveErpState(state: { invoices: Invoice[]; guard: unknown | null }): Promise<void> {
  const workspace = await owner();
  if (backend() === "supabase") {
    const { error } = await db().from("erp_state").upsert({ owner_id: workspace, invoices: state.invoices, guard: state.guard }, { onConflict: "owner_id" });
    if (error) throw error;
    return;
  }
  await writeJson(localPath(workspace, "erp"), state);
}

export async function saveErpInvoices(invoices: Invoice[]): Promise<void> {
  const workspace = await owner();
  if (backend() === "supabase") {
    const client = db();
    const { data, error } = await client.from("erp_state").select("owner_id").eq("owner_id", workspace).maybeSingle();
    if (error) throw error;
    if (data) {
      const { error: updateError } = await client.from("erp_state").update({ invoices }).eq("owner_id", workspace);
      if (updateError) throw updateError;
    } else {
      const { error: insertError } = await client.from("erp_state").upsert({ owner_id: workspace, invoices, guard: null }, { onConflict: "owner_id" });
      if (insertError) throw insertError;
    }
    return;
  }
  const state = await getErpState();
  await saveErpState({ ...state, invoices });
}

export async function saveErpGuard(guard: unknown | null): Promise<void> {
  const workspace = await owner();
  if (backend() === "supabase") {
    const client = db();
    const { data, error } = await client.from("erp_state").select("owner_id").eq("owner_id", workspace).maybeSingle();
    if (error) throw error;
    if (data) {
      const { error: updateError } = await client.from("erp_state").update({ guard }).eq("owner_id", workspace);
      if (updateError) throw updateError;
    } else {
      const { error: insertError } = await client.from("erp_state").upsert({ owner_id: workspace, invoices: [], guard }, { onConflict: "owner_id" });
      if (insertError) throw insertError;
    }
    return;
  }
  const state = await getErpState();
  await saveErpState({ ...state, guard });
}

export async function patchErpInvoice(id: string, patch: Partial<Invoice>): Promise<Invoice | undefined> {
  assertId(id);
  const workspace = await owner();
  if (backend() === "supabase") {
    const { data, error } = await db().rpc("tacit_patch_invoice", { p_owner: workspace, p_id: id, p_patch: patch });
    if (error) throw error;
    return (data as Invoice | null) ?? undefined;
  }
  const state = await getErpState();
  const invoice = state.invoices.find((item) => item.id === id);
  if (!invoice) return undefined;
  Object.assign(invoice, patch);
  await saveErpState(state);
  return invoice;
}

export function storageBackend(): Backend {
  return backend();
}
