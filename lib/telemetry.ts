/**
 * ERP telemetry over BroadcastChannel: the sandbox ERP tab tells the capture/teach tab exactly what changed.
 * This is the keyless "instrumented" event source. Vision is the general path; this one is exact.
 */
import type { InvoiceState } from "./workmap";
import type { EventKind } from "./events";

export const ERP_CHANNEL = "tacit-erp";

export interface TelemetryMessage {
  kind: EventKind;
  at: number; // epoch ms
  invoice?: string;
  field?: string;
  from?: string;
  to?: string;
  state?: InvoiceState;
  boundary?: boolean;
  mode?: "coached" | "independent";
  /** Which sandbox queue posted this (P-14). */
  queue?: "expert" | "newhire" | "autopilot";
  /** save_blocked only: the learned rule the save would have broken */
  blocked?: { ruleId: string; title: string; quote?: string; who?: string };
}

export function postTelemetry(msg: Omit<TelemetryMessage, "at">) {
  if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") return;
  const ch = new BroadcastChannel(ERP_CHANNEL);
  ch.postMessage({ ...msg, at: Date.now() } satisfies TelemetryMessage);
  ch.close();
}

export function subscribeTelemetry(handler: (m: TelemetryMessage) => void): () => void {
  if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") return () => {};
  const ch = new BroadcastChannel(ERP_CHANNEL);
  ch.onmessage = (ev) => handler(ev.data as TelemetryMessage);
  return () => ch.close();
}
