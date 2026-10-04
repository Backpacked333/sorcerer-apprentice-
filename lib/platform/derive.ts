/**
 * Real-mode platform derivations: SessionLog[] + WorkMap[] -> PlatformData / RoleMemory / Ontology (mode "real").
 *
 * Pure (no fs, no clock: `now` is passed in). Spec: scratchpad platform report §2.1-§2.3, lead decisions D6/D7.
 * Honesty rules applied here:
 *   - roles group by slug(session.task) (D6); mentioned roles come only from a confirmed map's stopAndAsk.who
 *   - a quote is shown only as verbatim Quote.text; a stop rule with no quote naming the role is labelled
 *     "Confirmed in the teach-back, not in {expert}'s words"
 *   - field provenance: vision -> "seen", dom -> "erp"; struck events (redacted or inside off-record) are skipped
 *   - policy.json and the Ask panel only from a confirmed map; suggestions only from real items
 *   - debrief times are reconstructed (debrief clock is not persisted) and flagged approx
 * Output never contains frames, transcript or raw event state.
 */
import type { ScreenEvent, SessionLog } from "../events";
import { Matcher, type MasteryEntry, type MasteryOutcome } from "../matcher";
import { generateTeachback } from "../teachback";
import { toPolicy } from "../export";
import { describeAct, describeCond, type Act, type Cond, type Quote, type Rule, type WorkMap } from "../workmap";
import {
  formatAt,
  makeTimeline,
  type AskEntry,
  type Bead,
  type CountPoint,
  type Department,
  type Dimension,
  type ItemKind,
  type KnowledgeSeries,
  type LogicRow,
  type Mastery,
  type MasteryLabel,
  type MemoryItem,
  type OntClass,
  type OntConcept,
  type OntEdge,
  type OntField,
  type OntRule,
  type Ontology,
  type OpenQuestion,
  type Person,
  type PlatformData,
  type Provenance,
  type RoleEdge,
  type RoleMemory,
  type RoleNode,
  type RuleChip,
  type SeriesPoint,
  type Suggestion,
  type SynopsisSentence,
  type TaskCard,
  type Timeline,
} from "./types";

export interface PlatformInput {
  sessions: SessionLog[];
  /** capture session id -> its map */
  maps: Record<string, WorkMap>;
  /** files that could not be read */
  unreadable?: number;
  now: number;
}

// ---------------------------------------------------------------- small helpers

export function slug(s: string): string {
  const out = s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60).replace(/-+$/g, "");
  return out || "untitled";
}

const pad = (n: number) => String(Math.max(0, Math.floor(n))).padStart(2, "0");
export const mmss = (t: number) => `${pad(t / 60)}:${pad(t % 60)}`;
const uniq = <T,>(xs: T[]) => [...new Set(xs)];
const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const normWho = (who: string) => who.trim().replace(/^the\s+/i, "");

const KIND_META: Record<ItemKind, { label: string; color: string }> = {
  rule: { label: "Decision rule", color: "#f5a623" },
  guardrail: { label: "Guardrail", color: "#e5484d" },
  exception: { label: "Exception", color: "#8f7bff" },
  escalation: { label: "Who to ask", color: "#3b82f6" },
  described: { label: "Described case", color: "#8e8e93" },
};

function quoteSourceLabel(source?: string): string {
  if (source === "live") return "live answer";
  if (source === "narration") return "narration";
  if (source === "debrief") return "debrief";
  if (source === "counterfactual") return "what-if";
  return source ?? "";
}

export const noQuoteLabel = (expert: string) => `Confirmed in the teach-back, not in ${expert}'s words`;

interface At { at: number; approx: boolean }

/** The debrief clock is not persisted: debrief answers land between the end of capture and the confirm. */
export function debriefAt(s: SessionLog, m: WorkMap): number {
  const end = s.endedAt ?? s.startedAt;
  let at = Math.max(m.compiledAt ?? end, end);
  if (m.confirmedAt) at = Math.min(at, m.confirmedAt);
  return at;
}

export function quoteAt(q: Pick<Quote, "t" | "source">, s: SessionLog, m: WorkMap): At {
  if (q.source === "debrief") return { at: debriefAt(s, m), approx: true };
  return { at: s.startedAt + Math.max(0, q.t) * 1000, approx: false };
}

const earliest = (xs: At[]): At | undefined => xs.reduce<At | undefined>((a, b) => (!a || b.at < a.at || (b.at === a.at && !b.approx) ? b : a), undefined);

export function ruleLearnedAt(r: Rule, s: SessionLog, m: WorkMap): At {
  const fromQuotes = earliest(r.quotes.map((q) => quoteAt(q, s, m)));
  if (fromQuotes) return fromQuotes;
  if (r.stopAndAsk?.quote) return quoteAt(r.stopAndAsk.quote, s, m);
  if (m.confirmedAt) return { at: m.confirmedAt, approx: false };
  return { at: m.compiledAt ?? s.endedAt ?? s.startedAt, approx: true };
}

export function ruleKind(r: Rule): ItemKind {
  if (r.quotes.length > 0 && r.quotes.every((q) => q.evidence === "described")) return "described";
  if (r.unless) return "exception";
  return "rule";
}

const guardrailKind = (k: "limit" | "exception" | "escalation"): ItemKind => (k === "limit" ? "guardrail" : k);

/** A struck event: tombstoned, or inside an off-record window. Never shown. */
export function isStruck(e: ScreenEvent, s: SessionLog): boolean {
  return !!e.redacted || s.offRecord.some((w) => e.t >= w.from && e.t <= w.to);
}

/** The stop rule's expert words: its own quote, or a quote of this rule that literally names the role. */
function stopQuote(r: Rule, m: WorkMap): Quote | undefined {
  if (!r.stopAndAsk?.who) return undefined;
  if (r.stopAndAsk.quote) return r.stopAndAsk.quote;
  const who = normWho(r.stopAndAsk.who).toLowerCase();
  if (!who) return undefined;
  const pool: Quote[] = [
    ...r.quotes,
    ...m.slots.filter((x) => x.ruleId === r.id && x.filledBy).map((x) => x.filledBy!),
    ...m.steps.flatMap((st) => st.guardrails).filter((g) => g.ruleId === r.id && g.quote).map((g) => g.quote!),
  ];
  return pool.find((q) => q.text.toLowerCase().includes(who));
}

// ---------------------------------------------------------------- mastery (T3 labels, D7)

const OUTCOMES: MasteryOutcome[] = ["applied_unprompted", "applied_after_hint", "missed", "escalation_recognized", "novel_case_flagged", "novel_case_covered", "predicted_correctly", "predicted_wrong"];

/** Parses the persisted string `"{outcome} ({phase}[, help before the decision])"` (TeachClient) or a bare outcome. */
export function parseMastery(m: { ruleId: string; outcome: string; t: number }): MasteryEntry | null {
  const match = /^\s*([a-z_]+)\s*(?:\(([^)]*)\))?\s*$/.exec(m.outcome ?? "");
  if (!match || !OUTCOMES.includes(match[1] as MasteryOutcome)) return null;
  const inner = match[2] ?? "";
  return {
    ruleId: m.ruleId,
    outcome: match[1] as MasteryOutcome,
    t: m.t,
    phase: /independent/.test(inner) ? "independent" : "coached",
    helpBefore: /help before/.test(inner),
  };
}

export function masteryLabels(teach: SessionLog, map: WorkMap): Map<string, MasteryLabel> {
  const mt = new Matcher(map);
  mt.ledger = (teach.mastery ?? []).map(parseMastery).filter((x): x is MasteryEntry => !!x);
  return new Map(mt.masteryCard().map((c) => [c.ruleId, c.label]));
}

function teachPhases(teach: SessionLog): string {
  const modes = uniq(teach.events.filter((e) => !isStruck(e, teach) && e.mode).map((e) => e.mode!));
  const phases = modes.length ? modes : uniq((teach.mastery ?? []).map(parseMastery).filter(Boolean).map((x) => x!.phase));
  return phases.length ? phases.sort().join(" + ") : "coached";
}

