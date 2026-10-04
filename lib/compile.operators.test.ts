import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { emptySession } from "./events";
import { emptyMap } from "./workmap";
import { refineWithLLM } from "./compile/rules-llm";

const { generate } = vi.hoisted(() => ({ generate: vi.fn() }));
vi.mock("ai", () => ({ generateText: generate, Output: { object: (options: unknown) => options } }));
beforeEach(() => { vi.stubEnv("AI_GATEWAY_API_KEY", "mock-only-not-a-key"); generate.mockReset(); });
afterEach(() => vi.unstubAllEnvs());

describe("live compiler operator regression (provider mocked)", () => {
  it.each(["==", "="])("documents the grammar and validates %s without silently repairing policy", async (op) => {
    const log = emptySession("operator-check", "capture", "Synthetic review", "Expert");
    log.transcript = [{ id: "t", t: 1, speaker: "expert", final: true, text: "If there is no purchase order, I hold the invoice and ask the procurement lead for the missing order." }];
    const draft = emptyMap(log.id, log.task, log.expertName);
    draft.steps = [{ id: "s", index: 0, title: "Hold", screenMoment: { t: 1 }, action: { type: "hold" }, decision: "Hold", judgment: true, guardrails: [], confidence: "medium" }];
    const when = { field: "hasPO", op, value: false };
    generate.mockResolvedValue({ output: {
      rules: [{ stepId: "s", title: "Hold", when: JSON.stringify(when), then: '{"status":"hold"}', unless: null,
        stopAndAsk: JSON.stringify({ who: "procurement lead", when }), quoteTexts: [log.transcript[0].text], confidence: "high" }],
      guardrails: [], slots: [], stepReasons: [],
    } });
    const result = await refineWithLLM(log, draft);
    expect(generate.mock.calls[0][0].instructions).toContain('Equality MUST use "==", never "=" or "eq".');
    expect(result.map.rules).toHaveLength(op === "==" ? 1 : 0);
    if (op === "==") expect(result.map.rules[0]).toMatchObject({ when, stopAndAsk: { who: "procurement lead", when } });
    expect(result.map.confirmedAt).toBeUndefined();
  });
});
