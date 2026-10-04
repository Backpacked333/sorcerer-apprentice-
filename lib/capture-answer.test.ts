import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { recordTypedAnswer } from "./capture-answer";
import { emptySession, type QuestionWindow } from "./events";
import { emptyMap } from "./workmap";
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
  const draft = emptyMap(log.id, log.task, log.expertName);
  draft.steps.push({ id: "s", index: 0, title: "Route", screenMoment: { t: 1 }, action: { type: "route" },
    decision: "Routed", judgment: true, guardrails: [], confidence: "medium" });
  const answer = "Above 7200 I need a second approval.";
  const output = { rules: [{ stepId: "s", title: "Second approval", when: '{"field":"amount","op":">","value":7200}',
    then: '{"route":"second_approval"}', unless: null, stopAndAsk: null, quoteTexts: [answer], confidence: "medium" }],
    guardrails: [], slots: [], stepReasons: [] };
  generate.mockResolvedValue({ output });
  return { log, window, draft, answer, output };
}

it.each(["limit", "counterfactual", "debrief"] as const)("keeps explicit typed %s evidence without STT", async (kind) => {
  const { log, window, draft, answer } = fixture(kind);
  expect(recordTypedAnswer(log, window.id, ` ${answer} `, 3)).toBe(0);
  Object.assign(window, { outcome: "answered", closedAt: 3 });
  expect(log.transcript).toEqual([{ id: "tr_0", typedFor: "w", t: 3, text: answer, speaker: "expert", final: true, redacted: false }]);
  expect(buildMemory(log).evidence[0].text).toBe(answer);
  const { map } = await refineWithLLM(log, draft);
  expect(generate.mock.calls[0][0].prompt).toContain(`Q(${kind}, item:route): ${window.question}\nA: ${answer}`);
  expect(map.rules[0].quotes).toEqual([{ text: answer, t: 3, source: kind === "limit" ? "live" : kind, audioId: undefined }]);
  expect(map.confirmedAt).toBeUndefined();
});

it("reconstructs mixed spoken and typed answers with exact question attribution", async () => {
  const { log, window, draft, answer, output } = fixture("counterfactual");
  const spoken = "It depends on the amount.";
  log.transcript.push({ id: "spoken", t: 2.5, text: spoken, speaker: "expert", final: true });
  window.answerText = spoken;
  recordTypedAnswer(log, "w", answer, 3);
  Object.assign(window, { outcome: "answered", closedAt: 3 });
  output.rules[0].quoteTexts = [window.answerText!];
  const { map } = await refineWithLLM(log, draft);
  expect(map.rules[0].quotes[0]).toMatchObject({ text: `${spoken} ${answer}`, source: "counterfactual" });
});

it.each(["agent", "partial", "redacted", "off_record", "paraphrase"])("does not promote %s text", async (invalid) => {
  const { log, window, draft, answer } = fixture();
  recordTypedAnswer(log, "w", answer, 3);
  Object.assign(window, { outcome: "answered", closedAt: 3 });
  const span = log.transcript[0];
  if (invalid === "agent") span.speaker = "agent";
  if (invalid === "partial") span.final = false;
  if (invalid === "redacted") span.redacted = true;
  if (invalid === "off_record") log.offRecord.push({ from: 2, to: 4 });
  if (invalid === "paraphrase") span.text = "We sometimes get another approval.";
  expect((await refineWithLLM(log, draft)).map.rules).toEqual([]);
  expect(generate.mock.calls[0][0].prompt).not.toContain(answer);
});

it("does not synthesize expert evidence from a tool summary or legacy unattributed answer", async () => {
  const { log, window, draft, answer } = fixture();
  Object.assign(window, { answerText: answer, logged: { reason: answer }, outcome: "answered", closedAt: 3 });
  expect((await refineWithLLM(log, draft)).map.rules).toEqual([]);
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
