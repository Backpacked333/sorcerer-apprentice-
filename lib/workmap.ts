/**
 * The Work Map: the single artifact that Capture writes, Map confirms and Teach executes.
 *
 * Everything else in the app is a view of this type. Keep it boring and explicit.
 */
import { z } from "zod";

// ---------- Invoice state as the vision model / ERP telemetry report it ----------

export const InvoiceStateSchema = z.object({
  invoice: z.string().optional(),
  supplier: z.string().optional(),
  entity: z.string().optional(), // "parent" | "subsidiary" | free text
  amount: z.number().optional(),
  category: z.string().optional(), // "equipment" | "freight" | "maintenance" | "cleaning" | "credit_note" ...
  invoiceMonth: z.number().optional(), // 1..12
  invoiceDate: z.string().optional(),
  costCenter: z.string().optional(),
  route: z.string().optional(), // "single" | "second_approval"
  status: z.string().optional(), // "open" | "approved" | "hold" | "posted"
  hasAssetNumber: z.boolean().optional(),
  knownSupplier: z.boolean().optional(),
  hasPO: z.boolean().optional(),
  description: z.string().optional(),
});
export type InvoiceState = z.infer<typeof InvoiceStateSchema>;

// ---------- Quotes: the expert's own words, always verbatim ----------

export const QuoteSchema = z.object({
  text: z.string(),
  t: z.number(), // seconds since session start
  audioId: z.string().optional(),
  source: z.enum(["live", "narration", "debrief", "counterfactual"]),
  translation: z.string().optional(),
});
export type Quote = z.infer<typeof QuoteSchema>;

// ---------- Conditions: machine-checkable, deliberately tiny ----------

export type Cond =
  | { all: Cond[] }
  | { any: Cond[] }
  | { not: Cond }
  | { field: string; op: ">" | ">=" | "<" | "<=" | "==" | "!=" | "in" | "matches" | "exists"; value?: string | number | boolean | string[] };

export const CondSchema: z.ZodType<Cond> = z.lazy(() =>
  z.union([
    z.object({ all: z.array(CondSchema) }),
    z.object({ any: z.array(CondSchema) }),
    z.object({ not: CondSchema }),
    z.object({
      field: z.string(),
      op: z.enum([">", ">=", "<", "<=", "==", "!=", "in", "matches", "exists"]),
      value: z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]).optional(),
    }),
  ]),
);

export const ActSchema = z.union([
  z.object({ set: z.record(z.string(), z.string()) }),
  z.object({ route: z.string() }),
  z.object({ status: z.enum(["hold", "approved", "posted"]) }),
]);
export type Act = z.infer<typeof ActSchema>;

export const GuardrailSchema = z.object({
  id: z.string(),
  kind: z.enum(["limit", "exception", "escalation"]),
  text: z.string(),
  quote: QuoteSchema.optional(),
  ruleId: z.string().optional(),
});
export type Guardrail = z.infer<typeof GuardrailSchema>;

export const StepSchema = z.object({
  id: z.string(),
  index: z.number(),
  title: z.string(),
  invoice: z.string().optional(),
  screenMoment: z.object({ t: z.number(), frameId: z.string().optional(), region: z.object({ x: z.number(), y: z.number(), w: z.number(), h: z.number() }).optional() }),
  action: z.union([
    z.object({ field: z.string(), from: z.string().optional(), to: z.string() }),
    z.object({ type: z.enum(["open", "hold", "route", "save", "approve", "close"]) }),
  ]),
  decision: z.string(),
  judgment: z.boolean(),
  reason: QuoteSchema.optional(),
  guardrails: z.array(GuardrailSchema).default([]),
  confidence: z.enum(["high", "medium", "low"]).default("medium"),
});
export type Step = z.infer<typeof StepSchema>;

export const RuleSchema = z.object({
  id: z.string(),
  stepId: z.string().optional(),
  title: z.string(),
  when: CondSchema,
  then: ActSchema,
  unless: CondSchema.optional(),
  stopAndAsk: z.object({ who: z.string(), when: CondSchema }).optional(),
  quotes: z.array(QuoteSchema).default([]),
  confidence: z.enum(["high", "medium", "low"]).default("medium"),
  confirmedBy: z.array(z.enum(["live", "counterfactual", "debrief", "teachback"])).default([]),
});
export type Rule = z.infer<typeof RuleSchema>;

export const SlotSchema = z.object({
  id: z.string(),
  kind: z.enum(["reason", "limit", "exception", "escalation", "counterfactual", "novel"]),
  stepId: z.string().optional(),
  ruleId: z.string().optional(),
  question: z.string(),
  status: z.enum(["open", "filled", "skipped"]),
  filledBy: QuoteSchema.optional(),
});
export type Slot = z.infer<typeof SlotSchema>;

export const WorkMapSchema = z.object({
  sessionId: z.string(),
  task: z.string(),
  expert: z.object({ name: z.string(), language: z.string().default("en") }),
  onet: z.object({ code: z.string(), occupation: z.string(), task: z.string() }).optional(),
  steps: z.array(StepSchema),
  rules: z.array(RuleSchema),
  slots: z.array(SlotSchema),
  privacy: z.object({
    framesSeen: z.number().default(0),
    framesKept: z.number().default(0),
    entitiesRedacted: z.number().default(0),
    offRecord: z.array(z.object({ from: z.number(), to: z.number() })).default([]),
  }),
  /** The debrief asks about cases it has not seen; the answers live here and the tutor quotes them when such a case appears. */
  notes: z.array(z.object({ topic: z.string(), question: z.string(), quote: QuoteSchema })).default([]),
  /** bumped on every saved change after compile; a teach session records the revision it taught from */
  revision: z.number().default(0),
  compiledAt: z.number().optional(),
  confirmedAt: z.number().optional(),
  corrections: z.array(z.object({ t: z.number(), text: z.string() })).default([]),
});
export type WorkMap = z.infer<typeof WorkMapSchema>;

