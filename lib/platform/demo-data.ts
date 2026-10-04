/**
 * DEMO MODE dataset for the platform pages. Entirely fictional: a Tier-2 support escalation lead at
 * "Larkspur Telecom (fictional)". Nothing here was learned by Tacit, and nothing here may be imported by a live
 * module (compile, tutor, matcher, guard, exports, agents, seed). lib/platform/demo-data.test.ts enforces both.
 *
 * Same PlatformData / RoleMemory / Ontology shapes as the real derivation, so one set of components renders both.
 * Copy is pronoun-free.
 */
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
  type MasteryLabel,
  type MemoryItem,
  type OntClass,
  type OntConcept,
  type OntEdge,
  type OntRule,
  type Ontology,
  type OpenQuestion,
  type Person,
  type PlatformData,
  type RoleEdge,
  type RoleMemory,
  type RoleNode,
  type SeriesPoint,
  type Suggestion,
  type SynopsisSentence,
  type TaskCard,
  type Timeline,
} from "./types";

// ---------------------------------------------------------------- time

const DAY = 86_400_000;
/** Day 0 of the demo story. Day 104 is "today". */
const D0 = Date.UTC(2026, 5, 22);
const d = (day: number) => D0 + Math.round(day * DAY);
export const DEMO_TODAY = d(104);
const RANGE_END = d(152);

export const DEMO_COMPANY = "Larkspur Telecom (fictional)";
export const DEMO_ROLE_ID = "tier-2-escalation-lead";
export const DEMO_BANNER = "Demo data — a fictional telecom. Nothing here was learned by Simon.";

const EXPERT = "Robin";
const NEWHIRE = "Kit";
const base = "/platform/demo";
const roleHref = (id: string) => `${base}/role/${id}`;
const ontHref = (id: string, rule?: string) => `${base}/role/${id}/ontology${rule ? `?rule=${rule}` : ""}`;

export const KIND_META: Record<ItemKind, { label: string; color: string }> = {
  rule: { label: "Decision rule", color: "#f5a623" },
  guardrail: { label: "Guardrail", color: "#e5484d" },
  exception: { label: "Exception", color: "#8f7bff" },
  escalation: { label: "Who to ask", color: "#3b82f6" },
  described: { label: "Described case", color: "#8e8e93" },
};

// ---------------------------------------------------------------- sessions (beads)

const BEADS: Bead[] = [
  { id: "s0", at: d(21), type: "mapped", title: "Org chart imported", who: "HR directory", diff: "12 roles · 26 people" },
  { id: "s1", at: d(38), type: "capture", title: "Capture · escalation queue", who: EXPERT, diff: "+2 rules · 5 classes" },
  { id: "s2", at: d(39.5), type: "debrief", title: "Debrief · confirmed rev 2", who: EXPERT, diff: "+3 rules · 3 roles" },
  { id: "s3", at: d(94), type: "capture", title: "Capture · billing escalations", who: EXPERT, diff: "+1 rule · 2 classes" },
  { id: "s4", at: d(95.5), type: "debrief", title: "Debrief · confirmed rev 4", who: EXPERT, diff: "+2 rules · 1 corrected" },
  { id: "s5", at: d(98), type: "teach", title: "Teach · coached", who: NEWHIRE, diff: "1 corrected after intervention" },
  { id: "s6", at: d(102), type: "teach", title: "Teach · independent", who: NEWHIRE, diff: "2 correct without help" },
  { id: "s7", at: d(136), type: "planned", title: "Capture planned · network operations", who: "Rowan", diff: "scheduled" },
];

function timeline(): Timeline {
  return makeTimeline(BEADS.map((b) => ({ ...b })), D0, RANGE_END, DEMO_TODAY);
}

// ---------------------------------------------------------------- rules (the fictional memory)

interface DemoRule {
  id: string;
  kind: ItemKind;
  title: string;
  quote: string;
  how: string;
  t: string;
  day: number;
  corrected?: { day: number; before: string; text: string };
  /** company-map role the rule hands work to */
  to?: string;
  prov: "said" | "described" | "teachback";
  logic: OntRule["logic"];
  path: string[];
  edges: string[];
  badge: string | null;
  learners: [number, MasteryLabel][];
  ask: string;
}

