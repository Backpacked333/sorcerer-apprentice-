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
  const rule = { stepId: "s", title: "No PO", when: { anyOf: [{ allOf: [{ field: "hasPO", op: "==", value: false }] }] }, then: { kind: "status", field: null, value: "hold" }, unless: null, stopAndAsk: null, quoteTexts: [log.transcript[0].text], confidence: "medium" };
  return { log, draft, rule };
}
describe("Gateway rule boundary", () => {
  it.each([1.5, 3])("retains grounded multi-span provenance, including finalization after closedAt=%s", async (closedAt) => {
    const { log, draft, rule } = fixture();
    log.transcript.push({ id: "t2", t: 2, speaker: "expert", final: true, text: "Then I ask the buyer for the PO." });
    const answerText = log.transcript.map((s) => s.text).join(" ");
    log.windows.push({ id: "w", candidateId: "c", kind: "counterfactual", question: "What if it had no PO?", openedAt: 0, askedAt: 0.5, closedAt, answeredAt: Math.min(2, closedAt), outcome: "answered", answerText, answerAudioId: "audio" });
    log.transcript.push({ id: "later", t: 4, speaker: "expert", final: true, text: "Now I am opening the next case." });
    generate.mockResolvedValue({ output: { rules: [{ ...rule, quoteTexts: [answerText] }], stepReasons: [], guardrails: [], slots: [] } });
    const result = await refineWithLLM(log, draft);
    expect(generate.mock.calls[0][0].prompt).toContain("What if it had no PO?");
    expect(result.map.rules[0]).toMatchObject({ confirmedBy: ["counterfactual"], quotes: [{ text: answerText, source: "counterfactual", audioId: "audio" }] });
    log.transcript[1].redacted = true;
    expect((await refineWithLLM(log, draft)).map.rules).toEqual([]);
    expect(generate.mock.calls[1][0].prompt).not.toContain("What if it had no PO?");
    log.transcript[1].redacted = false;
    log.offRecord = [{ from: 1.6, to: 1.9 }];
    await refineWithLLM(log, draft);
    expect(generate.mock.calls[2][0].prompt).not.toContain("What if it had no PO?");
  });
  it("uses a finite wire schema, validates conditions locally, and preserves exact quotes", async () => {
    const { log, draft, rule } = fixture();
    generate.mockResolvedValue({ output: { rules: [rule], stepReasons: [], guardrails: [], slots: [] } });
    const result = await refineWithLLM(log, draft);
    expect(result.used).toBe(true); expect(result.map.rules[0].when).toEqual({ any: [{ all: [{ field: "hasPO", op: "==", value: false }] }] });
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
