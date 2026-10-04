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
  aliases: string[];
  questionRetro: string;
  leftAt?: number;
  retryAfter?: number;
  filledBy?: "window" | "narration" | "answer";
  heardQuote?: string;
  heardAt?: number;
  userDeferred?: boolean;
}

export interface CuriosityContext {
  seenSuppliers: Set<string>;
  /** stepRef -> `to` value, to detect repeats of a previous action */
  priorActions: Map<string, string>;
  knownThresholds: number[]; // amounts the expert has named as limits
  valueLabels?: Record<string, string>;
}

export function newContext(): CuriosityContext {
  return { seenSuppliers: new Set(), priorActions: new Map(), knownThresholds: [] };
}

export type EventClass = "edit_prefilled" | "hold_or_reroute" | "threshold_adjacent" | "unusual_entity" | "repeat" | "navigation";

export function classifyEvent(e: ScreenEvent, ctx: CuriosityContext): { cls: EventClass; value: number } {
  const key = `${e.invoice ?? "?"}:${e.field ?? e.kind}`;
  if (e.kind === "field_changed") {
    const freeText = new Set(["notes", "note", "assetNumber", "hasAssetNumber", "description"]);
    const from = e.from ?? "";
    const to = e.to ?? "";
    const prefixEdit = Boolean(from && to && (to.startsWith(from) || from.startsWith(to)));
    if (e.uiActivity === "typing" || (e.field && freeText.has(e.field)) || prefixEdit) return { cls: "navigation", value: 0 };
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
    const near = ctx.knownThresholds.some((th) => Math.abs(amt - th) / th <= 0.3);
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
  const label = e.to ? ctx.valueLabels?.[e.to] : undefined;
  const fieldLabel = labelField(e.field).toLowerCase();
  const aliases = Array.from(
    new Set(
      [e.to?.toLowerCase(), label?.toLowerCase(), ...(label?.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []), fieldLabel !== "field" ? fieldLabel : undefined].filter(
        (alias): alias is string => Boolean(alias),
      ),
    ),
  );
  const retro = (question: string) =>
    e.invoice ? `On invoice ${e.invoice} a moment ago, ${question.charAt(0).toLowerCase()}${question.slice(1)}` : `A moment ago, ${question.charAt(0).toLowerCase()}${question.slice(1)}`;
  const base = { invoice: e.invoice, field: e.field, stepRef, eventId: e.id, createdAt: now, status: "queued" as const, aliases };
  const make = (kind: CandidateKind, candidateValue: number, question: string, guardrail: boolean, parentId?: string): Candidate => ({
    id: cid(),
    kind,
    value: candidateValue,
    question,
    questionRetro: retro(question),
    guardrail,
    ...(parentId ? { parentId } : {}),
    ...base,
  });
  const out: Candidate[] = [];
  if (tpl.why && (cls === "edit_prefilled" || cls === "hold_or_reroute")) {
    const why = make("why", value, tpl.why, false);
    out.push(why);
    if (e.kind === "field_changed") {
      if (tpl.counterfactual) out.push(make("counterfactual", value - 0.15, tpl.counterfactual, true, why.id));
      if (tpl.limit) out.push(make("limit", value - 0.2, tpl.limit, true, why.id));
      if (tpl.stop) out.push(make("stop", value - 0.3, tpl.stop, true, why.id));
    } else if (e.kind === "status_changed") {
      if (tpl.limit) out.push(make("limit", value - 0.15, tpl.limit, true, why.id));
      if (tpl.who) out.push(make("who", value - 0.25, tpl.who, true, why.id));
      if (tpl.counterfactual) out.push(make("counterfactual", value - 0.28, tpl.counterfactual, true, why.id));
      if (tpl.stop) out.push(make("stop", value - 0.3, tpl.stop, true, why.id));
    } else {
      if (tpl.limit) out.push(make("limit", value - 0.15, tpl.limit, true, why.id));
      if (tpl.who) out.push(make("who", value - 0.25, tpl.who, true, why.id));
      if (tpl.stop) out.push(make("stop", value - 0.3, tpl.stop, true, why.id));
    }
  } else if (cls === "threshold_adjacent" || cls === "unusual_entity") {
    // an opened invoice is being read; these probes wait for the debrief ("the cases it is unsure about")
    if (tpl.limit) out.push({ ...make("limit", value, tpl.limit, true), status: "debrief" });
    if (tpl.stop) out.push({ ...make("stop", value - 0.1, tpl.stop, true), status: "debrief" });
  } else if (cls === "repeat" && tpl.limit) {
    out.push(make("limit", value, `Is it always ${e.to} for this kind of invoice, or does it depend?`, true));
  }
  return out;
}

// ---------- The queue ----------

export class CandidateQueue {
  items: Candidate[] = [];
  readonly staleSecs: number;
  readonly graceSecs: number;
  constructor(staleSecs = 90, graceSecs = 0) {
    this.staleSecs = staleSecs;
    this.graceSecs = graceSecs;
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
      if (!gone) c.leftAt = undefined;
      else if (c.leftAt === undefined) c.leftAt = now;
      const pastGrace = gone && c.leftAt !== undefined && now - c.leftAt > this.graceSecs;
      if (stale || pastGrace) c.status = "debrief";
    }
  }

  /**
   * Pick the best live question. forceGuardrail implements the brief's rule: by the third window, at least one
   * question must be about a limit, exception or stop condition.
   */
  pick(forceGuardrail: boolean, now?: number, minAgeSecs = 3, preferredId?: string, eligible: (c: Candidate) => boolean = () => true): Candidate | undefined {
    // a candidate needs a moment to age: the why about an edit usually arrives seconds after the invoice opened
    const queued = this.items.filter(
      (c) => c.status === "queued" && (now === undefined || now - c.createdAt >= minAgeSecs) && (now === undefined || c.retryAfter === undefined || c.retryAfter <= now),
    );
    const ready = queued.filter((c) => !c.parentId || ["asked", "filled"].includes(this.items.find((x) => x.id === c.parentId)?.status ?? ""));
    const forced = forceGuardrail ? ready.filter((c) => c.guardrail) : [];
    const pool = forced.length ? forced : ready;
    const ranked = pool.sort((a, b) => b.value - (b.leftAt === undefined ? 0 : 0.1) - (a.value - (a.leftAt === undefined ? 0 : 0.1)) || b.createdAt - a.createdAt);
    return ranked.find((c) => c.id === preferredId && eligible(c)) ?? ranked.find(eligible);
  }

  markAsked(id: string) {
    const c = this.items.find((x) => x.id === id);
    if (c) c.status = "asked";
  }
  markFilled(id: string, filledBy: Candidate["filledBy"] = "window", heardQuote?: string, heardAt?: number) {
    const c = this.items.find((x) => x.id === id);
    if (c) {
      c.status = "filled";
      c.filledBy = filledBy;
      if (heardQuote !== undefined) c.heardQuote = heardQuote;
      if (heardAt !== undefined) c.heardAt = heardAt;
    }
  }
  /** Something answered the question without a window (narration). */
  fillByStep(stepRef: string, kind: CandidateKind = "why", filledBy: Candidate["filledBy"] = "narration", heardQuote?: string, heardAt?: number) {
    for (const c of this.items) {
      if (c.stepRef === stepRef && c.kind === kind && c.status === "queued") this.markFilled(c.id, filledBy, heardQuote, heardAt);
    }
  }
  /** Attribute a narration segment to matching live whys and retain its actual segment time. */
  fillNarration(text: string, at: number, currentInvoice?: string): Candidate[] {
    this.expire(at, currentInvoice);
    const filled: Candidate[] = [];
    for (const candidate of this.items) {
      if (candidate.status !== "queued" || candidate.kind !== "why") continue;
      if (!narrationMatch(text, candidate, at).fills) continue;
      this.markFilled(candidate.id, "narration", text, at);
      filled.push(candidate);
    }
    return filled;
  }
  /** Everything still unanswered goes to the debrief. */
  drainToDebrief(): Candidate[] {
    for (const c of this.items) if (c.status === "queued" || c.status === "asked") c.status = "debrief";
    return this.items.filter((c) => c.status === "debrief");
  }
  get guardrailAsked(): boolean {
    return this.items.some((c) => c.guardrail && (c.status === "asked" || (c.status === "filled" && c.filledBy === "window")));
  }
  get windowsAsked(): number {
    return this.items.filter((c) => c.status === "asked" || (c.status === "filled" && c.filledBy === "window")).length;
  }
  get askedCount(): number {
    return this.windowsAsked;
  }
}