const RULES: DemoRule[] = [
  {
    id: "R1", kind: "rule", title: "Three tickets from one area in 30 minutes → one outage",
    quote: "Three tickets from the same postcode inside half an hour is never three problems. It is one outage, and I open an incident.",
    how: "live answer", t: "03:40", day: 38, prov: "said",
    logic: [
      { key: "WHEN", entity: "Ticket", attr: "area", op: "=", value: "same postcode" },
      { key: "AND", entity: "Ticket", attr: "count in 30 min", op: "≥", value: "3" },
      { key: "THEN", entity: "Incident", attr: "", op: "open", value: "link all tickets" },
    ],
    path: ["ticket", "outage", "incident"], edges: ["tk_out", "out_inc"], badge: "out_inc",
    learners: [[98, "correct after a hint"], [102, "correct without help"]],
    ask: "When is it an outage and not single tickets?",
  },
  {
    id: "R2", kind: "guardrail", title: "Four-hour SLA → P1 before troubleshooting",
    quote: "If the contract says four-hour response, I bump it to P1 first and troubleshoot second. The clock does not wait for me.",
    how: "said while working", t: "05:52", day: 38, prov: "said",
    logic: [
      { key: "WHEN", entity: "Contract", attr: "SLA response", op: "=", value: "4 hours" },
      { key: "THEN", entity: "Ticket", attr: "priority", op: "set", value: "P1" },
    ],
    path: ["contract", "sla4h", "ticket"], edges: ["ct_sla", "sla_tk"], badge: "sla_tk",
    learners: [[102, "correct without help"]],
    ask: "Why does a four-hour SLA ticket jump the queue?",
  },
  {
    id: "R3", kind: "escalation", title: "Confirmed outage → network operations owns it",
    quote: "Once it is a real outage I hand it to network operations. Tier two does not fix towers.",
    how: "debrief", t: "—", day: 39.5, to: "noc", prov: "said",
    logic: [
      { key: "WHEN", entity: "Incident", attr: "type", op: "=", value: "confirmed outage" },
      { key: "THEN", entity: "Network operations", entityIsRole: true, attr: "", op: "owns", value: "the incident" },
    ],
    path: ["incident", "noc"], edges: ["inc_noc"], badge: "inc_noc",
    learners: [[98, "correct without help"]],
    ask: "Who owns an outage once it is confirmed?",
  },
  {
    id: "R4", kind: "exception", title: "Goodwill credit up to €40 without sign-off",
    quote: "Small goodwill credits I just give. Forty euros is cheaper than a second call.",
    how: "said while working", t: "02:15", day: 94, to: "disputes", prov: "said",
    corrected: { day: 95.5, before: "Refunds are approved in Tier 2 without sign-off.", text: "No, only goodwill credits up to forty euros. Anything bigger goes to billing disputes." },
    logic: [
      { key: "WHEN", entity: "Goodwill credit", attr: "amount", op: "≤", value: "€40" },
      { key: "THEN", entity: "Goodwill credit", attr: "approval", op: "set", value: "approve now" },
      { key: "UNLESS", entity: "Goodwill credit", attr: "amount", op: ">", value: "€40 → billing disputes" },
    ],
    path: ["credit", "disputes"], edges: ["cr_disp"], badge: "cr_disp",
    learners: [[98, "corrected after intervention"], [102, "correct after a hint"]],
    ask: "Can Tier 2 refund a customer without sign-off?",
  },
  {
    id: "R5", kind: "escalation", title: "Customer says they will cancel → retention desk",
    quote: "When someone says they will cancel, I do not argue the bill. I warm-transfer to the retention desk.",
    how: "debrief", t: "—", day: 95.5, to: "retention", prov: "said",
    logic: [
      { key: "WHEN", entity: "Customer", attr: "cancel intent", op: "=", value: "stated" },
      { key: "THEN", entity: "Retention specialist", entityIsRole: true, attr: "", op: "takes", value: "warm transfer" },
    ],
    path: ["customer", "retention"], edges: ["cu_ret"], badge: "cu_ret",
    learners: [],
    ask: "What happens when a customer threatens to cancel?",
  },
  {
    id: "R6", kind: "described", title: "Same line drops twice in 30 days → field engineer",
    quote: "If the same line drops twice in a month, remote fixes are done. I book a field engineer.",
    how: "debrief · described, not shown", t: "—", day: 95.5, to: "field", prov: "described",
    logic: [
      { key: "WHEN", entity: "Line", attr: "faults in 30 days", op: "≥", value: "2" },
      { key: "THEN", entity: "Field engineer", entityIsRole: true, attr: "", op: "visits", value: "book a slot" },
    ],
    path: ["line", "repeat", "field"], edges: ["ln_rep", "rep_fe"], badge: "rep_fe",
    learners: [],
    ask: "When do remote fixes stop and a visit is booked?",
  },
  {
    id: "R7", kind: "exception", title: "Reopened ticket → back to the agent who had it",
    quote: "A reopened ticket goes back to whoever had it, so the customer does not explain twice.",
    how: "debrief", t: "—", day: 39.5, prov: "said",
    logic: [
      { key: "WHEN", entity: "Ticket", attr: "status", op: "=", value: "reopened" },
      { key: "THEN", entity: "Ticket", attr: "assigned agent", op: "set", value: "previous agent" },
    ],
    path: ["ticket", "reopen"], edges: ["tk_reo"], badge: "tk_reo",
    learners: [[102, "correct without help"]],
    ask: "Who gets a reopened ticket?",
  },
  {
    id: "R8", kind: "guardrail", title: "Possible account takeover → fraud team, no changes",
    quote: "",
    how: "confirmed in the teach-back", t: "—", day: 39.5, to: "fraud", prov: "teachback",
    logic: [
      { key: "WHEN", entity: "Customer", attr: "contact details changed", op: "=", value: "in the last 24 h" },
      { key: "THEN", entity: "Fraud analyst", entityIsRole: true, attr: "", op: "reviews", value: "before any change" },
    ],
    path: ["customer", "fraud"], edges: ["cu_fr"], badge: "cu_fr",
    learners: [],
    ask: "",
  },
];

