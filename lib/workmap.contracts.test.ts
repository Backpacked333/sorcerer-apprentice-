import { describe, expect, it } from "vitest";
import { saveVerdict, type SaveVerdict } from "./matcher";
import { generateTeachback } from "./teachback";
import { emptyMap, QuoteSchema, RuleSchema, WorkMapSchema, type Quote, type Rule } from "./workmap";

const quote: Quote = { text: "Freight needs a second approval.", t: 12, source: "live" };
const rule: Rule = {
  id: "contract-rule", title: "Freight approval", when: { field: "category", op: "==", value: "freight" },
  then: { route: "second_approval" }, quotes: [quote], confidence: "medium", confirmedBy: ["live"],
  stopAndAsk: { who: "the reviewer", when: { field: "hasPO", op: "==", value: false } },
};

describe("pre-approved WorkMap contract compatibility", () => {
  it("round-trips old stored maps without inventing evidence or seen state", () => {
    const map = emptyMap("legacy", "Review invoices", "Expert");
    map.rules = [rule];
    map.notes = [{ topic: "freight", question: "What happens?", quote }];
    const parsed = WorkMapSchema.parse(JSON.parse(JSON.stringify(map)));
    expect(parsed).toEqual(map);
    expect(parsed).not.toHaveProperty("seen");
    expect(parsed.rules[0].quotes[0]).not.toHaveProperty("evidence");
    expect(parsed.rules[0].stopAndAsk).not.toHaveProperty("quote");
  });

  it.each(["demonstrated", "described"] as const)("preserves %s evidence and an independent stop quote", (evidence) => {
    const mainQuote = { ...quote, evidence };
    const stopQuote: Quote = { text: "If the purchase order is missing, stop.", t: 19, source: "counterfactual", evidence: "described" };
    const map = emptyMap("new", "Review invoices", "Expert");
    map.rules = [{ ...rule, quotes: [mainQuote], stopAndAsk: { when: rule.stopAndAsk!.when, quote: stopQuote } }];
    map.seen = { categories: ["freight"], entities: ["branch"], suppliers: ["Tern Parts"] };
    const parsed = WorkMapSchema.parse(JSON.parse(JSON.stringify(map)));
    expect(parsed).toEqual(map);
    expect(parsed.rules[0].stopAndAsk).not.toHaveProperty("who");
    expect(parsed.rules[0].quotes).toEqual([mainQuote]);
    expect(parsed.rules[0].stopAndAsk?.quote).toEqual(stopQuote);
  });

  it("retains the old rule defaults and named recipient", () => {
    const parsed = RuleSchema.parse({ id: rule.id, title: rule.title, when: rule.when, then: rule.then, stopAndAsk: rule.stopAndAsk });
    expect(parsed).toMatchObject({ confidence: "medium", confirmedBy: [], quotes: [], stopAndAsk: { who: "the reviewer" } });
    expect(QuoteSchema.parse(quote)).toEqual(quote);
  });

  it("distinguishes unrecorded seen state from an explicitly empty observation set", () => {
    const map = emptyMap("seen", "Review invoices", "Expert");
    expect(WorkMapSchema.parse(map).seen).toBeUndefined();
    map.seen = { categories: [], entities: [], suppliers: [] };
    expect(WorkMapSchema.parse(map).seen).toEqual(map.seen);
    expect(WorkMapSchema.safeParse({ ...map, seen: { categories: [] } }).success).toBe(false);
    expect(WorkMapSchema.safeParse({ ...map, seen: { ...map.seen, suppliers: [12] } }).success).toBe(false);
  });

  it("still rejects malformed evidence, recipients and stop conditions", () => {
    expect(QuoteSchema.safeParse({ ...quote, evidence: "assumed" }).success).toBe(false);
    expect(RuleSchema.safeParse({ ...rule, stopAndAsk: { who: 12, when: rule.when } }).success).toBe(false);
    expect(RuleSchema.safeParse({ ...rule, stopAndAsk: { quote } }).success).toBe(false);
    expect(RuleSchema.safeParse({ ...rule, stopAndAsk: { when: rule.when, quote: { ...quote, evidence: "assumed" } } }).success).toBe(false);
  });

  it("permits a missing-condition explanation without changing old verdict callers", () => {
    const legacy: SaveVerdict = { blocked: false };
    const extended: SaveVerdict = { blocked: true, missing: "A purchase order is required." };
    expect(legacy).not.toHaveProperty("missing");
    expect(extended.missing).toBe("A purchase order is required.");
  });

  it("keeps an unnamed stop guarded without inventing a recipient", () => {
    const map = emptyMap("guard", "Review invoices", "Expert");
    map.rules = [RuleSchema.parse({ ...rule, stopAndAsk: { when: rule.stopAndAsk!.when } })];
    const state = { category: "freight", route: "second_approval", hasPO: false };
    expect(saveVerdict(map, state, true).blocked).toBe(false);
    map.confirmedAt = 1;
    const verdict = saveVerdict(map, state, true);
    expect(verdict.blocked).toBe(true);
    expect(verdict.who).toBeUndefined();
    const teachback = generateTeachback(map).text;
    expect(teachback).toContain("Who to ask is still unresolved.");
    expect(teachback).not.toContain("undefined");
  });

  it("preserves the existing teach-back wording for a named stop", () => {
    const map = emptyMap("named", "Review invoices", "Expert");
    map.rules = [rule];
    expect(generateTeachback(map).text).toContain("You stop and ask the reviewer when purchase order is false.");
  });
});
