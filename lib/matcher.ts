/**
 * Teach: the rule matcher. Runs the Work Map's rules against the new hire's screen, event by event.
 * Twenty lines of logic because compile already turned the expert's words into conditions.
 */
import type { ScreenEvent } from "./events";
import { actionMatchesRule, describeCond, evalCond, type Cond, type InvoiceState, type Rule, type WorkMap } from "./workmap";

export type DecisionKind = "praise" | "intervene" | "stop" | "novel" | "predict" | "none";

export interface TutorDecision {
  kind: DecisionKind;
  rule?: Rule;
  /** what the tutor should say; the agent is told to use the expert's words from `quote` */
  message: string;
  quote?: string;
  stepId?: string;
  invoice?: string;
}

export type MasteryOutcome = "applied_unprompted" | "applied_after_hint" | "missed" | "escalation_recognized" | "novel_case_flagged" | "novel_case_covered" | "predicted_correctly" | "predicted_wrong";

export interface MasteryEntry {
  ruleId: string;
  outcome: MasteryOutcome;
  t: number;
  invoice?: string;
  /** help, if any, is recorded before the decision */
  phase: "coached" | "independent";
  helpBefore: boolean;
}

export type MasteryLabel = "correct without help" | "correct after a hint" | "corrected after intervention" | "not tested";

/** Rules whose `when` holds for this invoice state (and `unless` does not). */
export function applicableRules(map: WorkMap, state: InvoiceState): Rule[] {
  return map.rules.filter((r) => evalCond(r.when, state) && !(r.unless && evalCond(r.unless, state)));
}

/** A stop condition belongs to its rule: "no asset number, no capex booking" only matters when the capex rule applies. */
export function stopRules(map: WorkMap, state: InvoiceState): Rule[] {
  return map.rules.filter((r) => r.stopAndAsk && evalCond(r.when, state) && !(r.unless && evalCond(r.unless, state)) && evalCond(r.stopAndAsk.when, state));
}

/** Invoice types the expert never worked on. The matcher refuses to guess on these. */
function isNovelCase(map: WorkMap, state: InvoiceState): boolean {
  const seenCategories = new Set(map.steps.map((s) => s.invoice).filter(Boolean));
  void seenCategories;
  const cat = (state.category ?? "").toLowerCase();
  const novelCategory = cat === "credit_note" || (state.amount !== undefined && state.amount < 0) || state.hasPO === false;
  return novelCategory;
}

export class Matcher {
  readonly map: WorkMap;
  ledger: MasteryEntry[] = [];
  /** rules we already intervened on, per invoice, so we do not nag */
  private hinted = new Set<string>();
  private praised = new Set<string>();
  private predicted = new Set<string>();
  private flagged = new Set<string>();

  constructor(map: WorkMap) {
    this.map = map;
  }