const noQuote = `Confirmed in the teach-back, not in ${EXPERT}'s words`;

// ---------------------------------------------------------------- company map

const DEPARTMENTS: Department[] = [
  { id: "sup", name: "Customer support", color: "#d9822b", cloudA: "rgba(255,205,150,.5)", cloudB: "rgba(255,190,220,.32)", x: 930, y: 640, rx: 470, ry: 400 },
  { id: "net", name: "Network", color: "#3b78d8", cloudA: "rgba(170,210,255,.5)", cloudB: "rgba(200,228,255,.3)", x: 1620, y: 330, rx: 260, ry: 210 },
  { id: "bill", name: "Billing", color: "#1f9a58", cloudA: "rgba(170,235,200,.5)", cloudB: "rgba(205,245,225,.3)", x: 360, y: 1000, rx: 290, ry: 210 },
  { id: "sec", name: "Security", color: "#7a5cff", cloudA: "rgba(212,198,255,.55)", cloudB: "rgba(228,220,255,.3)", x: 300, y: 330, rx: 230, ry: 180 },
  { id: "acct", name: "Business accounts", color: "#0f8f8f", cloudA: "rgba(160,232,232,.5)", cloudB: "rgba(195,242,242,.3)", x: 1680, y: 1010, rx: 240, ry: 180 },
  { id: "ops", name: "Operations", color: "#6e6e73", cloudA: "rgba(215,218,228,.6)", cloudB: "rgba(235,236,242,.3)", x: 960, y: 170, rx: 300, ry: 130 },
];

const p = (id: string, name: string, tag: string, descriptor: string, yearsInRole: number | null, retiresInMonths: number | null = null, avatar: Person["avatar"] = "other"): Person =>
  ({ id, name, tag, descriptor, avatar, yearsInRole, retiresInMonths, firstSeenAt: null });

const series = (pts: [number, number][]): SeriesPoint[] => pts.map(([day, n]) => ({ at: d(day), n }));
const counts = (pts: [number, number, number][]): CountPoint[] => pts.map(([day, n, of]) => ({ at: d(day), n, of }));

const chip = (r: DemoRule) => ({ id: r.id, displayId: r.id, kind: r.kind, title: r.title, quote: r.quote || null, href: ontHref(DEMO_ROLE_ID, r.id) });
const rulesTo = (role: string) => RULES.filter((r) => r.to === role);
const mentions = (role: string): SeriesPoint[] => {
  const days = rulesTo(role).map((r) => r.day).sort((a, b) => a - b);
  return days.map((day, i) => ({ at: d(day), n: i + 1 }));
};

const MAIN_PEOPLE: Person[] = [
  p("robin", EXPERT, "expert", "expert · 21 yrs", 21, 16, "expert"),
  p("kit", NEWHIRE, "new hire", "new hire · learning from the map", 0, null, "newhire"),
  p("jordan", "Jordan", "not captured", "6 yrs · not captured", 6),
];

function role(partial: Omit<RoleNode, "coverage" | "rules" | "sessions" | "mentions" | "openGaps" | "learners" | "topRules" | "statusLabel"> & Partial<RoleNode>): RoleNode {
  const statusLabel: Record<RoleNode["status"], string> = {
    captured: "Captured · confirmed", in_debrief: "In debrief", capturing: "Capturing", mentioned: "Mentioned, not captured",
    inferred: "Inferred", seen: "Seen on screen", not_captured: "Not captured", mapped: "Mapped by you",
  };
  const m = mentions(partial.id);
  return {
    coverage: [], rules: [], sessions: [], mentions: m, openGaps: 0, learners: 0,
    topRules: rulesTo(partial.id).map(chip), statusLabel: statusLabel[partial.status],
    // demo users never get sent into the real capture flow from the sample company
    captureHref: null,
    note: partial.status === "captured" ? null : m.length ? "Simon knows when work goes here — not yet how this role decides." : null,
    ...partial,
  };
}

