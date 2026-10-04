/**
 * ERP telemetry over BroadcastChannel: the sandbox ERP tab tells the capture/teach tab exactly what changed.
 * This is the keyless "instrumented" event source. Vision is the general path; this one is exact.
 */
import type { InvoiceState } from "./workmap";
import type { EventKind } from "./events";
import type { Queue } from "./erp-model";

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
  queue?: Queue;
  sandboxSession?: string;
  reannounce?: boolean;
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
  ch.onmessage = (ev) => { if (ev.data?.type !== "hello") handler(ev.data as TelemetryMessage); };
  return () => ch.close();
}

export interface TelemetryHello { type: "hello"; at: number; sessionId: string; queues?: Queue[] }

export function postHello(h: { sessionId: string; queues?: Queue[] }): void {
  if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") return;
  const ch = new BroadcastChannel(ERP_CHANNEL);
  ch.postMessage({ ...h, type: "hello", at: Date.now() } satisfies TelemetryHello);
  ch.close();
}

export function subscribeHello(handler: (h: TelemetryHello) => void): () => void {
  if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") return () => {};
  const ch = new BroadcastChannel(ERP_CHANNEL);
  ch.onmessage = (ev) => { if (ev.data?.type === "hello") handler(ev.data as TelemetryHello); };
  return () => ch.close();
}
