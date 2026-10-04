// Capture companion copy and state derivations (pure, testable). Structural product copy only:
// every business value shown comes from the live session (events, the expert's words, the governor config).
import { labelField } from "@/lib/events";
import { captureMood, NOTICE_MS, UNDERSTOOD_MS, HEARD_MS, type OrbMood } from "./moods";
import type { PresenceState } from "./presence";

// ---------------------------------------------------------------- the app on screen

export type CaptureAppId = "erp" | "claims";

export interface CaptureAppInfo {
  id: CaptureAppId;
  /** iframe / popup URL */
  src: string;
  /** iframe title and short name */
  title: string;
  /** What to pick in the share dialog when the app runs in its own window. */
  shareHint: string;
  /** True when the app posts ERP telemetry (dom events). The claims workbench does not. */
  telemetry: boolean;
  /** Honest badge for a vision-only app. */
  badge?: string;
  /** Default task text. */
  task: string;
  /** Short noun for the case being worked ("invoice" / "claim"). */
  noun: string;
}

export const VISION_ONLY_BADGE = "Vision only — this app sends no ERP telemetry";
export const VISION_OFF_NO_KEY = "Vision is off (no key) — this app has no telemetry, so nothing is seen";
export const VISION_OFF_NO_SHARE = "No screen shared — this app has no telemetry, so nothing is seen";

export function captureApp(id: string | undefined | null): CaptureAppInfo {
  if (id === "claims") {
    return {
      id: "claims",
      src: "/claims",
      title: "Claims workbench",
      shareHint: "In the share dialog, pick the tab with the claims workbench.",
      telemetry: false,
      badge: VISION_ONLY_BADGE,
      task: "Work the open claims in the queue",
      noun: "claim",
    };
  }
  return {
    id: "erp",
    src: "/erp?queue=expert",
    title: "Sandbox ERP",
    shareHint: "In the share dialog, pick the tab named MB-ERP.",
    telemetry: true,
    task: "Process supplier invoices before month-end close",
    noun: "invoice",
  };
}

/** Keyless / no-share note for a vision-only app. Null when frames are actually being seen. */
export function visionOnlyNote(i: { app: CaptureAppInfo; visionKey?: boolean | null; sharing: boolean; started: boolean }): string | null {
  if (i.app.telemetry) return null;
  if (i.visionKey === false) return VISION_OFF_NO_KEY;
  if (i.started && !i.sharing) return VISION_OFF_NO_SHARE;
  return null;
}

/** Role copy for the onboarding card (gender-neutral, app-specific noun). */
export function rolePart(app: CaptureAppInfo, name: string): string {
  const who = name.trim() || "the expert";
  return `You are ${who}, the experienced one. Work the ${app.noun}s the way you would and say what you are thinking. The apprentice stays silent while you work and asks short questions when you pause. Use your own rules: it learns what you actually say.`;
}

// ---------------------------------------------------------------- question window

export const KIND_LABEL: Record<string, string> = {
  why: "Why",
  counterfactual: "What if",
  limit: "Where's the limit",
  stop: "When to stop",
  who: "Who decides",
};

/** "WHY · COST CENTER" (kind · field). The field part is omitted when unknown. */
export function eyebrowFor(kind: string, about?: string | null): string {
  const k = (KIND_LABEL[kind] ?? kind).toUpperCase();
  return about ? `${k} · ${about.toUpperCase()}` : k;
}

/** Field label for a window's stepRef ("4471:costCenter" → "cost center"). Null for non-field steps. */
export function aboutFor(stepRef?: string, field?: string): string | null {
  const f = field ?? stepRef?.split(":").slice(1).join(":");
  if (!f) return null;
  const known = ["invoice_opened", "invoice_closed", "screen_changed", "save_clicked", "save_intent", "save_blocked", "typing"];
  if (known.includes(f)) return null;
  if (f === "status_changed" || f === "status") return "status";
  if (f === "route_changed") return "approval route";
  return labelField(f);
}

export type Evidence = "seen on screen" | "seen on screen, confirmed by the ERP" | "reported by the ERP";

