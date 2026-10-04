import { describe, expect, it, vi } from "vitest";
import { ElevenLabsClient, type ElevenLabs } from "@elevenlabs/elevenlabs-js";
import { assertVoiceFlowAgent, voiceFlowAgentOptions } from "./agent-model";

describe("voice-flow provisioning policy", () => {
  const config: ElevenLabs.ConversationalConfig = {
    agent: {
      firstMessage: "",
      prompt: {
        prompt: "Only speak inside an authorized exchange.",
        llm: "gemini-2.5-flash",
        thinkingBudget: 1024,
        toolIds: ["tool_answer"],
        knowledgeBase: [{ type: "text", name: "Work Map", id: "map_test" }],
      },
    },
    turn: { turnTimeout: 30, silenceEndCallTimeout: -1, turnEagerness: "patient" },
    tts: { voiceId: "voice_test", expressiveMode: true },
  };

  it.each(["create", "update"] as const)("sends background detection through the real SDK %s serializer", async (operation) => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({ agent_id: "agent_test" }), {
      status: 200, headers: { "content-type": "application/json" },
    }));
    const client = new ElevenLabsClient({ apiKey: "test-only", fetch, maxRetries: 0 });
    const body = { conversationConfig: config, platformSettings: { privacy: { recordVoice: false } } };
    const options = voiceFlowAgentOptions(config);
    if (operation === "create") await client.conversationalAi.agents.create(body, options);
    else await client.conversationalAi.agents.update("agent_test", body, options).catch(() => undefined);
    expect(fetch).toHaveBeenCalledOnce();
    const request = fetch.mock.calls[0] as unknown as [unknown, RequestInit];
    expect(JSON.parse(request[1].body as string)).toMatchObject({
      conversation_config: {
        vad: { background_voice_detection: true },
        turn: { turn_eagerness: "normal", turn_timeout: 30, silence_end_call_timeout: -1 },
        tts: { model_id: "eleven_v4_turbo", voice_id: "voice_test", expressive_mode: true },
        agent: {
          first_message: "",
          prompt: {
            prompt: "Only speak inside an authorized exchange.",
            llm: "gemini-2.5-flash", thinking_budget: 0,
            tool_ids: ["tool_answer"],
            knowledge_base: [{ type: "text", name: "Work Map", id: "map_test" }],
          },
        },
      },
      platform_settings: { privacy: { record_voice: false } },
    });
    expect(config.turn?.turnEagerness).toBe("patient");
    expect(config.agent?.prompt?.thinkingBudget).toBe(1024);
  });

  it("does not change another model's reasoning settings", () => {
    const wire = voiceFlowAgentOptions({
      agent: { prompt: { llm: "gpt-4o-mini", thinkingBudget: 1024 } },
    }).additionalBodyParameters.conversation_config;
    expect(wire.agent?.prompt?.thinking_budget).toBe(1024);
  });

  it("does not add an LLM or prompt when neither was supplied", () => {
    const wire = voiceFlowAgentOptions({}).additionalBodyParameters.conversation_config;
    expect(wire.agent).toBeUndefined();
    expect(wire.turn?.turn_eagerness).toBe("normal");
    expect(wire.vad.background_voice_detection).toBe(true);
  });

  it("rejects drift in any saved release setting", () => {
    const saved = {
      tts: { modelId: "eleven_v4_turbo" },
      vad: { background_voice_detection: true },
      turn: { turnEagerness: "normal" },
      agent: { prompt: { llm: "gemini-2.5-flash", thinkingBudget: 0 } },
    };
    expect(() => assertVoiceFlowAgent({ conversationConfig: saved })).not.toThrow();
    for (const drift of [
      { tts: { modelId: "eleven_v3" } },
      { vad: {} },
      { vad: { background_voice_detection: false } },
      { turn: { turnEagerness: "patient" } },
      { agent: { prompt: { llm: "gemini-2.5-flash" } } },
    ]) {
      expect(() => assertVoiceFlowAgent({ conversationConfig: { ...saved, ...drift } })).toThrow();
    }
  });
});