const ROLES: RoleNode[] = [
  role({
    id: DEMO_ROLE_ID, title: "Tier-2 support escalation lead", dept: "sup", team: "Escalations", status: "captured", isMain: true,
    at: d(21), people: MAIN_PEOPLE, x: 920, y: 680, r: 62,
    coverage: counts([[38, 2, 3], [39.5, 4, 5], [94, 5, 7], [95.5, 7, 8]]),
    rules: series([[38, 2], [39.5, 5], [94, 6], [95.5, 8]]),
    sessions: series([[38, 1], [39.5, 2], [94, 3], [95.5, 4], [98, 5], [102, 6]]),
    mentions: [], openGaps: 2, learners: 1,
    topRules: RULES.slice(0, 4).map(chip),
    risk: { level: "watch", note: "21 years in the role, retires in 16 months. 8 rules captured so far." },
    memoryHref: roleHref(DEMO_ROLE_ID), ontologyHref: ontHref(DEMO_ROLE_ID),
  }),
  role({ id: "t1", title: "Tier-1 support agent", dept: "sup", team: "Front line", status: "not_captured", at: d(21), x: 600, y: 520, r: 44,
    people: [p("ari", "Ari", "agent", "3 yrs", 3), p("noor", "Noor", "agent", "1 yr", 1)] }),
  role({ id: "retention", title: "Retention specialist", dept: "sup", team: "Retention", status: "mentioned", at: d(95.5), x: 1180, y: 880, r: 40,
    people: [p("quinn", "Quinn", "", "9 yrs", 9)] }),
  role({ id: "qa", title: "Quality reviewer", dept: "sup", team: "Quality", status: "seen", at: d(38), x: 700, y: 900, r: 36,
    people: [p("jules", "Jules", "", "5 yrs", 5)] }),
  role({ id: "noc", title: "Network operations engineer", dept: "net", team: "NOC", status: "mentioned", at: d(39.5), x: 1560, y: 360, r: 46,
    people: [p("rowan", "Rowan", "", "23 yrs", 23, 9)], plannedAt: d(136),
    risk: { level: "critical", note: "23 years in network operations, retires in 9 months. Nothing of the role is captured yet." } }),
  role({ id: "field", title: "Field engineer", dept: "net", team: "Field service", status: "mentioned", at: d(95.5), x: 1760, y: 520, r: 38,
    people: [p("sasha", "Sasha", "", "11 yrs", 11), p("devin", "Devin", "", "2 yrs", 2)] }),
  role({ id: "disputes", title: "Billing disputes analyst", dept: "bill", team: "Disputes", status: "mentioned", at: d(95.5), x: 420, y: 960, r: 40,
    people: [p("emery", "Emery", "", "7 yrs", 7)] }),
  role({ id: "revenue", title: "Revenue assurance", dept: "bill", team: "Assurance", status: "not_captured", at: d(21), x: 220, y: 1100, r: 34,
    people: [p("taylor", "Taylor", "", "4 yrs", 4)] }),
  role({ id: "fraud", title: "Fraud analyst", dept: "sec", team: "Fraud", status: "mentioned", at: d(39.5), x: 320, y: 360, r: 40,
    people: [p("morgan", "Morgan", "", "8 yrs", 8)] }),
  role({ id: "am", title: "Business account manager", dept: "acct", team: "Enterprise", status: "inferred", at: d(95.5), x: 1660, y: 1000, r: 42,
    people: [p("reese", "Reese", "", "27 yrs", 27, 14)],
    risk: { level: "high", note: "27 years with business accounts, retires in 14 months." } }),
  role({ id: "sdm", title: "Service desk manager", dept: "ops", team: "Service desk", status: "not_captured", at: d(21), x: 900, y: 180, r: 38,
    people: [p("avery", "Avery", "", "19 yrs", 19)] }),
  role({ id: "wfm", title: "Workforce planner", dept: "ops", team: "Planning", status: "not_captured", at: d(21), x: 1150, y: 150, r: 32,
    people: [p("casey", "Casey", "", "4 yrs", 4)] }),
];

const EDGES: RoleEdge[] = [
  { id: "e_noc", from: DEMO_ROLE_ID, to: "noc", label: "confirmed outage → owns it", prov: "said", ruleIds: ["R3"], at: d(39.5) },
  { id: "e_ret", from: DEMO_ROLE_ID, to: "retention", label: "cancel intent → warm transfer", prov: "said", ruleIds: ["R5"], at: d(95.5) },
  { id: "e_disp", from: DEMO_ROLE_ID, to: "disputes", label: "credits over €40", prov: "said", ruleIds: ["R4"], at: d(95.5) },
  { id: "e_field", from: DEMO_ROLE_ID, to: "field", label: "repeat fault → visit", prov: "described", ruleIds: ["R6"], at: d(95.5) },
  { id: "e_fraud", from: DEMO_ROLE_ID, to: "fraud", label: "possible takeover → review", prov: "teachback", ruleIds: ["R8"], at: d(39.5) },
  { id: "e_qa", from: DEMO_ROLE_ID, to: "qa", label: "closed P1 tickets reviewed", prov: "seen", ruleIds: [], at: d(38) },
  { id: "e_am", from: DEMO_ROLE_ID, to: "am", label: "told about P1 on a 4-hour SLA?", prov: "inferred", ruleIds: ["R2"], at: d(95.5),
    suggest: "Four-hour SLA tickets always go to P1 first. Does the business account manager hear about them?" },
  { id: "e_t1", from: "t1", to: DEMO_ROLE_ID, label: "escalates tickets", prov: "mapped", ruleIds: [], at: d(21) },
  { id: "e_sdm", from: "sdm", to: "t1", label: "staffs the front line", prov: "mapped", ruleIds: [], at: d(21) },
  { id: "e_wfm", from: "wfm", to: "sdm", label: "shift plans", prov: "mapped", ruleIds: [], at: d(21) },
  { id: "e_rev", from: "disputes", to: "revenue", label: "dispute outcomes", prov: "mapped", ruleIds: [], at: d(21) },
];