// ---------------------------------------------------------------- grouping

interface Pair { s: SessionLog; m: WorkMap }
interface RoleGroup {
  id: string;
  task: string;
  captures: SessionLog[];
  pairs: Pair[];
  /** latest confirmed map: the role's memory (non-negotiable 7) */
  memory: Pair | null;
  /** memory, else the latest compiled draft */
  display: Pair | null;
  teaches: SessionLog[];
  experts: string[];
  newHires: string[];
  /** captures with no events and no map (counted, not shown) */
  empties: number;
}

/** A capture with nothing in it (no events, no map) counts as a session but contributes no people, tasks or beads. */
const substantive = (s: SessionLog, maps: Record<string, WorkMap>) => s.events.length > 0 || !!maps[s.id];

function groupRoles(input: PlatformInput): RoleGroup[] {
  const captures = input.sessions.filter((s) => s.mode === "capture").sort((a, b) => a.startedAt - b.startedAt);
  const byId = new Map<string, RoleGroup>();
  const order: string[] = [];
  for (const s of captures) {
    const id = slug(s.task);
    let g = byId.get(id);
    if (!g) {
      g = { id, task: s.task, captures: [], pairs: [], memory: null, display: null, teaches: [], experts: [], newHires: [], empties: 0 };
      byId.set(id, g);
      order.push(id);
    }
    g.captures.push(s);
    const m = input.maps[s.id];
    if (m) g.pairs.push({ s, m });
  }
  const captureRole = new Map(captures.map((s) => [s.id, slug(s.task)]));
  for (const t of input.sessions.filter((s) => s.mode === "teach").sort((a, b) => a.startedAt - b.startedAt)) {
    const id = (t.sourceMapSessionId && captureRole.get(t.sourceMapSessionId)) || slug(t.task);
    byId.get(id)?.teaches.push(t);
  }
  for (const g of byId.values()) {
    const stamp = (p: Pair) => p.m.confirmedAt ?? p.m.compiledAt ?? p.s.startedAt;
    const latest = (ps: Pair[]) => ps.slice().sort((a, b) => stamp(b) - stamp(a))[0] ?? null;
    g.memory = latest(g.pairs.filter((p) => !!p.m.confirmedAt));
    g.display = g.memory ?? latest(g.pairs.filter((p) => p.m.steps.length > 0 || p.m.rules.length > 0)) ?? latest(g.pairs);
    g.empties = g.captures.filter((s) => !substantive(s, input.maps)).length;
    g.captures = g.captures.filter((s) => substantive(s, input.maps));
    g.experts = uniq([...g.captures.map((s) => s.expertName), ...g.pairs.map((p) => p.m.expert.name)].map((x) => x.trim()).filter(Boolean));
    g.newHires = uniq(g.teaches.map((t) => t.expertName.trim()).filter(Boolean));
  }
  const rank = (g: RoleGroup) => (g.memory ? 0 : g.display ? 1 : 2);
  return order.map((id) => byId.get(id)!).sort((a, b) => rank(a) - rank(b) || (a.captures[0]?.startedAt ?? Number.MAX_SAFE_INTEGER) - (b.captures[0]?.startedAt ?? Number.MAX_SAFE_INTEGER));
}

function statusOf(g: RoleGroup): { status: RoleNode["status"]; label: string } {
  if (g.memory) return { status: "captured", label: "Captured · confirmed" };
  if (g.display) return { status: "in_debrief", label: "In debrief — not memory yet" };
  return { status: "capturing", label: "Capturing" };
}

/**
 * Capture and Teach fall back to a placeholder name ("Expert" / "New hire") when nobody typed one. That placeholder is not a
 * person: it never becomes a separate entry next to a named one, and it is shown as "Unnamed …" only when nobody was named.
 */
const PLACEHOLDER_NAMES = new Set(["", "expert", "the expert", "new hire", "the new hire", "unnamed", "unknown"]);
export const isPlaceholderName = (name: string | null | undefined) => PLACEHOLDER_NAMES.has((name ?? "").trim().toLowerCase());
const named = (names: string[]) => names.filter((n) => !isPlaceholderName(n));
const displayName = (name: string, tag: "expert" | "new hire") => (isPlaceholderName(name) ? `Unnamed ${tag}` : name);

const expertOf = (g: RoleGroup) => [g.display?.m.expert.name ?? "", ...g.experts].find((n) => !isPlaceholderName(n)) || "the expert";

// ---------------------------------------------------------------- beads and timeline

function casesOf(s: SessionLog): number {
  return uniq(s.events.filter((e) => !isStruck(e, s) && e.invoice).map((e) => e.invoice!)).length;
}

function beadsFor(groups: RoleGroup[]): Bead[] {
  const beads: Bead[] = [];
  for (const g of groups) {
    for (const s of g.captures) {
      const m = g.pairs.find((p) => p.s.id === s.id)?.m;
      const liveRules = m ? m.rules.filter((r) => r.quotes.some((q) => q.source !== "debrief")).length : 0;
      beads.push({ id: `cap_${s.id}`, at: s.startedAt, type: "capture", title: `Capture · ${s.task}`, who: displayName(s.expertName, "expert"), href: m ? `/map/${s.id}` : null,
        diff: m ? `+${liveRules} rule${liveRules === 1 ? "" : "s"} · ${casesOf(s)} case${casesOf(s) === 1 ? "" : "s"}` : "not compiled yet" });
      if (!m) continue;
      const filled = m.slots.filter((x) => x.status === "filled" && x.filledBy?.source === "debrief").length;
      if (filled > 0 || m.notes.length > 0) {
        const closed = m.slots.filter((x) => x.status !== "open").length;
        beads.push({ id: `deb_${s.id}`, at: debriefAt(s, m), approx: true, type: "debrief", title: `Debrief · ${closed}/${m.slots.length} gaps closed`, who: m.expert.name, diff: `+${filled} answered`, href: `/map/${s.id}` });
      }
      if (m.confirmedAt) beads.push({ id: `conf_${s.id}`, at: m.confirmedAt, type: "confirm", title: `Confirmed · rev ${m.revision}`, who: m.expert.name, diff: `${m.corrections.length} corrected`, href: `/map/${s.id}` });
    }
    for (const t of g.teaches) {
      const n = uniq((t.mastery ?? []).map((x) => x.ruleId).filter((id) => id !== "novel")).length;
      beads.push({ id: `teach_${t.id}`, at: t.startedAt, type: "teach", title: `Teach · ${teachPhases(t)}`, who: displayName(t.expertName, "new hire"), diff: `${n} rule${n === 1 ? "" : "s"} exercised`, href: `/teach/${t.id}` });
    }
  }
  return beads;
}

/** Merge beads of one type that sit closer than 1/150 of the range (they would overlap on the track). */
export function mergeBeads(beads: Bead[], start: number, end: number): Bead[] {
  const eps = Math.max(1, (end - start) / 150);
  const out: Bead[] = [];
  for (const b of [...beads].sort((a, c) => a.at - c.at)) {
    const prev = [...out].reverse().find((x) => x.type === b.type);
    if (prev && b.at - prev.at < eps) {
      prev.merged = [...(prev.merged ?? [prev.title]), b.title];
      continue;
    }
    out.push({ ...b });
  }
  return out;
}

export function timelineFor(beads: Bead[], now: number): Timeline {
  if (beads.length === 0) return makeTimeline([], now - 3_600_000, now, now);
  const first = Math.min(...beads.map((b) => b.at));
  const last = Math.max(now, ...beads.map((b) => b.at));
  const padMs = Math.max(60_000, (last - first) * 0.06);
  const start = first - padMs;
  return makeTimeline(mergeBeads(beads, start, last), start, last, now);
}

// ---------------------------------------------------------------- per-map knowledge

interface Learned { at: number; approx: boolean }

