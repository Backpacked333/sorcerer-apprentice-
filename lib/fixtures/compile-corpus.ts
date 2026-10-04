/** TEST ONLY. All text/context is synthetic, including appendix examples; never human-recorded or provider-verified. */
import type { CompileFixture, CorpusContext, CorpusGroup, CorpusRow, FixtureOptions } from "./compile-corpus.types";

export const corpusOracle = "docs/lanes/C-map-and-teach-brain.md";
export const corpusOutcomeMeaning = {
  RULE: "A rule must result and behave as described.",
  SLOT: "No runnable rule; an open question remains.",
  EITHER: "Rule or slot is acceptable, but the oracle's never clause must hold.",
} as const;

const threshold: CorpusContext = { phase: "capture", decision: "costCenter", state: { amount: 7850, category: "equipment" }, observed: "Cost center changed from opex to capex (0400).", suppliers: [] };
const approval: CorpusContext = { phase: "capture", decision: "route", state: { supplier: "Novak", entity: "subsidiary", category: "freight", amount: 320 }, observed: "Route changed from single to second_approval.", suppliers: ["Novak", "Other Parent Supplier"] };
const hold: CorpusContext = { phase: "capture", decision: "status", state: { supplier: "Bäcker Elektrotechnik", invoiceMonth: 12 }, observed: "Status changed from open to hold.", suppliers: ["Bäcker Elektrotechnik", "Other Supplier"] };
const correction: CorpusContext = { ...hold, phase: "correction", prior: "Three rules: equipment amount > 5000 to capex; subsidiary to second approval; every supplier in December to hold. Replay includes equipment at 7850. No software seen." };
const debrief: CorpusContext = { ...hold, phase: "debrief", slot: "any", prior: "An open slot on the hold decision; no answer yet." };

function rows(group: CorpusGroup, context: CorpusContext, entries: readonly CorpusRow[]): CompileFixture[] {
  return entries.map(([id, utterance, outcome, oracle, options = {}]) => {
    const { context: extraContext, evidenceInput, ...expected } = options;
    return {
      id, caseId: id.split("-")[0], group, utterance, provenance: "synthetic", humanRecorded: false, liveProviderVerified: false,
      context: { ...context, ...extraContext },
      evidence: { speaker: "expert", redacted: false, offRecord: false, questionEcho: false, ...evidenceInput },
      expected: { outcome, oracle, ...expected },
    };
  });
}

const exclusive: FixtureOptions = { boundary: { value: 5000, operator: "exclusive" }, probes: [{ state: { amount: 5000 }, fires: false }, { state: { amount: 5001 }, fires: true }] };
const inclusive: FixtureOptions = { boundary: { value: 5000, operator: "inclusive" }, probes: [{ state: { amount: 4999 }, fires: false }, { state: { amount: 5000 }, fires: true }] };
const equipmentOnly = { state: { category: "maintenance", amount: 5001 }, fires: false };
const supplierDecember: FixtureOptions = { probes: [{ state: { supplier: "Bäcker Elektrotechnik", invoiceMonth: 12 }, fires: true }, { state: { supplier: "Other Supplier", invoiceMonth: 12 }, fires: false }, { state: { supplier: "Bäcker Elektrotechnik", invoiceMonth: 11 }, fires: false }] };