const SUGGESTIONS: Suggestion[] = [
  { id: "sg_risk", kind: "retirement_risk", tone: "red", roleId: "noc", at: d(95.5),
    text: "Rowan has 23 years in network operations and retires in 9 months. Nothing of the role is captured yet.",
    action: { label: "Plan a capture", href: null } },
  { id: "sg_inf", kind: "inferred_link", tone: "violet", roleId: "am", at: d(95.5),
    text: "Four-hour SLA tickets always go to P1 first. Does the business account manager hear about them?",
    action: { label: "Confirm link", href: null } },
  { id: "sg_gap", kind: "continue_debrief", tone: "amber", roleId: DEMO_ROLE_ID, at: d(95.5),
    text: `${EXPERT}'s memory has 2 open questions.`,
    action: { label: "Continue the debrief", href: null } },
];

export function demoPlatform(): PlatformData {
  return {
    mode: "demo",
    company: { name: DEMO_COMPANY, sub: "Demo workspace" },
    departments: DEPARTMENTS.map((x) => ({ ...x })),
    orgNote: null,
    roles: ROLES.map((r) => ({ ...r })),
    edges: EDGES.map((e) => ({ ...e })),
    mainRoleId: DEMO_ROLE_ID,
    timeline: timeline(),
    suggestions: SUGGESTIONS.map((s) => ({ ...s })),
    sessionsCount: 6,
    exports: [],
    live: null,
    features: { riskLens: true, editMap: true },
    unreadable: 0,
    empty: null,
  };
}

// ---------------------------------------------------------------- role memory

const SYNOPSIS: SynopsisSentence[] = [
  { id: "sy0", at: d(38), text: `${EXPERT} works the Tier-2 escalation queue in the support desk.` },
  { id: "sy1", at: d(38), text: "Three tickets from one area inside half an hour are one outage, so an incident is opened and the tickets are linked." },
  { id: "sy2", at: d(38), text: "A business contract with a four-hour response SLA goes to P1 before any troubleshooting." },
  { id: "sy3", at: d(39.5), text: "Once an outage is confirmed, network operations owns it; Tier 2 keeps the customers informed." },
  { id: "sy4", at: d(39.5), text: "A reopened ticket goes back to the agent who had it, and a possible account takeover goes to the fraud team before any change." },
  { id: "sy5", at: d(94), until: d(95.5), text: "Refunds are approved in Tier 2 without sign-off." },
  { id: "sy6", at: d(95.5), corrected: { by: EXPERT, at: d(95.5) }, text: "Only goodwill credits up to €40 are given without sign-off; anything bigger goes to billing disputes." },
  { id: "sy7", at: d(95.5), text: "When a customer says they will cancel, the call is warm-transferred to the retention desk." },
  { id: "sy8", at: d(95.5), described: true, text: "If the same line drops twice in 30 days, a field engineer visit is booked — described, not yet seen." },
  { id: "sy9", at: d(102), text: `${NEWHIRE} now links area outages and handles four-hour SLA tickets without help.` },
];

function items(): MemoryItem[] {
  return RULES.map((r) => ({
    id: r.id, displayId: r.id, ruleId: r.id, kind: r.kind, title: r.title,
    quote: r.quote || null,
    noQuoteLabel: r.quote ? null : noQuote,
    source: `${EXPERT} · ${r.how}${r.t !== "—" ? ` · ${r.t}` : ""}`,
    learnedAt: d(r.day),
    correction: r.corrected ? { text: r.corrected.text, before: r.corrected.before, at: d(r.corrected.day) } : null,
    mastery: r.learners.length ? { person: NEWHIRE, label: r.learners[r.learners.length - 1][1] } : null,
    href: ontHref(DEMO_ROLE_ID, r.id),
  }));
}

function knowledge(): KnowledgeSeries {
  const kinds = (Object.keys(KIND_META) as ItemKind[]).map((kind) => ({ kind, ...KIND_META[kind] }));
  const days = [...new Set(RULES.map((r) => r.day))].sort((a, b) => a - b);
  const points = days.map((day) => {
    const c: Record<ItemKind, number> = { rule: 0, guardrail: 0, exception: 0, escalation: 0, described: 0 };
    for (const r of RULES) if (r.day <= day) c[r.kind]++;
    return { at: d(day), counts: c };
  });
  return { kinds, points, total: RULES.length };
}