function displayIds(m: WorkMap): Map<string, string> {
  return new Map(m.rules.map((r, i) => [r.id, `R${i + 1}`]));
}

function coverageSeries(p: Pair | null): CountPoint[] {
  if (!p) return [];
  const evs: { at: number; dn: number; dof: number }[] = [];
  for (const st of p.m.steps.filter((x) => x.judgment)) {
    evs.push({ at: p.s.startedAt + st.screenMoment.t * 1000, dn: 0, dof: 1 });
    if (st.reason) evs.push({ at: quoteAt(st.reason, p.s, p.m).at, dn: 1, dof: 0 });
  }
  evs.sort((a, b) => a.at - b.at);
  const out: CountPoint[] = [];
  let n = 0, of = 0;
  for (const e of evs) {
    n += e.dn; of += e.dof;
    const last = out[out.length - 1];
    if (last && last.at === e.at) { last.n = Math.min(n, of); last.of = of; } else out.push({ at: e.at, n: Math.min(n, of), of });
  }
  return out;
}

function cumulative(ats: number[]): SeriesPoint[] {
  const out: SeriesPoint[] = [];
  ats.slice().sort((a, b) => a - b).forEach((at, i) => {
    const last = out[out.length - 1];
    if (last && last.at === at) last.n = i + 1; else out.push({ at, n: i + 1 });
  });
  return out;
}

// ---------------------------------------------------------------- company map

const MAIN_W = 2000, MAIN_H = 1300;

export function derivePlatform(input: PlatformInput): PlatformData {
  const groups = groupRoles(input);
  const now = input.now;
  const roles: RoleNode[] = [];
  const edges: RoleEdge[] = [];
  const cx = MAIN_W / 2, cy = MAIN_H / 2;

  const layout = ringLayout(groups.length, mentionedCount(groups), cx, cy);
  groups.forEach((g, i) => {
    const { status, label } = statusOf(g);
    const p = g.display;
    const ids = p ? displayIds(p.m) : new Map<string, string>();
    roles.push({
      id: g.id, title: g.task, dept: "seen", team: null,
      onet: p?.m.onet ? { code: p.m.onet.code, occupation: p.m.onet.occupation } : null,
      status, statusLabel: label, isMain: i === 0,
      at: g.captures[0]?.startedAt ?? input.now,
      people: peopleOf(g),
      coverage: coverageSeries(p),
      rules: p ? cumulative(p.m.rules.map((r) => ruleLearnedAt(r, p.s, p.m).at)) : [],
      sessions: cumulative([...g.captures, ...g.teaches].map((s) => s.startedAt)),
      mentions: [],
      openGaps: p ? p.m.slots.filter((x) => x.status === "open").length : 0,
      learners: peopleOf(g).filter((x) => x.tag === "new hire").length,
      topRules: p ? p.m.rules.slice(0, 4).map((r) => chipOf(g.id, r, ids)) : [],
      risk: null, plannedAt: null,
      x: layout.inner[i].x, y: layout.inner[i].y, r: status === "captured" ? 62 : 54,
      memoryHref: `/platform/role/${g.id}`, ontologyHref: `/platform/role/${g.id}/ontology`, captureHref: null,
      note: status === "captured" ? null : status === "in_debrief" ? `Waiting for ${expertOf(g)}'s yes. Not memory yet.` : "Captured, not compiled yet.",
    });
  });

  // mentioned roles: stopAndAsk.who of confirmed maps only
  const mentioned = new Map<string, { title: string; firsts: number[]; chips: RuleChip[]; links: { from: string; said: boolean; ruleIds: string[]; titles: string[]; at: number }[] }>();
  for (const g of groups) {
    const p = g.memory;
    if (!p) continue;
    const ids = displayIds(p.m);
    const perWho = new Map<string, { said: boolean; ruleIds: string[]; titles: string[]; at: number }>();
    for (const r of p.m.rules) {
      const who = r.stopAndAsk?.who ? normWho(r.stopAndAsk.who) : "";
      if (!who) continue;
      const key = slug(who);
      const at = ruleLearnedAt(r, p.s, p.m).at;
      const e = perWho.get(key) ?? { said: false, ruleIds: [], titles: [], at };
      e.said ||= !!stopQuote(r, p.m);
      e.ruleIds.push(ids.get(r.id)!);
      e.titles.push(r.title);
      e.at = Math.min(e.at, at);
      perWho.set(key, e);
      const mr = mentioned.get(key) ?? { title: cap(who), firsts: [], chips: [], links: [] };
      mr.firsts.push(at);
      mr.chips.push(chipOf(g.id, r, ids));
      mentioned.set(key, mr);
    }
    for (const [key, e] of perWho) mentioned.get(key)!.links.push({ from: g.id, ...e });
  }
  const mList = [...mentioned.entries()].sort((a, b) => Math.min(...a[1].firsts) - Math.min(...b[1].firsts));
  mList.forEach(([key, mr], i) => {
    const id = `mentioned-${key}`;
    roles.push({
      id, title: mr.title, dept: "seen", team: null, onet: null, status: "mentioned", statusLabel: "Mentioned, not captured",
      at: Math.min(...mr.firsts), people: [], coverage: [], rules: [], sessions: [], mentions: cumulative(mr.firsts),
      openGaps: 0, learners: 0, topRules: mr.chips, risk: null, plannedAt: null,
      x: layout.outer[i].x, y: layout.outer[i].y, r: 42,
      memoryHref: null, ontologyHref: null, captureHref: "/capture",
      note: "Simon knows when work goes here — not yet how this role decides.",
    });
    for (const l of mr.links) {
      edges.push({ id: `${l.from}->${id}`, from: l.from, to: id, label: `stop and ask · ${l.titles.join(" · ")}`, prov: l.said ? "said" : "teachback", ruleIds: l.ruleIds, at: l.at });
    }
  });

  const timeline = timelineFor(beadsFor(groups), now);
  const departments: Department[] = roles.length ? [{
    id: "seen", name: "Seen by Simon", color: "#6e6e73", cloudA: "rgba(215,218,228,.6)", cloudB: "rgba(235,236,242,.3)",
    x: cx, y: cy, rx: layout.cloud.rx, ry: layout.cloud.ry,
  }] : [];

  return {
    mode: "real",
    company: { name: "Sandbox workspace", sub: "Roles Simon has watched or heard about" },
    departments,
    orgNote: "Org structure isn't connected. Simon only shows roles it has watched or heard about.",
    roles, edges,
    mainRoleId: groups[0]?.id ?? null,
    timeline,
    suggestions: suggestionsFor(groups, mList.map(([key, mr]) => ({ id: `mentioned-${key}`, title: mr.title, n: mr.chips.length }))),
    sessionsCount: input.sessions.length,
    exports: groups.flatMap((g) => g.pairs.filter((p) => !!p.m.confirmedAt)).map((p) => ({
      sessionId: p.s.id, label: `${p.m.task} · ${p.m.expert.name} · rev ${p.m.revision}`,
      policy: `/api/export?sessionId=${encodeURIComponent(p.s.id)}&format=policy`,
      sop: `/api/export?sessionId=${encodeURIComponent(p.s.id)}&format=sop`,
      prompt: `/api/export?sessionId=${encodeURIComponent(p.s.id)}&format=prompt`,
    })),
    live: liveOf(input),
    features: { riskLens: false, editMap: false },
    unreadable: input.unreadable ?? 0,
    empty: roles.length ? null : { title: "No role captured yet", cta: { label: "Start a capture", href: "/capture" } },
  };
}

/** Same key set as the mentioned-roles pass below (stopAndAsk.who of confirmed maps), so the layout knows the outer count up front. */
function mentionedCount(groups: RoleGroup[]): number {
  const keys = new Set<string>();
  for (const g of groups) for (const r of g.memory?.m.rules ?? []) if (r.stopAndAsk?.who && normWho(r.stopAndAsk.who)) keys.add(slug(normWho(r.stopAndAsk.who)));
  return keys.size;
}

