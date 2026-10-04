import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { compileDeterministic } from "./steps";
import { refineWithLLM } from "./rules-llm";
import { emptySession } from "../events";

const { generate } = vi.hoisted(() => ({ generate: vi.fn() }));
vi.mock("ai", () => ({ generateText: generate, Output: { object: (o: unknown) => o } }));

const quote = "The expert uses the cost center for this invoice.";
const validWhen = { anyOf: [{ allOf: [{ field: "amount", op: ">", value: 1000 }] }] };
const validThen = { kind: "set", field: "costCenter", value: "2000" };

const rule = (stepId: string, title: string, quoteTexts: string[], when = validWhen) => ({
  stepId, title, when, then: validThen, unless: null, stopAndAsk: null, quoteTexts, confidence: "high",
});

const output = (rules: unknown[]) => ({ rules, guardrails: [], slots: [], stepReasons: [] });

function fixture() {
  const log = emptySession("rules-llm-test", "capture", "Review invoices", "Expert");
  log.events.push({ id: "event-1", t: 1, source: "dom", kind: "field_changed", invoice: "4471", field: "costCenter", from: "1000", to: "2000" });
  log.transcript.push({ id: "transcript-1", t: 2, text: quote, speaker: "expert", final: true });
  return { log, draft: compileDeterministic(log) };
}

beforeEach(() => {
  vi.stubEnv("AI_GATEWAY_API_KEY", "mock-only-not-a-key");
  generate.mockReset();
});

afterEach(() => vi.unstubAllEnvs());

describe("refineWithLLM rejected rule notes", () => {
  it("accepts all valid proposed rules without adding a note", async () => {
    const { log, draft } = fixture();
    generate.mockResolvedValue({ output: output([rule(draft.steps[0].id, "Valid rule", [quote])]) });

    const result = await refineWithLLM(log, draft);

    expect(result.used).toBe(true);
    expect(result.map.rules).toHaveLength(1);
    expect(result.map.rules[0].title).toBe("Valid rule");
    expect(result).not.toHaveProperty("note");
  });

  it("reports each rejected rule while keeping valid rules", async () => {
    const { log, draft } = fixture();
    generate.mockResolvedValue({
      output: output([
        rule(draft.steps[0].id, "Valid rule", [quote]),
        rule("missing-step", "Unknown step", [quote]),
        rule(draft.steps[0].id, "Missing quote", ["not in transcript"]),
        rule(draft.steps[0].id, "Empty trigger", [quote], { anyOf: [] }),
      ]),
    });

    const result = await refineWithLLM(log, draft);

    expect(result.used).toBe(true);
    expect(result.map.rules.map(({ title }) => title)).toEqual(["Valid rule"]);
    expect(result.note).toBe('Rejected 3 of 4 proposed rules ("Unknown step": unknown step missing-step; "Missing quote": 1 of 1 quotes not found verbatim; "Empty trigger": Empty rule trigger)');
  });

  it("keeps deterministic draft rules when every proposal is invalid", async () => {
    const { log, draft } = fixture();
    generate.mockResolvedValue({ output: output([rule("missing-step", "Unknown step", [quote])]) });

    const result = await refineWithLLM(log, draft);

    expect(result.used).toBe(true);
    expect(result.map.rules).toEqual(draft.rules);
    expect(result.note).toMatch(/; kept deterministic draft rules$/);
  });
});
