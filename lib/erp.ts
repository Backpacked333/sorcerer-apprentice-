/**
 * Server ERP access. Durable state lives behind lib/store so browser visitors
 * never share invoices or teach guards.
 */
import { seedInvoices, toInvoiceState, type Invoice, type Queue } from "./erp-model";
import { getMap, getSession, getErpState, patchErpInvoice, saveErpGuard, saveErpInvoices, saveErpState } from "./store";
import { saveVerdict, type SaveVerdict } from "./matcher";

export * from "./erp-model";

export interface TeachGuard {
  mapSessionId: string;
  teachSessionId: string;
  armedAt: number;
}

export async function armTeachGuard(guard: Omit<TeachGuard, "armedAt">): Promise<TeachGuard> {
  const value = { ...guard, armedAt: Date.now() };
  await saveErpGuard(value);
  return value;
}

export async function disarmTeachGuard(): Promise<void> {
  const state = await getErpState();
  if (state.guard !== null) await saveErpGuard(null);
}

export async function getTeachGuard(): Promise<TeachGuard | null> {
  const state = await getErpState();
  return state.guard && typeof state.guard === "object" ? state.guard as TeachGuard : null;
}

export type { SaveVerdict } from "./matcher";

export async function checkSave(inv: Invoice, patch: InvoicePatch): Promise<SaveVerdict> {
  const guard = await getTeachGuard();
  if (!guard || inv.queue !== "newhire") return { blocked: false };
  const map = await getMap(guard.mapSessionId);
  const session = await getSession(guard.teachSessionId);
  if (!map?.confirmedAt || session?.mode !== "teach" || session.sourceMapSessionId !== map.sessionId || session.sourceMapRevision !== map.revision) {
    return { blocked: true, reason: "the teach guard is no longer valid" };
  }
  const proposed = toInvoiceState({ ...inv, ...patch });
  return saveVerdict(map, proposed, patch.status === "approved" || patch.status === "posted");
}

async function load(): Promise<Invoice[]> {
  const state = await getErpState();
  if (state.invoices.length) return state.invoices;
  const invoices = seedInvoices();
  await saveErpInvoices(invoices);
  return invoices;
}

export async function listInvoices(queue?: Queue): Promise<Invoice[]> {
  const all = await load();
  return queue ? all.filter((invoice) => invoice.queue === queue) : all;
}

export async function getInvoice(id: string): Promise<Invoice | undefined> {
  return (await load()).find((invoice) => invoice.id === id);
}

export type InvoicePatch = Partial<Pick<Invoice, "costCenter" | "route" | "status" | "assetNumber" | "notes">>;

export async function patchInvoice(id: string, patch: InvoicePatch): Promise<Invoice | undefined> {
  await load();
  return patchErpInvoice(id, patch);
}

export async function resetErp(queue?: Queue): Promise<Invoice[]> {
  const state = await getErpState();
  const fresh = seedInvoices();
  const invoices = queue
    ? (state.invoices.length ? state.invoices : fresh).map((invoice) => invoice.queue === queue ? fresh.find((next) => next.id === invoice.id) ?? invoice : invoice)
    : fresh;
  await saveErpInvoices(invoices);
  return invoices;
}
