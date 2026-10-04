/**
 * Platform contract (Company Map, Role Memory, Ontology).
 *
 * One shape, two producers:
 *   - lib/platform/derive.ts  builds it from the real store (mode "real")
 *   - lib/platform/demo-data.ts  holds a fictional dataset (mode "demo")
 * The UI renders both through the same components, so every field the mockups show exists here, and every field
 * that real data cannot supply is optional / nullable and has an honest empty state.
 *
 * Conventions:
 *   - Every time is epoch milliseconds (`at`). `approx: true` means the time was reconstructed (debrief clock),
 *     render it with a leading "~".
 *   - Quotation marks only around `quote` / `answer` strings that are verbatim expert words. Paraphrases live in
 *     `title` / `text` / `label`.
 *   - No percentages for understanding: counts (`n` of `of`).
 *   - This file has no imports, so it is safe in client components. The two helpers at the bottom are pure.
 */

export type PlatformMode = "real" | "demo";

/** Where a piece of knowledge came from. `seen` = vision model, `erp` = ERP telemetry (dom); never merge them. */
export type Provenance = "seen" | "erp" | "said" | "described" | "inferred" | "teachback" | "mapped";

/** Memory item kinds (Role Memory legend, rule chips, Ontology decision paths). */
export type ItemKind = "rule" | "guardrail" | "exception" | "escalation" | "described";

/** The spec's T3 labels (D7). Same legend for demo and real. */
export type MasteryLabel = "correct without help" | "correct after a hint" | "corrected after intervention" | "not tested";

export type BeadType = "mapped" | "capture" | "debrief" | "confirm" | "teach" | "planned";

export type TimeUnit = "minute" | "hour" | "day" | "month";

// ---------------------------------------------------------------- timeline ("Watch it grow")

export interface Bead {
  id: string;
  at: number;
  approx?: boolean;
  type: BeadType;
  /** e.g. "Capture · Process supplier invoices", "Debrief · 4/5 gaps closed", "Teach · coached" */
  title: string;
  who?: string | null;
  /** e.g. "+2 rules · 3 cases" */
  diff?: string | null;
  href?: string | null;
  /** beads merged because they sit at (almost) the same time; titles of all merged beads */
  merged?: string[];
}

export interface Tick {
  at: number;
  label: string;
}

export interface Timeline {
  start: number;
  end: number;
  /** "now" for real data (load time), a fixed day for demo */
  today: number;
  unit: TimeUnit;
  ticks: Tick[];
  beads: Bead[];
  /** false when fewer than 2 distinct bead times exist: render static, no Play */
  canPlay: boolean;
}

/** A stepped series: value at time t = the last point with at <= t (0 before the first). */
export interface SeriesPoint {
  at: number;
  n: number;
}

/** A stepped count with a denominator ("3 of 5 explained"). `of` may grow over time. */
export interface CountPoint {
  at: number;
  n: number;
  of: number;
}

// ---------------------------------------------------------------- people and org

export interface Person {
  id: string;
  name: string;
  /** "expert" | "new hire" | free text in demo (e.g. "not captured") */
  tag: string;
  /** short grey descriptor next to the name, e.g. "expert", "new hire · learning from the map", "first seen Oct 4" */
  descriptor: string;
  avatar: "expert" | "newhire" | "other";
  firstSeenAt?: number | null;
  /** demo only (no HR source in real mode) */
  yearsInRole?: number | null;
  /** demo only (no HR source in real mode) */
  retiresInMonths?: number | null;
}

export interface Department {
  id: string;
  name: string;
  /** label colour */
  color: string;
  /** cloud gradient stops */
  cloudA: string;
  cloudB: string;
  x: number;
  y: number;
  rx: number;
  ry: number;
}

export type RoleStatus =
  | "captured" // a confirmed map exists
  | "in_debrief" // compiled, not yet confirmed
  | "capturing" // a capture session with no map yet
  | "mentioned" // named by an expert (stopAndAsk.who), not captured
  | "inferred" // demo only
  | "seen" // demo only (seen on screen, never explained)
  | "not_captured" // demo only (org import)
  | "mapped"; // demo only (added by a user)

export interface RoleRisk {
  level: "critical" | "high" | "watch";
  /** pronoun-free, e.g. "22 years in the role, retires in 10 months. Nothing captured yet." */
  note: string;
}

export interface RuleChip {
  /** real rule id (key, policy lookup, ontology `?rule=`) */
  id: string;
  /** "R1".. by map.rules order */
  displayId: string;
  kind: ItemKind;
  title: string;
  /** verbatim, may be truncated by the UI; null when the rule has no quote */
  quote: string | null;
  href?: string | null;
}

