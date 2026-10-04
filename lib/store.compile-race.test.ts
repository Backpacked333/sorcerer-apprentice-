import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { emptySession } from "./events";
import { emptyMap } from "./workmap";
import { getMap, getSession, saveCompiledMap, saveMap, saveSession } from "./store";
import { POST } from "@/app/api/compile/route";

let root: string;
beforeEach(async () => { root = await fs.mkdtemp(path.join(os.tmpdir(), "tacit-compile-lock-")); vi.stubEnv("DATA_DIR", root); });
afterEach(async () => { vi.restoreAllMocks(); vi.unstubAllEnvs(); await fs.rm(root, { recursive: true, force: true }); });
const deferred = () => { let resolve!: () => void; const promise = new Promise<void>((r) => { resolve = r; }); return { promise, resolve }; };

it("waits for an in-flight session update and returns 409 without overwriting the previous map", async () => {
  const source = emptySession("race", "capture", "Review shipments", "Expert");
  await saveSession(source);
  const previous = emptyMap(source.id, "Previous map", source.expertName);
  await saveMap(previous);
  const pending = deferred(), release = deferred();
  const rename = fs.rename.bind(fs);
  vi.spyOn(fs, "rename").mockImplementation(async (from, to) => {
    if (String(to) === path.join(root, "sessions", "race.json")) {
      pending.resolve();
      await release.promise;
    }
    return rename(from, to);
  });
  const writing = saveSession({ ...source, task: "Corrected evidence" });
  await pending.promise;
  const initialRead = deferred(), read = fs.readFile.bind(fs);
  vi.spyOn(fs, "readFile").mockImplementationOnce(async (...args) => {
    const value = await read(...args);
    initialRead.resolve();
    return value;
  });
  // Hold B until the route has captured A, then require its final check to see B.
  const response = POST(new Request("http://localhost/api/compile", { method: "POST", body: JSON.stringify({ sessionId: source.id, llm: false }) }));
  try {
    await initialRead.promise;
  } finally {
    release.resolve();
  }
  await writing;
  const result = await response;
  expect(result.status).toBe(409);
  expect(await result.json()).toEqual({ error: "session changed during compile; retry" });
  expect(await getMap(source.id)).toMatchObject({ task: "Previous map", revision: 1 });
});

it("holds the session lock until map publication, without blocking a different session", async () => {
  const source = emptySession("publish", "capture", "Review shipments", "Expert");
  await saveSession(source);
  const pending = deferred(), release = deferred(), writes: string[] = [];
  const rename = fs.rename.bind(fs);
  vi.spyOn(fs, "rename").mockImplementation(async (from, to) => {
    if (String(to) === path.join(root, "maps", "publish.json")) { pending.resolve(); await release.promise; }
    await rename(from, to);
    writes.push(String(to));
  });
  const compiling = saveCompiledMap(emptyMap(source.id, source.task, source.expertName), source);
  await pending.promise;
  const writing = saveSession({ ...source, task: "New evidence" });
  try {
    await saveSession(emptySession("other", "capture", "Unrelated", "Expert"));
    expect((await getSession(source.id))?.task).toBe(source.task);
    expect(writes).toEqual([path.join(root, "sessions", "other.json")]);
  } finally {
    release.resolve();
    await Promise.all([compiling, writing]);
  }
  expect(await compiling).toBe(true);
  expect(writes.slice(-2)).toEqual([path.join(root, "maps", "publish.json"), path.join(root, "sessions", "publish.json")]);
  expect((await getSession(source.id))?.task).toBe("New evidence");
});

it("releases the session lock after a map write fails and can retry", async () => {
  const source = emptySession("failure", "capture", "Review shipments", "Expert");
  await saveSession(source);
  const map = emptyMap(source.id, source.task, source.expertName);
  vi.spyOn(fs, "rename").mockRejectedValueOnce(new Error("disk error"));
  await expect(saveCompiledMap(map, source)).rejects.toThrow("disk error");
  await saveSession(source);
  expect(await saveCompiledMap(map, source)).toBe(true);
  expect(await getMap(source.id)).toBeDefined();
});

it("rejects missing or mismatched sources without publishing a map", async () => {
  const source = emptySession("missing", "capture", "Review shipments", "Expert");
  expect(await saveCompiledMap(emptyMap(source.id, source.task, source.expertName), source)).toBe(false);
  await expect(saveCompiledMap(emptyMap("other", source.task, source.expertName), source)).rejects.toThrow("session mismatch");
  expect(await getMap(source.id)).toBeUndefined();
});