const TASKS: TaskCard[] = [
  { id: "t1", title: "Work the Tier-2 escalation queue", at: d(38), sub: `${EXPERT} · 8 min · 3 tickets`, watched: true, steps: [
    { n: 1, t: "00:12", title: "Open the escalated ticket", judgment: false },
    { n: 2, t: "01:05", title: "Check the customer's contract", judgment: false },
    { n: 3, t: "02:30", title: "Set priority to P1", judgment: true, rule: { id: "R2", displayId: "R2", kind: "guardrail" } },
    { n: 4, t: "03:40", title: "Link three tickets to one incident", judgment: true, rule: { id: "R1", displayId: "R1", kind: "rule" } },
    { n: 5, t: "05:10", title: "Reply to the customers", judgment: false },
    { n: 6, t: "06:20", title: "Close and save", judgment: false },
  ] },
  { id: "t2", title: "Billing escalations", at: d(94), sub: `${EXPERT} · 11 min · 4 tickets`, watched: true, steps: [
    { n: 1, t: "00:20", title: "Open the billing complaint", judgment: false },
    { n: 2, t: "02:15", title: "Give a goodwill credit", judgment: true, rule: { id: "R4", displayId: "R4", kind: "exception" } },
    { n: 3, t: "04:40", title: "Send a larger refund request on", judgment: true, rule: { id: "R4", displayId: "R4", kind: "exception" } },
    { n: 4, t: "07:05", title: "Note the outcome on the ticket", judgment: false },
  ] },
  { id: "t3", title: "Repeat faults", at: d(95.5), sub: "Described in the debrief · not demonstrated", watched: false, steps: [
    { n: 1, t: "—", title: "Check the line's fault history", judgment: false },
    { n: 2, t: "—", title: "Book a field engineer", judgment: true, rule: { id: "R6", displayId: "R6", kind: "described" } },
  ], described: [{ question: "What if the same line keeps dropping?", quote: RULES[5].quote }] },
];

function asks(): AskEntry[] {
  return RULES.filter((r) => r.quote && r.ask).map((r) => ({
    id: `ask_${r.id}`, question: r.ask,
    answer: r.corrected ? r.corrected.text : r.quote,
    kind: r.kind,
    source: `${KIND_META[r.kind].label} · ${EXPERT} · ${r.corrected ? "debrief correction" : r.how}`,
    learnedAt: d(r.day),
    early: r.corrected ? { answer: r.quote, until: d(r.corrected.day), note: `Before the teach-back · ${EXPERT} corrected this later` } : null,
  }));
}

const DIMENSIONS: Dimension[] = [
  { label: "Tasks seen", series: series([[38, 1], [94, 2]]), max: null },
  { label: "Decisions explained", series: series([[38, 2], [39.5, 4], [94, 5], [95.5, 7]]), max: 8 },
  { label: "Guardrails in the expert's words", series: series([[38, 1]]), max: 2 },
  { label: "Exceptions", series: series([[39.5, 1], [94, 2]]), max: 2 },
  { label: "Cases described, not shown", series: series([[95.5, 1]]), max: 1 },
];

const QUESTIONS: OpenQuestion[] = [
  { id: "q1", question: "Is three tickets the threshold, or does area size matter?", status: "filled", openedAt: d(38), closedAt: d(38), how: "answered live" },
  { id: "q2", question: "Why set P1 before reading the ticket?", status: "filled", openedAt: d(38), closedAt: d(38), how: "answered live" },
  { id: "q3", question: "Is every refund approved in Tier 2?", status: "filled", openedAt: d(94), closedAt: d(95.5), how: "answered in the debrief" },
  { id: "q4", question: "Who takes a customer who wants to cancel?", status: "filled", openedAt: d(94), closedAt: d(95.5), how: "answered in the debrief" },
  { id: "q5", question: "What if the same line keeps dropping?", status: "filled", openedAt: d(94), closedAt: d(95.5), how: "described in the debrief" },
  { id: "q6", question: "Who decides when an outage is over?", status: "open", openedAt: d(95.5), closedAt: null, how: "open · for network operations" },
  { id: "q7", question: "When does a ticket skip Tier 2 entirely?", status: "open", openedAt: d(39.5), closedAt: null, how: "open · next debrief" },
];

const MASTERY_COLS = [
  { id: "s5", at: d(98), label: `${formatAt(d(98), "day")} · coached` },
  { id: "s6", at: d(102), label: `${formatAt(d(102), "day")} · independent` },
];

