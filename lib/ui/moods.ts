// Orb / companion glow-state language (design report §3.4, §3.5, §5.2).
// Pure data + pure derivations from real runtime state. No logic-module imports except types.
import type { PresenceState } from "./presence";

export type OrbMood =
  | "quiet"
  | "notice"
  | "typing"
  | "reading"
  | "pausing"
  | "asking"
  | "listening"
  | "understood"
  | "heard"
  | "off"
  | "holding"
  | "step"
  | "correct";

/** The mockup renders every screenshot with rainbow k = 0.1 (design §0.1). */
export const RAINBOW = 0.1;

export const PASTEL = ["#ffb8d9", "#ffe2a8", "#b9f0d3", "#b5dcff", "#d4c6ff", "#ffb8d9"];
export const SWIRL = ["#ff9ad5", "#ffd27a", "#9be7c4", "#8fd3ff", "#b7a6ff", "#ff9ad5"];

export const PEARL = "radial-gradient(circle at 35% 30%,#ffffff,#eef1f6 48%,#d2d9e3)";
export const DIM = "radial-gradient(circle at 35% 30%,#fbfcfd,#e9edf2 50%,#cfd6df)";
export const GREEN = "radial-gradient(circle at 35% 30%,#f6fff9,#aeeecb 52%,#38c477)";

export interface MoodSpec {
  /** Human label for the mood (legend / debug / data attributes). */
  label: string;
  /** Orb body background (gradient). */
  base: string;
  /** Orb body box-shadow. */
  shadow: string;
  /** Orb body animation (shared tc-* keyframes) or "none". */
  anim: string;
  /** Swirl opacity with k applied (companion look). */
  swirl: number;
  /** Ripple ring colour. */
  ring: string;
  /** Iridescent rim: conic colours, opacity with k applied, hue period in seconds. */
  rim: { colors: string[]; opacity: number; speed: number };
  /** Blurred companion glow opacity with k applied. */
  glow: number;
  /** Two tint-blob colours inside the companion glass. */
  tint: [string, string];
  /** Field-halo opacity with k applied (0 hides the halo). */
  halo: number;
  /** Eyebrow / kind-label colour. */
  kindColor: string;
  /** Amber "question held" badge on the orb. */
  badge: boolean;
  /** Entering this mood fires a one-shot ripple (v3:391). */
  ripple: boolean;
  /** Raw (k = 1) values, for the landing page's `full` orb. */
  raw: { swirl: number; rim: number; glow: number; halo: number };
}

const breathe = (s: number) => `tc-breathe ${s}s ease-in-out infinite`;

interface Def {
  label: string;
  base: string;
  shadow: string;
  anim: string;
  swirl: number;
  ring: string;
  colors: string[];
  rim: number;
  glow: number;
  tint: [string, string];
  inten: number;
  kindColor: string;
  speed?: number;
  badge?: boolean;
  ripple?: boolean;
}