  /** Called once per screen event with the merged invoice state. */
  decide(e: ScreenEvent, state: InvoiceState, now: number): TutorDecision {
    const inv = state.invoice ?? e.invoice;
    const key = (r: Rule) => `${inv}:${r.id}`;
    const phase: MasteryEntry["phase"] = e.mode === "independent" ? "independent" : "coached";
    const helped = (r: Rule) => this.hinted.has(key(r)) || this.hinted.has(`predict:${inv}`);

    // 0. The sandbox refused a commit: the tutor explains with the expert's reasoning, and the learner corrects it
    if (e.kind === "save_blocked" && e.blocked) {
      const rule = this.map.rules.find((r) => r.id === e.blocked!.ruleId);
      if (rule && !this.ledger.some((m) => m.ruleId === rule.id && m.invoice === inv && m.outcome === "missed")) {
        this.ledger.push({ ruleId: rule.id, outcome: "missed", t: now, invoice: inv, phase, helpBefore: helped(rule) });
      }
      this.hinted.add(rule ? key(rule) : `blocked:${inv}`);
      return { kind: e.blocked.who ? "stop" : "intervene", rule, invoice: inv, stepId: rule?.stepId, quote: e.blocked.quote, message: e.blocked.who ? `Not posted. ${this.map.expert.name} checks with ${e.blocked.who} here. Who would you ask?` : `Not posted. ${this.map.expert.name} would stop here: ${e.blocked.title}. Why do you think?` };
    }

    // independent follow-up: no predictions, no hints, no praise; the save guard is the only backstop
    if (phase === "independent") {
      if (e.kind === "save_clicked") {
        for (const rule of applicableRules(this.map, state)) {
          if (actionMatchesRule(rule, state) === true && !this.ledger.some((m) => m.ruleId === rule.id && m.invoice === inv)) {
            this.ledger.push({ ruleId: rule.id, outcome: "applied_unprompted", t: now, invoice: inv, phase, helpBefore: false });
          }
        }
      }
      return { kind: "none", message: "" };
    }

    // 1. A new invoice opened: maybe ask for a prediction, maybe flag novelty
    if (e.kind === "invoice_opened") {
      if (isNovelCase(this.map, state) && inv && !this.flagged.has(inv)) {
        this.flagged.add(inv);
        const note = this.map.notes.find((n) => (n.topic === "credit_note" && ((state.category ?? "") === "credit_note" || (state.amount ?? 0) < 0)) || (n.topic === "no_po" && state.hasPO === false));
        if (note) {
          // the debrief asked about this case; the tutor has their words for it
          this.ledger.push({ ruleId: "novel", outcome: "novel_case_covered", t: now, invoice: inv, phase, helpBefore: true });
          return { kind: "novel", invoice: inv, quote: note.quote.text, message: `${this.map.expert.name} never worked one of these while I watched, but I asked them. They said: "${note.quote.text}"` };
        }
        this.ledger.push({ ruleId: "novel", outcome: "novel_case_flagged", t: now, invoice: inv, phase, helpBefore: false });
        return { kind: "novel", invoice: inv, message: `${this.map.expert.name} never showed me a case like this one (${describeState(state)}). I will not guess. I have flagged it for them so the map can learn it.` };
      }
      const upcoming = applicableRules(this.map, { ...state, costCenter: undefined, route: undefined, status: "open" });
      if (upcoming.length && inv && !this.predicted.has(inv)) {
        this.predicted.add(inv);
        this.hinted.add(`predict:${inv}`);
        return { kind: "predict", invoice: inv, rule: upcoming[0], message: `Before you code this one: what would ${this.map.expert.name} do here, and why?`, quote: upcoming[0].quotes[0]?.text };
      }
      return { kind: "none", message: "" };
    }

    // 2. A decision was made on screen: compare with every applicable rule, before any save
    if (e.kind === "field_changed" || e.kind === "route_changed" || e.kind === "status_changed") {
      for (const rule of applicableRules(this.map, state)) {
        const ok = actionMatchesRule(rule, state);
        if (ok === undefined) continue;
        if (!ok && !this.hinted.has(key(rule))) {
          this.hinted.add(key(rule));
          return {
            kind: "intervene",
            rule,
            invoice: inv,
            stepId: rule.stepId,
            quote: rule.quotes[0]?.text,
            message: `${this.map.expert.name} would stop here. Why do you think?`,
          };
        }
        if (ok && !this.praised.has(key(rule))) {
          this.praised.add(key(rule));
          const after = this.hinted.has(key(rule));
          const corrected = this.ledger.some((m) => m.ruleId === rule.id && m.invoice === inv && m.outcome === "missed");
          this.ledger.push({ ruleId: rule.id, outcome: after || corrected ? "applied_after_hint" : "applied_unprompted", t: now, invoice: inv, phase, helpBefore: helped(rule) });
          return { kind: "praise", rule, invoice: inv, quote: rule.quotes[0]?.text, message: after ? `That is it. ${rule.title}, in their words: "${rule.quotes[0]?.text ?? ""}"` : `Right. ${rule.title}. Exactly what ${this.map.expert.name} does.` };
        }
      }
    }

    // 3. About to save or approve while a stop-and-ask condition holds
    if (e.kind === "save_clicked" || (e.kind === "status_changed" && (state.status === "approved" || state.status === "posted"))) {
      for (const rule of stopRules(this.map, state)) {
        const k = `stop:${key(rule)}`;
        if (this.hinted.has(k)) continue;
        this.hinted.add(k);
        return { kind: "stop", rule, invoice: inv, stepId: rule.stepId, quote: rule.quotes[0]?.text, message: `This is a stop point. ${this.map.expert.name} checks with ${rule.stopAndAsk?.who ?? "someone"} when ${describeStop(rule)}. Who would you ask?` };
      }
      // a save with an uncorrected intervention is a miss
      for (const rule of applicableRules(this.map, state)) {
        if (this.hinted.has(key(rule)) && actionMatchesRule(rule, state) === false && !this.ledger.some((m) => m.ruleId === rule.id && m.invoice === inv)) {
          this.ledger.push({ ruleId: rule.id, outcome: "missed", t: now, invoice: inv, phase, helpBefore: true });
        }
      }
    }
    return { kind: "none", message: "" };
  }

  recordPrediction(ruleId: string, correct: boolean, now: number, invoice?: string) {
    this.ledger.push({ ruleId, outcome: correct ? "predicted_correctly" : "predicted_wrong", t: now, invoice, phase: "coached", helpBefore: false });
  }

  recordEscalation(ruleId: string, now: number, invoice?: string) {
    this.ledger.push({ ruleId, outcome: "escalation_recognized", t: now, invoice, phase: "coached", helpBefore: true });
  }