export function demoRole(roleId: string = DEMO_ROLE_ID): { data: PlatformData; role: RoleMemory | null } {
  const data = demoPlatform();
  if (roleId !== DEMO_ROLE_ID) return { data, role: null };
  const main = ROLES[0];
  return {
    data,
    role: {
      roleId: DEMO_ROLE_ID,
      title: main.title,
      breadcrumb: ["Customer support", "Escalations"],
      status: "captured",
      statusLabel: "Captured",
      revision: 4,
      confirmed: true,
      expertName: EXPERT,
      memoryMapId: null,
      mapHref: null,
      ontologyHref: ontHref(DEMO_ROLE_ID),
      coverage: main.coverage.map((c) => ({ ...c })),
      people: MAIN_PEOPLE.map((x) => ({ ...x })),
      timeline: timeline(),
      synopsis: { sentences: SYNOPSIS.map((s) => ({ ...s })), draftBanner: null, empty: null },
      knowledge: knowledge(),
      tasks: TASKS.map((t) => ({ ...t, steps: t.steps.map((s) => ({ ...s })) })),
      items: items(),
      asks: asks(),
      asksEmpty: null,
      dimensions: DIMENSIONS.map((x) => ({ ...x })),
      mastery: {
        learner: NEWHIRE,
        columns: MASTERY_COLS.map((c) => ({ ...c })),
        rows: RULES.map((r) => ({
          ruleId: r.id, displayId: r.id, title: r.title,
          cells: MASTERY_COLS.map((c) => r.learners.find(([day]) => d(day) === c.at)?.[1] ?? "not tested"),
        })),
        empty: null,
      },
      openQuestions: QUESTIONS.map((q) => ({ ...q })),
    },
  };
}

// ---------------------------------------------------------------- ontology

const f = (name: string, value: string, prov: OntClass["prov"], day: number) => ({ name, value, prov, at: d(day) });

const CLASSES: OntClass[] = [
  { id: "ticket", kind: "object", name: "Ticket", x: 900, y: 600, at: d(38), prov: "seen", firstSession: "Capture · escalation queue",
    def: "A customer ticket escalated from the front line. Opened, prioritised, linked or routed, then resolved.",
    fields: [f("number", "LT-######", "seen", 38), f("customer", "→ Customer", "seen", 38), f("category", "fault · billing · account", "seen", 38),
      f("priority", "P1 · P2 · P3 · P4", "seen", 38), f("area", "postcode", "seen", 38), f("status", "new · escalated · resolved · reopened", "seen", 38),
      f("assigned agent", "name", "seen", 38), f("incident", "→ Incident", "seen", 38)],
    instances: ["LT-208114", "LT-208131", "LT-208139", "LT-208202", "LT-208217"] },
  { id: "customer", kind: "object", name: "Customer", x: 470, y: 380, at: d(38), prov: "seen", firstSession: "Capture · escalation queue",
    def: "Who raised the ticket. Consumer or business; contact details are masked before any frame leaves the browser.",
    fields: [f("segment", "consumer · business", "seen", 38), f("name", "masked before sending", "seen", 38), f("phone", "masked before sending", "seen", 38),
      f("cancel intent", "stated · not stated", "said", 95.5)],
    instances: ["BUS-1182", "CON-90417"] },
  { id: "contract", kind: "object", name: "Contract", x: 1370, y: 420, at: d(38), prov: "seen", firstSession: "Capture · escalation queue",
    def: "The plan the customer is on, with its service level.",
    fields: [f("plan", "Fibre Home · Fibre Pro · Mobile", "seen", 38), f("SLA", "→ SLA", "seen", 38), f("renewal", "date", "seen", 94)],
    instances: ["Fibre Pro · business"] },
  { id: "incident", kind: "object", name: "Incident", x: 520, y: 860, at: d(38), prov: "seen", firstSession: "Capture · escalation queue",
    def: "One network problem behind many tickets.",
    fields: [f("number", "INC-####", "seen", 38), f("scope", "postcodes", "seen", 38), f("owner", "team", "said", 39.5)],
    instances: ["INC-3381"] },
  { id: "credit", kind: "object", name: "Goodwill credit", x: 1340, y: 830, at: d(94), prov: "seen", firstSession: "Capture · billing escalations",
    def: "Money given back on the bill as an apology.",
    fields: [f("amount", "€", "seen", 94), f("reason", "text", "seen", 94), f("approval", "approve now · send on", "said", 95.5)],
    instances: ["€25 · LT-208202"] },
  { id: "line", kind: "object", name: "Line", x: 760, y: 1060, at: d(95.5), prov: "described", firstSession: "Debrief · confirmed rev 4",
    def: "The physical connection to the customer.",
    fields: [f("fault history", "dates", "described", 95.5)], instances: [] },
];

