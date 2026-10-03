/**
 * Engine 2: curiosity. Decides WHAT to ask.
 *
 * Rule that keeps it honest: never ask what happened, the screen already shows that.
 * Ask why, what if, what the limit is, when to stop, who decides.
 */
import type { ScreenEvent } from "./events";
import { labelField } from "./events";

export type CandidateKind = "why" | "counterfactual" | "limit" | "stop" | "who";

export interface Candidate {
  id: string;
  kind: CandidateKind;
  value: number; // 0..1 judgment value
  question: string; // grounded template, the agent phrases it naturally
  invoice?: string;
  field?: string;
  stepRef: string; // "4471:costCenter" or "4473:status"
  eventId: string;
  createdAt: number;
  status: "queued" | "asked" | "filled" | "expired" | "debrief";
  parentId?: string; // sibling probes point at their why
  guardrail: boolean; // counts toward the "at least one guardrail question" rule
}

export interface CuriosityContext {
  seenSuppliers: Set<string>;
  /** stepRef -> `to` value, to detect repeats of a previous action */
  priorActions: Map<string, string>;
  knownThresholds: number[]; // amounts the expert has named as limits
}

export function newContext(): CuriosityContext {
  return { seenSuppliers: new Set(), priorActions: new Map(), knownThresholds: [] };
}

export type EventClass = "edit_prefilled" | "hold_or_reroute" | "threshold_adjacent" | "unusual_entity" | "repeat" | "navigation";

export function classifyEvent(e: ScreenEvent, ctx: CuriosityContext): { cls: EventClass; value: number } {
  const key = `${e.invoice ?? "?"}:${e.field ?? e.kind}`;
  if (e.kind === "field_changed") {
    const repeat = e.to !== undefined && ctx.priorActions.get(`${e.field}`) === e.to;
    if (repeat) return { cls: "repeat", value: 0.2 };
    // an edit of a value that was already filled in (the system default) is the strongest judgment signal
    return { cls: "edit_prefilled", value: e.from && e.from !== "" ? 0.9 : 0.7 };
  }
  if (e.kind === "status_changed" && (e.to === "hold" || e.to === "rejected")) return { cls: "hold_or_reroute", value: 0.9 };
  if (e.kind === "route_changed") return { cls: "hold_or_reroute", value: 0.85 };
  if (e.kind === "invoice_opened" && e.state) {
    const supplier = e.state.supplier ?? "";
    const unusual = (supplier && !ctx.seenSuppliers.has(supplier) && e.state.knownSupplier === false) || e.state.entity === "subsidiary";
    if (unusual) return { cls: "unusual_entity", value: 0.45 };
    const amt = e.state.amount ?? 0;
    const near = ctx.knownThresholds.some((th) => Math.abs(amt - th) / th <= 0.3) || (ctx.knownThresholds.length === 0 && amt >= 5000);
    if (near) return { cls: "threshold_adjacent", value: 0.45 };
  }
  void key;
  return { cls: "navigation", value: 0 };
}

/** Update what the engine has seen. Call for every event, after classification. */
export function observe(e: ScreenEvent, ctx: CuriosityContext) {
  if (e.state?.supplier) ctx.seenSuppliers.add(e.state.supplier);
  if (e.kind === "field_changed" && e.field && e.to) ctx.priorActions.set(e.field, e.to);
}

// ---------- Templates (slots are filled from the event's own values) ----------

const money = (n: number) => "€" + Math.round(n).toLocaleString("en-IE");

