/**
 * Pure helpers for the sandbox invoice form. No business reasons live here.
 */
import { toInvoiceState, type Invoice, type Queue } from "./erp-model";
import type { InvoiceState } from "./workmap";

export type SaveDecision = "post" | "hold";

export function decisionOf(inv: { status: string }): SaveDecision {
  return inv.status === "hold" ? "hold" : "post";
}

/** What a successful save commits. A held draft stays held; everything else posts. */
export function commitStatus(inv: { status: string }): "posted" | "hold" {
  return decisionOf(inv) === "hold" ? "hold" : "posted";
}

export function canCommit(inv: { status: string; costCenter: string }): { ok: true } | { ok: false; field: "costCenter"; message: string } {
  if (decisionOf(inv) === "post" && !inv.costCenter.trim()) {
    return { ok: false, field: "costCenter", message: "Choose a cost center before posting." };
  }
  return { ok: true };
}

export function proposedState(inv: Invoice): InvoiceState {
  return toInvoiceState({ ...inv, status: commitStatus(inv) });
}

/**
 * One field_changed for a text field. Null when trim did not change.
 * Notes are never broadcast as text: both sides become "" or "(note, N chars)".
 */
export function textCommit(field: string, before: string, after: string): { from: string; to: string } | null {
  if (before.trim() === after.trim()) return null;
  if (field === "notes") {
    const pack = (s: string) => (s.trim() ? `(note, ${s.trim().length} chars)` : "");
    return { from: pack(before), to: pack(after) };
  }
  return { from: before.trim(), to: after.trim() };
}

export function statusBadge(status: string): { label: "OPEN" | "ON HOLD" | "POSTED"; tone: "open" | "hold" | "posted" } {
  if (status === "hold") return { label: "ON HOLD", tone: "hold" };
  if (status === "approved" || status === "posted") return { label: "POSTED", tone: "posted" };
  return { label: "OPEN", tone: "open" };
}

/* ---------- MB-ERP shell helpers (display only; no business reasons) ---------- */

export type QueueKey = Queue;

export const QUEUE_KEYS: readonly QueueKey[] = ["expert", "newhire", "autopilot"];

export const QUEUE_LABEL: Record<QueueKey, string> = {
  expert: "Invoice queue · expert",
  newhire: "Invoice queue · new hire",
  autopilot: "Routine queue · agent",
};

/** Any unknown or missing value falls back to the expert queue (same as before). */
export function queueOf(value: unknown): QueueKey {
  return QUEUE_KEYS.includes(value as QueueKey) ? (value as QueueKey) : "expert";
}

/** Neutral role initials for the top-bar avatar. Never a person's name. */
export function queueAvatar(queue: string): { initials: "AP" | "NH" | "AG"; label: string } {
  if (queue === "newhire") return { initials: "NH", label: "New hire" };
  if (queue === "autopilot") return { initials: "AG", label: "Agent" };
  return { initials: "AP", label: "Accounts payable" };
}

export function money(n: number): string {
  return `${n < 0 ? "-" : ""}€${Math.abs(n).toLocaleString("en-IE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function routeLabelOf(route: string): "second approval" | "single approval" {
  return route === "second_approval" ? "second approval" : "single approval";
}

/**
 * The confirm popover sentence. It names what the save will actually do:
 * a held draft is held, everything else is posted. Never contains the word "confirm"
 * (the Confirm button must be the first "confirm" text on the page).
 */
export function confirmCopy(inv: { id: string; status: string; costCenter: string; route: string }): string {
  const cc = inv.costCenter.trim() || "—";
  const route = routeLabelOf(inv.route);
  return decisionOf(inv) === "hold"
    ? `Hold INV-${inv.id} for review, cost center ${cc}, ${route}?`
    : `Post INV-${inv.id} to cost center ${cc}, ${route}?`;
}

/** "2 of 5 · 4 still open", plus " · coached" when the invoice carries a mode. */
export function progressLine(p: { position: number; total: number; remainingOpen: number }, mode?: string): string {
  return `${p.position} of ${p.total} · ${p.remainingOpen} still open${mode ? ` · ${mode}` : ""}`;
}

/** Queue search: matches bill number (with or without "INV-"), vendor and description, case-insensitive. */
export function matchesQuery(inv: { id: string; supplier: string; description: string }, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const hay = `inv-${inv.id} ${inv.id} ${inv.supplier} ${inv.description}`.toLowerCase();
  return q.split(/\s+/).every((part) => hay.includes(part));
}
