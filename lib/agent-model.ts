import type { ElevenLabs } from "@elevenlabs/elevenlabs-js";
import { ConversationalConfig } from "@elevenlabs/elevenlabs-js/serialization";

export const REQUIRED_VOICE_MODEL = "eleven_v4_turbo";

export const SKIP_TURN_DESCRIPTION = "Stay silent outside an active tagged exchange or for unrelated background speech. During an active exchange, respond to direct answers, connection checks and requests to repeat or clarify; these do not need a new tag.";

export function answerAcknowledgmentOptions(name: string): Pick<ElevenLabs.ClientToolConfigInput, "preToolSpeech" | "executionMode"> {
  return name === "log_answer"
    ? { preToolSpeech: "force", executionMode: "post_tool_speech" }
    : { preToolSpeech: "off", executionMode: "immediate" };
}

export function assertAnswerAcknowledgment(tool?: Pick<ElevenLabs.ClientToolConfigInput, "preToolSpeech" | "executionMode" | "expectsResponse">) {
  if (tool?.preToolSpeech !== "force" || tool.executionMode !== "post_tool_speech" || tool.expectsResponse !== true) {
    throw new Error("Voice-flow check failed: log_answer must acknowledge before saving and still await its result.");
  }
}

export function v4AgentOptions(config: ElevenLabs.ConversationalConfig) {
  // SDK 2.70's outbound enum predates V4; serialize other fields before the wire override.
  const wire = ConversationalConfig.jsonOrThrow({
    ...config,
    tts: { ...config.tts, modelId: undefined },
  });
  return {
    additionalBodyParameters: {
      conversation_config: {
        ...wire,
        tts: { ...wire.tts, model_id: REQUIRED_VOICE_MODEL },
      },
    },
  };
}

export function voiceFlowAgentOptions(config: ElevenLabs.ConversationalConfig) {
  const prompt = config.agent?.prompt;
  const options = v4AgentOptions({
    ...config,
    turn: { ...config.turn, turnEagerness: "normal" },
    ...(prompt?.llm === "gemini-2.5-flash" ? {
      agent: { ...config.agent, prompt: { ...prompt, thinkingBudget: 0 } },
    } : {}),
  });
  const wire = options.additionalBodyParameters.conversation_config;
  return {
    additionalBodyParameters: {
      conversation_config: {
        ...wire,
        // SDK 2.70 serializes VAD as an empty object, dropping this API setting.
        vad: { ...wire.vad, background_voice_detection: true },
      },
    },
  };
}

export function assertV4Agent(agent: { conversationConfig: { tts?: { modelId?: string } } }) {
  const actual = agent.conversationConfig.tts?.modelId;
  if (actual !== REQUIRED_VOICE_MODEL) {
    throw new Error(`Voice release gate failed: expected ${REQUIRED_VOICE_MODEL}, received ${actual ?? "unset"}.`);
  }
}

export function assertVoiceFlowAgent(agent: {
  conversationConfig: {
    tts?: { modelId?: string };
    vad?: object;
    turn?: { turnEagerness?: string };
    agent?: { prompt?: { llm?: string; thinkingBudget?: number } };
  };
}) {
  assertV4Agent(agent);
  const { vad, turn, agent: settings } = agent.conversationConfig;
  // Unknown SDK fields are returned under their original wire names.
  if (!vad || !("background_voice_detection" in vad) || vad.background_voice_detection !== true) {
    throw new Error("Voice-flow check failed: background voice detection is not enabled.");
  }
  if (turn?.turnEagerness !== "normal") {
    throw new Error("Voice-flow check failed: turn eagerness must be normal.");
  }
  if (settings?.prompt?.llm === "gemini-2.5-flash" && settings.prompt.thinkingBudget !== 0) {
    throw new Error("Voice-flow check failed: Gemini Flash thinking budget must be zero.");
  }
}
