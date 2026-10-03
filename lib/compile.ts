/**
 * Compile: events + transcript + answers -> Work Map.
 *
 * Two passes. The deterministic pass builds steps and screen moments from events (exact, no model), attaches
 * verbatim quotes from question windows and narration, and derives rules with simple heuristics so the whole
 * demo runs without a key. The LLM pass (when a key is present) refines rules, guardrails and slots, and is
 * validated: every quote must be a substring of the transcript, every condition must use known fields.
 */
import { generateObject } from "ai";
import { z } from "zod";
import type { QuestionWindow, ScreenEvent, SessionLog, TranscriptSegment } from "./events";
import { labelField } from "./events";
import { extractThresholds } from "./curiosity";
import { CondSchema, ActSchema, QuoteSchema, emptyMap, evalCond, type Cond, type Quote, type Rule, type Slot, type Step, type WorkMap, uid } from "./workmap";

const COST_CENTER_LABEL: Record<string, string> = { "4711": "opex", "0400": "capex", "4120": "opex freight", "4300": "opex facilities", "4050": "opex consumables" };
const NARRATION_CUES = /\b(because|since|so|always|never|over|above|under|has to|must|only|every|whenever|unless|rule|double)\b/i;
const ALLOWED_FIELDS = new Set(["amount", "category", "supplier", "entity", "invoiceMonth", "costCenter", "hasAssetNumber", "knownSupplier", "hasPO", "route", "status"]);

export function stepRefOf(e: ScreenEvent): string {
  return `${e.invoice ?? "?"}:${e.field ?? e.kind}`;
}

// ---------- Pass 1: deterministic ----------

