import type { ElevenLabs } from "@elevenlabs/elevenlabs-js";
import { ConversationalConfig } from "@elevenlabs/elevenlabs-js/serialization";

export const REQUIRED_VOICE_MODEL = "eleven_v4_turbo";

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

export function assertV4Agent(agent: { conversationConfig: { tts?: { modelId?: string } } }) {
  const actual = agent.conversationConfig.tts?.modelId;
  if (actual !== REQUIRED_VOICE_MODEL) {
    throw new Error(`Voice release gate failed: expected ${REQUIRED_VOICE_MODEL}, received ${actual ?? "unset"}.`);
  }
}
