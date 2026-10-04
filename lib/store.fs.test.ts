import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import * as store from "./store";
import { emptySession } from "./events";
import { seedInvoices } from "./erp-model";
import { currentWorkspace } from "./workspace";
import { WorkMapSchema } from "./workmap";

let root: string;
beforeEach(async () => { root = await fs.mkdtemp(path.join(os.tmpdir(), "tacit-store-")); vi.stubEnv("DATA_DIR", root); vi.stubEnv("STORAGE_BACKEND", "local"); vi.stubEnv("STORE_OWNER_ID", "local"); vi.stubEnv("VERCEL", ""); vi.stubEnv("SUPABASE_URL", ""); vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", ""); });
afterEach(async () => { vi.restoreAllMocks(); vi.unstubAllEnvs(); await fs.rm(root, { recursive: true, force: true }); });

it.each(["Frame", "Clip"] as const)("round-trips, serializes and deletes %s bytes", async (kind) => {
  const save = store[`save${kind}`], read = store[`read${kind}`], remove = store[`delete${kind}`];
  expect(await read("s", "one")).toBeUndefined();
  await Promise.all([save("s", "one", new Uint8Array([1])), save("s", "one", new Uint8Array([2, 3]))]);
  expect(Array.from((await read("s", "one"))!)).toEqual([2, 3]);
  if (kind === "Frame") expect(await store.listFrameIds("s")).toEqual(["one"]);
  expect(await remove("s", "one")).toBe(true);
  expect(await remove("s", "one")).toBe(false);
  await Promise.all([save("s", "one", new Uint8Array([1])), remove("s", "one")]);
  expect(await read("s", "one")).toBeUndefined();
  await Promise.all([save("s", "one", new Uint8Array([1])), save("s", "two", new Uint8Array([2]))]);
  await expect(store[`delete${kind}s`]("s", ["one", "../x"])).rejects.toThrow();
  expect(await read("s", "one")).toBeDefined();
  await store[`delete${kind}s`]("s", ["one", "two"]);
  expect(await read("s", "one")).toBeUndefined();
  expect(await read("s", "two")).toBeUndefined();
  expect(await fs.readdir(path.join(root, "local", "s", `${kind.toLowerCase()}s`))).toEqual([]);
});

it.each(["../x", "", "x/y", "x\\y", "a".repeat(65)])("rejects unsafe path id %j", async (id) => {
  for (const call of [() => store.getSession(id), () => store.saveSession(emptySession(id, "capture", "", "")),
    () => store.getMap(id), () => store.saveFrame(id, "f", new Uint8Array()), () => store.readClip("s", id),
    () => store.deleteFrame("s", id), () => store.deleteClip(id, "c"), () => store.listFrameIds(id),
    () => store.getErpState(id), () => store.saveErpState([], id), () => store.getGuard(id),
    () => store.saveGuard({ mapSessionId: id, teachSessionId: "t" }), () => store.clearGuard(id)]) await expect(call()).rejects.toThrow();
});

it("reads DATA_DIR per call, does not resurrect deleted sessions/maps, and surfaces corruption", async () => {
  expect(store.dataDir()).toBe(root);
  expect(await currentWorkspace()).toBe("local");
  const session = emptySession("session", "capture", "task", "expert");
  await store.saveSession(session);
  expect(await store.getSession(session.id)).toEqual(session);
  const map = WorkMapSchema.parse({ sessionId: "session", task: "task", expert: { name: "expert" }, steps: [], rules: [], slots: [], privacy: {} });
  await store.saveMap(map);
  expect((await store.getMap("session"))?.revision).toBe(1);
  vi.stubEnv("DATA_DIR", path.join(root, "other"));
  expect(await store.getSession(session.id)).toBeUndefined();
  expect(await store.getMap("session")).toBeUndefined();
  expect(await store.listSessions()).toEqual([]);
  vi.stubEnv("DATA_DIR", root);
  await fs.unlink(path.join(root, "local", "sessions", "session"));
  expect(await store.getSession(session.id)).toBeUndefined();
  await fs.unlink(path.join(root, "local", "maps", "session"));
  expect(await store.getMap("session")).toBeUndefined();
  for (const [sub, read] of [["sessions", store.getSession], ["maps", store.getMap]] as const) {
    await fs.mkdir(path.join(root, "local", sub), { recursive: true });
    await fs.writeFile(path.join(root, "local", sub, "bad"), "{");
    await expect(read("bad")).rejects.toThrow();
    await fs.mkdir(path.join(root, "local", sub, "directory"));
    await expect(read("directory")).rejects.toMatchObject({ code: "EISDIR" });
    expect(await read("missing")).toBeUndefined();
  }
  await expect(store.listSessions()).rejects.toThrow();
  await fs.writeFile(path.join(root, "local", "maps", "bad"), "{}");
  await expect(store.getMap("bad")).rejects.toThrow();
  for (const raw of ["null", "{}", "[]"]) {
    await fs.writeFile(path.join(root, "local", "sessions", "bad"), raw);
    await expect(store.getSession("bad")).rejects.toThrow();
  }
});

it("round-trips isolated ERP workspaces and never treats corrupt ERP as missing", async () => {
  expect(await store.getErpSnapshot()).toEqual({ invoices: [], guard: null });
  expect(await store.getErpState()).toBeUndefined();
  const invoices = seedInvoices().slice(0, 1);
  await store.saveErpSnapshot({ invoices, guard: { teachSessionId: "t" } });
  expect(await store.getErpSnapshot()).toEqual({ invoices, guard: { teachSessionId: "t" } });
  await store.saveErpState(invoices);
  expect(await store.getErpState()).toEqual(invoices);
  expect(await store.getErpState("visitor")).toBeUndefined();
  await store.saveErpState([], "visitor");
  expect(await store.getErpState("visitor")).toEqual([]);
  for (const raw of ["{", "null", "[]", "{}", '{"invoices":null}', '{"invoices":[null]}', '{"invoices":[[]]}', '{"invoices":[1]}']) {
    await fs.writeFile(path.join(root, "local", "erp"), raw);
    await expect(store.getErpState()).rejects.toThrow();
    await expect(store.getErpSnapshot()).rejects.toThrow();
  }
});

it("serializes guard updates, expires/rearms per teach session and clears only the chosen workspace", async () => {
  const clock = vi.spyOn(Date, "now").mockReturnValue(1000);
  const arm = (teachSessionId: string, ttlMs?: number, ws?: string) => store.saveGuard({ mapSessionId: "map", teachSessionId, ttlMs }, ws);
  const [first] = await Promise.all([arm("first"), arm("short", 50)]);
  expect(first.expiresAt).toBe(1000 + 30 * 60 * 1000);
  expect(await store.getGuard("first")).toEqual(first);
  clock.mockReturnValue(1049);
  expect(await store.getGuard("short")).toBeDefined();
  clock.mockReturnValue(1050);
  expect(await store.getGuard("short")).toBeUndefined();
  await arm("short", 100);
  expect((await store.getGuard())?.teachSessionId).toBe("short");
  await arm("outside", undefined, "visitor");
  await store.clearGuard("short");
  expect(await store.getGuard()).toEqual(first);
  await store.clearGuard();
  expect(await store.getGuard()).toBeUndefined();
  expect(await store.getGuard("outside", "visitor")).toBeDefined();
  await arm("__proto__");
  expect((await store.getGuard("__proto__"))?.teachSessionId).toBe("__proto__");
  for (const raw of ["{", "null", "[]", '{"bad":{}}']) {
    await fs.writeFile(path.join(root, "local", "guards"), raw);
    await expect(store.getGuard()).rejects.toThrow();
    await expect(arm("first")).rejects.toThrow();
  }
});

it("persists recency across equal timestamps, numeric IDs and rearming", async () => {
  vi.spyOn(Date, "now").mockReturnValue(1000);
  const first = await store.saveGuard({ mapSessionId: "map1", teachSessionId: "first" });
  await fs.writeFile(path.join(root, "local", "guards"), JSON.stringify({ first }));
  expect(await store.getGuard()).toEqual(first);
  const second = await store.saveGuard({ mapSessionId: "map2", teachSessionId: "second" });
  expect(second.armedAt).toBe(first.armedAt);
  expect(await store.getGuard()).toEqual(second);
  await store.saveGuard({ mapSessionId: "map3", teachSessionId: "9" });
  const numeric = await store.saveGuard({ mapSessionId: "map4", teachSessionId: "2" });
  expect(await store.getGuard()).toEqual(numeric);
  const rearmed = await store.saveGuard({ mapSessionId: "map5", teachSessionId: "first" });
  vi.resetModules();
  expect(await (await import("./store")).getGuard()).toEqual(rearmed);
  await store.saveGuard({ mapSessionId: "expired", teachSessionId: "zero", ttlMs: 0 });
  expect(await store.getGuard()).toEqual(rearmed);
});

it("snapshots validated guard input before yielding", async () => {
  vi.spyOn(Date, "now").mockReturnValue(1000);
  const input = { mapSessionId: "map", teachSessionId: "teach", ttlMs: 50 };
  const saving = store.saveGuard(input);
  Object.assign(input, { mapSessionId: "../bad", teachSessionId: "../bad", ttlMs: 0 });
  expect(await saving).toEqual({ mapSessionId: "map", teachSessionId: "teach", armedAt: 1000, expiresAt: 1050 });
  expect((await store.getGuard("teach"))?.mapSessionId).toBe("map");
});

it.each([[undefined, "local"], ["local", undefined]])("orders implicit/explicit workspace writes (%s, %s)", async (first, second) => {
  await Promise.all([store.saveGuard({ mapSessionId: "map", teachSessionId: "teach" }, first), store.clearGuard(undefined, second)]);
  expect(await store.getGuard()).toBeUndefined();
  await Promise.all([store.saveErpState(seedInvoices(), first), store.saveErpState([], second)]);
  expect(await store.getErpState()).toEqual([]);
});

it("keeps the old file on write failure, cleans temp files, and recovers its write queue", async () => {
  await store.saveFrame("s", "f", new Uint8Array([1]));
  vi.spyOn(fs, "rename").mockRejectedValueOnce(new Error("disk error"));
  await expect(store.saveFrame("s", "f", new Uint8Array([2]))).rejects.toThrow("disk error");
  expect(Array.from((await store.readFrame("s", "f"))!)).toEqual([1]);
  expect(await fs.readdir(path.join(root, "local", "s", "frames"))).toEqual(["f.jpg"]);
  await store.saveFrame("s", "f", new Uint8Array([3]));
  expect(Array.from((await store.readFrame("s", "f"))!)).toEqual([3]);
  vi.spyOn(fs, "readFile").mockRejectedValueOnce(Object.assign(new Error("denied"), { code: "EACCES" }));
  await expect(store.getSession("s")).rejects.toMatchObject({ code: "EACCES" });
});