const DEFS: Record<OrbMood, Def> = {
  quiet: {
    label: "Quiet", base: PEARL, shadow: "0 0 0 .5px rgba(0,0,0,.08),0 4px 12px rgba(80,90,110,.16)", anim: breathe(4.4), swirl: 0.34,
    ring: "rgba(160,170,200,.7)", colors: PASTEL, rim: 0.5, glow: 0.16, tint: ["rgba(255,190,225,.16)", "rgba(170,215,255,.18)"], inten: 0.6, kindColor: "#6e6e73",
  },
  notice: {
    label: "Noticed", base: PEARL, shadow: "0 0 0 .5px rgba(0,0,0,.06),0 0 16px rgba(170,150,255,.4)", anim: breathe(2.2), swirl: 0.72,
    ring: "rgba(160,140,255,.7)", colors: PASTEL, rim: 0.95, glow: 0.34, tint: ["rgba(210,190,255,.26)", "rgba(255,215,170,.2)"], inten: 1, kindColor: "#7a5cff", ripple: true,
  },
  typing: {
    label: "Typing", base: DIM, shadow: "0 0 0 .5px rgba(0,0,0,.08),0 2px 8px rgba(80,90,110,.12)", anim: breathe(7), swirl: 0.12,
    ring: "rgba(160,170,190,.5)", colors: PASTEL, rim: 0.22, glow: 0.05, tint: ["rgba(220,225,235,.1)", "rgba(220,225,235,.1)"], inten: 0.32, kindColor: "#6e6e73", speed: 20,
  },
  reading: {
    label: "Reading", base: DIM, shadow: "0 0 0 .5px rgba(0,0,0,.08),0 2px 8px rgba(80,90,110,.12)", anim: breathe(6), swirl: 0.14,
    ring: "rgba(160,170,190,.5)", colors: PASTEL, rim: 0.2, glow: 0.05, tint: ["rgba(220,225,235,.1)", "rgba(220,225,235,.1)"], inten: 0.3, kindColor: "#6e6e73", speed: 20,
  },
  holding: {
    label: "Holding", base: PEARL, shadow: "0 0 0 .5px rgba(0,0,0,.08),0 2px 8px rgba(80,90,110,.12)", anim: breathe(5.5), swirl: 0.18,
    ring: "rgba(245,166,35,.6)", colors: ["#ffe2a8", "#e9ecf2", "#ffe2a8", "#e9ecf2", "#ffe2a8"], rim: 0.4, glow: 0.08,
    tint: ["rgba(255,226,168,.16)", "rgba(220,225,235,.1)"], inten: 0, kindColor: "#8a5200", badge: true,
  },
  heard: {
    label: "Reason heard", base: "radial-gradient(circle at 35% 30%,#ffffff,#ece6ff 50%,#c9bdf5)", shadow: "0 0 0 .5px rgba(80,50,200,.1),0 0 18px rgba(143,123,255,.4)",
    anim: breathe(2.4), swirl: 0.7, ring: "rgba(143,123,255,.75)", colors: ["#d4c6ff", "#b5dcff", "#ffb8d9", "#d4c6ff", "#b9f0d3", "#d4c6ff"], rim: 0.85, glow: 0.3,
    tint: ["rgba(200,185,255,.28)", "rgba(181,220,255,.2)"], inten: 0.9, kindColor: "#6a55d8", ripple: true,
  },
  pausing: {
    label: "Pause found", base: PEARL, shadow: "0 0 0 .5px rgba(0,0,0,.06),0 4px 14px rgba(120,130,170,.2)", anim: breathe(3), swirl: 0.5,
    ring: "rgba(160,170,200,.7)", colors: PASTEL, rim: 0.65, glow: 0.2, tint: ["rgba(200,200,255,.18)", "rgba(255,220,190,.14)"], inten: 0.7, kindColor: "#6e6e73",
  },
  asking: {
    label: "Asking", base: "radial-gradient(circle at 35% 30%,#fffaf0,#ffd98f 52%,#f2a531)", shadow: "0 0 0 .5px rgba(160,100,0,.14),0 0 18px rgba(245,166,35,.42)",
    anim: breathe(1.8), swirl: 0.32, ring: "rgba(245,166,35,.75)", colors: ["#ffd27a", "#ffb8d9", "#ffe9c2", "#ffc56b", "#c9d8ff", "#ffd27a"], rim: 0.9, glow: 0.36,
    tint: ["rgba(255,205,120,.32)", "rgba(255,180,210,.16)"], inten: 0.95, kindColor: "#a35f00", ripple: true,
  },
  listening: {
    label: "Listening", base: GREEN, shadow: "0 0 0 .5px rgba(0,100,40,.12),0 0 18px rgba(56,196,119,.42)", anim: "tc-talk 1.1s ease-in-out infinite", swirl: 0.28,
    ring: "rgba(56,196,119,.7)", colors: ["#8ff0b6", "#b5f0ff", "#d9ffe8", "#7fe0b0", "#c6e6ff", "#8ff0b6"], rim: 0.85, glow: 0.32,
    tint: ["rgba(140,235,185,.28)", "rgba(160,220,255,.18)"], inten: 0.8, kindColor: "#1b8a4b",
  },
  understood: {
    label: "Understood", base: PEARL, shadow: "0 0 0 .5px rgba(0,0,0,.05),0 0 22px rgba(170,150,255,.55)", anim: breathe(2), swirl: 0.95,
    ring: "rgba(170,150,255,.8)", colors: SWIRL, rim: 1, glow: 0.5, tint: ["rgba(205,175,255,.3)", "rgba(255,205,150,.24)"], inten: 1, kindColor: "#7a5cff", ripple: true,
  },
  off: {
    label: "Off the record", base: "repeating-linear-gradient(135deg,rgba(229,72,77,.7) 0 4px,rgba(229,72,77,.2) 4px 8px)", shadow: "0 0 0 .5px rgba(229,72,77,.4)",
    anim: "none", swirl: 0, ring: "rgba(229,72,77,.6)", colors: ["#ff9b9b", "#ffd0d0", "#ff8080", "#ffd0d0", "#ff9b9b"], rim: 0.8, glow: 0.2,
    tint: ["rgba(255,120,120,.2)", "rgba(255,170,170,.12)"], inten: 0, kindColor: "#c9342f",
  },
  step: {
    label: "Steps in", base: "radial-gradient(circle at 35% 30%,#fff6f0,#ffbf9b 52%,#f0703f)", shadow: "0 0 0 .5px rgba(150,50,0,.14),0 0 18px rgba(240,100,47,.42)",
    anim: breathe(1.5), swirl: 0.34, ring: "rgba(240,100,47,.75)", colors: ["#ffb38a", "#ff9ad5", "#ffd27a", "#ff8f6b", "#ffc6a8", "#ffb38a"], rim: 0.95, glow: 0.4,
    tint: ["rgba(255,170,130,.3)", "rgba(255,170,210,.18)"], inten: 1, kindColor: "#b4501f", ripple: true,
  },
  correct: {
    label: "Correct", base: GREEN, shadow: "0 0 22px rgba(56,196,119,.5)", anim: breathe(2), swirl: 0.6,
    ring: "rgba(56,196,119,.75)", colors: ["#8ff0b6", "#b5f0ff", "#ffe2a8", "#7fe0b0", "#d4c6ff", "#8ff0b6"], rim: 0.9, glow: 0.38,
    tint: ["rgba(140,235,185,.3)", "rgba(255,226,168,.2)"], inten: 0.9, kindColor: "#1b8a4b",
  },
};