// ---------- Condition evaluation ----------

export function evalCond(cond: Cond, state: InvoiceState): boolean {
  if ("all" in cond) return cond.all.every((c) => evalCond(c, state));
  if ("any" in cond) return cond.any.some((c) => evalCond(c, state));
  if ("not" in cond) return !evalCond(cond.not, state);
  const v = (state as Record<string, unknown>)[cond.field];
  switch (cond.op) {
    case "exists":
      return v !== undefined && v !== null && v !== "";
    case "==":
      return normalize(v) === normalize(cond.value);
    case "!=":
      return normalize(v) !== normalize(cond.value);
    case ">":
      return typeof v === "number" && typeof cond.value === "number" && v > cond.value;
    case ">=":
      return typeof v === "number" && typeof cond.value === "number" && v >= cond.value;
    case "<":
      return typeof v === "number" && typeof cond.value === "number" && v < cond.value;
    case "<=":
      return typeof v === "number" && typeof cond.value === "number" && v <= cond.value;
    case "in":
      return Array.isArray(cond.value) && cond.value.map(normalize).includes(normalize(v));
    case "matches":
      return typeof v === "string" && typeof cond.value === "string" && new RegExp(cond.value, "i").test(v);
  }
}

function normalize(v: unknown): string {
  if (v === undefined || v === null) return "";
  return String(v).trim().toLowerCase();
}

/** Human-readable rendering of a condition, for the Work Map UI and the SOP export. */
export function describeCond(cond: Cond): string {
  if ("all" in cond) return cond.all.map(describeCond).join(" and ");
  if ("any" in cond) return "(" + cond.any.map(describeCond).join(" or ") + ")";
  if ("not" in cond) return "not " + describeCond(cond.not);
  const field = FIELD_LABELS[cond.field] ?? cond.field;
  switch (cond.op) {
    case "exists":
      return `${field} is present`;
    case "in":
      return `${field} is one of ${(cond.value as string[]).join(", ")}`;
    case "matches":
      return `${field} matches /${cond.value}/`;
    case "==":
      return `${field} is ${fmt(cond.field, cond.value)}`;
    case "!=":
      return `${field} is not ${fmt(cond.field, cond.value)}`;
    default:
      return `${field} ${cond.op} ${fmt(cond.field, cond.value)}`;
  }
}

export function describeAct(act: Act): string {
  if ("set" in act) return Object.entries(act.set).map(([k, v]) => `set ${FIELD_LABELS[k] ?? k} to ${v}`).join(", ");
  if ("route" in act) return `route to ${act.route.replace(/_/g, " ")}`;
  return `set status to ${act.status}`;
}

const FIELD_LABELS: Record<string, string> = {
  amount: "amount",
  category: "category",
  supplier: "supplier",
  entity: "entity",
  invoiceMonth: "invoice month",
  costCenter: "cost center",
  hasAssetNumber: "asset number",
  knownSupplier: "known supplier",
  hasPO: "purchase order",
  route: "approval route",
  status: "status",
};

function fmt(field: string, v: unknown): string {
  if (field === "amount" && typeof v === "number") return "€" + v.toLocaleString("en-IE");
  if (field === "invoiceMonth" && typeof v === "number") return MONTHS[v - 1] ?? String(v);
  return String(v);
}
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** Does the action the user just took agree with what the rule prescribes? */
export function actionMatchesRule(rule: Rule, state: InvoiceState): boolean | undefined {
  const act = rule.then;
  if ("set" in act) {
    const entries = Object.entries(act.set);
    const seen = entries.filter(([k]) => (state as Record<string, unknown>)[k] !== undefined);
    if (seen.length === 0) return undefined; // nothing decided yet
    return entries.every(([k, v]) => normalize((state as Record<string, unknown>)[k]) === normalize(v));
  }
  if ("route" in act) {
    if (state.route === undefined) return undefined;
    return normalize(state.route) === normalize(act.route);
  }
  if (state.status === undefined || state.status === "open") return undefined;
  return normalize(state.status) === normalize(act.status);
}

// ---------- Slots and understanding ----------

export function openSlots(map: WorkMap): Slot[] {
  return map.slots.filter((s) => s.status === "open");
}

/** 0..1, confidence weighted: a filled slot counts fully, a low-confidence rule counts half. */
export function understanding(map: WorkMap): number {
  const slotScore = map.slots.length === 0 ? 1 : map.slots.filter((s) => s.status !== "open").length / map.slots.length;
  const ruleScore = map.rules.length === 0 ? 1 : map.rules.reduce((acc, r) => acc + (r.confidence === "high" ? 1 : r.confidence === "medium" ? 0.75 : 0.5), 0) / map.rules.length;
  const confirmed = map.confirmedAt ? 1 : 0.9;
  return Math.round(Math.min(1, slotScore * 0.7 + ruleScore * 0.3) * confirmed * 100) / 100;
}

export function isComplete(map: WorkMap): boolean {
  return openSlots(map).length === 0 && !!map.confirmedAt;
}

export function emptyMap(sessionId: string, task: string, expertName: string): WorkMap {
  return {
    sessionId,
    task,
    expert: { name: expertName, language: "en" },
    onet: { code: "43-3031.00", occupation: "Bookkeeping, Accounting, and Auditing Clerks", task: "Code documents according to company procedures" },
    steps: [],
    rules: [],
    slots: [],
    privacy: { framesSeen: 0, framesKept: 0, entitiesRedacted: 0, offRecord: [] },
    notes: [],
    revision: 0,
    corrections: [],
  };
}

export function uid(prefix = "id"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-3)}`;
}