/** Honest provenance: only a vision event may say "seen on screen" (non-negotiable 5). */
export function evidenceFor(e?: { source: "vision" | "dom"; alsoSeenBy?: "vision" | "dom" } | null): Evidence | undefined {
  if (!e) return undefined;
  if (e.source === "vision") return e.alsoSeenBy === "dom" ? "seen on screen, confirmed by the ERP" : "seen on screen";
  return "reported by the ERP";
}

/** "You paused 1.6 s · reported by the ERP". */
export function askSub(pauseSecs?: number | null, evidence?: Evidence): string {
  const parts: string[] = [];
  if (pauseSecs != null && Number.isFinite(pauseSecs) && pauseSecs >= 0) parts.push(`You paused ${pauseSecs.toFixed(1)} s`);
  if (evidence) parts.push(evidence);
  return parts.join(" · ");
}

export function budgetText(questions: number, budget: number): string {
  return `asked ${questions} · ≤${budget} per 10 min`;
}

/** "4711 → 0400" from an event's own values. */
export function changeText(e: { from?: string; to?: string }): string {
  return `${e.from || "empty"} → ${e.to ?? ""}`;
}

/** ERP `data-erp-target` key for a field (invoice ERP hooks); falls back to the field name itself. */
export function erpTargetFor(field?: string | null): string | null {
  if (!field) return null;
  const map: Record<string, string> = {
    costCenter: "cc",
    assetNumber: "asset",
    hasAssetNumber: "asset",
    route: "route",
    route_changed: "route",
    status: "status",
    status_changed: "status",
    amount: "amount",
    supplier: "vendor",
    description: "line",
  };
  return map[field] ?? field;
}

// ---------------------------------------------------------------- health chips

export type ChipTone = "green" | "amber" | "red" | "neutral";

export interface HealthInput {
  started: boolean;
  app: CaptureAppInfo;
  voice: { mode: "agent" | "fallback"; connected: boolean; degraded?: boolean };
  sttEngine: "scribe" | "webspeech" | "none";
  sharing: boolean;
  visionError?: string | null;
  degraded?: string | null;
  dropped: number;
  queued: number;
  /** event source; "dom" means no frame goes to vision even while a screen is shared */
  source?: "vision" | "dom" | "both";
}

function eyeChip(i: HealthInput): { label: string; tone: ChipTone } {
  if (i.degraded === "wrong_surface") return { label: "Wrong surface — no frames sent", tone: "amber" };
  if (i.visionError) return { label: "Vision degraded", tone: "amber" };
  if (i.sharing && i.source === "dom") return { label: "Screen shared · ERP telemetry only", tone: "neutral" };
  const where = i.app.id === "claims" ? "the claims app" : "the ERP";
  if (i.sharing && i.dropped > 0) return { label: `Seeing ${where} · ${i.dropped} skipped`, tone: "green" };
  if (i.sharing) return { label: `Seeing ${where}`, tone: "green" };
  if (i.app.telemetry) return { label: "ERP telemetry only", tone: "neutral" };
  return { label: "No screen", tone: "neutral" };
}

export function healthItems(i: HealthInput): { label: string; tone: ChipTone }[] {
  if (!i.started) return [];
  const voice =
    i.voice.degraded || (i.voice.mode === "agent" && !i.voice.connected)
      ? { label: "Voice offline", tone: "amber" as const }
      : i.voice.mode === "agent"
        ? { label: "ElevenAgents", tone: "green" as const }
        : { label: "Browser voice (fallback)", tone: "amber" as const };
  const ear =
    i.sttEngine === "scribe"
      ? { label: "Scribe v2", tone: "green" as const }
      : i.sttEngine === "webspeech"
        ? { label: "Browser STT (fallback)", tone: "amber" as const }
        : { label: "No transcript", tone: "neutral" as const };
  const out = [voice, ear, eyeChip(i)];
  if (i.queued > 0) out.push({ label: `${i.queued} waiting`, tone: "amber" });
  return out;
}

// ---------------------------------------------------------------- the card state

export type CardMode = "prestart" | "capsule" | "ask";