const round = (n: number) => Math.round(n * 1000) / 1000;

function build(d: Def): MoodSpec {
  const k = RAINBOW;
  return {
    label: d.label,
    base: d.base,
    shadow: d.shadow,
    anim: d.anim,
    swirl: round(d.swirl * k),
    ring: d.ring,
    rim: { colors: d.colors, opacity: round(Math.min(1, d.rim * (0.4 + 0.6 * k))), speed: d.speed ?? 9 },
    glow: round(d.glow * k),
    tint: d.tint,
    halo: round(Math.min(1, d.inten * (0.55 + 0.45 * k))),
    kindColor: d.kindColor,
    badge: !!d.badge,
    ripple: !!d.ripple,
    raw: { swirl: d.swirl, rim: d.rim, glow: d.glow, halo: d.inten },
  };
}

export const MOODS: Record<OrbMood, MoodSpec> = Object.fromEntries(
  (Object.keys(DEFS) as OrbMood[]).map((m) => [m, build(DEFS[m])]),
) as Record<OrbMood, MoodSpec>;

export const ORB_MOODS = Object.keys(DEFS) as OrbMood[];

/** Fires a ripple when the mood changes into an attention-rising mood. */
export function ripplesOnEnter(prev: OrbMood | null | undefined, next: OrbMood): boolean {
  return prev !== next && MOODS[next].ripple;
}

