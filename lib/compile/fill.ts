import { type Cond, type Quote, type Rule, type WorkMap, uid } from "../workmap";
import { UNSEEN_CASES } from "./slots";

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
export function monthCondOf(rule: Rule): Cond {
  const find = (c: Cond): Cond | undefined => ("all" in c ? c.all.map(find).find(Boolean) : "any" in c ? c.any.map(find).find(Boolean) : "not" in c ? undefined : c.field === "invoiceMonth" ? c : undefined);
  return find(rule.when) ?? { field: "invoiceMonth", op: "exists" };
}
