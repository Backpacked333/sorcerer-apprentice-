import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { recordTypedAnswer } from "./capture-answer";
import { emptySession, type QuestionWindow } from "./events";
import { compileDeterministic } from "./compile/steps";
import { refineWithLLM } from "./compile/rules-llm";
import { buildMemory } from "./memory";

const { generate } = vi.hoisted(() => ({ generate: vi.fn() }));
vi.mock("ai", () => ({ generateText: generate, Output: { object: (o: unknown) => o } }));
beforeEach(() => { vi.stubEnv("AI_GATEWAY_API_KEY", "mock"); generate.mockReset(); });
afterEach(() => vi.unstubAllEnvs());

function fixture(kind: QuestionWindow["kind"] = "limit") {
  const log = emptySession("typed", "capture", "Review shipments", "Expert");
  const window: QuestionWindow = { id: "w", candidateId: "c", kind, openedAt: 1, askedAt: 2,
    stepRef: "item:route", question: "When do you need another approval?" };
  log.windows.push(window);
  log.events.push({ id: "e", source: "dom", kind: "route_changed", invoice: "item", t: 1, to: "second_approval" });
  const answer = "Above 7200 I need a second approval.";
  const output = { rules: [{ stepId: "s", title: "Second approval", when: { anyOf: [{ allOf: [{ field: "amount", op: ">", value: 7200 }] }] },
    then: { kind: "route", field: null, value: "second_approval" }, unless: null, stopAndAsk: null, quoteTexts: [answer], confidence: "medium" }],
    guardrails: [], slots: [], stepReasons: [] };
  generate.mockResolvedValue({ output });
  const compile = () => {
    const draft = compileDeterministic(log);
    output.rules[0].stepId = draft.steps[0].id;
    return refineWithLLM(log, draft);
  };
  return { log, window, compile, answer, output };
}

it.each(["limit", "counterfactual", "debrief"] as const)("keeps explicit typed %s evidence without STT", async (kind) => {
  const { log, window, compile, answer } = fixture(kind);
  expect(recordTypedAnswer(log, window.id, ` ${answer} `, 3)).toBe(0);
  Object.assign(window, { outcome: "answered", closedAt: 3 });
  expect(log.transcript).toEqual([{ id: "tr_0", typedFor: "w", t: 3, text: answer, speaker: "expert", final: true, redacted: false }]);
  expect(buildMemory(log).evidence[0].text).toBe(answer);
  const { map } = await compile();
  expect(generate.mock.calls[0][0].prompt).toContain(`Q(${kind}, item:route): ${window.question}\nA: ${answer}`);
  expect(map.rules[0].quotes).toEqual([{ text: answer, t: 3, source: kind === "limit" ? "live" : kind, audioId: undefined }]);
  expect(map.confirmedAt).toBeUndefined();
});

it("reconstructs mixed spoken and typed answers with exact question attribution", async () => {
  const { log, window, compile, answer, output } = fixture("counterfactual");
  const spoken = "It depends on the amount.";
  log.transcript.push({ id: "spoken", t: 2.5, text: spoken, speaker: "expert", final: true });
  window.answerText = spoken;
  recordTypedAnswer(log, "w", answer, 3);
  Object.assign(window, { outcome: "answered", closedAt: 3 });
  output.rules[0].quoteTexts = [window.answerText!];
  const { map } = await compile();
  expect(map.rules[0].quotes[0]).toMatchObject({ text: `${spoken} ${answer}`, source: "counterfactual" });
});

it.each(["agent", "partial", "redacted", "off_record", "paraphrase"])("does not promote %s text", async (invalid) => {
  const { log, window, compile, answer } = fixture();
  recordTypedAnswer(log, "w", answer, 3);
  Object.assign(window, { outcome: "answered", closedAt: 3 });
  const span = log.transcript[0];
  if (invalid === "agent") span.speaker = "agent";
  if (invalid === "partial") span.final = false;
  if (invalid === "redacted") span.redacted = true;
  if (invalid === "off_record") log.offRecord.push({ from: 2, to: 4 });
  if (invalid === "paraphrase") span.text = "We sometimes get another approval.";
  expect((await compile()).map.rules).toEqual([]);
  expect(generate.mock.calls[0][0].prompt).not.toContain(answer);
});

it("does not synthesize expert evidence from a tool summary or legacy unattributed answer", async () => {
  const { log, window, compile, answer } = fixture();
  Object.assign(window, { answerText: answer, logged: { reason: answer }, outcome: "answered", closedAt: 3 });
  expect((await compile()).map.rules).toEqual([]);
  expect(generate.mock.calls[0][0].prompt).not.toContain(answer);
});

it("redacts typed PII before storing it and excludes that span from model evidence", () => {
  const { log, window } = fixture();
  expect(recordTypedAnswer(log, "w", "Ask Expert at private@example.test", 3)).toBe(2);
  expect(JSON.stringify(log)).not.toContain("private@example.test");
  expect(window.answerText).toBe("Ask [person] at [email]");
  expect(buildMemory(log).evidence).toEqual([]);
});

it.each(["missing", "closed", "off_record", "before_question", "blank", "teach"])("rejects %s submissions", (invalid) => {
  const { log, window, answer } = fixture();
  if (invalid === "closed") window.outcome = "answered";
  if (invalid === "off_record") log.offRecord.push({ from: 2, to: 4 });
  if (invalid === "teach") log.mode = "teach";
  expect(recordTypedAnswer(log, invalid === "missing" ? "other" : "w", invalid === "blank" ? " " : answer,
    invalid === "before_question" ? 0 : 3)).toBeUndefined();
  expect(log.transcript).toEqual([]);
  expect(window.answerText).toBeUndefined();
});

it.each(["eligible", "redacted", "withdrawn"])("keeps %s typed evidence scoped through deterministic compilation and refinement", async (state) => {
  const { log, window } = fixture();
  window.stepRef = "first:costCenter";
  log.events = [
    { id: "a", source: "dom", kind: "field_changed", invoice: "first", field: "costCenter", to: "0400", t: 1 },
    { id: "b", source: "dom", kind: "field_changed", invoice: "second", field: "costCenter", to: "4711", t: 6 },
  ];
  const answer = "Equipment over 7500 is always capital expense.";
  recordTypedAnswer(log, "w", state === "redacted" ? `${answer} Ask pat@example.test.` : answer, 5);
  Object.assign(window, { outcome: "answered", closedAt: 5 });
  if (state === "withdrawn") log.offRecord.push({ from: 2, to: 4 });
  const draft = compileDeterministic(log);
  expect(draft.steps[1].reason).toBeUndefined();
  expect(draft.steps[1].guardrails).toEqual([]);
  expect(draft.rules.map((r) => r.then)).toEqual(state === "eligible" ? [{ set: { costCenter: "0400" } }] : []);
  expect(draft.steps[0].guardrails).toHaveLength(state === "eligible" ? 1 : 0);
  generate.mockResolvedValue({ output: { rules: [], guardrails: [], stepReasons: [], slots: [] } });
  const { map } = await refineWithLLM(log, draft);
  expect(map.rules).toEqual(draft.rules);
  if (state !== "eligible") expect(generate.mock.calls[0][0].prompt).not.toContain(answer);
});