// ---------------------------------------------------------------- derivations

/** How long a one-shot mood lingers after its real event (design §5.4 step durations). */
export const UNDERSTOOD_MS = 3400;
export const HEARD_MS = 4000;
export const NOTICE_MS = 2500;
export const PRAISE_MS = 4000;

export interface CaptureMoodInput {
  presence: PresenceState;
  /** Latest governor decision (shape of `Decision` from lib/governor, structurally typed). */
  decision?: { state: "listening" | "waiting" | "asking" | "answering"; lights: { notTyping: boolean; notReading: boolean } } | null;
  sharing: boolean;
  understoodAgoMs?: number | null;
  heardAgoMs?: number | null;
  noticeAgoMs?: number | null;
  queued: number;
}

const within = (ago: number | null | undefined, ms: number) => ago != null && ago >= 0 && ago < ms;

/** Priority: off > asking > listening > understood > heard > notice > typing > reading > pausing > quiet. */
export function captureMood(i: CaptureMoodInput): OrbMood {
  if (i.presence === "off-record") return "off";
  if (i.presence === "asking") return "asking";
  if (i.presence === "listening") return "listening";
  if (within(i.understoodAgoMs, UNDERSTOOD_MS)) return "understood";
  if (within(i.heardAgoMs, HEARD_MS)) return "heard";
  if (within(i.noticeAgoMs, NOTICE_MS)) return "notice";
  const d = i.decision;
  if (i.sharing && d) {
    if (!d.lights.notTyping) return "typing";
    if (!d.lights.notReading) return "reading";
    if (d.state === "waiting" && i.queued > 0) return "pausing";
  }
  return "quiet";
}

export interface MapMoodInput {
  phase: "idle" | "asking" | "teachback" | "confirmed";
  /** The debrief agent is speaking. */
  isSpeaking: boolean;
  /** A debrief voice session is live. */
  debriefOn: boolean;
  /** Milliseconds since a slot was filled. */
  filledAgoMs?: number | null;
  /** The map carries `confirmedAt`. */
  confirmed: boolean;
}

/** Priority: confirmed > slot just filled > teach-back > agent speaking > mic open > quiet. */
export function mapMood(i: MapMoodInput): OrbMood {
  if (i.confirmed || i.phase === "confirmed") return "correct";
  if (within(i.filledAgoMs, UNDERSTOOD_MS)) return "understood";
  if (i.phase === "teachback") return "understood";
  if (i.debriefOn && i.isSpeaking) return "asking";
  if (i.phase === "asking") return i.debriefOn ? "listening" : "asking";
  if (i.debriefOn) return "listening";
  return "quiet";
}

export type TeachKind = "predict" | "intervene" | "stop" | "save-blocked" | "praise" | "novel" | "none";

export interface TeachMoodInput {
  /** Kind of the latest tutor decision (matcher DecisionKind or "save-blocked"). */
  latestKind?: TeachKind | string | null;
  /** Milliseconds since that decision. Step/ask kinds stay until the caller clears them. */
  latestAgoMs?: number | null;
  /** The tutor voice is speaking. */
  isSpeaking: boolean;
  ended: boolean;
}

/** predict → asking; intervene/stop/save-blocked → step; praise → correct; novel → notice. Never listening. */
export function teachMood(i: TeachMoodInput): OrbMood {
  if (i.ended) return "understood";
  switch (i.latestKind) {
    case "intervene":
    case "stop":
    case "save-blocked":
      return "step";
    case "predict":
      return "asking";
    case "praise":
      if (i.latestAgoMs == null || within(i.latestAgoMs, PRAISE_MS)) return "correct";
      break;
    case "novel":
      if (i.latestAgoMs == null || within(i.latestAgoMs, PRAISE_MS)) return "notice";
      break;
  }
  return i.isSpeaking ? "asking" : "quiet";
}