export interface RoleNode {
  id: string;
  title: string;
  /** department id; real mode uses one neutral "Seen by Tacit" cloud (no org source) */
  dept: string | null;
  team: string | null;
  /** O*NET chip shown instead of department in real mode */
  onet?: { code: string; occupation: string } | null;
  status: RoleStatus;
  /** human status chip text, e.g. "Captured · confirmed", "In debrief", "Mentioned, not captured" */
  statusLabel: string;
  /** the role the company map centres on */
  isMain?: boolean;
  /** when the role first becomes known on the timeline */
  at: number;
  approx?: boolean;
  people: Person[];
  /** "n of N decisions explained", stepped over time; empty for roles that were never captured */
  coverage: CountPoint[];
  rules: SeriesPoint[];
  sessions: SeriesPoint[];
  /** how many rules hand work to this role (mentioned roles) */
  mentions: SeriesPoint[];
  openGaps: number;
  learners: number;
  topRules: RuleChip[];
  risk?: RoleRisk | null;
  plannedAt?: number | null;
  /** world coordinates (2000 x 1300) and radius; deterministic */
  x: number;
  y: number;
  r: number;
  memoryHref?: string | null;
  ontologyHref?: string | null;
  /** CTA for roles nobody has been captured in */
  captureHref?: string | null;
  /** short explanation for non-captured roles, e.g. "Tacit knows when work goes here — not yet how this role decides." */
  note?: string | null;
}

export interface RoleEdge {
  id: string;
  from: string;
  to: string;
  /** paraphrase, e.g. "stop and ask · Hold until matched" */
  label: string;
  prov: Provenance;
  /** display ids ("R2") of the rules behind this hand-off */
  ruleIds: string[];
  at: number;
  approx?: boolean;
  /** inferred links only (demo): the question Tacit would ask */
  suggest?: string | null;
}

export interface Suggestion {
  id: string;
  kind: "continue_debrief" | "awaiting_confirm" | "novel_case" | "stale_revision" | "retirement_risk" | "inferred_link" | "plan_capture";
  text: string;
  /** dot colour hint */
  tone: "amber" | "violet" | "green" | "red" | "blue";
  action: { label: string; href: string | null } | null;
  at?: number | null;
  roleId?: string | null;
}

export interface ExportLink {
  sessionId: string;
  label: string;
  policy: string;
  sop: string;
  prompt: string;
}

export interface PlatformData {
  mode: PlatformMode;
  company: { name: string; sub: string };
  departments: Department[];
  /** shown when there is no org source (real mode) */
  orgNote: string | null;
  roles: RoleNode[];
  edges: RoleEdge[];
  mainRoleId: string | null;
  timeline: Timeline;
  suggestions: Suggestion[];
  /** sidebar Library */
  sessionsCount: number;
  exports: ExportLink[];
  /** sidebar footer pill; null hides it */
  live: { label: string; href: string } | null;
  /** what the UI may offer: real mode hides edit and the risk lens */
  features: { riskLens: boolean; editMap: boolean };
  /** session/map files that could not be read */
  unreadable: number;
  /** centre empty state when there are no roles */
  empty: { title: string; cta: { label: string; href: string } } | null;
}

// ---------------------------------------------------------------- role memory

export interface SynopsisSentence {
  id: string;
  text: string;
  at: number;
  approx?: boolean;
  /** superseded at this time (demo: pre-correction wording); the sentence disappears when until <= t */
  until?: number | null;
  /** chip "corrected by {by}" */
  corrected?: { by: string; at: number; approx?: boolean } | null;
  /** "Described, not shown" sentences */
  described?: boolean;
}

export interface Synopsis {
  sentences: SynopsisSentence[];
  /** unconfirmed: "Draft — not yet confirmed by {expert}" */
  draftBanner: string | null;
  /** no map at all */
  empty: string | null;
}

export interface KnowledgeSeries {
  kinds: { kind: ItemKind; label: string; color: string }[];
  /** cumulative counts per kind, one point per change */
  points: { at: number; counts: Record<ItemKind, number> }[];
  total: number;
}

export interface TaskStep {
  n: number;
  /** "mm:ss" or "—" */
  t: string;
  title: string;
  judgment: boolean;
  rule?: { id: string; displayId: string; kind: ItemKind } | null;
}

export interface TaskCard {
  id: string;
  title: string;
  at: number;
  approx?: boolean;
  /** "Oct 4 · Sabine · 8 min · 3 cases" or "Described in the debrief · not demonstrated" */
  sub: string;
  watched: boolean;
  steps: TaskStep[];
  /** described tasks: question -> verbatim answer */
  described?: { question: string; quote: string }[];
}