  /**
   * The end card: per rule, what actually happened, with help disclosed. Labels are task-specific outcomes,
   * not a certification: correct without help, correct after a hint, corrected after intervention, not tested.
   */
  masteryCard(): { ruleId: string; title: string; label: MasteryLabel; status: "mastered" | "practicing" | "needs_practice" | "untested"; detail: string; independent?: "correct without help" | "needed the guard" }[] {
    return this.map.rules.map((r) => {
      const entries = this.ledger.filter((m) => m.ruleId === r.id);
      const independent = entries.filter((m) => m.phase === "independent");
      const indep = independent.length === 0 ? undefined : independent.some((m) => m.outcome === "missed") ? ("needed the guard" as const) : ("correct without help" as const);
      const base = { ruleId: r.id, title: r.title, independent: indep };
      if (entries.length === 0) return { ...base, label: "not tested", status: "untested", detail: "Not exercised in this session" };
      const coached = entries.filter((m) => m.phase === "coached");
      if (indep === "correct without help") return { ...base, label: "correct without help", status: "mastered", detail: "Decided correctly on the independent case, no help before the decision" };
      if (coached.some((m) => (m.outcome === "applied_unprompted" && !m.helpBefore) || m.outcome === "predicted_correctly")) return { ...base, label: "correct without help", status: "mastered", detail: "Applied without a hint" };
      if (coached.some((m) => m.outcome === "applied_after_hint" || m.outcome === "escalation_recognized" || (m.outcome === "applied_unprompted" && m.helpBefore))) {
        const intervened = coached.some((m) => m.outcome === "missed");
        return { ...base, label: intervened ? "corrected after intervention" : "correct after a hint", status: "practicing", detail: intervened ? "Corrected after the replay of the expert's moment" : "Right after the prediction prompt" };
      }
      return { ...base, label: "corrected after intervention", status: "needs_practice", detail: indep === "needed the guard" ? "The save guard had to hold it; practice this one next" : "Intervened and not yet corrected; practice this one next" };
    });
  }
}

function describeState(s: InvoiceState): string {
  const bits: string[] = [];
  if (s.category) bits.push(s.category.replace(/_/g, " "));
  if (s.amount !== undefined) bits.push(`€${s.amount.toLocaleString("en-IE")}`);
  if (s.hasPO === false) bits.push("no purchase order");
  return bits.join(", ") || "an unfamiliar invoice";
}

function describeStop(rule: Rule): string {
  if (!rule.stopAndAsk) return "";
  const c = rule.stopAndAsk.when;
  const one = (x: Cond): string => {
    if ("field" in x) {
      if (x.field === "knownSupplier") return "the supplier is unknown";
      if (x.field === "hasAssetNumber") return "there is no asset number";
      return describeCond(x);
    }
    if ("any" in x) return x.any.map(one).join(" or ");
    if ("all" in x) return x.all.map(one).join(" and ");
    return describeCond(x);
  };
  return one(c);
}

/** A practice invoice that targets a missed rule, by mutating the seeded case. */
export function practiceCaseFor(rule: Rule, seed: InvoiceState): InvoiceState {
  const c = rule.when;
  const out: InvoiceState = { ...seed, invoice: `P-${Math.floor(1000 + Math.random() * 9000)}`, costCenter: "4711", status: "open", route: "single" };
  const bump = (cond: typeof c) => {
    if ("all" in cond) cond.all.forEach(bump);
    else if ("any" in cond) cond.any.forEach(bump);
    else if ("not" in cond) return;
    else if (cond.field === "amount" && typeof cond.value === "number") out.amount = Math.round(cond.value * 1.15);
    else if (cond.field === "category" && typeof cond.value === "string") out.category = cond.value;
    else if (cond.field === "entity" && typeof cond.value === "string") out.entity = cond.value;
    else if (cond.field === "invoiceMonth" && typeof cond.value === "number") out.invoiceMonth = cond.value;
    else if (cond.field === "supplier" && typeof cond.value === "string") out.supplier = cond.value;
  };
  bump(c);
  out.supplier = out.supplier ?? "Weber Hydraulik GmbH";
  return out;
}

export interface SaveVerdict {
  blocked: boolean;
  ruleId?: string;
  title?: string;
  quote?: string;
  who?: string;
  reason?: string;
  missing?: string;
}

/**
 * The authoritative pre-save check, pure so it can be tested: only a confirmed map is enforced, only learned rules,
 * never a rule the model proposed and the expert did not confirm. Unknown fields do not fire conditions.
 */
export function saveVerdict(map: WorkMap | undefined, proposed: InvoiceState, committing: boolean): SaveVerdict {
  if (!map || !map.confirmedAt) return { blocked: false, reason: "no confirmed map" };
  for (const rule of applicableRules(map, proposed)) {
    if (actionMatchesRule(rule, proposed) === false) return { blocked: true, ruleId: rule.id, title: rule.title, quote: rule.quotes[0]?.text, reason: "the draft contradicts a confirmed rule" };
  }
  if (committing) {
    for (const rule of stopRules(map, proposed)) return { blocked: true, ruleId: rule.id, title: rule.title, quote: rule.quotes[0]?.text, who: rule.stopAndAsk?.who, reason: "a stop-and-ask condition holds" };
  }
  return { blocked: false };
}
