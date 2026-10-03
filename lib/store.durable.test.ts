import { promises as fs } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const cookie = vi.hoisted(() => ({ value: "a".repeat(64), request: true }));
const supabaseMock = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => {
    if (!cookie.request) throw new Error("outside request");
    return { get: () => ({ value: cookie.value }) };
  }),
}));
vi.mock("@supabase/supabase-js", () => ({ createClient: supabaseMock.createClient }));

import { emptySession } from "./events";
import { emptyMap } from "./workmap";
import { seedInvoices } from "./erp-model";

const ownerA = "a".repeat(64);
const ownerB = "b".repeat(64);
const localOwner = "test_local_seeded_store";
const dataRoot = path.join(process.cwd(), ".data");
const rows = new Map<string, Record<string, unknown>>();
const media = new Map<string, Uint8Array>();
const rateCounts = new Map<string, number>();

function rowKey(table: string, row: Record<string, unknown>): string {
  const id = table === "work_maps" ? row.session_id : table === "erp_state" ? row.owner_id : row.id;
  return `${table}:${row.owner_id}:${id}`;
}

function matches(row: Record<string, unknown>, filters: Record<string, unknown>): boolean {
  return Object.entries(filters).every(([key, value]) => row[key] === value);
}

function makeClient() {
  return {
    from(table: string) {
      let filters: Record<string, unknown> = {};
      let updateValue: Record<string, unknown> | undefined;
      const query: any = {
        select: () => query,
        eq: (key: string, value: unknown) => { filters[key] = value; return query; },
        maybeSingle: async () => {
          const row = [...rows.entries()].find(([key, value]) => key.startsWith(`${table}:`) && matches(value, filters))?.[1];
          return { data: row ?? null, error: null };
        },
        upsert: async (value: Record<string, unknown>) => {
          rows.set(rowKey(table, value), { ...value });
          return { error: null };
        },
        update: (value: Record<string, unknown>) => { updateValue = value; return query; },
        then: (resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) => {
          if (updateValue) for (const [key, row] of rows) if (key.startsWith(`${table}:`) && matches(row, filters)) rows.set(key, { ...row, ...updateValue });
          const data = [...rows.entries()].filter(([key, value]) => key.startsWith(`${table}:`) && matches(value, filters)).map(([, value]) => value);
          return Promise.resolve({ data, error: null }).then(resolve, reject);
        },
      };
      return query;
    },
    rpc: async (name: string, args: Record<string, unknown>) => {
      if (name === "tacit_save_map") {
        const key = `work_maps:${args.p_owner}:${args.p_session}`;
        const old = rows.get(key);
        const revision = Number(old?.revision ?? 0) + 1;
        const data = { ...(args.p_data as object), revision };
        rows.set(key, { owner_id: args.p_owner, session_id: args.p_session, data, revision });
        return { data, error: null };
      }
      if (name === "tacit_rate_limit") {
        const key = `${args.p_owner}:${args.p_bucket}`;
        const count = (rateCounts.get(key) ?? 0) + 1;
        rateCounts.set(key, count);
        return { data: count <= Number(args.p_limit), error: null };
      }
      if (name === "tacit_patch_invoice") return { data: null, error: null };
      throw new Error(`unexpected rpc ${name}`);
    },
    storage: {
      from: () => ({
        upload: async (key: string, bytes: Uint8Array) => {
          media.set(key, new Uint8Array(bytes));
          return { error: null };
        },
        download: async (key: string) => {
          const value = media.get(key);
          if (!value) return { data: null, error: { message: "Object not found" } };
          const buffer = new ArrayBuffer(value.byteLength);
          new Uint8Array(buffer).set(value);
          return { data: new Blob([buffer]), error: null };
        },
        remove: async (keys: string[]) => {
          keys.forEach((key) => media.delete(key));
          return { error: null };
        },
      }),
    },
  };
}

async function loadStore() {
  vi.resetModules();
  return import("./store");
}

beforeEach(() => {
  rows.clear();
  media.clear();
  rateCounts.clear();
  supabaseMock.createClient.mockImplementation(() => makeClient());
  cookie.value = ownerA;
  cookie.request = true;
});

afterEach(async () => {
  cookie.request = true;
  cookie.value = ownerA;
  vi.unstubAllEnvs();
  await Promise.all([ownerA, ownerB, localOwner].map((owner) => fs.rm(path.join(dataRoot, owner), { recursive: true, force: true })));
});

