import { afterEach, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { cleanupSmoke, expectedGuardConsole, isolatedProject, stopChild } from "./smoke-runtime.mjs";

const roots: string[] = [];
const temp = () => { const root = mkdtempSync(join(tmpdir(), "smoke-test-")); roots.push(root); return root; };
afterEach(() => roots.forEach((root) => rmSync(root, { recursive: true, force: true })));

it("copies source/dependencies but never dotenv, stored data or a previous build", () => {
  const source = temp(), root = temp();
  for (const dir of ["node_modules/package", ".next", ".data", ".worktrees/another"]) {
    mkdirSync(join(source, dir), { recursive: true });
    writeFileSync(join(source, dir, "fixture"), "synthetic");
  }
  for (const name of [".env", ".env.local", ".env.production", ".env.production.local", "node_modules/package/.env"]) writeFileSync(join(source, name), "TEST_PROVIDER_API_KEY=dummy");
  writeFileSync(join(source, "package.json"), "{}");
  const { project, nonce } = isolatedProject(source, root);
  expect(existsSync(join(project, "package.json"))).toBe(true);
  expect(existsSync(join(project, "node_modules/package/fixture"))).toBe(true);
  for (const name of [".env", ".env.local", ".env.production", ".env.production.local", "node_modules/package/.env", ".next", ".data", ".worktrees"]) expect(existsSync(join(project, name))).toBe(false);
  expect(readFileSync(join(project, "public", `smoke-${nonce}.txt`), "utf8")).toBe(nonce);
  expect(isolatedProject(source, temp()).nonce).not.toBe(nonce);
});

it("cleans server and data even when browser shutdown rejects", async () => {
  const root = temp();
  const child = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"]);
  await once(child, "spawn");
  expect(await cleanupSmoke({ close: async () => { throw new Error("disconnected"); } }, [child], root)).toBe(false);
  expect(child.signalCode).toBe("SIGTERM");
  expect(existsSync(root)).toBe(false);
});

it("does not wait for an already signalled or failed child", async () => {
  const child = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"]);
  await once(child, "spawn");
  child.kill("SIGTERM");
  await once(child, "exit");
  await stopChild(child);
  await stopChild(undefined);
});

it("forcibly terminates a child that ignores graceful shutdown", async () => {
  const child = spawn(process.execPath, ["-e", "process.on('SIGTERM', () => {}); console.log('ready'); setInterval(() => {}, 1000)"]);
  await once(child.stdout!, "data");
  await stopChild(child, 50);
  expect(child.signalCode).toBe("SIGKILL");
});

it("only exempts the intentional ERP 409 resource diagnostic", () => {
  const message = "Failed to load resource: the server responded with a status of 409 (Conflict)";
  expect(expectedGuardConsole(message, "http://localhost:3077/api/erp/invoices/fixture", "http://localhost:3077")).toBe(true);
  for (const url of ["", "https://other.test/api/erp/invoices/fixture", "http://localhost:3077/api/compile", "http://localhost:3077/_next/app.js"]) expect(expectedGuardConsole(message, url, "http://localhost:3077")).toBe(false);
  expect(expectedGuardConsole("Unexpected app error", "http://localhost:3077/api/erp/invoices/fixture", "http://localhost:3077")).toBe(false);
});
