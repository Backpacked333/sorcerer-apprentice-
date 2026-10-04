/**
 * Pure helpers for the sandbox invoice form. No business reasons live here.
 */
import { toInvoiceState, type Invoice } from "./erp-model";
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
