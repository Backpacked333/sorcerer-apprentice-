import { afterEach, describe, expect, it, vi } from "vitest";
import * as compiler from "./compile";
import { compileDeterministic, stepRefOf } from "./compile/steps";
import { GENERIC_PROBES, UNSEEN_CASES, buildSlots, seenCases } from "./compile/slots";
import { refineWithLLM } from "./compile/rules-llm";
import { fillSlot } from "./compile/fill";
import { applyCorrection } from "./compile/correct";
import { emptySession } from "./events";
import { QuoteSchema } from "./workmap";

afterEach(() => vi.unstubAllEnvs());

describe("compile barrel compatibility", () => {
  it("preserves exactly the original exports without exposing internal helpers", () => {
    expect(Object.keys(compiler).sort()).toEqual([
      "GENERIC_PROBES", "QuoteSchema", "UNSEEN_CASES", "applyCorrection", "buildSlots",
      "compileDeterministic", "fillSlot", "refineWithLLM", "seenCases", "stepRefOf",
    ]);
  });

  it("re-exports the same functions, constants and quote schema by identity", () => {
    const originals = {
      compileDeterministic, stepRefOf, GENERIC_PROBES, UNSEEN_CASES, buildSlots,
      seenCases, refineWithLLM, fillSlot, applyCorrection, QuoteSchema,
    };
    for (const name of Object.keys(originals) as (keyof typeof originals)[]) {
      expect(compiler[name]).toBe(originals[name]);
    }
  });

  it("keeps the keyless refinement fallback callable through the barrel", async () => {
    vi.stubEnv("AI_GATEWAY_API_KEY", "");
    const log = emptySession("split-test", "capture", "Review invoices", "Expert");
    const draft = compiler.compileDeterministic(log);
    const result = await compiler.refineWithLLM(log, draft);
    expect(result).toEqual({ map: draft, used: false, note: "no AI_GATEWAY_API_KEY; deterministic map" });
    expect(result.map).toBe(draft);
  });
});