/**
 * Company-map positions. The main role sits in the centre; other captured roles share an inner ring sized so neighbours
 * never touch, starting to the right (a node's title hangs below it, and the canvas counter-scales nodes and labels ~2x
 * when zoomed out, so stacking roles vertically is what makes them collide); mentioned roles sit on an outer ring,
 * rotated to stay as far as possible from the inner roles and from straight up/down, so cables and labels do not run
 * across them.
 */
export function ringLayout(nInner: number, nOuter: number, cx: number, cy: number) {
  const SPACING = 300;
  const perim = (n: number) => (n * SPACING) / (2 * Math.PI * 0.8);
  const others = Math.max(0, nInner - 1);
  const innerRx = others ? Math.max(520, perim(others)) : 0;
  const innerRy = others ? Math.max(380, innerRx * 0.62) : 0;
  const innerAngles = Array.from({ length: others }, (_, k) => (k / others) * Math.PI * 2);
  const outerRx = Math.max(700, innerRx + 300, perim(nOuter));
  const outerRy = Math.max(440, innerRy + 240, outerRx * 0.62);
  const gap = (a: number, b: number) => Math.abs((((a - b) % (2 * Math.PI)) + 3 * Math.PI) % (2 * Math.PI) - Math.PI);
  const avoid = [...innerAngles, Math.PI / 2, -Math.PI / 2];
  let best = 0, bestScore = -1;
  for (let step = 0; step < 24; step++) {
    const phi = (step / 24) * ((Math.PI * 2) / Math.max(1, nOuter));
    let score = Infinity;
    for (let i = 0; i < nOuter; i++) for (const a of avoid) score = Math.min(score, gap(phi + (i / nOuter) * Math.PI * 2, a));
    if (score > bestScore + 1e-6) { bestScore = score; best = phi; }
  }
  const at = (a: number, rx: number, ry: number) => ({ x: Math.round(cx + Math.cos(a) * rx), y: Math.round(cy + Math.sin(a) * ry) });
  const inner = [{ x: cx, y: cy }, ...innerAngles.map((a) => at(a, innerRx, innerRy))];
  const outer = Array.from({ length: nOuter }, (_, i) => at(best + (i / nOuter) * Math.PI * 2, outerRx, outerRy));
  const rx = nOuter ? outerRx : innerRx, ry = nOuter ? outerRy : innerRy;
  return { inner, outer, cloud: { rx: Math.max(320, rx + 170), ry: Math.max(260, ry + 150) } };
}

function chipOf(roleId: string, r: Rule, ids: Map<string, string>): RuleChip {
  return { id: r.id, displayId: ids.get(r.id) ?? r.id, kind: ruleKind(r), title: r.title, quote: r.quotes[0]?.text ?? null, href: `/platform/role/${roleId}/ontology?rule=${encodeURIComponent(r.id)}` };
}

function peopleOf(g: RoleGroup): Person[] {
  const first = (name: string, ss: SessionLog[]) => Math.min(...ss.filter((s) => s.expertName.trim() === name).map((s) => s.startedAt), Infinity);
  // placeholder names collapse into one honest "Unnamed …" entry, and only when no one in that role was named
  const pick = (names: string[]) => (named(names).length ? named(names) : names.length ? [names[0]] : []);
  const firstOf = (name: string, ss: SessionLog[]) =>
    isPlaceholderName(name) ? Math.min(...ss.filter((s) => isPlaceholderName(s.expertName)).map((s) => s.startedAt), Infinity) : first(name, ss);
  const experts = pick(g.experts).map((name): Person => {
    const at = firstOf(name, g.captures);
    const shown = displayName(name, "expert");
    return { id: `expert-${slug(shown)}`, name: shown, tag: "expert", avatar: "expert", firstSeenAt: Number.isFinite(at) ? at : null,
      descriptor: Number.isFinite(at) ? `expert · first seen ${formatAt(at, "day")}` : "expert", yearsInRole: null, retiresInMonths: null };
  });
  const hires = pick(g.newHires).map((name): Person => {
    const at = firstOf(name, g.teaches);
    const shown = displayName(name, "new hire");
    return { id: `newhire-${slug(shown)}`, name: shown, tag: "new hire", avatar: "newhire", firstSeenAt: Number.isFinite(at) ? at : null,
      descriptor: "new hire · learning from the map", yearsInRole: null, retiresInMonths: null };
  });
  return [...experts, ...hires];
}

function liveOf(input: PlatformInput): PlatformData["live"] {
  const t = input.sessions.filter((s) => s.mode === "teach" && !s.endedAt && input.now - s.startedAt >= 0 && input.now - s.startedAt < 30 * 60_000)
    .sort((a, b) => b.startedAt - a.startedAt)[0];
  return t ? { label: `Live · ${t.expertName}, teach session`, href: `/teach/${t.id}` } : null;
}

function suggestionsFor(groups: RoleGroup[], mentioned: { id: string; title: string; n: number }[]): Suggestion[] {
  const out: Suggestion[] = [];
  for (const g of groups) {
    for (const p of g.pairs.filter((x) => !x.m.confirmedAt && (x.m.steps.length || x.m.rules.length))) {
      const open = p.m.slots.filter((x) => x.status === "open").length;
      if (open > 0) out.push({ id: `debrief-${p.s.id}`, kind: "continue_debrief", tone: "amber", roleId: g.id, at: p.m.compiledAt ?? p.s.startedAt,
        text: `${p.m.expert.name}'s map has ${open} open question${open === 1 ? "" : "s"}.`, action: { label: "Continue the debrief", href: `/map/${p.s.id}` } });
      else out.push({ id: `confirm-${p.s.id}`, kind: "awaiting_confirm", tone: "violet", roleId: g.id, at: p.m.compiledAt ?? p.s.startedAt,
        text: `Waiting for ${p.m.expert.name}'s yes on the teach-back.`, action: { label: "Open the map", href: `/map/${p.s.id}` } });
    }
    for (const t of g.teaches) {
      const novel = (t.flagged?.length ?? 0) > 0 || (t.mastery ?? []).some((x) => parseMastery(x)?.outcome === "novel_case_flagged");
      const href = g.memory ? `/map/${g.memory.s.id}` : null;
      if (novel) out.push({ id: `novel-${t.id}`, kind: "novel_case", tone: "violet", roleId: g.id, at: t.startedAt,
        text: `${t.expertName} met a case nobody taught.`, action: { label: "Ask the expert", href } });
      const src = t.sourceMapSessionId ? g.pairs.find((p) => p.s.id === t.sourceMapSessionId) : undefined;
      if (src && t.sourceMapRevision !== undefined && t.sourceMapRevision < src.m.revision) out.push({ id: `stale-${t.id}`, kind: "stale_revision", tone: "amber", roleId: g.id, at: t.startedAt,
        text: `${t.expertName} was taught from rev ${t.sourceMapRevision}; the map is now rev ${src.m.revision}.`, action: { label: "Open the map", href: `/map/${src.s.id}` } });
    }
  }
  for (const m of mentioned) out.push({ id: `plan-${m.id}`, kind: "plan_capture", tone: "green", roleId: m.id, at: null,
    text: `${m.title} is named in ${m.n} rule${m.n === 1 ? "" : "s"}, but nobody in the role has been captured.`, action: { label: "Plan a capture", href: "/capture" } });
  return out;
}

// ---------------------------------------------------------------- role memory

function stampLabel(at: number, approx: boolean | undefined, tl: Timeline): string {
  return `${approx ? "~" : ""}${formatAt(at, tl.unit, true)}`;
}

function findGroup(input: PlatformInput, roleId: string): RoleGroup | undefined {
  return groupRoles(input).find((g) => g.id === roleId);
}

function correctionFor(texts: string[], p: Pair): MemoryItem["correction"] {
  const c = p.m.corrections.find((x) => texts.includes(x.text));
  return c ? { text: c.text, before: null, at: debriefAt(p.s, p.m), approx: true } : null;
}

