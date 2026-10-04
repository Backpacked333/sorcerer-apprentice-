import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { emptySession } from "./events";
import { emptyMap } from "./workmap";
import { refineWithLLM } from "./compile/rules-llm";

const { generate } = vi.hoisted(() => ({ generate: vi.fn() }));
vi.mock("ai", () => ({ generateText: generate, Output: { object: (o: unknown) => o } }));
beforeEach(() => { vi.stubEnv("AI_GATEWAY_API_KEY", "mock"); generate.mockReset(); });
afterEach(() => vi.unstubAllEnvs());
function fixture() {
  const log = emptySession("compile_test", "capture", "Review shipments", "Expert");
  log.transcript = [{ id: "t", t: 1, speaker: "expert", final: true, text: "If there is no PO, I hold it." }];
  const draft = emptyMap(log.id, log.task, log.expertName);
  draft.steps = [{ id: "s", index: 0, title: "Hold", screenMoment: { t: 1 }, action: { type: "hold" }, decision: "Hold", judgment: true, guardrails: [], confidence: "medium" }];
  const rule = { stepId: "s", title: "No PO", when: '{"field":"hasPO","op":"==","value":false}', then: '{"status":"hold"}', unless: null, stopAndAsk: null, quoteTexts: [log.transcript[0].text], confidence: "medium" };
  return { log, draft, rule };
}
describe("Gateway rule boundary", () => {
  it("uses a flat wire schema, validates JSON conditions locally, and preserves exact quotes", async () => {
    const { log, draft, rule } = fixture();
    generate.mockResolvedValue({ output: { rules: [rule], stepReasons: [], guardrails: [], slots: [] } });
    const result = await refineWithLLM(log, draft);
    expect(result.used).toBe(true); expect(result.map.rules[0].when).toEqual({ field: "hasPO", op: "==", value: false });
    expect(result.map.rules[0].quotes[0].text).toBe(log.transcript[0].text);
    const call = generate.mock.calls[0][0];
    expect(call).toMatchObject({ reasoning: "high", maxRetries: 0, timeout: { totalMs: 25000 } });
    expect(JSON.stringify(z.toJSONSchema(call.output.schema))).not.toContain('"$ref"');
    expect(draft.rules).toEqual([]);
  });
  it("rejects malformed conditions and agent, partial, withdrawn or paraphrased evidence", async () => {
    const { log, draft, rule } = fixture();
    log.transcript.push({ ...log.transcript[0], id: "agent", speaker: "agent", text: "All shipments go on hold." });
    generate.mockResolvedValue({ output: { rules: [
      { ...rule, when: "not JSON" }, { ...rule, quoteTexts: ["All shipments go on hold."] },
      { ...rule, quoteTexts: ["if there is no po, i hold it."] },
    ], stepReasons: [], guardrails: [], slots: [] } });
    expect((await refineWithLLM(log, draft)).map.rules).toEqual([]);
    expect(generate.mock.calls[0][0].prompt).not.toContain("All shipments go on hold.");
    log.offRecord = [{ from: 0, to: 2 }];
    generate.mockResolvedValue({ output: { rules: [rule], stepReasons: [], guardrails: [], slots: [] } });
    expect((await refineWithLLM(log, draft)).map.rules).toEqual([]);
  });
});
