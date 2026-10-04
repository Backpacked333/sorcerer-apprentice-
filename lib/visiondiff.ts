import type { ScreenEvent } from "./events";
import type { InvoiceState } from "./workmap";
import type { ClaimState } from "./vision-schema";

export interface VisionFrame {
  screen: string;
  state: InvoiceState;
  banner?: string;
  confidence?: number;
  uiActivity?: ScreenEvent["uiActivity"];
  saved?: boolean;
  /** set by /api/vision when the request named `app: "claims"`; absent means the invoice ERP */
  app?: "erp" | "claims";
  /** claims frames only: what vision read off the claim page (`state` stays empty) */
  claim?: ClaimState;
}
export type EmitSpec = Omit<ScreenEvent, "id" | "t">;
export const normalizeInvoiceId = (invoice?: string) => invoice?.trim().replace(/^inv(oice)?[\s#:.-]*/i, "").trim() || undefined;
export const normalizeVisionState = (state: InvoiceState): InvoiceState => {
  const clean: InvoiceState = Object.fromEntries(Object.entries(state).filter(([, v]) => v != null));
  if (clean.invoice !== undefined) {
    clean.invoice = normalizeInvoiceId(clean.invoice);
    if (!clean.invoice) delete clean.invoice;
  }
  if (clean.status) clean.status = clean.status.trim().toLowerCase().replace(/\s+/g, "_").replace(/^on_hold$/, "hold");
  return clean;
};

/** Only compare visual observations; ERP state is never evidence for a vision event. */
export function diffVision(prev: VisionFrame | null, next: VisionFrame) {
  if (next.app === "claims") return diffClaims(prev, next);
  const before = normalizeVisionState(prev?.state ?? {});
  const specs: EmitSpec[] = [];
  if (next.screen === "other" || (next.confidence ?? 1) < 0.4)
    return { specs, state: before, frame: prev };
  const list = next.screen === "invoice_list";
  const visible = list ? {} : normalizeVisionState(next.state);
  const invoice = visible.invoice ?? before.invoice;
  const same = Boolean(before.invoice && invoice === before.invoice);
  const state = list ? {} : { ...(same ? before : {}), ...visible };
  const add = (event: Omit<EmitSpec, "source">) => specs.push({ source: "vision", uiActivity: next.uiActivity, ...event });
  const success = (s?: string) => s === "posted" || s === "saved";
  let saved = same && Boolean(prev?.saved);
  if (success(before.status) && visible.status && !success(visible.status)) saved = false;
  const posted = next.banner === "posted" && prev?.banner !== "posted";
  const confirmed = prev?.screen === "confirm_dialog" && next.screen === "invoice_detail" && Boolean(before.status) && !success(before.status) && success(visible.status);
  if (same && !saved && next.banner !== "blocked" && (posted || confirmed)) {
    add({ kind: "save_clicked", invoice, state: list ? before : state, boundary: true });
    saved = true;
  }
  if (before.invoice && (list || !same)) add({ kind: "invoice_closed", invoice: before.invoice, boundary: true });
  if (!list && visible.invoice && !same) {
    add({ kind: "invoice_opened", invoice, state });
  } else if (!list && same) {
    for (const field of ["costCenter", "route", "status"] as const) {
      if (visible[field] !== undefined && before[field] !== undefined && visible[field] !== before[field])
        add({ kind: field === "costCenter" ? "field_changed" : field === "route" ? "route_changed" : "status_changed", invoice, field, from: before[field], to: visible[field], state });
    }
    if (visible.hasAssetNumber !== undefined && before.hasAssetNumber !== undefined && visible.hasAssetNumber !== before.hasAssetNumber)
      add({ kind: "field_changed", invoice, field: "assetNumber", to: visible.hasAssetNumber ? "entered" : "cleared", state });
  }
  return { specs, state, frame: { ...next, state, saved: list ? false : saved } };
}

const CLAIM_FIELDS = ["cause", "coverage", "nextStep", "reserve", "priorClaims"] as const;
const claimClean = (c?: ClaimState): ClaimState => Object.fromEntries(Object.entries(c ?? {}).filter(([, v]) => v != null && v !== ""));

/**
 * Claims frames: `field_changed` / `screen_changed` events carrying `subject: {type:"claim"}`.
 * A claim is never reported as an invoice: `invoice` and the invoice `state` are never set.
 */
export function diffClaims(prev: VisionFrame | null, next: VisionFrame) {
  const before = prev?.app === "claims" ? claimClean(prev.claim) : {};
  const specs: EmitSpec[] = [];
  if (next.screen === "other" || (next.confidence ?? 1) < 0.4)
    return { specs, state: {} as InvoiceState, frame: prev };
  const subject = (id: string) => ({ type: "claim" as const, id });
  const add = (event: Omit<EmitSpec, "source" | "invoice" | "state">) => specs.push({ source: "vision", uiActivity: next.uiActivity, ...event });
  const list = next.screen === "claim_list";
  const visible = list ? {} : claimClean(next.claim);
  const id = visible.claim ?? before.claim;
  const same = Boolean(before.claim && id === before.claim);
  const claim: ClaimState = list ? {} : { ...(same ? before : {}), ...visible };
  if (before.claim && list) add({ kind: "screen_changed", subject: subject(before.claim), boundary: true });
  if (!list && visible.claim && !same) {
    add({ kind: "screen_changed", subject: subject(visible.claim), boundary: Boolean(before.claim) });
  } else if (!list && same && id) {
    for (const field of CLAIM_FIELDS) {
      const from = before[field], to = visible[field];
      if (to !== undefined && from !== undefined && String(to) !== String(from))
        add({ kind: "field_changed", subject: subject(id), field, from: String(from), to: String(to) });
    }
  }
  return { specs, state: {} as InvoiceState, frame: { ...next, app: "claims" as const, state: {}, claim, saved: false } };
}