export interface MemoryItem {
  id: string;
  displayId: string;
  /** real rule id when the item is a rule (ontology link) */
  ruleId?: string | null;
  kind: ItemKind;
  title: string;
  /** verbatim expert words or null */
  quote: string | null;
  /** when there is no quote: "Confirmed in the teach-back, not in {expert}'s words" */
  noQuoteLabel: string | null;
  /** source line, e.g. "Sabine · live answer · 00:49" */
  source: string;
  learnedAt: number;
  approx?: boolean;
  /** a debrief correction whose words are in this item's quotes; `before` only when stored (demo) */
  correction?: { text: string; before?: string | null; at: number; approx?: boolean } | null;
  mastery?: { person: string; label: MasteryLabel } | null;
  href?: string | null;
}

export interface AskEntry {
  id: string;
  question: string;
  /** verbatim expert words */
  answer: string;
  kind: ItemKind;
  /** "Who to ask · Sabine · debrief" */
  source: string;
  learnedAt: number;
  approx?: boolean;
  /** demo only: the answer memory gave before a later correction */
  early?: { answer: string; until: number; note: string } | null;
}

export interface Dimension {
  label: string;
  series: SeriesPoint[];
  /** null when there is no denominator source ("Tasks seen") */
  max: number | null;
}

export interface MasteryColumn {
  id: string;
  at: number;
  /** "Oct 4 · coached" */
  label: string;
  href?: string | null;
}

export interface Mastery {
  learner: string | null;
  columns: MasteryColumn[];
  rows: { ruleId: string; displayId: string; title: string; cells: (MasteryLabel | null)[] }[];
  /** "No new hire has trained on this map yet." */
  empty: string | null;
}

export interface OpenQuestion {
  id: string;
  question: string;
  status: "open" | "filled" | "skipped";
  openedAt: number;
  closedAt: number | null;
  approx?: boolean;
  /** "open · limit", "answered in the debrief", "skipped" */
  how: string;
}

export interface RoleMemory {
  roleId: string;
  title: string;
  breadcrumb: string[];
  status: RoleStatus;
  statusLabel: string;
  revision: number | null;
  confirmed: boolean;
  expertName: string | null;
  /** session id of the map this memory comes from (null: nothing compiled) */
  memoryMapId: string | null;
  mapHref: string | null;
  ontologyHref: string | null;
  /** "n of N explained" stepped */
  coverage: CountPoint[];
  people: Person[];
  timeline: Timeline;
  synopsis: Synopsis;
  knowledge: KnowledgeSeries;
  tasks: TaskCard[];
  items: MemoryItem[];
  asks: AskEntry[];
  /** "Nothing confirmed to answer from yet." when asks is empty */
  asksEmpty: string | null;
  dimensions: Dimension[];
  mastery: Mastery;
  openQuestions: OpenQuestion[];
}

// ---------------------------------------------------------------- ontology

export interface OntField {
  name: string;
  /** observed values joined, or a type hint ("€ · tabular") */
  value: string;
  prov: Provenance;
  at: number;
  approx?: boolean;
}

interface OntNodeBase {
  id: string;
  name: string;
  prov: Provenance;
  at: number;
  approx?: boolean;
  /** paraphrase definition, or null */
  def: string | null;
  /** verbatim expert words that define it, or null */
  defQuote?: string | null;
  /** world coordinates (1800 x 1180), deterministic */
  x: number;
  y: number;
  /** "First learned … · {session title}" */
  firstSession?: string | null;
}

export interface OntClass extends OntNodeBase {
  kind: "object";
  fields: OntField[];
  /** instance chips (non-redacted observed values) */
  instances: string[];
}

export interface OntConcept extends OntNodeBase {
  kind: "concept" | "role";
  fields?: OntField[];
  instances?: string[];
  /** demo only: other roles this node also belongs to */
  alsoIn?: string[];
}

export type OntNode = OntClass | OntConcept;

export interface OntEdge {
  id: string;
  from: string;
  to: string;
  verb: string;
  /** "n:1", "0..1" or null */
  card: string | null;
  prov: Provenance;
  at: number;
  approx?: boolean;
  /** real rule ids whose badge sits on this edge */
  ruleIds: string[];
}

export interface LogicRow {
  key: "WHEN" | "AND" | "ANY OF" | "OR" | "NOT" | "UNLESS" | "THEN" | "STOP";
  /** the class owning the attribute ("Invoice"), or a role ("AP lead") */
  entity: string | null;
  entityIsRole?: boolean;
  attr: string;
  op: string;
  value: string;
}