function latestMastery(g: RoleGroup, p: Pair): { person: string; labels: Map<string, MasteryLabel> } | null {
  const t = g.teaches.filter((x) => (x.mastery ?? []).length > 0).sort((a, b) => b.startedAt - a.startedAt)[0];
  if (!t) return null;
  const src = g.pairs.find((x) => x.s.id === t.sourceMapSessionId)?.m ?? p.m;
  return { person: t.expertName, labels: masteryLabels(t, src) };
}

export function deriveRole(input: PlatformInput, roleId: string): { data: PlatformData; role: RoleMemory | null } {
  const data = derivePlatform(input);
  const g = findGroup(input, roleId);
  if (!g) return { data, role: null };
  const { status, label } = statusOf(g);
  const p = g.display;
  const expert = expertOf(g);
  const beads = beadsFor([g]);
  const tl = timelineFor(beads, input.now);
  const ids = p ? displayIds(p.m) : new Map<string, string>();
  const mastery = p ? latestMastery(g, p) : null;
  const items: MemoryItem[] = [];

  if (p) {
    const { s, m } = p;
    m.rules.forEach((r) => {
      const at = ruleLearnedAt(r, s, m);
      const q = r.quotes[0];
      items.push({
        id: `rule-${r.id}`, displayId: ids.get(r.id)!, ruleId: r.id, kind: ruleKind(r), title: r.title,
        quote: q?.text ?? null, noQuoteLabel: q ? null : m.confirmedAt ? noQuoteLabel(expert) : "No words from the expert yet",
        source: q ? `${expert} · ${quoteSourceLabel(q.source)}${q.source !== "debrief" ? ` · ${mmss(q.t)}` : ""} · ${stampLabel(at.at, at.approx, tl)}` : `${expert} · ${stampLabel(at.at, at.approx, tl)}`,
        learnedAt: at.at, approx: at.approx,
        correction: correctionFor(r.quotes.map((x) => x.text), p),
        mastery: mastery?.labels.has(r.id) ? { person: mastery.person, label: mastery.labels.get(r.id)! } : null,
        href: `/platform/role/${g.id}/ontology?rule=${encodeURIComponent(r.id)}`,
      });
      if (r.stopAndAsk?.who) {
        const sq = stopQuote(r, m);
        const sat = sq ? quoteAt(sq, s, m) : at;
        items.push({
          id: `stop-${r.id}`, displayId: `${ids.get(r.id)}·S`, ruleId: r.id, kind: "escalation",
          title: `Stop and ask ${r.stopAndAsk.who.trim()} when ${describeCond(r.stopAndAsk.when)}`,
          quote: sq?.text ?? null, noQuoteLabel: sq ? null : m.confirmedAt ? noQuoteLabel(expert) : "No words from the expert yet",
          source: `${expert} · ${sq ? quoteSourceLabel(sq.source) + " · " : ""}${stampLabel(sat.at, sat.approx, tl)}`,
          learnedAt: sat.at, approx: sat.approx, correction: null, mastery: null,
          href: `/platform/role/${g.id}/ontology?rule=${encodeURIComponent(r.id)}`,
        });
      }
    });
    let gi = 0;
    for (const st of [...m.steps].sort((a, b) => a.index - b.index)) {
      for (const gr of st.guardrails) {
        gi++;
        const at: Learned = gr.quote ? quoteAt(gr.quote, s, m) : { at: s.startedAt + st.screenMoment.t * 1000, approx: true };
        items.push({
          id: `guard-${gr.id}`, displayId: `G${gi}`, ruleId: gr.ruleId ?? null, kind: guardrailKind(gr.kind), title: `${cap(gr.kind)} · ${st.title}`,
          quote: gr.quote?.text ?? null, noQuoteLabel: gr.quote ? null : "Not in the expert's words",
          source: `${expert} · ${gr.quote ? quoteSourceLabel(gr.quote.source) + " · " : ""}${stampLabel(at.at, at.approx, tl)}`,
          learnedAt: at.at, approx: at.approx, correction: gr.quote ? correctionFor([gr.quote.text], p) : null, mastery: null,
        });
      }
    }
    m.notes.forEach((n, i) => {
      const at = quoteAt(n.quote, s, m);
      items.push({
        id: `note-${i}`, displayId: `D${i + 1}`, ruleId: null, kind: "described", title: `${cap(n.topic.replace(/_/g, " "))} · described, not shown`,
        quote: n.quote.text, noQuoteLabel: null, source: `${expert} · ${quoteSourceLabel(n.quote.source)} · ${stampLabel(at.at, at.approx, tl)}`,
        learnedAt: at.at, approx: at.approx, correction: null, mastery: null,
      });
    });
  }

  const role: RoleMemory = {
    roleId: g.id, title: g.task, breadcrumb: ["Platform", "Roles", g.task], status, statusLabel: label,
    revision: p ? p.m.revision : null, confirmed: !!g.memory, expertName: p ? expert : named(g.experts)[0] ?? null,
    memoryMapId: p?.s.id ?? null, mapHref: p ? `/map/${p.s.id}` : null, ontologyHref: `/platform/role/${g.id}/ontology`,
    coverage: coverageSeries(p), people: peopleOf(g), timeline: tl,
    synopsis: synopsisFor(p, expert),
    knowledge: knowledgeFor(items),
    tasks: tasksFor(g, p, ids),
    items: items.sort((a, b) => a.learnedAt - b.learnedAt),
    asks: g.memory ? asksFor(g.memory, expert) : [],
    asksEmpty: g.memory ? null : "Nothing confirmed to answer from yet.",
    dimensions: dimensionsFor(g, p),
    mastery: masteryFor(g, p, ids),
    openQuestions: questionsFor(g, p),
  };
  return { data, role };
}

function synopsisFor(p: Pair | null, expert: string): RoleMemory["synopsis"] {
  if (!p) return { sentences: [], draftBanner: null, empty: "Nothing yet. The company map lists this role, but nobody has been captured in it." };
  const { s, m } = p;
  const confirmed = !!m.confirmedAt;
  const sentences: SynopsisSentence[] = [];
  for (const st of m.steps.filter((x) => x.judgment).sort((a, b) => a.index - b.index)) {
    const tb = generateTeachback({ ...m, steps: [st] });
    const text = tb.sure[0] ?? (confirmed ? undefined : tb.unsure[0]);
    if (!text) continue;
    const r = m.rules.find((x) => x.stepId === st.id);
    const at = r ? ruleLearnedAt(r, s, m) : st.reason ? quoteAt(st.reason, s, m) : { at: s.startedAt + st.screenMoment.t * 1000, approx: false };
    const corr = r ? m.corrections.find((c) => r.quotes.some((q) => q.text === c.text)) : undefined;
    sentences.push({ id: `syn-${st.id}`, text, at: at.at, approx: at.approx, corrected: corr ? { by: expert, at: debriefAt(s, m), approx: true } : null });
  }
  for (const r of m.rules.filter((x) => x.stopAndAsk)) {
    const text = r.stopAndAsk!.who ? `You stop and ask ${r.stopAndAsk!.who} when ${describeCond(r.stopAndAsk!.when)}.` : `You stop when ${describeCond(r.stopAndAsk!.when)}. Who to ask is still unresolved.`;
    const sq = stopQuote(r, m);
    const at = sq ? quoteAt(sq, s, m) : m.confirmedAt ? { at: m.confirmedAt, approx: false } : ruleLearnedAt(r, s, m);
    sentences.push({ id: `syn-stop-${r.id}`, text, at: at.at, approx: at.approx });
  }
  m.notes.forEach((n, i) => {
    const at = quoteAt(n.quote, s, m);
    sentences.push({ id: `syn-note-${i}`, text: `Described, not shown: "${n.quote.text}"`, at: at.at, approx: at.approx, described: true });
  });
  const seenText = new Set<string>();
  const unique = sentences.filter((x) => (seenText.has(x.text) ? false : (seenText.add(x.text), true)));
  return { sentences: unique, draftBanner: confirmed ? null : `Draft — not yet confirmed by ${expert}`, empty: unique.length ? null : "Nothing understood yet." };
}