export function compileDeterministic(log: SessionLog): WorkMap {
  const map = emptyMap(log.id, log.task, log.expertName);
  const steps: Step[] = [];
  const byRef = new Map<string, Step>();
  let index = 0;

  const addStep = (s: Omit<Step, "id" | "index" | "guardrails" | "confidence">, ref: string) => {
    const existing = byRef.get(ref);
    if (existing) {
      // a later edit of the same field: keep the first screen moment, update the decision
      existing.action = s.action;
      existing.decision = s.decision;
      existing.judgment = existing.judgment || s.judgment;
      return existing;
    }
    const step: Step = { id: uid("step"), index: index++, guardrails: [], confidence: "medium", ...s };
    steps.push(step);
    byRef.set(ref, step);
    return step;
  };

  for (const e of log.events) {
    if (e.redacted) continue;
    const inv = e.invoice ?? "?";
    const moment = { t: e.t, frameId: e.frameId };
    switch (e.kind) {
      case "invoice_opened":
        addStep({ title: `Open invoice ${inv}`, invoice: inv, screenMoment: moment, action: { type: "open" }, decision: `Opened ${inv}${e.state?.supplier ? ` from ${e.state.supplier}` : ""}${e.state?.amount !== undefined ? `, €${e.state.amount.toLocaleString("en-IE")}` : ""}`, judgment: false }, `${inv}:open`);
        break;
      case "field_changed": {
        const from = e.from ?? "";
        const to = e.to ?? "";
        const fl = labelField(e.field);
        const fromL = COST_CENTER_LABEL[from] ? `${COST_CENTER_LABEL[from]} (${from})` : from || "empty";
        const toL = COST_CENTER_LABEL[to] ? `${COST_CENTER_LABEL[to]} (${to})` : to;
        addStep({ title: e.field === "costCenter" ? `Code invoice ${inv} to a cost center` : `Set ${fl} on invoice ${inv}`, invoice: inv, screenMoment: moment, action: { field: e.field ?? "field", from, to }, decision: from && from !== to ? `Re-coded from ${fromL} to ${toL}` : `Set ${fl} to ${toL}`, judgment: from !== to && (from !== "" || e.field === "costCenter") }, stepRefOf(e));
        break;
      }
      case "route_changed":
        addStep({ title: `Set the approval route for invoice ${inv}`, invoice: inv, screenMoment: moment, action: { type: "route" }, decision: `Routed to ${String(e.to).replace(/_/g, " ")}`, judgment: e.to === "second_approval" }, `${inv}:route`);
        break;
      case "status_changed":
        addStep({ title: e.to === "hold" ? `Hold invoice ${inv}` : `Set status of invoice ${inv}`, invoice: inv, screenMoment: moment, action: { type: e.to === "hold" ? "hold" : "approve" }, decision: `Status ${e.from ?? "open"} to ${e.to}`, judgment: e.to === "hold" || e.to === "rejected" }, `${inv}:status`);
        break;
      case "save_clicked":
        addStep({ title: `Save invoice ${inv}`, invoice: inv, screenMoment: moment, action: { type: "save" }, decision: "Saved", judgment: false }, `${inv}:save`);
        break;
      default:
        break;
    }
  }

  // ---- attach verbatim quotes from question windows ----
  const quoteOf = (w: QuestionWindow): Quote | undefined =>
    w.answerText && w.outcome === "answered" ? { text: w.answerText, t: w.answeredAt ?? w.openedAt, audioId: w.answerAudioId, source: w.kind === "counterfactual" ? "counterfactual" : w.kind === "debrief" ? "debrief" : "live" } : undefined;

  const answered = log.windows.filter((w) => w.outcome === "answered" && w.answerText);
  for (const w of answered) {
    const step = w.stepRef ? byRef.get(w.stepRef) : undefined;
    const q = quoteOf(w);
    if (!q) continue;
    if (!step) continue;
    if (w.kind === "why" || w.kind === "debrief") {
      if (!step.reason) step.reason = q;
      else step.guardrails.push({ id: uid("gr"), kind: "exception", text: q.text, quote: q });
    } else if (w.kind === "counterfactual" || w.kind === "limit") {
      step.guardrails.push({ id: uid("gr"), kind: "limit", text: q.text, quote: q });
    } else if (w.kind === "stop" || w.kind === "who") {
      step.guardrails.push({ id: uid("gr"), kind: "escalation", text: q.text, quote: q });
    }
  }

  // ---- narration: a reason the expert said out loud without being asked ----
  for (const step of steps) {
    if (step.reason || !step.judgment) continue;
    const near = log.transcript.filter((s) => s.speaker === "expert" && !s.redacted && s.final && s.t >= step.screenMoment.t - 20 && s.t <= step.screenMoment.t + 25);
    const hit = near.find((s) => NARRATION_CUES.test(s.text) && s.text.split(/\s+/).length >= 6);
    if (hit) step.reason = { text: hit.text, t: hit.t, source: "narration" };
  }

  // ---- rules by heuristic ----
  const invoiceMonths = new Map<string, number>();
  for (const e of log.events) if (e.invoice && e.state?.invoiceMonth) invoiceMonths.set(e.invoice, e.state.invoiceMonth);
  map.rules = deriveRules(steps, log.transcript, invoiceMonths);
  map.steps = steps;
  map.slots = buildSlots(map, seenCases(log));
  map.privacy = { framesSeen: log.metrics?.framesSeen ?? log.frames.length, framesKept: log.frames.length, entitiesRedacted: log.metrics?.entitiesRedacted ?? 0, offRecord: log.offRecord };
  map.compiledAt = Date.now();
  return map;
}

function allQuotes(step: Step): Quote[] {
  return [step.reason, ...step.guardrails.map((g) => g.quote)].filter(Boolean) as Quote[];
}

