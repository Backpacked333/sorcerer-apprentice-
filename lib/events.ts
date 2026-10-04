/**
 * Screen events: what changed on screen, as the vision model or the ERP telemetry report it.
 * One event per meaningful change. Navigation and scrolling are events too, with no judgment value.
 */
import type { InvoiceState } from "./workmap";

export type EventKind =
  | "screen_changed" // navigation / scroll / reading
  | "invoice_opened"
  | "invoice_closed"
  | "field_changed"
  | "status_changed"
  | "route_changed"
  | "save_clicked"
  | "save_intent" // the ERP opened its save confirm; the proposed state is not committed yet (P-11)
  | "save_blocked" // the sandbox's pre-save guard refused a commit that broke a confirmed rule
  | "typing";

export type EventSource = "vision" | "dom";

export interface ScreenEvent {
  id: string;
  t: number; // seconds since session start
  source: EventSource;
  kind: EventKind;
  invoice?: string;
  field?: string;
  from?: string;
  to?: string;
  state?: InvoiceState; // merged invoice state after the event
  uiActivity?: "typing" | "reading" | "navigating" | "idle";
  frameId?: string;
  confidence?: number;
  latencyMs?: number;
  /** set when a second source confirmed the same change (vision saw it, the ERP reported it) */
  alsoSeenBy?: EventSource;
  /** teach mode: coached or independent, as the sandbox reports it per case */
  mode?: "coached" | "independent";
  blocked?: { ruleId: string; title: string; quote?: string; who?: string };
  /** true when this event is a natural step boundary (save, close, back to list) */
  boundary?: boolean;
  /** Set when the event was struck from the record. Kept as a tombstone, content removed. */
  redacted?: boolean;
}

export interface TranscriptSegment {
  id: string;
  /** Explicit expert typing, not STT or an agent summary; references its question window. */
  typedFor?: string;
  t: number; // start, seconds since session start
  tEnd?: number;
  text: string;
  speaker: "expert" | "agent" | "newhire";
  final: boolean;
  redacted?: boolean;
}

export interface QuestionWindow {
  id: string;
  candidateId: string;
  kind: "why" | "counterfactual" | "limit" | "stop" | "who" | "debrief" | "intervene" | "predict";
  question: string;
  stepRef?: string; // invoice + field, e.g. "4471:costCenter"
  openedAt: number;
  spokeAt?: number; // agent started speaking
  askedAt?: number; // question finished; listening mic opened
  answeredAt?: number;
  closedAt?: number;
  closedBy?: "tool" | "scribe_fallback" | "timeout" | "user";
  outcome?: "answered" | "timeout" | "aborted" | "off_record";
  answerText?: string;
  answerAudioId?: string;
  /** structured extraction from the agent's log_answer tool call */
  logged?: { reason?: string; guardrail?: string; kind?: string };
}

export interface Frame {
  id: string;
  t: number;
  /** data URL of a downscaled JPEG with PII regions blurred */
  dataUrl?: string;
  url?: string;
  width: number;
  height: number;
  piiRegionsBlurred: number;
}

export interface SessionLog {
  id: string;
  mode: "capture" | "teach";
  task: string;
  expertName: string;
  startedAt: number; // epoch ms
  endedAt?: number;
  events: ScreenEvent[];
  transcript: TranscriptSegment[];
  windows: QuestionWindow[];
  frames: Frame[];
  offRecord: { from: number; to: number }[];
  metrics?: Record<string, number>;
  deferred?: { kind: string; question: string; stepRef: string }[];
  sample?: boolean;
  ws?: string;
  /** teach mode only */
  mastery?: { ruleId: string; outcome: string; t: number }[];
  flagged?: { t: number; context: string }[];
  sourceMapSessionId?: string;
  /** teach mode: the map revision the tutor taught from */
  sourceMapRevision?: number;
}

export function emptySession(id: string, mode: SessionLog["mode"], task: string, expertName: string): SessionLog {
  return { id, mode, task, expertName, startedAt: Date.now(), events: [], transcript: [], windows: [], frames: [], offRecord: [] };
}

/** Short one-line rendering, used for contextual updates to the agent and the event feed. */
export function describeEvent(e: ScreenEvent): string {
  const inv = e.invoice ? `invoice ${e.invoice}` : "screen";
  switch (e.kind) {
    case "invoice_opened":
      return `${inv} opened${e.state?.supplier ? ` (${e.state.supplier}, €${e.state.amount?.toLocaleString("en-IE") ?? "?"})` : ""}`;
    case "invoice_closed":
      return `${inv} closed, back on the queue`;
    case "field_changed":
      return `${inv}: ${labelField(e.field)} ${e.from ?? "empty"} -> ${e.to}`;
    case "status_changed":
      return `${inv}: status ${e.from ?? "open"} -> ${e.to}`;
    case "route_changed":
      return `${inv}: approval route ${e.from ?? "single"} -> ${e.to}`;
    case "save_clicked":
      return `${inv}: saved`;
    case "save_intent":
      return `${inv}: save requested, not yet posted`;
    case "save_blocked":
      return `${inv}: save held by the guard (${e.blocked?.title ?? "learned rule"})`;
    case "typing":
      return `${inv}: typing`;
    default:
      return `${inv}: ${e.uiActivity ?? "changed"}`;
  }
}

export function labelField(f?: string): string {
  switch (f) {
    case "costCenter":
      return "cost center";
    case "route":
      return "approval route";
    case "hasAssetNumber":
    case "assetNumber":
      return "asset number";
    default:
      return f ?? "field";
  }
}
