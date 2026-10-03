/**
 * The sandbox ERP server state: in memory plus .data/erp.json so a demo survives a reload.
 * Client components import from ./erp-model instead (this file pulls in node:fs).
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { seedInvoices, toInvoiceState, type Invoice, type Queue } from "./erp-model";
import { getMap } from "./store";
import { saveVerdict, type SaveVerdict } from "./matcher";

export * from "./erp-model";

const DATA_DIR = path.join(process.cwd(), ".data");
const FILE = path.join(DATA_DIR, "erp.json");

type ErpGlobal = { invoices: Invoice[] | null; guard: TeachGuard | null };
const g = globalThis as unknown as { __tacitErp?: ErpGlobal };
g.__tacitErp ??= { invoices: null, guard: null };

/** While a teach session is armed, saves in the new-hire queue are checked against the confirmed Work Map before commit. */
export interface TeachGuard {
  mapSessionId: string;
  teachSessionId: string;
  armedAt: number;
}
const GUARD_FILE = path.join(process.cwd(), ".data", "erp-guard.json");

export async function armTeachGuard(guard: Omit<TeachGuard, "armedAt">): Promise<TeachGuard> {
  const value = { ...guard, armedAt: Date.now() };
  g.__tacitErp!.guard = value;
  await fs.mkdir(path.dirname(GUARD_FILE), { recursive: true });
  await fs.writeFile(GUARD_FILE, JSON.stringify(value));
  return value;
}

export async function disarmTeachGuard(): Promise<void> {
  g.__tacitErp!.guard = null;
  await fs.rm(GUARD_FILE, { force: true });
}

export async function getTeachGuard(): Promise<TeachGuard | null> {
  try {
    g.__tacitErp!.guard = JSON.parse(await fs.readFile(GUARD_FILE, "utf8")) as TeachGuard;
  } catch {
    g.__tacitErp!.guard = null;
  }
  return g.__tacitErp!.guard;
}

export type { SaveVerdict } from "./matcher";

/** The authoritative pre-save check at the commit boundary. See saveVerdict in lib/matcher.ts. */
export async function checkSave(inv: Invoice, patch: InvoicePatch): Promise<SaveVerdict> {
  const guard = await getTeachGuard();
  if (!guard || inv.queue !== "newhire") return { blocked: false };
  const map = await getMap(guard.mapSessionId);
  const proposed = toInvoiceState({ ...inv, ...patch });
  return saveVerdict(map, proposed, patch.status === "approved" || patch.status === "posted");
}

/** Always read from disk: the seed script resets the file from another process, and the demo must see it at once. */
async function load(): Promise<Invoice[]> {
  try {
    const raw = await fs.readFile(FILE, "utf8");
    const stored = JSON.parse(raw) as Invoice[];
    // invoices added to the seed since the file was written join the queue
    const missing = seedInvoices().filter((seed) => !stored.some((i) => i.id === seed.id));
    g.__tacitErp!.invoices = [...stored, ...missing];
    if (missing.length) await persist();
  } catch {
    g.__tacitErp!.invoices = seedInvoices();
    await persist();
  }
  return g.__tacitErp!.invoices!;
}

async function persist() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(g.__tacitErp!.invoices, null, 2));
}

export async function listInvoices(queue?: Queue): Promise<Invoice[]> {
  const all = await load();
  return queue ? all.filter((i) => i.queue === queue) : all;
}

export async function getInvoice(id: string): Promise<Invoice | undefined> {
  return (await load()).find((i) => i.id === id);
}

export type InvoicePatch = Partial<Pick<Invoice, "costCenter" | "route" | "status" | "assetNumber" | "notes">>;

export async function patchInvoice(id: string, patch: InvoicePatch): Promise<Invoice | undefined> {
  const all = await load();
  const inv = all.find((i) => i.id === id);
  if (!inv) return undefined;
  Object.assign(inv, patch);
  await persist();
  return inv;
}

export async function resetErp(queue?: Queue): Promise<Invoice[]> {
  const fresh = seedInvoices();
  if (queue) {
    const all = await load();
    g.__tacitErp!.invoices = all.map((i) => (i.queue === queue ? fresh.find((f) => f.id === i.id) ?? i : i));
  } else {
    g.__tacitErp!.invoices = fresh;
  }
  await persist();
  return g.__tacitErp!.invoices!;
}