function knowledgeFor(items: MemoryItem[]): KnowledgeSeries {
  const kinds = (Object.keys(KIND_META) as ItemKind[]).map((kind) => ({ kind, ...KIND_META[kind] }));
  const ats = uniq(items.map((i) => i.learnedAt)).sort((a, b) => a - b);
  const points = ats.map((at) => {
    const counts: Record<ItemKind, number> = { rule: 0, guardrail: 0, exception: 0, escalation: 0, described: 0 };
    for (const i of items) if (i.learnedAt <= at) counts[i.kind]++;
    return { at, counts };
  });
  return { kinds, points, total: items.length };
}

function tasksFor(g: RoleGroup, p: Pair | null, ids: Map<string, string>): TaskCard[] {
  const cards: TaskCard[] = g.captures.map((s) => {
    const m = g.pairs.find((x) => x.s.id === s.id)?.m;
    const mins = Math.max(1, Math.round(((s.endedAt ?? s.startedAt) - s.startedAt) / 60_000));
    const isDisplay = p?.s.id === s.id;
    const n = casesOf(s);
    return {
      id: `task-${s.id}`, title: s.task, at: s.startedAt,
      sub: `${formatAt(s.startedAt, "day")} · ${displayName(s.expertName, "expert")}${s.endedAt ? ` · ${mins} min` : ""} · ${n} case${n === 1 ? "" : "s"}${m ? (m.confirmedAt ? "" : " · draft") : " · not compiled yet"}`,
      watched: true,
      steps: m ? [...m.steps].sort((a, b) => a.index - b.index).map((st, i) => {
        const r = isDisplay ? m.rules.find((x) => x.stepId === st.id) : undefined;
        return { n: i + 1, t: mmss(st.screenMoment.t), title: st.title, judgment: st.judgment, rule: r ? { id: r.id, displayId: ids.get(r.id)!, kind: ruleKind(r) } : null };
      }) : [],
    };
  });
  if (p && p.m.notes.length) {
    cards.push({
      id: "task-described", title: "Cases described in the debrief", at: debriefAt(p.s, p.m), approx: true,
      sub: "Described in the debrief · not demonstrated", watched: false, steps: [],
      described: p.m.notes.map((n) => ({ question: n.question, quote: n.quote.text })),
    });
  }
  return cards;
}

const slotKind = (k: string): ItemKind => (k === "limit" || k === "counterfactual" ? "guardrail" : k === "exception" ? "exception" : k === "escalation" ? "escalation" : k === "novel" ? "described" : "rule");

function asksFor(p: Pair, expert: string): AskEntry[] {
  const { s, m } = p;
  const out: AskEntry[] = [];
  const seen = new Set<string>();
  const add = (question: string, q: Quote, kind: ItemKind, id: string) => {
    const key = question.trim().toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    const at = quoteAt(q, s, m);
    out.push({ id, question, answer: q.text, kind, source: `${KIND_META[kind].label} · ${expert} · ${quoteSourceLabel(q.source)}`, learnedAt: at.at, approx: at.approx, early: null });
  };
  for (const x of m.slots) if (x.status === "filled" && x.filledBy) add(x.question, x.filledBy, slotKind(x.kind), `ask-slot-${x.id}`);
  m.notes.forEach((n, i) => add(n.question, n.quote, "described", `ask-note-${i}`));
  for (const r of m.rules) if (r.quotes[0]) add(`Why this rule: ${r.title}?`, r.quotes[0], ruleKind(r), `ask-rule-${r.id}`);
  return out;
}

function dimensionsFor(g: RoleGroup, p: Pair | null): Dimension[] {
  const dims: Dimension[] = [{ label: "Tasks seen", series: cumulative(g.captures.map((s) => s.startedAt)), max: null }];
  if (!p) return dims;
  const { s, m } = p;
  const judg = m.steps.filter((x) => x.judgment);
  dims.push({ label: "Decisions explained", series: cumulative(judg.filter((x) => x.reason).map((x) => quoteAt(x.reason!, s, m).at)), max: judg.length });
  const guards = m.steps.flatMap((x) => x.guardrails);
  if (guards.length) dims.push({ label: "Guardrails in the expert's words", series: cumulative(guards.filter((x) => x.quote).map((x) => quoteAt(x.quote!, s, m).at)), max: guards.length });
  for (const [kind, labelText] of [["limit", "Limits"], ["escalation", "Who decides"], ["novel", "Cases not seen"]] as const) {
    const slots = m.slots.filter((x) => x.kind === kind);
    if (!slots.length) continue;
    dims.push({ label: labelText, series: cumulative(slots.filter((x) => x.status === "filled" && x.filledBy).map((x) => quoteAt(x.filledBy!, s, m).at)), max: slots.length });
  }
  return dims;
}

function masteryFor(g: RoleGroup, p: Pair | null, ids: Map<string, string>): Mastery {
  const teaches = g.teaches.filter((t) => (t.mastery ?? []).length > 0);
  if (!p || teaches.length === 0) return { learner: null, columns: [], rows: [], empty: "No new hire has trained on this map yet." };
  const labels = teaches.map((t) => masteryLabels(t, g.pairs.find((x) => x.s.id === t.sourceMapSessionId)?.m ?? p.m));
  return {
    learner: uniq(teaches.map((t) => displayName(t.expertName, "new hire"))).join(", "),
    columns: teaches.map((t) => ({ id: t.id, at: t.startedAt, label: `${formatAt(t.startedAt, "day")} · ${teachPhases(t)}`, href: `/teach/${t.id}` })),
    rows: p.m.rules.map((r) => ({ ruleId: r.id, displayId: ids.get(r.id)!, title: r.title, cells: labels.map((l) => l.get(r.id) ?? null) })),
    empty: null,
  };
}

function questionsFor(g: RoleGroup, p: Pair | null): OpenQuestion[] {
  if (!p) return [];
  const { s, m } = p;
  const opened = m.compiledAt ?? s.endedAt ?? s.startedAt;
  const out: OpenQuestion[] = m.slots.map((x) => {
    if (x.status === "filled" && x.filledBy) {
      const at = quoteAt(x.filledBy, s, m);
      return { id: x.id, question: x.question, status: "filled", openedAt: Math.min(opened, at.at), closedAt: at.at, approx: at.approx, how: `answered · ${quoteSourceLabel(x.filledBy.source)}` };
    }
    return { id: x.id, question: x.question, status: x.status === "skipped" ? "skipped" : "open", openedAt: opened, closedAt: null, approx: true, how: x.status === "skipped" ? "skipped" : `open · ${x.kind}` };
  });
  for (const d of s.deferred ?? []) out.push({ id: `deferred-${out.length}`, question: d.question, status: "open", openedAt: s.endedAt ?? s.startedAt, closedAt: null, approx: true, how: `deferred · ${d.kind}` });
  return out;
}

// ---------------------------------------------------------------- ontology

const CLASS_DEF: Record<string, { name: string; def: string; x: number; y: number }> = {
  invoice: { name: "Invoice", def: "The document on screen: opened, coded, routed, then saved or held.", x: 900, y: 600 },
  supplier: { name: "Supplier", def: "Who sent the invoice.", x: 470, y: 380 },
  costcenter: { name: "Cost center", def: "Where the amount is booked.", x: 1370, y: 440 },
  route: { name: "Approval route", def: "Who has to sign before it posts.", x: 900, y: 160 },
};

