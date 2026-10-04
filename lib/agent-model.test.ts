import { describe, expect, it, vi } from "vitest";
import { ElevenLabsClient, type ElevenLabs } from "@elevenlabs/elevenlabs-js";
import { assertV4Agent, REQUIRED_VOICE_MODEL, v4AgentOptions } from "./agent-model";

describe("V4 Turbo release gate", () => {
  it("accepts only the saved V4 Turbo model", () => {
    expect(() => assertV4Agent({ conversationConfig: { tts: { modelId: REQUIRED_VOICE_MODEL } } })).not.toThrow();
    for (const modelId of [undefined, "eleven_v3_conversational", "eleven_flash_v2_5"]) {
      expect(() => assertV4Agent({ conversationConfig: { tts: { modelId } } })).toThrow("Voice release gate failed");
    }
  });

  it.each(["create", "update"] as const)("sends V4 through the real SDK %s serializer without changing prompt or tools", async (operation) => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({ agent_id: "agent_test" }), {
      status: 200, headers: { "content-type": "application/json" },
    }));
    const client = new ElevenLabsClient({ apiKey: "test-only", fetch, maxRetries: 0 });
    const body: ElevenLabs.conversationalAi.BodyCreateAgentV1ConvaiAgentsCreatePost = {
      name: "Test",
      conversationConfig: {
        tts: { expressiveMode: true, voiceId: "voice_test", suggestedAudioTags: [{ tag: "warm" }] },
        agent: { prompt: { prompt: "Speak to {{expert_name}}.", llm: "gemini-2.5-flash", toolIds: ["tool_test"] } },
        turn: { turnEagerness: "patient" },
      },
      platformSettings: { privacy: { recordVoice: false, retentionDays: 7 } },
    };
    const options = v4AgentOptions(body.conversationConfig);
    // Update's response schema is larger; only the outbound request is under test here.
    if (operation === "create") await client.conversationalAi.agents.create(body, options);
    else await client.conversationalAi.agents.update("agent_test", body, options).catch(() => undefined);
    expect(fetch).toHaveBeenCalledOnce();
    const request = fetch.mock.calls[0] as unknown as [unknown, RequestInit];
    const wire = JSON.parse(request[1].body as string);
    expect(wire).toMatchObject({
      conversation_config: {
        tts: { model_id: "eleven_v4_turbo", voice_id: "voice_test", expressive_mode: true, suggested_audio_tags: [{ tag: "warm" }] },
        agent: { prompt: { prompt: "Speak to {{expert_name}}.", llm: "gemini-2.5-flash", tool_ids: ["tool_test"] } },
        turn: { turn_eagerness: "patient" },
      },
      platform_settings: { privacy: { record_voice: false, retention_days: 7 } },
    });
    expect(JSON.stringify(wire)).not.toContain("eleven_v3_conversational");
  });
});
