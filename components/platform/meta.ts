// Client-safe constants and tiny helpers shared by the platform pages (Company Map, Role Memory, Ontology).
// No data imports: real and demo data both arrive as props through lib/platform/types.
import { formatAt, type Bead, type ItemKind, type MasteryLabel, type Provenance, type Timeline } from "@/lib/platform/types";

export const KIND: Record<ItemKind, { label: string; color: string }> = {
  rule: { label: "Decision rule", color: "#f5a623" },
  guardrail: { label: "Guardrail", color: "#e5484d" },
  exception: { label: "Exception", color: "#8f7bff" },
  escalation: { label: "Who to ask", color: "#3b82f6" },
  described: { label: "Described case", color: "#8e8e93" },
};

/** Provenance chips. `seen` (vision) and `erp` (dom telemetry) stay separate (non-negotiable 5). */
export const PROV: Record<Provenance, { label: string; short: string; color: string; bg: string; ink: string }> = {
  said: { label: "Said by the expert", short: "said", color: "#f5a623", bg: "rgba(245,166,35,.14)", ink: "#a35f00" },
  seen: { label: "Seen on screen", short: "seen", color: "#8fa1bb", bg: "rgba(107,133,168,.14)", ink: "#4a6488" },
  erp: { label: "From the ERP", short: "erp", color: "#4a6488", bg: "rgba(74,100,136,.12)", ink: "#34496a" },
  described: { label: "Described, not shown", short: "described", color: "#9a9aa2", bg: "rgba(0,0,0,.05)", ink: "#6e6e73" },
  inferred: { label: "Inferred", short: "inferred", color: "#8f7bff", bg: "rgba(143,123,255,.14)", ink: "#6a55d8" },
  teachback: { label: "Confirmed in the teach-back", short: "teach-back", color: "#22b45e", bg: "rgba(34,180,94,.12)", ink: "#1b8a4b" },
  mapped: { label: "Mapped by you", short: "mapped", color: "#8e8e93", bg: "rgba(0,0,0,.05)", ink: "#6e6e73" },
};

export const MASTERY: Record<MasteryLabel, { color: string; ink: string; short: string }> = {
  "correct without help": { color: "#22b45e", ink: "#1b8a4b", short: "alone" },
  "correct after a hint": { color: "#f5a623", ink: "#a35f00", short: "hint" },
  "corrected after intervention": { color: "#f0642f", ink: "#b4501f", short: "caught" },
  "not tested": { color: "#c7c7cc", ink: "#8e8e93", short: "—" },
};

export const PASTEL = ["#ffb8d9", "#ffe2a8", "#b9f0d3", "#b5dcff", "#d4c6ff", "#ffb8d9"];
export const EDGE_GRAD = ["#ff9ad5", "#ffc56b", "#7fe0b0", "#8fd3ff", "#b7a6ff"];

export const AVATAR: Record<"expert" | "newhire" | "other", { bg: string; ink: string }> = {
  expert: { bg: "radial-gradient(circle at 35% 30%,#fff6e4,#ffd27a)", ink: "#6b3f00" },
  newhire: { bg: "radial-gradient(circle at 35% 30%,#eef5ff,#b5dcff)", ink: "#1e4b8a" },
  other: { bg: "radial-gradient(circle at 35% 30%,#ffffff,#ececf0)", ink: "#3a3a3c" },
};

export const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

/** "As of …" label for the scrubber. */
export function asOfLabel(tl: Timeline, t: number): string {
  const span = Math.max(1, tl.end - tl.start);
  const withDay = tl.unit === "minute" || tl.unit === "hour";
  const atToday = Math.abs(t - tl.today) <= span * 0.004;
  return `As of ${formatAt(t, tl.unit === "month" ? "day" : tl.unit, withDay)}${atToday ? " · today" : ""}`;
}

/** Date label in the timeline's own unit (with "~" when approximate). */
export function when(tl: Timeline, at: number, approx?: boolean): string {
  const unit = tl.unit === "month" ? "day" : tl.unit;
  return `${approx ? "~" : ""}${formatAt(at, unit, unit === "minute" || unit === "hour")}`;
}

/** Last (and previous) non-planned bead at or before t. */
export function lastBeads(beads: Bead[], t: number): { last: Bead | null; prev: Bead | null } {
  let last: Bead | null = null;
  let prev: Bead | null = null;
  for (const b of beads) {
    if (b.type === "planned" || b.at > t) continue;
    prev = last;
    last = b;
  }
  return { last, prev };
}

export function lastLine(beads: Bead[], t: number, before: string): string {
  const { last } = lastBeads(beads, t);
  if (!last) return before;
  return `Last · ${last.title}${last.diff ? ` · ${last.diff}` : ""}`;
}

/** Scrubber beads in the glass TimelineScrubber shape (confirm beads violet, as in the platform report). */
export function scrubberBeads(beads: Bead[]) {
  return beads.map((b) => ({ at: b.at, type: b.type, title: `${b.approx ? "~" : ""}${b.title}${b.who ? ` · ${b.who}` : ""}`, color: b.type === "confirm" ? "#8f7bff" : undefined }));
}

/** The index of the last threshold passed: lets heavy views memoise on "what is known" instead of on every t. */
export function stepIndex(sortedTimes: number[], t: number): number {
  let lo = 0, hi = sortedTimes.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sortedTimes[mid] <= t) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return parts.length === 1 ? parts[0].slice(0, 1).toUpperCase() : (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function trunc(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s;
}

export function hexA(hex: string, a: number): string {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return hex;
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
}