/** The fixed class registry is the InvoiceState schema; values and provenance are observed. */
const FIELD_CLASS: Record<string, { cls: keyof typeof CLASS_DEF; label: string }> = {
  invoice: { cls: "invoice", label: "number" },
  amount: { cls: "invoice", label: "amount" },
  category: { cls: "invoice", label: "category" },
  invoiceMonth: { cls: "invoice", label: "invoice month" },
  invoiceDate: { cls: "invoice", label: "invoice date" },
  description: { cls: "invoice", label: "description" },
  status: { cls: "invoice", label: "status" },
  costCenter: { cls: "invoice", label: "cost center" },
  route: { cls: "invoice", label: "approval route" },
  hasAssetNumber: { cls: "invoice", label: "asset number" },
  hasPO: { cls: "invoice", label: "purchase order" },
  supplier: { cls: "supplier", label: "name" },
  entity: { cls: "supplier", label: "entity" },
  knownSupplier: { cls: "supplier", label: "known supplier" },
};
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function fmtValue(field: string, v: unknown): string {
  if (Array.isArray(v)) return v.join(", ");
  if (field === "amount" && typeof v === "number") return "€" + v.toLocaleString("en-IE");
  if (field === "invoiceMonth" && typeof v === "number") return MONTHS[v - 1] ?? String(v);
  if (typeof v === "boolean") return v ? "yes" : "no";
  return String(v ?? "").replace(/_/g, " ");
}

/** Class that "owns" the target of a field: cost center and route have their own classes. */
const targetClass = (field: string): keyof typeof CLASS_DEF => (field === "costCenter" ? "costcenter" : field === "route" ? "route" : FIELD_CLASS[field]?.cls ?? "invoice");

function condFields(c: Cond | undefined): string[] {
  if (!c) return [];
  if ("all" in c) return c.all.flatMap(condFields);
  if ("any" in c) return c.any.flatMap(condFields);
  if ("not" in c) return condFields(c.not);
  return [c.field];
}

function actFields(a: Act): string[] {
  if ("set" in a) return Object.keys(a.set);
  if ("route" in a) return ["route"];
  return ["status"];
}

const OP: Record<string, string> = { "==": "=", "!=": "≠", ">": ">", ">=": "≥", "<": "<", "<=": "≤", in: "in", matches: "matches", exists: "is present" };

function leafRow(key: LogicRow["key"], c: Extract<Cond, { field: string }>): LogicRow {
  const fc = FIELD_CLASS[c.field];
  return { key, entity: fc ? CLASS_DEF[fc.cls].name : null, attr: fc?.label ?? c.field, op: OP[c.op] ?? c.op, value: c.op === "exists" ? "" : fmtValue(c.field, c.value) };
}

export function logicRows(r: Rule): LogicRow[] {
  const rows: LogicRow[] = [];
  const top = (c: Cond, first: LogicRow["key"], rest: LogicRow["key"]) => {
    const parts = "all" in c ? c.all : [c];
    parts.forEach((x, i) => {
      const key = i === 0 ? first : rest;
      if ("field" in x) rows.push(leafRow(key, x));
      else if ("any" in x) rows.push({ key: i === 0 && first === "WHEN" ? "WHEN" : "ANY OF", entity: null, attr: "", op: "", value: describeCond(x) });
      else rows.push({ key: "not" in x ? "NOT" : key, entity: null, attr: "", op: "", value: describeCond(x) });
    });
  };
  top(r.when, "WHEN", "AND");
  if (r.unless) top(r.unless, "UNLESS", "UNLESS");
  const a = r.then;
  if ("set" in a) for (const [k, v] of Object.entries(a.set)) rows.push({ key: "THEN", entity: CLASS_DEF[FIELD_CLASS[k]?.cls ?? "invoice"].name, attr: FIELD_CLASS[k]?.label ?? k, op: "set", value: fmtValue(k, v) });
  else if ("route" in a) rows.push({ key: "THEN", entity: "Invoice", attr: "approval route", op: "set", value: fmtValue("route", a.route) });
  else rows.push({ key: "THEN", entity: "Invoice", attr: "status", op: "set", value: a.status });
  if (r.stopAndAsk) rows.push({ key: "STOP", entity: r.stopAndAsk.who ? cap(normWho(r.stopAndAsk.who)) : "someone (unresolved)", entityIsRole: true, attr: "", op: "ask when", value: describeCond(r.stopAndAsk.when) });
  return rows;
}

interface Obs { value: string; prov: "seen" | "erp"; at: number; session: string }