export interface OntRule {
  id: string;
  displayId: string;
  kind: ItemKind;
  title: string;
  at: number;
  approx?: boolean;
  logic: LogicRow[];
  /** verbatim, with source label and "mm:ss" */
  quotes: { text: string; source: string; t: string }[];
  noQuoteLabel: string | null;
  correction: { text: string; before?: string | null; at: number; approx?: boolean } | null;
  /** node ids the trace highlights (in order for the "Path through the data" chips) */
  path: string[];
  edgeIds: string[];
  /** edge carrying the rule badge */
  badgeEdgeId: string | null;
  learners: { name: string; label: MasteryLabel }[];
  /** pretty JSON of this rule in policy.json, only if the map is confirmed */
  policy: string | null;
  /** shown instead of `policy` when null, e.g. "Not agent-ready until Sabine confirms" */
  policyNote: string | null;
}

export interface Ontology {
  roleId: string;
  roleTitle: string;
  expertName: string | null;
  people: Person[];
  confirmed: boolean;
  timeline: Timeline;
  classes: OntClass[];
  concepts: OntConcept[];
  edges: OntEdge[];
  rules: OntRule[];
  /** legend label for "said by {expert}" */
  saidLabel: string;
  empty: string | null;
}

// ---------------------------------------------------------------- pure helpers (client-safe)

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Deterministic date label (UTC, so server and client render the same string).
 * minute/hour: "14:05" (plus "Oct 4 " when `withDay`); day: "Oct 4"; month: "Oct 2026".
 */
/**
 * Labels are formatted in UTC so server and client render the same text (hydration-safe). A time of day therefore says
 * "UTC"; axis ticks pass `zone = false` because the "As of … UTC" headline above the axis already names the zone.
 */
export function formatAt(at: number, unit: TimeUnit, withDay = false, zone = true): string {
  const d = new Date(at);
  const day = `${MON[d.getUTCMonth()]} ${d.getUTCDate()}`;
  if (unit === "minute" || unit === "hour") return `${withDay ? day + " " : ""}${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}${zone ? " UTC" : ""}`;
  if (unit === "month") return `${MON[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  return day;
}

/** Value of a stepped series at time t. */
export function seriesAt<T extends { at: number }>(series: readonly T[], t: number): T | undefined {
  let v: T | undefined;
  for (const p of series) if (p.at <= t) v = p;
  return v;
}

const MIN = 60_000, HOUR = 60 * MIN, DAY = 24 * HOUR;

/** Pick the tick unit from the range length. */
export function unitFor(start: number, end: number): TimeUnit {
  const span = Math.max(0, end - start);
  if (span <= 3 * HOUR) return "minute";
  if (span <= 2 * DAY) return "hour";
  if (span <= 60 * DAY) return "day";
  return "month";
}

/** About 4-8 evenly stepped ticks inside [start, end], labelled with formatAt. */
export function makeTicks(start: number, end: number, unit: TimeUnit = unitFor(start, end)): Tick[] {
  if (!(end > start)) return [];
  const span = end - start;
  const out: Tick[] = [];
  if (unit === "month") {
    const d = new Date(start);
    let y = d.getUTCFullYear(), m = d.getUTCMonth() + 1;
    for (let i = 0; i < 60; i++, m++) {
      if (m > 11) { m = 0; y++; }
      const at = Date.UTC(y, m, 1);
      if (at > end) break;
      out.push({ at, label: MON[m] });
    }
    return out;
  }
  const steps = unit === "minute" ? [1, 2, 5, 10, 15, 30, 60].map((x) => x * MIN)
    : unit === "hour" ? [1, 2, 3, 6, 12, 24].map((x) => x * HOUR)
    : [1, 2, 7, 14].map((x) => x * DAY);
  const step = steps.find((s) => span / s <= 8) ?? steps[steps.length - 1];
  for (let at = Math.ceil(start / step) * step; at <= end; at += step) out.push({ at, label: formatAt(at, unit, false, false) });
  return out;
}

/** Assemble a Timeline: sorted beads, adaptive ticks, play only with >= 2 distinct bead times. */
export function makeTimeline(beads: Bead[], start: number, end: number, today: number): Timeline {
  const sorted = [...beads].sort((a, b) => a.at - b.at);
  const unit = unitFor(start, end);
  const distinct = new Set(sorted.filter((b) => b.type !== "planned").map((b) => b.at)).size;
  return { start, end, today, unit, ticks: makeTicks(start, end, unit), beads: sorted, canPlay: distinct >= 2 };
}