export interface CardInput {
  started: boolean;
  now: number | null; // epoch ms, null before mount
  presence: PresenceState;
  decision?: { state: "listening" | "waiting" | "asking" | "answering"; lights: { notTyping: boolean; notReading: boolean }; reasons?: string[] } | null;
  /** frames or telemetry are being observed */
  watching: boolean;
  queued: number;
  holding: boolean;
  ending?: boolean;
  window?: { phase: "asking" | "answering" } | null;
  lastUnderstoodAt?: number | null;
  lastHeard?: { at: number; about?: string | null } | null;
  lastNotice?: { at: number; text: string; queued: boolean } | null;
  lastStrikeAt?: number | null;
  lastDeferredAt?: number | null;
  noun: string;
}

export const STRUCK_MS = 4000;
export const DEFERRED_MS = 2600;

export interface CardState {
  mode: CardMode;
  mood: OrbMood;
  title: string;
  sub: string;
  /** Ask mode lingers on the understood card after the window closed. */
  understoodLinger: boolean;
  struck: boolean;
}

const ago = (now: number | null, at?: number | null) => (now == null || at == null ? null : now - at);
const within = (a: number | null, ms: number) => a != null && a >= 0 && a < ms;

/** Mood from captureMood only; titles keyed to the same real state. */
export function cardState(i: CardInput): CardState {
  if (!i.started) return { mode: "prestart", mood: "quiet", title: "Ready when you are", sub: "Nothing is captured until you start", understoodLinger: false, struck: false };
  const understoodAgo = ago(i.now, i.lastUnderstoodAt);
  const heardAgo = ago(i.now, i.lastHeard?.at);
  const noticeAgo = i.lastNotice?.queued ? ago(i.now, i.lastNotice.at) : null;
  const struck = within(ago(i.now, i.lastStrikeAt), STRUCK_MS);
  const mood = captureMood({
    presence: i.presence,
    decision: i.decision ?? null,
    sharing: i.watching,
    understoodAgoMs: understoodAgo,
    heardAgoMs: heardAgo,
    noticeAgoMs: noticeAgo,
    queued: i.queued,
  });
  const linger = !i.window && !i.holding && !struck && within(understoodAgo, UNDERSTOOD_MS);
  const mode: CardMode = (i.window && !i.holding) || linger ? "ask" : "capsule";
  const base = { mode, mood, understoodLinger: linger, struck };
  if (i.ending) return { ...base, mode: "capsule", title: "Saving the session…", sub: "The debrief starts with what's still unclear" };
  if (i.holding) return { ...base, title: "Paused", sub: "Press P or Resume to continue" };
  if (struck) return { ...base, title: "Struck from the record", sub: "That exchange and its frames are gone" };
  if (i.window) return { ...base, title: i.window.phase === "asking" ? "Asking…" : "Listening to your answer", sub: "" };
  if (linger) return { ...base, title: "Understood", sub: "Saved with your own words" };
  if (within(ago(i.now, i.lastDeferredAt), DEFERRED_MS)) return { ...base, title: "Okay — I'll ask in the debrief", sub: "Added to the list of open questions" };
  if (mood === "heard") return { ...base, title: "Reason heard — not asking", sub: i.lastHeard?.about ? `You explained the ${i.lastHeard.about} while you worked` : "You explained it while you worked" };
  if (mood === "notice" && i.lastNotice) return { ...base, title: `Noticed: ${i.lastNotice.text}`, sub: "Holding a question for a pause" };
  if (mood === "typing") return { ...base, title: "Quiet — you're typing", sub: "I won't interrupt while you type" };
  if (mood === "reading") return { ...base, title: "Quiet — you're reading", sub: "Reading isn't a pause · I'll wait" };
  if (mood === "pausing") return { ...base, title: "You paused…", sub: i.decision?.reasons?.[0] ? `Waiting — ${i.decision.reasons[0]}` : "Waiting to be sure" };
  if (!i.watching) return { ...base, title: "Not watching", sub: "No screen is shared" };
  if (i.queued > 0) return { ...base, title: "Quiet while you work", sub: `${i.queued} question${i.queued > 1 ? "s" : ""} waiting for a pause` };
  return { ...base, title: "Quiet while you work", sub: "Watching, saying nothing" };
}

/** Footer status line in ask mode. */
export function askStatus(phase: "asking" | "answering" | null, linger: boolean): string {
  if (linger) return "Saved with your own words";
  return phase === "asking" ? "Asking…" : "Listening to your answer";
}

export { NOTICE_MS, UNDERSTOOD_MS, HEARD_MS };
