import { extractThresholds } from "../curiosity";
import type { Quote, WorkMap } from "../workmap";
import { monthCondOf } from "./fill";

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