export function templates(e: ScreenEvent): Partial<Record<CandidateKind, string>> {
  const inv = e.invoice ? `invoice ${e.invoice}` : "that invoice";
  const field = labelField(e.field);
  const amount = e.state?.amount;
  const to = e.to ?? "";
  switch (e.kind) {
    case "field_changed":
      return {
        why: `You moved ${inv} from ${e.from ?? "empty"} to ${e.to} on the ${field}. What made you do that?`,
        counterfactual: amount ? `If ${inv} had been ${money(amount * 0.63)} instead of ${money(amount)}, would you still have put it on ${to}?` : `If this had come from a different supplier, would you still have put it on ${to}?`,
        limit: `Is there an amount, or a kind of supplier, where you would handle the ${field} on ${inv} differently?`,
        stop: `When would you stop at this step on ${inv} and check with someone instead?`,
      };
    case "status_changed":
      return {
        why: `You put ${inv} on ${e.to}. What made you do that?`,
        counterfactual: e.state?.invoiceMonth ? `If the same invoice had arrived in ${monthName(e.state.invoiceMonth === 12 ? 11 : e.state.invoiceMonth + 1)}, would you still have put it on ${e.to}?` : `Would you do that for every supplier, or only this one?`,
        limit: `Is that for every supplier, or only this one?`,
        who: `Who decides when ${inv} gets released?`,
        stop: `When would you stop here and ask someone before releasing ${inv}?`,
      };
    case "route_changed":
      return {
        why: `You sent ${inv} for ${String(e.to).replace(/_/g, " ")}. What made you do that?`,
        limit: `Is there a kind of invoice you would never approve alone?`,
        who: `Who signs the second approval on ${inv}, and what if they are away?`,
        stop: `When would you stop here and ask someone instead of routing ${inv}?`,
      };
    case "invoice_opened":
      return {
        limit: amount ? `${inv} is ${money(amount)}. Is there an amount where you handle an invoice differently?` : `Is there an amount where you handle an invoice differently?`,
        stop: `When you open an invoice like ${inv}, what would make you stop and check with someone?`,
      };
    default:
      return {};
  }
}

function monthName(m: number): string {
  return ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][m - 1] ?? "another month";
}

// ---------- Candidate generation ----------

