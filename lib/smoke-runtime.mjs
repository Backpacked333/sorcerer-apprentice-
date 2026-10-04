import { cpSync, constants, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

const processGroups = new WeakSet();

export function spawnSmoke(command, args, options) {
  if (process.platform === "win32") throw new Error("Smoke requires POSIX process groups (Linux/macOS)");
  const child = spawn(command, args, { ...options, detached: true });
  processGroups.add(child);
  return child;
}

export function isolatedProject(source, root) {
  const project = join(root, "project");
  cpSync(source, project, {
    recursive: true, dereference: true, mode: constants.COPYFILE_FICLONE,
    filter: (file) => !basename(file).startsWith(".env") && ![".git", ".next", ".data", ".worktrees", ".claude", "recordings"].includes(basename(file)),
  });
  const nonce = randomUUID();
  mkdirSync(join(project, "public"), { recursive: true });
  writeFileSync(join(project, "public", `smoke-${nonce}.txt`), nonce);
  return { project, nonce };
}

export function expectedGuardConsole(message, location, base) {
  try {
    const url = new URL(location);
    return url.origin === base && /^\/api\/erp\/invoices\/[^/]+$/.test(url.pathname) &&
      /^Failed to load resource: the server responded with a status of 409\b/.test(message);
  } catch { return false; }
}

export async function stopChild(child, graceMs = 5000) {
  if (child?.pid && processGroups.has(child)) {
    const signalGroup = (signal) => {
      try { process.kill(-child.pid, signal); return true; }
      catch (error) { if (error.code === "ESRCH") return false; throw error; }
    };
    if (signalGroup("SIGTERM")) {
      const deadline = Date.now() + graceMs;
      while (Date.now() < deadline && signalGroup(0)) await delay(Math.min(50, graceMs));
      signalGroup("SIGKILL");
    }
    processGroups.delete(child);
  }
  if (!child?.pid || child.exitCode !== null || child.signalCode !== null) return;
  await new Promise((resolve, reject) => {
    const done = () => { clearTimeout(kill); clearTimeout(bound); resolve(); };
    const kill = setTimeout(() => child.kill("SIGKILL"), graceMs);
    const bound = setTimeout(() => { child.off("exit", done); reject(new Error("Child did not stop")); }, graceMs * 2);
    child.once("exit", done);
    child.kill("SIGTERM");
  });
}

export async function cleanupSmoke(browser, children, root) {
  let failed = false;
  try { await browser?.close(); } catch { failed = true; }
  for (const child of children) {
    try { await stopChild(child); } catch { failed = true; }
  }
  try { rmSync(root, { recursive: true, force: true }); } catch { failed = true; }
  return !failed;
}
