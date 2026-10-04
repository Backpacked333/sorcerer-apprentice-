import type { TranscriptSegment } from "../events";
import { extractThresholds } from "../curiosity";
import { type Cond, type Quote, type Rule, type Step, uid } from "../workmap";
import { confirmedByOf } from "./evidence";

export const COST_CENTER_LABEL: Record<string, string> = { "4711": "opex", "0400": "capex", "4120": "opex freight", "4300": "opex facilities", "4050": "opex consumables" };

function allQuotes(step: Step): Quote[] {
  return [step.reason, ...step.guardrails.map((g) => g.quote)].filter(Boolean) as Quote[];
}

export function deriveRules(steps: Step[], transcript: TranscriptSegment[], invoiceMonths: Map<string, number> = new Map()): Rule[] {
  void transcript;
  const rules: Rule[] = [];
  const said = (step: Step) => allQuotes(step).map((q) => q.text.toLowerCase()).join(" ");
  const everySupplier = (t: string) => /\b(every|all|any) supplier/.test(t) && !/\b(not|only)\b/.test(t);

  for (const step of steps) {
    if (!step.judgment) continue;
    const text = said(step);
    const quotes = allQuotes(step);
    const confirmedBy = confirmedByOf(quotes);
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