export const compileCorpus: readonly CompileFixture[] = [
  ...rows("A", threshold, [
    ["A1", "Equipment over five thousand is always capex.", "RULE", "RULE: fires on equipment at 5 001, not at 5 000, not on non-equipment", { ...exclusive, probes: [...exclusive.probes!, equipmentOnly] }],
    ["A2", "The limit is 5,000 euros. Above that it's an asset, so it goes on 0400.", "RULE", "RULE: number 5 000; boundary slot open", { boundary: { value: 5000, operator: "unresolved" } }],
    ["A3", "€5,000 or more goes to capex.", "RULE", "RULE: fires at exactly 5 000", inclusive],
    ["A4", "It's 7,850, that's above our 5,000 limit, so capex.", "RULE", "RULE: threshold 5 000, never the invoice's own amount"],
    ["A5", "This one is seven thousand eight hundred, and anything over five thousand is capex.", "RULE", "RULE: fires at 5 500", { context: { state: { ...threshold.state, amount: 7800 } }, probes: [{ state: { amount: 5500 }, fires: true }] }],
    ["A6", "Machines from five k upwards we capitalise.", "RULE", "RULE: inclusive at 5 000, equipment only", { ...inclusive, probes: [...inclusive.probes!, equipmentOnly] }],
    ["A7", "From 5.000 euros it's a fixed asset.", "RULE", "RULE: 5 000 (European format), inclusive", inclusive],
    ["A8", "Anything north of five grand that's a machine is an investment, not maintenance.", "RULE", "RULE: exclusive, equipment only", { ...exclusive, probes: [...exclusive.probes!, equipmentOnly] }],
    ["A9", "We capitalise equipment once it's more than 5000 net, below that it's just expensed.", "RULE", "RULE: exclusive at 5 000", exclusive],
    ["A10", "Under five thousand stays opex, everything else is capex if it's equipment.", "RULE", "RULE: fires at 5 000", inclusive],
    ["A11", "equipment over 5000 is always cap ex", "RULE", "RULE as A1", { sameAs: "A1", ...exclusive }],
    ["A12", "It's a fixed asset, so capex.", "EITHER", "EITHER; never a numeric threshold"],
    ["A13", "That one is capex, it is a spindle.", "EITHER", "EITHER; never a numeric threshold; limit slot open if a rule exists"],
    ["A14", "Because it's expensive.", "SLOT", "SLOT"],
  ]),
  ...rows("B", approval, [
    ["B1", "Anything from a subsidiary needs a second signature.", "RULE", "RULE: fires on any subsidiary invoice, not on parent", { probes: [{ state: { entity: "subsidiary" }, fires: true }, { state: { entity: "parent" }, fires: false }] }],
    ["B2", "It's intercompany, so four eyes.", "RULE", "RULE: fires on the subsidiary case, not on parent"],
    ["B3", "Novak is a sister company, those never go through on one approval.", "RULE", "RULE: fires on that supplier's subsidiary invoice; never on parent"],
    ["B4", "That's one of our affiliates. Affiliates always get the group controller's sign-off as well.", "RULE", "RULE; `who` only as she said it"],
    ["B5", "It belongs to the group, so I can't approve it on my own.", "RULE", "RULE"],
    ["B6", "Group companies need two approvals, mine isn't enough.", "RULE", "RULE"],
    ["B7", "Czech subsidiary. Second approval, always, doesn't matter how small.", "RULE", "RULE with no amount condition"],
    ["B8", "Because the amount is small I could do it alone, but it's from our own subsidiary, so no.", "RULE", "RULE on entity; no amount condition"],
    ["B9", "Freight from Novak always goes to Markus too.", "RULE", "RULE scoped to that supplier (category optional); never on parent suppliers"],
    ["B10", "A daughter company, so the controller has to countersign.", "RULE", "RULE"],
    ["B11", "anything from a subsidy area gets a second approval", "EITHER", "EITHER; never a rule on a field she did not mean"],
    ["B12", "I always add a second approval on these.", "SLOT", "SLOT"],
    ["B13", "It needs a second pair of eyes.", "SLOT", "SLOT"],
  ]),
  ...rows("C", hold, [
    ["C1", "Bäcker double-bills every December, so this one waits until I've matched it against November.", "RULE", "RULE: fires on that supplier in December; not on another supplier in December", supplierDecember],
    ["C2", "They always double invoice in December, so I never pay a December one from them until it's matched.", "RULE", 'RULE as C1 ("they" binds to the supplier on screen)', { sameAs: "C1" }],
    ["C3", "Every Dec these guys bill us double — hold.", "RULE", "RULE as C1", { sameAs: "C1" }],
    ["C4", "Becker, December. They double bill every December.", "RULE", "RULE: supplier resolved to the on-screen name"],
    ["C5", "Baker Elektrotechnik has a habit of invoicing the same job twice around Christmas.", "RULE", "RULE: supplier resolved; month 12 or limit slot open"],
    ["C6", "This supplier sends everything twice at year end. I park it until I've checked last month's.", "RULE", "RULE on that supplier; month 12 or limit slot open"],
    ["C7", "It's dated the second of December and it's Bäcker — with them I wait in December.", "RULE", "RULE as C1", { sameAs: "C1" }],
    ["C8", "In the twelfth month this vendor is on my watch list, last year they billed us twice for the same maintenance.", "RULE", "RULE as C1", { sameAs: "C1" }],
    ["C9", "Not before I've compared it with the November invoice — Bäcker does this every year in December.", "RULE", "RULE as C1", { sameAs: "C1" }],
    ["C10", "December invoices get held until matched.", "RULE", "RULE on month only; supplier-scope slot open (she said it broadly)", { probes: [{ state: { supplier: "Other Supplier", invoiceMonth: 12 }, fires: true }] }],
    ["C11", "I hold this one.", "SLOT", "SLOT"],
    ["C12", "Because of duplicates.", "SLOT", "SLOT"],
    ["C13", "Hold, it's a double.", "SLOT", "SLOT"],
  ]),
  ...rows("K", correction, [
    ["K1", "Not every supplier — only Bäcker.", "PATCH", "hold rule gains the supplier condition; other rules untouched", supplierDecember],
    ["K2", "No, only Becker.", "PATCH", "same as K1 after resolution", { sameAs: "K1" }],
    ["K3", "No, only when it's Baker.", "PATCH", 'same as K1; never a condition on the word "when"', { sameAs: "K1" }],
    ["K4", "It's from five thousand, not over.", "PATCH", "threshold rule becomes inclusive; number unchanged", { ...inclusive, context: { ...threshold, phase: "correction" } }],
    ["K5", "No, the threshold is 10.000.", "REJECT", "rejected by replay (her own invoice would no longer fit); specific spoken reply; map unchanged", { context: { ...threshold, phase: "correction" } }],
    ["K6", "Not only equipment, software too.", "NOTE", "hold rule untouched; threshold rule unchanged (value not on this screen); her words kept as a described exception"],
    ["K7", "The group controller signs, not me.", "GUARDRAIL", "no condition changes; escalation guardrail with her words"],
    ["K8", "Yes, but I also hold Bäcker in January.", "PATCH", "hold rule fires in months 12 and 1 for that supplier; not treated as a plain yes", { context: { prior: "Three rules: equipment amount > 5000 to capex; subsidiary to second approval; Bäcker Elektrotechnik in December to hold." }, probes: [{ state: { invoiceMonth: 1 }, fires: true }, { state: { invoiceMonth: 12 }, fires: true }, { state: { supplier: "Other Supplier", invoiceMonth: 1 }, fires: false }] }],
    ["K9", "Hmm, that's not quite it.", "UNCHANGED", '`changed: false`; "I did not catch what to change"'],
    ["K10-a", "Yes, that's how it works.", "CONFIRM", "confirmation"],
    ["K10-b", "Mhm, yes.", "CONFIRM", "confirmation"],
    ["K11-a", "Mhm.", "REASK", 'not a confirmation; one re-ask ("is that a yes?")'],
    ["K11-b", "Okay.", "REASK", 'not a confirmation; one re-ask ("is that a yes?")'],
  ]),
  ...rows("D", debrief, [
    ["D1", "No no, just Becker. Everyone else goes through as normal.", "PATCH", "supplier condition added, resolved", { context: { slot: "limit (hold)", prior: correction.prior }, ...supplierDecember }],
    ["D2", "Me or the AP lead, once it's matched against November.", "GUARDRAIL", "escalation guardrail; `who` verbatim; no stop condition", { context: { slot: "escalation (hold)" } }],
    ["D3", "Hmm, not sure, skip that one.", "SKIPPED", "`skipped`; no quote, no guardrail"],
    ["D4", "I don't know, I'd have to check.", "SKIPPED", "`skipped`"],
    ["D5", "Never post without one. It goes back to whoever ordered it.", "NOTE", "note under the no-PO topic with her words", { context: { decision: "noPO", state: { hasPO: false }, observed: "No-PO case raised as a novel topic; no action observed.", slot: "novel (no PO)", prior: "Open no-PO topic; no runnable policy yet." } }],
    ["D6", "Well this one was 7.850, and anything above 5.000 is an asset.", "RULE", "rule created in the debrief: threshold 5 000, exclusive", { ...exclusive, context: { ...threshold, phase: "debrief", slot: "trigger (threshold)", prior: "No threshold rule yet; trigger slot open." } }],
    ["D7", "Strictly over. Five thousand flat is still opex. And it's the net amount.", "GUARDRAIL", "operator stays exclusive; guardrail with her words", { ...exclusive, context: { ...threshold, phase: "debrief", slot: "limit (threshold)", prior: "Equipment amount > 5000 goes to capex; limit slot open." } }],
    ["D8", "Can we do this later? I have a call.", "SKIPPED", "`skipped`"],
    ["D9-a", "That is all.", "THIN", "`thin`: nothing stored in the map; one follow-up; then `skipped`"],
    ["D9-b", "Yeah, that's it.", "THIN", "`thin`: nothing stored in the map; one follow-up; then `skipped`"],
  ]),
  ...rows("variation", threshold, [
    ["V1", "Equipment over 6,275 goes to capex.", "RULE", "Exclusive threshold 6275, never the on-screen amount 9100 or appendix limit 5000.", { context: { state: { category: "equipment", amount: 9100 } }, boundary: { value: 6275, operator: "exclusive" }, probes: [{ state: { amount: 6275 }, fires: false }, { state: { amount: 6276 }, fires: true }] }],
    ["V2", "Equipment from 3,240 upwards goes to capex.", "RULE", "Inclusive threshold 3240, never the on-screen amount 4600 or appendix limit 5000.", { context: { state: { category: "equipment", amount: 4600 } }, boundary: { value: 3240, operator: "inclusive" }, probes: [{ state: { amount: 3239 }, fires: false }, { state: { amount: 3240 }, fires: true }] }],
    ["V3", "Lumen Forge double-bills every March, so I hold their March invoices until matched.", "RULE", "Hold Lumen Forge in month 3; not another supplier in March, nor Lumen Forge in December.", { context: { ...hold, state: { supplier: "Lumen Forge", invoiceMonth: 3 }, suppliers: ["Lumen Forge", "Tern Parts"] }, probes: [{ state: { invoiceMonth: 3 }, fires: true }, { state: { supplier: "Tern Parts", invoiceMonth: 3 }, fires: false }, { state: { invoiceMonth: 12 }, fires: false }] }],
    ["V4", "Freight from Tern Parts always goes to Imani too.", "RULE", "Second approval scoped to Tern Parts; who is Imani verbatim, never Markus; not parent suppliers.", { context: { ...approval, state: { ...approval.state, supplier: "Tern Parts" }, suppliers: ["Tern Parts", "Lumen Forge"] } }],
  ]),
  ...rows("adverse", threshold, [
    ["E1", "Equipment over 6275 always goes to capex.", "SLOT", "Reject agent-only text as evidence; no runnable rule or expert quote; leave the trigger slot open.", { evidence: "reject", evidenceInput: { speaker: "agent" } }],
    ["E2", "Equipment over 6275 always goes to capex.", "SLOT", "Reject redacted expert text even if it states a trigger; no rule or quote; leave the trigger slot open.", { evidence: "reject", evidenceInput: { redacted: true } }],
    ["E3", "Equipment over 6275 always goes to capex.", "SLOT", "Reject off-record expert text; no rule or quote; leave the trigger slot open.", { evidence: "reject", evidenceInput: { offRecord: true } }],
    ["E4", "Does equipment over 6275 go to capex?", "SLOT", "Reject the echoed question as an expert answer; no rule or quote; leave the trigger slot open.", { evidence: "reject", evidenceInput: { questionEcho: true, question: "Does equipment over 6275 go to capex?" } }],
  ]),
];
