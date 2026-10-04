import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { answerAcknowledgmentOptions, assertAnswerAcknowledgment, SKIP_TURN_DESCRIPTION } from "./agent-model";

describe("responsive conversation policy", () => {
  it("rejects silent or fire-and-forget answer saving in the release check", () => {
    const saved = { ...answerAcknowledgmentOptions("log_answer"), expectsResponse: true };
    expect(() => assertAnswerAcknowledgment(saved)).not.toThrow();
    for (const config of [undefined, { ...saved, preToolSpeech: "off" as const }, { ...saved, executionMode: "async" as const }, { ...saved, expectsResponse: false }]) {
      expect(() => assertAnswerAcknowledgment(config)).toThrow();
    }
  });
  it("acknowledges before answer persistence without dropping the tool result", async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({
      id: "test-tool",
      tool_config: { type: "client", name: "log_answer", description: "Persist a literal answer" },
      access_info: { is_creator: true, creator_name: "test", creator_email: "test@example.com", role: "admin" },
      usage_stats: { total_calls: 0, avg_latency_secs: 0 },
    }), {
      status: 200, headers: { "content-type": "application/json" },
    }));
    const client = new ElevenLabsClient({ apiKey: "test-only", fetch, maxRetries: 0 });
    await client.conversationalAi.tools.update("test-tool", {
      toolConfig: {
        type: "client", name: "log_answer", description: "Persist a literal answer",
        expectsResponse: true, ...answerAcknowledgmentOptions("log_answer"),
      },
    });
    const request = fetch.mock.calls[0] as unknown as [unknown, RequestInit];
    expect(JSON.parse(request[1].body as string)).toMatchObject({
      tool_config: {
        pre_tool_speech: "auto", execution_mode: "post_tool_speech", expects_response: true,
      },
    });
  });

  it.each(["mark_off_record", "end_task", "confirm_teachback", "record_prediction", "end_session"])(
    "does not delay %s or acknowledge an unconfirmed outcome", (name) => {
      expect(answerAcknowledgmentOptions(name)).toEqual({ preToolSpeech: "off", executionMode: "immediate" });
    },
  );

  it.each(["interviewer", "tutor"])("allows conversational repair without inventing task evidence for %s", (role) => {
    const prompt = readFileSync(`agents/${role}.md`, "utf8");
    expect(prompt).toContain("can you hear me?");
    expect(prompt).toContain("no new tag is needed");
    expect(prompt).toMatch(/Keep the (original|task) question pending/);
    expect(prompt).toMatch(/Never log these conversational checks|Do not score, record mastery/);
    expect(prompt).toContain("Do not treat unrelated background speech or a murmur as an answer");
    expect(prompt).toContain("Outside that exchange, call `skip_turn`");
  });

  it("does not contradict active-exchange replies in the skip tool description", () => {
    expect(SKIP_TURN_DESCRIPTION).toContain("outside an active tagged exchange");
    expect(SKIP_TURN_DESCRIPTION).toContain("connection checks");
    expect(SKIP_TURN_DESCRIPTION).toContain("do not need a new tag");
    expect(SKIP_TURN_DESCRIPTION).not.toContain("no tagged message was received");
  });
});