export function deriveOntology(input: PlatformInput, roleId: string): { data: PlatformData; ontology: Ontology | null } {
  const data = derivePlatform(input);
  const g = findGroup(input, roleId);
  if (!g) return { data, ontology: null };
  const p = g.display;
  const expert = expertOf(g);
  const tl = timelineFor(beadsFor([g]), input.now);

  // observations: non-struck events with state, all capture sessions of the role
  const obs = new Map<string, Obs[]>();
  const instances: Record<string, string[]> = { invoice: [], supplier: [] };
  for (const s of g.captures) {
    for (const e of s.events) {
      if (isStruck(e, s)) continue;
      const prov = e.source === "vision" ? "seen" : "erp";
      const at = s.startedAt + Math.max(0, e.t) * 1000;
      if (e.invoice) instances.invoice.push(e.invoice);
      for (const [k, v] of Object.entries(e.state ?? {})) {
        if (!(k in FIELD_CLASS) || v === undefined || v === null || v === "") continue;
        const list = obs.get(k) ?? [];
        list.push({ value: fmtValue(k, v), prov, at, session: `Capture · ${s.task}` });
        obs.set(k, list);
        if (k === "supplier") instances.supplier.push(String(v));
      }
    }
  }

  const fields: Record<string, OntField[]> = { invoice: [], supplier: [], costcenter: [], route: [] };
  const firstSession: Record<string, { at: number; title: string }> = {};
  const note = (cls: string, at: number, title: string) => { if (!firstSession[cls] || at < firstSession[cls].at) firstSession[cls] = { at, title }; };
  for (const [k, list] of obs) {
    const fc = FIELD_CLASS[k];
    const first = list.reduce((a, b) => (b.at < a.at ? b : a));
    const vals = uniq(list.map((o) => o.value));
    const prov: Provenance = list.some((o) => o.prov === "seen") ? "seen" : "erp";
    const shown = vals.slice(0, 6).join(" · ") + (vals.length > 6 ? ` · +${vals.length - 6}` : "");
    fields[fc.cls].push({ name: fc.label, value: k === "costCenter" ? "→ Cost center" : k === "route" ? "→ Approval route" : shown, prov, at: first.at });
    note(fc.cls, first.at, first.session);
    if (k === "costCenter" || k === "route") {
      const cls = targetClass(k);
      for (const v of vals) {
        const o = list.filter((x) => x.value === v);
        fields[cls].push({ name: v, value: o.some((x) => x.prov === "seen") ? "seen on screen" : "from the ERP", prov: o.some((x) => x.prov === "seen") ? "seen" : "erp", at: Math.min(...o.map((x) => x.at)) });
      }
      note(cls, first.at, first.session);
    }
  }

  // fields only named in rules (never observed): said / teach-back
  const rules = p?.m.rules ?? [];
  const ids = p ? displayIds(p.m) : new Map<string, string>();
  for (const r of rules) {
    const at = ruleLearnedAt(r, p!.s, p!.m);
    const prov: Provenance = r.quotes.length ? (r.quotes.every((q) => q.evidence === "described") ? "described" : "said") : "teachback";
    for (const f of uniq([...condFields(r.when), ...condFields(r.unless), ...actFields(r.then)])) {
      const fc = FIELD_CLASS[f];
      if (!fc || obs.has(f) || fields[fc.cls].some((x) => x.name === fc.label)) continue;
      fields[fc.cls].push({ name: fc.label, value: "named in a rule, not observed", prov, at: at.at, approx: at.approx });
      note(fc.cls, at.at, r.title);
    }
  }

  const classes: OntClass[] = (Object.keys(CLASS_DEF) as (keyof typeof CLASS_DEF)[]).filter((c) => fields[c].length > 0).map((c) => {
    const fs = fields[c].sort((a, b) => a.at - b.at);
    const prov: Provenance = fs.some((f) => f.prov === "seen") ? "seen" : fs.some((f) => f.prov === "erp") ? "erp" : fs[0].prov;
    const approx = fs.every((f) => f.approx);
    return {
      id: c, kind: "object", name: CLASS_DEF[c].name, def: CLASS_DEF[c].def, defQuote: null, prov, at: fs[0].at, approx: approx || undefined,
      x: CLASS_DEF[c].x, y: CLASS_DEF[c].y, firstSession: firstSession[c]?.title ?? null, fields: fs,
      instances: uniq(instances[c] ?? []).slice(0, 12),
    };
  });
  const has = new Set(classes.map((c) => c.id));

  const edges: OntEdge[] = [];
  const classEdge = (id: string, from: string, to: string, verb: string, card: string) => {
    if (!has.has(from) || !has.has(to)) return;
    const a = classes.find((c) => c.id === to)!;
    edges.push({ id, from, to, verb, card, prov: a.prov, at: a.at, approx: a.approx, ruleIds: [] });
  };
  classEdge("inv_sup", "invoice", "supplier", "billed by", "n:1");
  classEdge("inv_cc", "invoice", "costcenter", "coded to", "n:1");
  classEdge("inv_route", "invoice", "route", "routed via", "n:1");

  // concepts (one per rule), roles (stopAndAsk.who), described cases (notes)
  const concepts: OntConcept[] = [];
  const ontRules: OntRule[] = [];
  const ring = (i: number, n: number, rx: number, ry: number, offset = 0) => {
    const a = (i / Math.max(1, n)) * Math.PI * 2 - Math.PI / 2 + offset;
    return { x: Math.round(900 + Math.cos(a) * rx), y: Math.round(590 + Math.sin(a) * ry) };
  };
  const roleNodes = new Map<string, OntConcept>();
  const learnersFor = (ruleId: string) => {
    const out: { name: string; label: MasteryLabel }[] = [];
    if (!p) return out;
    for (const name of g.newHires) {
      const t = g.teaches.filter((x) => x.expertName.trim() === name && (x.mastery ?? []).length).sort((a, b) => b.startedAt - a.startedAt)[0];
      if (!t) continue;
      const label = masteryLabels(t, g.pairs.find((x) => x.s.id === t.sourceMapSessionId)?.m ?? p.m).get(ruleId);
      if (label) out.push({ name: displayName(name, "new hire"), label });
    }
    return out;
  };
  const policy = p?.m.confirmedAt ? toPolicy(p.m) : null;

  rules.forEach((r, i) => {
    const { s, m } = p!;
    const at = ruleLearnedAt(r, s, m);
    const kind = ruleKind(r);
    const prov: Provenance = r.quotes.length ? (kind === "described" ? "described" : "said") : "teachback";
    const cid = `rule-${r.id}`;
    concepts.push({ id: cid, kind: "concept", name: r.title, prov, at: at.at, approx: at.approx || undefined,
      def: `When ${describeCond(r.when)}${r.unless ? `, unless ${describeCond(r.unless)}` : ""}: ${describeAct(r.then)}.`, defQuote: r.quotes[0]?.text ?? null,
      ...ring(i, rules.length, 640, 470, 0.35), firstSession: `Capture · ${s.task}` });
    const edgeIds: string[] = [];
    const whenCls = uniq(condFields(r.when).map((f) => FIELD_CLASS[f]?.cls).filter((c): c is keyof typeof CLASS_DEF => !!c && has.has(c)));
    for (const c of whenCls) {
      const id = `${cid}-when-${c}`;
      const labels = uniq(condFields(r.when).filter((f) => FIELD_CLASS[f]?.cls === c).map((f) => FIELD_CLASS[f].label));
      edges.push({ id, from: c, to: cid, verb: `when ${labels.join(", ")}`, card: null, prov, at: at.at, approx: at.approx || undefined, ruleIds: [] });
      edgeIds.push(id);
    }
    const thenCls = uniq(actFields(r.then).map(targetClass)).filter((c) => has.has(c));
    let badge: string | null = null;
    for (const c of thenCls) {
      const id = `${cid}-then-${c}`;
      edges.push({ id, from: cid, to: c, verb: describeAct(r.then), card: null, prov, at: at.at, approx: at.approx || undefined, ruleIds: [r.id] });
      edgeIds.push(id);
      badge ??= id;
    }
    const path = uniq([cid, ...whenCls, ...thenCls]);
    if (r.stopAndAsk?.who) {
      const who = normWho(r.stopAndAsk.who);
      const rid = `role-${slug(who)}`;
      const sq = stopQuote(r, m);
      const rprov: Provenance = sq ? "said" : "teachback";
      const existing = roleNodes.get(rid);
      if (!existing) roleNodes.set(rid, { id: rid, kind: "role", name: cap(who), prov: rprov, at: at.at, approx: at.approx || undefined, def: `Who ${expert} stops and asks.`, defQuote: sq?.text ?? null, x: 0, y: 0 });
      else if (rprov === "said") { existing.prov = "said"; existing.defQuote ??= sq?.text ?? null; }
      const id = `${cid}-stop-${rid}`;
      edges.push({ id, from: cid, to: rid, verb: "stop and ask", card: null, prov: rprov, at: at.at, approx: at.approx || undefined, ruleIds: [] });
      edgeIds.push(id);
      path.push(rid);
      badge ??= id;
    }
    const quotes = uniq(r.quotes.map((q) => `${q.source}\u0000${q.t}\u0000${q.text}`)).map((k) => {
      const [source, t, text] = k.split("\u0000");
      return { text, source: quoteSourceLabel(source), t: source === "debrief" ? "—" : mmss(Number(t)) };
    });
    const corr = m.corrections.find((c) => r.quotes.some((q) => q.text === c.text));
    const pol = policy?.rules.find((x) => x.id === r.id);
    ontRules.push({
      id: r.id, displayId: ids.get(r.id)!, kind, title: r.title, at: at.at, approx: at.approx || undefined,
      logic: logicRows(r), quotes, noQuoteLabel: quotes.length ? null : m.confirmedAt ? noQuoteLabel(expert) : "No words from the expert yet",
      correction: corr ? { text: corr.text, before: null, at: debriefAt(s, m), approx: true } : null,
      path, edgeIds, badgeEdgeId: badge, learners: learnersFor(r.id),
      policy: pol ? JSON.stringify(pol, null, 2) : null,
      policyNote: pol ? null : `Not agent-ready until ${expert} confirms`,
    });
  });
  const rolesArr = [...roleNodes.values()];
  rolesArr.forEach((rn, i) => Object.assign(rn, ring(i, rolesArr.length, 820, 540, -0.2)));
  concepts.push(...rolesArr);
  if (p) {
    p.m.notes.forEach((n, i) => {
      const at = quoteAt(n.quote, p.s, p.m);
      const id = `note-${i}`;
      concepts.push({ id, kind: "concept", name: cap(n.topic.replace(/_/g, " ")), prov: "described", at: at.at, approx: at.approx || undefined,
        def: `Described in the debrief, not shown: ${n.question}`, defQuote: n.quote.text, x: 300 + i * 260, y: 1080 });
      if (has.has("invoice")) edges.push({ id: `${id}-inv`, from: id, to: "invoice", verb: "described case", card: null, prov: "described", at: at.at, approx: at.approx || undefined, ruleIds: [] });
    });
  }

  return {
    data,
    ontology: {
      roleId: g.id, roleTitle: g.task, expertName: p ? expert : null, people: peopleOf(g), confirmed: !!p?.m.confirmedAt, timeline: tl,
      classes, concepts, edges, rules: ontRules, saidLabel: `said by ${expert}`,
      empty: classes.length || concepts.length ? null : "Nothing observed yet. Classes appear once Simon has watched a case.",
    },
  };
}