const CONCEPTS: OntConcept[] = [
  { id: "outage", kind: "concept", name: "Area outage", x: 600, y: 160, at: d(38), prov: "said", def: "Three or more tickets from one postcode within 30 minutes.", defQuote: RULES[0].quote },
  { id: "sla4h", kind: "concept", name: "Four-hour SLA", x: 1420, y: 150, at: d(38), prov: "said", def: "A business contract promising a response within four hours.", defQuote: RULES[1].quote },
  { id: "reopen", kind: "concept", name: "Reopened ticket", x: 1240, y: 640, at: d(39.5), prov: "said", def: "A ticket the customer opened again after it was resolved.", defQuote: RULES[6].quote },
  { id: "repeat", kind: "concept", name: "Repeat fault", x: 420, y: 1080, at: d(95.5), prov: "described", def: "The same line dropping twice in 30 days. Described in the debrief, not yet seen.", defQuote: RULES[5].quote },
  { id: "noc", kind: "role", name: "Network operations", x: 240, y: 700, at: d(39.5), prov: "said", def: "Owns a confirmed outage." },
  { id: "disputes", kind: "role", name: "Billing disputes", x: 1650, y: 1000, at: d(95.5), prov: "said", def: "Takes credits above what Tier 2 may give alone." },
  { id: "retention", kind: "role", name: "Retention desk", x: 160, y: 300, at: d(95.5), prov: "said", def: "Takes customers who say they will cancel." },
  { id: "field", kind: "role", name: "Field engineer", x: 160, y: 1050, at: d(95.5), prov: "described", def: "Visits a line with repeat faults." },
  { id: "fraud", kind: "role", name: "Fraud analyst", x: 900, y: 120, at: d(39.5), prov: "teachback", def: "Reviews a possible account takeover before any change." },
  { id: "am", kind: "role", name: "Business account manager", x: 1680, y: 300, at: d(95.5), prov: "inferred", def: "May need to hear about P1 tickets on a four-hour SLA. Simon inferred this; nobody has said it yet.", alsoIn: ["Business accounts"] },
];

const e = (id: string, from: string, to: string, verb: string, card: string | null, prov: OntEdge["prov"], day: number, ruleIds: string[] = []): OntEdge =>
  ({ id, from, to, verb, card, prov, at: d(day), ruleIds });

const OEDGES: OntEdge[] = [
  e("tk_cu", "ticket", "customer", "raised by", "n:1", "seen", 38),
  e("cu_ct", "customer", "contract", "holds", "1:n", "seen", 38),
  e("tk_inc", "ticket", "incident", "linked to", "0..1", "seen", 38),
  e("tk_cr", "ticket", "credit", "compensated by", "0..1", "seen", 94),
  e("tk_ln", "ticket", "line", "about", "n:1", "described", 95.5),
  e("tk_out", "ticket", "outage", "3+ in one area", null, "said", 38),
  e("out_inc", "outage", "incident", "opens", null, "said", 38, ["R1"]),
  e("ct_sla", "contract", "sla4h", "4-hour response", null, "said", 38),
  e("sla_tk", "sla4h", "ticket", "→ P1", null, "said", 38, ["R2"]),
  e("inc_noc", "incident", "noc", "owned by", null, "said", 39.5, ["R3"]),
  e("tk_reo", "ticket", "reopen", "reopened → previous agent", null, "said", 39.5, ["R7"]),
  e("cu_fr", "customer", "fraud", "possible takeover →", null, "teachback", 39.5, ["R8"]),
  e("cr_disp", "credit", "disputes", "over €40 →", null, "said", 95.5, ["R4"]),
  e("cu_ret", "customer", "retention", "cancel intent →", null, "said", 95.5, ["R5"]),
  e("ln_rep", "line", "repeat", "drops twice in 30 days", null, "described", 95.5),
  e("rep_fe", "repeat", "field", "books", null, "described", 95.5, ["R6"]),
  e("sla_am", "sla4h", "am", "notified?", null, "inferred", 95.5),
];

export function demoOntology(roleId: string = DEMO_ROLE_ID): { data: PlatformData; ontology: Ontology | null } {
  const data = demoPlatform();
  if (roleId !== DEMO_ROLE_ID) return { data, ontology: null };
  return {
    data,
    ontology: {
      roleId: DEMO_ROLE_ID,
      roleTitle: ROLES[0].title,
      expertName: EXPERT,
      people: MAIN_PEOPLE.slice(0, 2).map((x) => ({ ...x })),
      confirmed: true,
      timeline: timeline(),
      classes: CLASSES.map((c) => ({ ...c, fields: c.fields.map((x) => ({ ...x })) })),
      concepts: CONCEPTS.map((c) => ({ ...c })),
      edges: OEDGES.map((x) => ({ ...x })),
      rules: RULES.map((r): OntRule => ({
        id: r.id, displayId: r.id, kind: r.kind, title: r.title, at: d(r.day),
        logic: r.logic.map((l) => ({ ...l })),
        quotes: r.quote ? [{ text: r.quote, source: r.how, t: r.t }] : [],
        noQuoteLabel: r.quote ? null : noQuote,
        correction: r.corrected ? { text: r.corrected.text, before: r.corrected.before, at: d(r.corrected.day) } : null,
        path: [...r.path], edgeIds: [...r.edges], badgeEdgeId: r.badge,
        learners: r.learners.length ? [{ name: NEWHIRE, label: r.learners[r.learners.length - 1][1] }] : [],
        policy: JSON.stringify({ id: r.id, title: r.title, logic: r.logic.map((l) => `${l.key} ${[l.entity, l.attr, l.op, l.value].filter(Boolean).join(" ")}`), evidence: r.quote ? [r.quote] : [] }, null, 2),
        policyNote: null,
      })),
      saidLabel: `said by ${EXPERT}`,
      empty: null,
    },
  };
}