let counter = 0;
const cid = () => `cand_${(++counter).toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

/** Every judgment-like event yields a why plus sibling probes. Siblings carry lower live value and usually wait for the debrief. */
export function buildCandidates(e: ScreenEvent, ctx: CuriosityContext, now: number): Candidate[] {
  const { cls, value } = classifyEvent(e, ctx);
  if (value === 0) return [];
  const tpl = templates(e);
  const stepRef = `${e.invoice ?? "?"}:${e.field ?? e.kind}`;
  const base = { invoice: e.invoice, field: e.field, stepRef, eventId: e.id, createdAt: now, status: "queued" as const };
  const out: Candidate[] = [];
  if (tpl.why && (cls === "edit_prefilled" || cls === "hold_or_reroute")) {
    const why: Candidate = { id: cid(), kind: "why", value, question: tpl.why, guardrail: false, ...base };
    out.push(why);
    if (tpl.counterfactual) out.push({ id: cid(), kind: "counterfactual", value: value - 0.15, question: tpl.counterfactual, guardrail: true, parentId: why.id, ...base });
    if (tpl.limit) out.push({ id: cid(), kind: "limit", value: value - 0.2, question: tpl.limit, guardrail: true, parentId: why.id, ...base });
    if (tpl.who) out.push({ id: cid(), kind: "who", value: value - 0.25, question: tpl.who, guardrail: true, parentId: why.id, ...base });
    if (tpl.stop) out.push({ id: cid(), kind: "stop", value: value - 0.3, question: tpl.stop, guardrail: true, parentId: why.id, ...base });
  } else if (cls === "threshold_adjacent" || cls === "unusual_entity") {
    // an opened invoice is being read; these probes wait for the debrief ("the cases it is unsure about")
    if (tpl.limit) out.push({ id: cid(), kind: "limit", value, question: tpl.limit, guardrail: true, ...base, status: "debrief" });
    if (tpl.stop) out.push({ id: cid(), kind: "stop", value: value - 0.1, question: tpl.stop, guardrail: true, ...base, status: "debrief" });
  } else if (cls === "repeat" && tpl.limit) {
    out.push({ id: cid(), kind: "limit", value, question: `Is it always ${e.to} for this kind of invoice, or does it depend?`, guardrail: true, ...base });
  }
  return out;
}

// ---------- The queue ----------

export class CandidateQueue {
  items: Candidate[] = [];
  readonly staleSecs: number;
  constructor(staleSecs = 90) {
    this.staleSecs = staleSecs;
  }

  add(cs: Candidate[]) {
    for (const c of cs) {
      // one open why per stepRef; a newer edit of the same field replaces the older candidate set
      const dupe = this.items.find((x) => x.status === "queued" && x.stepRef === c.stepRef && x.kind === c.kind);
      if (dupe) dupe.status = "expired";
      this.items.push(c);
    }
  }

  /** Candidates older than staleSecs, or whose invoice left the screen, move to the debrief list. */
  expire(now: number, currentInvoice?: string) {
    for (const c of this.items) {
      if (c.status !== "queued") continue;
      const stale = now - c.createdAt > this.staleSecs;
      const gone = currentInvoice !== undefined && c.invoice !== undefined && c.invoice !== currentInvoice;
      if (stale || gone) c.status = "debrief";
    }
  }

  /**
   * Pick the best live question. forceGuardrail implements the brief's rule: by the third window, at least one
   * question must be about a limit, exception or stop condition.
   */
  pick(forceGuardrail: boolean, now?: number, minAgeSecs = 3): Candidate | undefined {
    // a candidate needs a moment to age: the why about an edit usually arrives seconds after the invoice opened
    const queued = this.items.filter((c) => c.status === "queued" && (now === undefined || now - c.createdAt >= minAgeSecs));
    const pool = forceGuardrail ? queued.filter((c) => c.guardrail) : queued;
    if (pool.length === 0) return undefined;
    // whys first (highest value), siblings only once their why was asked or filled
    const ready = pool.filter((c) => !c.parentId || ["asked", "filled"].includes(this.items.find((x) => x.id === c.parentId)?.status ?? ""));
    const ranked = (ready.length ? ready : pool).sort((a, b) => b.value - a.value || b.createdAt - a.createdAt);
    return ranked[0];
  }

  markAsked(id: string) {
    const c = this.items.find((x) => x.id === id);
    if (c) c.status = "asked";
  }
  markFilled(id: string) {
    const c = this.items.find((x) => x.id === id);
    if (c) c.status = "filled";
  }
  /** Something answered the question without a window (narration). */
  fillByStep(stepRef: string, kind: CandidateKind = "why") {
    for (const c of this.items) if (c.stepRef === stepRef && c.kind === kind && c.status === "queued") c.status = "filled";
  }
  /** Everything still unanswered goes to the debrief. */
  drainToDebrief(): Candidate[] {
    for (const c of this.items) if (c.status === "queued" || c.status === "asked") c.status = "debrief";
    return this.items.filter((c) => c.status === "debrief");
  }
  get guardrailAsked(): boolean {
    return this.items.some((c) => c.guardrail && (c.status === "asked" || c.status === "filled"));
  }
  get askedCount(): number {
    return this.items.filter((c) => c.status === "asked" || c.status === "filled").length;
  }
}

// ---------- Narration check ----------

const REASON_CUES = /\b(because|since|so that|always|never|over|above|under|below|whenever|every|only|unless|has to|must|needs?|rule)\b/i;

/**
 * Cheap check: did the expert's own narration already answer a queued why?
 * Needs the invoice number or the field label plus a reason cue in the same segment.
 */
export function narrationFills(text: string, c: Candidate): boolean {
  if (c.kind !== "why") return false;
  const t = text.toLowerCase();
  const mentionsInvoice = c.invoice ? t.includes(c.invoice.toLowerCase()) : false;
  const mentionsField = c.field ? t.includes(labelField(c.field).toLowerCase()) || t.includes(c.field.toLowerCase()) : false;
  const mentionsValue = /\b(capex|opex|hold|second approval|four eyes|controller|asset)\b/i.test(t);
  return (mentionsInvoice || mentionsField || mentionsValue) && REASON_CUES.test(t) && t.split(/\s+/).length >= 6;
}

/** Numbers the expert names as limits ("over five thousand", "above €5,000") become known thresholds. */
export function extractThresholds(text: string): number[] {
  const out: number[] = [];
  const t = text.toLowerCase().replace(/,/g, "");
  for (const m of t.matchAll(/(?:over|above|under|below|more than|less than|from|up to)\s+(?:€|eur\s*)?(\d+(?:\.\d+)?)\s*(k|thousand)?/g)) {
    let n = parseFloat(m[1]);
    if (m[2]) n *= 1000;
    if (n >= 100) out.push(n);
  }
  for (const m of t.matchAll(/\b(\w+)\s+thousand\b/g)) {
    const words: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twenty: 20, fifty: 50 };
    if (words[m[1]]) out.push(words[m[1]] * 1000);
  }
  return Array.from(new Set(out));
}