// ---------- Narration check ----------

const REASON_CUES = /\b(because|since|so that|due to|that's why|always|never|must|has to|have to|rule|policy)\b/i;
const DEICTIC = /\b(this one|that one|this invoice|this supplier|here)\b/i;
const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export interface NarrationMatch {
  fills: boolean;
  target: "invoice" | "value" | "field" | "deictic" | null;
  cue?: string;
}

export function narrationMatch(text: string, c: Candidate, at?: number): NarrationMatch {
  const t = text.toLowerCase();
  const explicitInvoices = Array.from(t.matchAll(/\binvoice\s+([\p{L}-]*\d[\p{L}\p{N}-]*)/giu), (match) => match[1].toLowerCase());
  const conflictingInvoice = Boolean(c.invoice && explicitInvoices.some((invoice) => invoice !== c.invoice!.toLowerCase()));
  const invoice = c.invoice && new RegExp(`\\b${escapeRegExp(c.invoice.toLowerCase())}\\b`).test(t);
  const field = c.field ? labelField(c.field).toLowerCase() : "";
  const alias = (c.aliases ?? []).find((value) => value !== field && new RegExp(`\\b${escapeRegExp(value)}\\b`, "i").test(t));
  const fieldTarget = Boolean(field && field !== "field" && new RegExp(`\\b${escapeRegExp(field)}\\b`, "i").test(t));
  const target = invoice ? "invoice" : alias ? "value" : fieldTarget ? "field" : DEICTIC.test(t) ? "deictic" : null;
  const cue = t.match(REASON_CUES)?.[0];
  const timely = at === undefined || (at >= c.createdAt && at - c.createdAt <= 15);
  const ambiguousOffscreen = c.leftAt !== undefined && !invoice;
  const fills = c.kind === "why" && !conflictingInvoice && !ambiguousOffscreen && t.trim().split(/\s+/).length >= 6 && target !== null && Boolean(cue) && timely;
  return { fills, target, ...(cue ? { cue } : {}) };
}

/**
 * Cheap check: did the expert's own narration already answer a queued why?
 * Needs the invoice number or the field label plus a reason cue in the same segment.
 */
export function narrationFills(text: string, c: Candidate, at?: number): boolean {
  return narrationMatch(text, c, at).fills;
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