function deriveRules(steps: Step[], transcript: TranscriptSegment[], invoiceMonths: Map<string, number> = new Map()): Rule[] {
  void transcript;
  const rules: Rule[] = [];
  const said = (step: Step) => allQuotes(step).map((q) => q.text.toLowerCase()).join(" ");
  const everySupplier = (t: string) => /\b(every|all|any) supplier/.test(t) && !/\b(not|only)\b/.test(t);

  for (const step of steps) {
    if (!step.judgment) continue;
    const text = said(step);
    const quotes = allQuotes(step);
    const confirmedBy = quotes.map((q) => (q.source === "counterfactual" ? "counterfactual" : q.source === "debrief" ? "debrief" : "live")) as Rule["confirmedBy"];
    const confidence: Rule["confidence"] = quotes.some((q) => q.source === "counterfactual") ? "high" : step.reason ? "medium" : "low";

    // cost center coding: a rule needs a stated threshold; nothing is assumed on the expert's behalf
    if ("field" in step.action && step.action.field === "costCenter") {
      const thresholds = extractThresholds(text);
      if (thresholds.length === 0) continue; // the step keeps its open slot; the tutor cannot use a rule nobody stated
      const th = thresholds[0];
      const inclusive = /\b(from|at least|and above|or more|starting at)\b/.test(text);
      const conds: Cond[] = [{ field: "amount", op: inclusive ? ">=" : ">", value: th }];
      const equipment = /equipment|machine|asset|spindle|press|tool|capital/.test(text);
      if (equipment) conds.push({ field: "category", op: "==", value: "equipment" });
      const rule: Rule = {
        id: uid("rule"),
        stepId: step.id,
        title: `${equipment ? "Equipment" : "Invoices"} ${inclusive ? "from" : "over"} €${th.toLocaleString("en-IE")} ${COST_CENTER_LABEL[step.action.to] ? `are ${COST_CENTER_LABEL[step.action.to]}` : `go to ${step.action.to}`}`,
        when: { all: conds },
        then: { set: { costCenter: step.action.to } },
        quotes,
        confidence,
        confirmedBy,
      };
      const stops: Cond[] = [];
      if (/asset number/.test(text)) stops.push({ field: "hasAssetNumber", op: "==", value: false });
      if (/unknown supplier|new supplier|don't know the supplier|do not know the supplier|not in (the )?master data/.test(text)) stops.push({ field: "knownSupplier", op: "==", value: false });
      if (stops.length) rule.stopAndAsk = { who: /controller/.test(text) ? "the controller" : "the AP lead", when: stops.length === 1 ? stops[0] : { any: stops } };
      rules.push(rule);
    }
    // second approval: only when the expert named who it applies to
    if ("type" in step.action && step.action.type === "route") {
      const subsidiary = /subsidiary|subsidiaries|intercompany|inter-company|group company|group companies/.test(text);
      if (!subsidiary) continue;
      rules.push({
        id: uid("rule"),
        stepId: step.id,
        title: "Subsidiary invoices need a second approval",
        when: { field: "entity", op: "==", value: "subsidiary" },
        then: { route: "second_approval" },
        quotes,
        confidence,
        confirmedBy,
      });
    }
    // a hold tied to a month: only when the expert tied it to one
    if ("type" in step.action && step.action.type === "hold") {
      const month = monthIn(text, invoiceMonths.get(step.invoice ?? ""));
      if (month === undefined) continue;
      const supplier = supplierOf(step, steps);
      const forEveryone = everySupplier(text);
      const conds: Cond[] = [{ field: "invoiceMonth", op: "==", value: month }];
      if (!forEveryone && supplier) conds.push({ field: "supplier", op: "matches", value: supplier.split(" ")[0] });
      const who = /ap lead|team lead|petra/.test(text) ? "the AP lead" : /controller/.test(text) ? "the controller" : undefined;
      rules.push({
        id: uid("rule"),
        stepId: step.id,
        title: forEveryone ? `${MONTHS[month - 1]} invoices are held until matched` : `${MONTHS[month - 1]} invoices from ${supplier?.split(" ")[0] ?? "this supplier"} are held until matched`,
        when: { all: conds },
        then: { status: "hold" },
        // releasing a held invoice is the escalation; it only becomes a stop condition once the expert names who releases
        stopAndAsk: who && /release/.test(text) ? { who, when: { all: [...conds, { field: "status", op: "==", value: "hold" }] } } : undefined,
        quotes,
        confidence,
        confirmedBy,
      });
    }
  }
  return rules;
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
/** The month the expert tied the hold to: the invoice's own month when she named it, else the first month she mentioned. */
function monthIn(text: string, invoiceMonth?: number): number | undefined {
  const mentioned = MONTHS.map((m, i) => ({ month: i + 1, at: text.search(new RegExp(`\\b${m.toLowerCase()}\\b`)) })).filter((x) => x.at >= 0);
  if (mentioned.length === 0) return undefined;
  if (invoiceMonth && mentioned.some((x) => x.month === invoiceMonth)) return invoiceMonth;
  return mentioned.sort((a, b) => a.at - b.at)[0].month;
}

/** The opening step of the same invoice carries the supplier name in its decision line. */
function supplierOf(step: Step, steps: Step[]): string | undefined {
  const open = steps.find((s) => s.invoice === step.invoice && "type" in s.action && s.action.type === "open");
  const m = open?.decision.match(/from (.+?)(?:,|$)/);
  return m?.[1];
}

export const GENERIC_PROBES = [
  "What would make you reject an invoice outright rather than hold it?",
  "Which of these steps do you do differently in the last two days before month-end close?",
  "When you are unsure, who do you ask, and how long do you wait before you decide yourself?",
];

/** Cases the sandbox can present that the expert may not have worked on today ("the cases it has not seen"). */
export const UNSEEN_CASES: { topic: string; seenIf: (categories: Set<string>, flags: Set<string>) => boolean; question: string }[] = [
  { topic: "credit_note", seenIf: (c) => c.has("credit_note"), question: "I did not see a credit note today. What do you do when one comes in?" },
  { topic: "no_po", seenIf: (_c, f) => f.has("no_po"), question: "What do you do when an invoice arrives without a purchase order?" },
];

export function buildSlots(map: WorkMap, seen: { categories: Set<string>; flags: Set<string> } = { categories: new Set(), flags: new Set() }): Slot[] {
  const slots: Slot[] = [];
  for (const step of map.steps) {
    if (step.judgment && !step.reason) {
      slots.push({ id: uid("slot"), kind: "reason", stepId: step.id, question: `On invoice ${step.invoice}, ${step.decision.toLowerCase()}. What made you do that?`, status: "open" });
    }
  }
  for (const rule of map.rules) {
    const step = map.steps.find((s) => s.id === rule.stepId);
    const hasLimit = step?.guardrails.some((g) => g.kind === "limit" || g.kind === "exception") || rule.confirmedBy.includes("counterfactual");
    if (!hasLimit) slots.push({ id: uid("slot"), kind: "limit", stepId: rule.stepId, ruleId: rule.id, question: limitQuestion(rule), status: "open" });
    const hasEscalation = step?.guardrails.some((g) => g.kind === "escalation") || !!rule.stopAndAsk;
    if (!hasEscalation) slots.push({ id: uid("slot"), kind: "escalation", stepId: rule.stepId, ruleId: rule.id, question: `For "${rule.title.toLowerCase()}": when would you stop and check with someone, and who decides?`, status: "open" });
  }
  // the cases it has not seen: one question each, so the tutor has the expert's words when a new hire meets one
  for (const u of UNSEEN_CASES) {
    if (u.seenIf(seen.categories, seen.flags)) continue;
    if (map.notes.some((n) => n.topic === u.topic)) continue;
    slots.push({ id: uid("slot"), kind: "novel", question: u.question, status: "open" });
  }
  // the brief requires at least three debrief questions
  let i = 0;
  while (slots.length < 3 && i < GENERIC_PROBES.length) slots.push({ id: uid("slot"), kind: "exception", question: GENERIC_PROBES[i++], status: "open" });
  return slots;
}

export function seenCases(log: SessionLog): { categories: Set<string>; flags: Set<string> } {
  const categories = new Set<string>();
  const flags = new Set<string>();
  for (const e of log.events) {
    if (e.state?.category) categories.add(e.state.category);
    if (e.state?.hasPO === false) flags.add("no_po");
  }
  return { categories, flags };
}

function limitQuestion(rule: Rule): string {
  if ("status" in rule.then && rule.then.status === "hold") return `You held that invoice. Is that for every supplier, and who decides when to release it?`;
  if ("route" in rule.then) return `Is there a kind of invoice you would never approve alone, even below the usual amounts?`;
  return `Is there an amount, or a kind of supplier, where "${rule.title.toLowerCase()}" would not apply?`;
}

// ---------- Pass 2: LLM refinement (optional, validated) ----------

const RefinementSchema = z.object({
  rules: z.array(
    z.object({
      stepId: z.string(),
      title: z.string(),
      when: CondSchema,
      then: ActSchema,
      unless: CondSchema.optional(),
      stopAndAsk: z.object({ who: z.string(), when: CondSchema }).optional(),
      quoteTexts: z.array(z.string()),
      confidence: z.enum(["high", "medium", "low"]),
    }),
  ),
  guardrails: z.array(z.object({ stepId: z.string(), kind: z.enum(["limit", "exception", "escalation"]), text: z.string(), quoteText: z.string().optional() })),
  slots: z.array(z.object({ stepId: z.string().optional(), kind: z.enum(["reason", "limit", "exception", "escalation", "counterfactual", "novel"]), question: z.string() })),
  stepReasons: z.array(z.object({ stepId: z.string(), quoteText: z.string() })),
});

export async function refineWithLLM(log: SessionLog, draft: WorkMap): Promise<{ map: WorkMap; used: boolean; note?: string }> {
  if (!process.env.AI_GATEWAY_API_KEY) return { map: draft, used: false, note: "no AI_GATEWAY_API_KEY; deterministic map" };
  const transcript = log.transcript.filter((s) => !s.redacted).map((s) => `[${s.t.toFixed(1)}s ${s.speaker}] ${s.text}`).join("\n");
  const answers = log.windows.filter((w) => w.outcome === "answered").map((w) => `[${(w.answeredAt ?? w.openedAt).toFixed(1)}s] Q(${w.kind}, ${w.stepRef}): ${w.question}\nA: ${w.answerText}`).join("\n\n");
  const steps = draft.steps.map((s) => `${s.id} | invoice ${s.invoice} | ${s.title} | ${s.decision} | judgment=${s.judgment} | reason=${s.reason?.text ?? "none"}`).join("\n");
  try {
    const { object } = await generateObject({
      model: process.env.COMPILE_MODEL ?? "anthropic/claude-sonnet-4.5",
      schema: RefinementSchema,
      system: [
        "You turn an expert's recorded work session into machine-checkable rules for an apprentice system.",
        "Hard constraints:",
        "1. Every quoteText MUST be copied verbatim from the transcript or answers below. Never paraphrase. If no quote supports a rule, set confidence to low and quoteTexts to [].",
        `2. Conditions may only use these fields: ${Array.from(ALLOWED_FIELDS).join(", ")}. amount is a number in EUR, invoiceMonth is 1-12, entity is 'parent' or 'subsidiary', category is one of equipment, freight, maintenance, cleaning, consumables, credit_note.`,
        "3. Prefer precise thresholds the expert stated (a counterfactual answer like 'no, then it is opex' confirms the threshold). Use 'unless' for exceptions the expert named.",
        "4. stopAndAsk captures when the expert would stop and who they ask. who is a role, not a name.",
        "5. slots are questions the debrief still needs to ask: one per judgment step without a reason, one limit per rule without a stated boundary, one escalation per rule without a stop condition, and kind 'novel' for a case type the expert did not work on today (a credit note, an invoice without a purchase order). Phrase them as spoken questions about the specific invoice.",
        "6. stepReasons attach a verbatim quote as the reason for a judgment step that has none.",
      ].join("\n"),
      prompt: `TASK: ${log.task}\nEXPERT: ${log.expertName}\n\nSTEPS (id | invoice | title | decision | judgment | reason):\n${steps}\n\nQUESTIONS AND ANSWERS:\n${answers || "(none)"}\n\nTRANSCRIPT:\n${transcript || "(none)"}`,
    });
    const corpus = (log.transcript.map((s) => s.text).join("\n") + "\n" + log.windows.map((w) => w.answerText ?? "").join("\n")).toLowerCase();
    const verbatim = (q: string) => corpus.includes(q.toLowerCase().trim());
    const findQuote = (text: string): Quote | undefined => {
      const w = log.windows.find((w) => w.answerText && w.answerText.toLowerCase().includes(text.toLowerCase().trim()));
      if (w) return { text, t: w.answeredAt ?? w.openedAt, audioId: w.answerAudioId, source: w.kind === "counterfactual" ? "counterfactual" : w.kind === "debrief" ? "debrief" : "live" };
      const s = log.transcript.find((s) => s.text.toLowerCase().includes(text.toLowerCase().trim()));
      return s ? { text, t: s.t, source: "narration" } : undefined;
    };
    const condOk = (c: Cond): boolean => ("all" in c ? c.all.every(condOk) : "any" in c ? c.any.every(condOk) : "not" in c ? condOk(c.not) : ALLOWED_FIELDS.has(c.field));
    const map: WorkMap = { ...draft, rules: [], slots: [] };
    for (const r of object.stepReasons) {
      const step = map.steps.find((s) => s.id === r.stepId);
      const q = verbatim(r.quoteText) ? findQuote(r.quoteText) : undefined;
      if (step && q && !step.reason) step.reason = q;
    }
    for (const g of object.guardrails) {
      const step = map.steps.find((s) => s.id === g.stepId);
      if (!step) continue;
      const q = g.quoteText && verbatim(g.quoteText) ? findQuote(g.quoteText) : undefined;
      if (!step.guardrails.some((x) => x.text === g.text)) step.guardrails.push({ id: uid("gr"), kind: g.kind, text: g.text, quote: q });
    }
    for (const r of object.rules) {
      if (!condOk(r.when) || (r.unless && !condOk(r.unless)) || (r.stopAndAsk && !condOk(r.stopAndAsk.when))) continue;
      const quotes = r.quoteTexts.filter(verbatim).map(findQuote).filter(Boolean) as Quote[];
      // sanity: the condition must evaluate without throwing on an empty state
      try {
        evalCond(r.when, {});
      } catch {
        continue;
      }
      map.rules.push({ id: uid("rule"), stepId: r.stepId, title: r.title, when: r.when, then: r.then, unless: r.unless, stopAndAsk: r.stopAndAsk, quotes, confidence: quotes.length ? r.confidence : "low", confirmedBy: Array.from(new Set(quotes.map((q) => (q.source === "counterfactual" ? "counterfactual" : q.source === "debrief" ? "debrief" : "live")))) as Rule["confirmedBy"] });
    }
    if (map.rules.length === 0) map.rules = draft.rules;
    map.slots = object.slots.map((s) => ({ id: uid("slot"), kind: s.kind, stepId: s.stepId, question: s.question, status: "open" as const }));
    const extra = buildSlots(map, seenCases(log)).filter((s) => (s.kind === "novel" && !map.slots.some((x) => x.kind === "novel")) || map.slots.length < 3);
    map.slots = [...map.slots, ...extra.filter((s) => !map.slots.some((x) => x.question === s.question))];
    map.compiledAt = Date.now();
    return { map, used: true };
  } catch (err) {
    return { map: draft, used: false, note: `LLM refinement failed: ${(err as Error).message}` };
  }
}

/** Apply a debrief answer to a slot: fills it and threads the quote into the step or rule it belongs to. */
export function fillSlot(map: WorkMap, slotId: string, quote: Quote): WorkMap {
  const slot = map.slots.find((s) => s.id === slotId);
  if (!slot) return map;
  slot.status = "filled";
  slot.filledBy = quote;
  if (slot.kind === "novel") {
    const topic = UNSEEN_CASES.find((u) => u.question === slot.question)?.topic ?? slot.question.toLowerCase().replace(/[^a-z]+/g, "_").slice(0, 32);
    map.notes.push({ topic, question: slot.question, quote });
    return map;
  }
  const step = map.steps.find((s) => s.id === slot.stepId);
  const rule = map.rules.find((r) => r.id === slot.ruleId || (slot.stepId && r.stepId === slot.stepId));
  if (slot.kind === "reason" && step && !step.reason) step.reason = quote;
  else if (step) step.guardrails.push({ id: uid("gr"), kind: slot.kind === "escalation" ? "escalation" : slot.kind === "exception" ? "exception" : "limit", text: quote.text, quote, ruleId: rule?.id });
  if (rule) {
    rule.quotes.push(quote);
    if (!rule.confirmedBy.includes("debrief")) rule.confirmedBy.push("debrief");
    if (rule.confidence === "low") rule.confidence = "medium";
    const t = quote.text.toLowerCase();
    // boundary learned in the debrief: "only Bäcker" narrows, "every supplier" widens
    if ("status" in rule.then && rule.then.status === "hold") {
      const monthCond = monthCondOf(rule);
      if (/\b(every|all|any) supplier/.test(t) && !/\b(not|only)\b/.test(t)) rule.when = { all: [monthCond] };
      const only = t.match(/only (?:for )?([a-zäöüß]+)/i);
      if (only && only[1] && !/this|that|the/.test(only[1])) rule.when = { all: [monthCond, { field: "supplier", op: "matches", value: only[1] }] };
    }
    if (slot.kind === "escalation") {
      const who = /controller/.test(t) ? "the controller" : /lead/.test(t) ? "the AP lead" : /manager|boss/.test(t) ? "the manager" : "the AP lead";
      const stops: Cond[] = [];
      if (/unknown supplier|new supplier|not in (the )?master data/.test(t)) stops.push({ field: "knownSupplier", op: "==", value: false });
      if (/asset number/.test(t)) stops.push({ field: "hasAssetNumber", op: "==", value: false });
      if (stops.length) rule.stopAndAsk = { who, when: stops.length === 1 ? stops[0] : { any: stops } };
      else if ("status" in rule.then && rule.then.status === "hold" && /release|held|hold/.test(t)) rule.stopAndAsk = { who, when: { all: [rule.when, { field: "status", op: "==", value: "hold" }] } };
      // otherwise the escalation stays a guardrail on the step; a stop condition needs a trigger the expert named
    }
  }
  return map;
}

/** The month condition a hold rule already carries (never assumed). */
function monthCondOf(rule: Rule): Cond {
  const find = (c: Cond): Cond | undefined => ("all" in c ? c.all.map(find).find(Boolean) : "any" in c ? c.any.map(find).find(Boolean) : "not" in c ? undefined : c.field === "invoiceMonth" ? c : undefined);
  return find(rule.when) ?? { field: "invoiceMonth", op: "exists" };
}

export function applyCorrection(map: WorkMap, text: string, t: number): WorkMap {
  map.corrections.push({ t, text });
  const quote: Quote = { text, t, source: "debrief" };
  const low = text.toLowerCase();
  // the common correction in the demo: a rule was generalised too far
  for (const rule of map.rules) {
    if ("status" in rule.then && rule.then.status === "hold") {
      const only = low.match(/only (?:for )?([a-zäöüß]+)/i);
      if (only && only[1] && !/this|that|the|december|january|every/.test(only[1])) {
        const monthCond = monthCondOf(rule);
        rule.when = { all: [monthCond, { field: "supplier", op: "matches", value: only[1] }] };
        rule.title = `${rule.title.split(" ")[0]} invoices from ${only[1][0].toUpperCase() + only[1].slice(1)} are held until matched`;
        if (rule.stopAndAsk) rule.stopAndAsk.when = { all: [rule.when, { field: "status", op: "==", value: "hold" }] };
        rule.quotes.push(quote);
        rule.confirmedBy.push("teachback");
        rule.confidence = "high";
      }
    }
    const th = extractThresholds(low)[0];
    if (th && "set" in rule.then) {
      const keep = "all" in rule.when ? rule.when.all.filter((c) => !("field" in c && c.field === "amount")) : [];
      rule.when = { all: [{ field: "amount", op: /\b(from|at least|and above|or more)\b/.test(low) ? ">=" : ">", value: th }, ...keep] };
      rule.title = rule.title.replace(/€[\d.,]+/, `€${th.toLocaleString("en-IE")}`);
      rule.quotes.push(quote);
      rule.confirmedBy.push("teachback");
      rule.confidence = "high";
    }
  }
  return map;
}

export { QuoteSchema };
