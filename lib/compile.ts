/**
 * Compile: events + transcript + answers -> Work Map.
 *
 * Two passes. The deterministic pass builds steps and screen moments from events (exact, no model), attaches
 * verbatim quotes from question windows and narration, and derives rules with simple heuristics so the whole
 * demo runs without a key. The LLM pass (when a key is present) refines rules, guardrails and slots, and is
 * validated: every quote must be a substring of the transcript, every condition must use known fields.
 */
export { compileDeterministic, stepRefOf } from "./compile/steps";
export { GENERIC_PROBES, UNSEEN_CASES, buildSlots, seenCases } from "./compile/slots";
export { refineWithLLM } from "./compile/rules-llm";
export { fillSlot } from "./compile/fill";
export { applyCorrection } from "./compile/correct";
export { QuoteSchema } from "./workmap";
