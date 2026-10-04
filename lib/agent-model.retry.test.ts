import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { answerAcknowledgmentOptions, assertAnswerAcknowledgment } from "./agent-model";

describe("silent answer-tool correction retries", () => {
  it("allows speech before a new answer without forcing it on every retry", () => {
    expect(answerAcknowledgmentOptions("log_answer")).toEqual({ preToolSpeech: "auto", executionMode: "post_tool_speech" });
  });

  it("rejects a saved configuration that forces duplicate retry speech", () => {
    expect(() => assertAnswerAcknowledgment({ preToolSpeech: "force", executionMode: "post_tool_speech", expectsResponse: true })).toThrow();
  });

  it("distinguishes a fresh answer acknowledgment from a silent internal retry", () => {
    const prompt = readFileSync("agents/interviewer.md", "utf8");
    expect(prompt).toContain("promptly acknowledge it in a brief, warm phrase before calling `log_answer`");
    expect(prompt).toContain("retry once silently");
    expect(prompt).toContain("not a new expert answer");
    expect(prompt).toContain("Never retry a closed or withdrawn question");
  });
});