describe("workspace durable store", () => {
  it("isolates sessions, maps, ERP state and private media across owners and module instances", async () => {
    vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-only");
    vi.stubEnv("STORAGE_BACKEND", "supabase");
    let store = await loadStore();

    const session = emptySession("s_1", "capture", "task", "expert");
    await store.saveSession(session);
    const map = emptyMap("s_1", "task", "expert");
    await store.saveMap(map);
    await store.saveErpState({ invoices: [], guard: { teachSessionId: "t_1" } });
    await store.saveErpInvoices([seedInvoices()[0]]);
    await store.saveErpGuard({ teachSessionId: "t_2" });
    const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
    await store.saveFrame("s_1", "f_1", bytes);
    const clip = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3]);
    await store.saveClip("s_1", "a_1", clip);
    const withFrame = { ...session, frames: [{ id: "f_1", t: 1, dataUrl: "/api/sessions/s_1/frames?frameId=f_1", width: 1, height: 1, piiRegionsBlurred: 0 }] };
    await store.saveSession({ ...withFrame, windows: [{ id: "w_1", candidateId: "c_1", kind: "why", question: "why", stepRef: "x", openedAt: 1, answerAudioId: "a_1" }] });

    cookie.value = ownerB;
    expect(await store.getSession("s_1")).toBeUndefined();
    expect(await store.getMap("s_1")).toBeUndefined();
    expect(await store.readFrame("s_1", "f_1")).toBeUndefined();
    expect(await store.getErpState()).toEqual({ invoices: [], guard: null });

    cookie.value = ownerA;
    expect((await store.getSession("s_1"))?.frames).toHaveLength(1);
    expect((await store.getMap("s_1"))?.revision).toBe(1);
    expect(await store.readFrame("s_1", "f_1")).toEqual(bytes);
    expect(await store.readClip("s_1", "a_1")).toEqual(clip);
    expect((await store.getErpState()).guard).toEqual({ teachSessionId: "t_2" });
    expect((await store.getErpState()).invoices).toHaveLength(1);

    store = await loadStore();
    expect(await store.getSession("s_1")).toBeDefined();
    expect((await store.getMap("s_1"))?.revision).toBe(1);
    expect(await store.readFrame("s_1", "f_1")).toEqual(bytes);
    await store.saveSession(session);
    expect(await store.readFrame("s_1", "f_1")).toBeUndefined();
    expect(await store.readClip("s_1", "a_1")).toBeUndefined();
  });

  it("keeps the durable rate limit across fresh store instances", async () => {
    vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-only");
    vi.stubEnv("STORAGE_BACKEND", "supabase");
    let store = await loadStore();
    expect(await store.allowRateLimit("frames", 1, 60)).toBe(true);
    store = await loadStore();
    expect(await store.allowRateLimit("frames", 1, 60)).toBe(false);
  });

  it("keeps the keyless local store usable for seeded CLI sessions", async () => {
    cookie.request = false;
    vi.stubEnv("STORE_OWNER_ID", localOwner);
    vi.stubEnv("SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    vi.stubEnv("STORAGE_BACKEND", "local");
    vi.stubEnv("VERCEL", "");
    const store = await loadStore();
    const session = emptySession("s_seed", "capture", "seed", "expert");
    await store.saveSession(session);
    expect(await store.getSession("s_seed")).toMatchObject({ id: "s_seed", task: "seed" });
    expect(await store.listSessions()).toHaveLength(1);
    const frameBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    await store.saveFrame("s_seed", "f_seed", frameBytes, "image/png");
    const withFrame = { ...session, frames: [{ id: "f_seed", t: 1, dataUrl: "/api/sessions/s_seed/frames?frameId=f_seed", width: 1, height: 1, piiRegionsBlurred: 0 }] };
    await store.saveSession(withFrame);
    expect(await store.readFrame("s_seed", "f_seed")).toEqual(frameBytes);
    await store.saveSession(session);
    expect(await store.readFrame("s_seed", "f_seed")).toBeUndefined();
  });

  it("rejects invalid identifiers, invalid stored maps, partial config, and Vercel fallback", async () => {
    vi.stubEnv("SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    vi.stubEnv("STORAGE_BACKEND", "local");
    vi.stubEnv("VERCEL", "");
    const local = await loadStore();
    await expect(local.getSession("../bad")).rejects.toThrow("invalid identifier");
    vi.stubEnv("STORE_OWNER_ID", localOwner);
    cookie.request = false;
    await fs.mkdir(path.join(dataRoot, localOwner, "maps"), { recursive: true });
    await fs.writeFile(path.join(dataRoot, localOwner, "maps", "s_bad"), JSON.stringify({ invalid: true }));
    await expect(local.getMap("s_bad")).rejects.toThrow("stored data is invalid");

    cookie.request = true;
    cookie.value = ownerA;
    vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    const partial = await loadStore();
    await expect(partial.getSession("s_1")).rejects.toThrow("storage unavailable");

    vi.stubEnv("SUPABASE_URL", "");
    vi.stubEnv("VERCEL", "1");
    const production = await loadStore();
    await expect(production.getSession("s_1")).rejects.toThrow("storage unavailable");
  });
});
