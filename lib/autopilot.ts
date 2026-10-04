/**
 * Autopilot: "people first, then agents", made tangible.
 * Walks a queue of invoices with the compiled policy, applies routine rules through the ERP API,
 * and halts the moment a stop-and-ask condition holds or a judgment has no rule.
 */
import { toInvoiceState, type Invoice, type InvoicePatch } from "./erp";
import { applicableRules, stopRules } from "./matcher";
import { describeCond, type WorkMap } from "./workmap";

export interface AutopilotStep {
  invoice: string;
  supplier: string;
  amount: number;
  outcome: "applied" | "posted" | "halted" | "flagged";
  ruleTitle?: string;
  action?: InvoicePatch;
  reason: string;
  quote?: string;
  who?: string;
}

export function planInvoice(map: WorkMap, inv: Invoice): AutopilotStep {
  const state = toInvoiceState(inv);
  const base = { invoice: inv.id, supplier: inv.supplier, amount: inv.amount };
  // 1. stop conditions come first, always
  const stops = stopRules(map, state);
  if (stops.length) {
    const r = stops[0];
    return { ...base, outcome: "halted", ruleTitle: r.title, who: r.stopAndAsk?.who, reason: `Stop: ${describeCond(r.stopAndAsk!.when)}. ${r.stopAndAsk?.who ? `${map.expert.name} asks ${r.stopAndAsk.who} here.` : "Who to ask is unresolved."}`, quote: r.quotes[0]?.text };
  }
  // 2. novel case: no rule and not routine
  const isNovel = inv.category === "credit_note" || inv.amount < 0 || !inv.hasPO;
  if (isNovel) return { ...base, outcome: "flagged", reason: `No rule covers this case (${inv.category.replace(/_/g, " ")}). Flagged for ${map.expert.name}.` };
  // 3. apply the rules whose conditions hold
  const rules = applicableRules(map, state);
  const patch: InvoicePatch = {};
  const titles: string[] = [];
  for (const r of rules) {
    if ("set" in r.then && r.then.set.costCenter) patch.costCenter = r.then.set.costCenter;
    if ("route" in r.then) patch.route = r.then.route as Invoice["route"];
    if ("status" in r.then) patch.status = r.then.status as Invoice["status"];
    titles.push(r.title);
  }
  if (rules.length) {
    const held = patch.status === "hold";
    if (!held && !patch.status) patch.status = "posted";
    return { ...base, outcome: held ? "applied" : "posted", ruleTitle: titles.join("; "), action: patch, reason: held ? `Held per rule: ${titles.join("; ")}` : `Applied: ${titles.join("; ")}, then posted`, quote: rules[0].quotes[0]?.text };
  }
  // 4. routine: nothing to decide, post it
  return { ...base, outcome: "posted", action: { status: "posted" }, reason: "Routine invoice, no judgment call. Posted." };
}
