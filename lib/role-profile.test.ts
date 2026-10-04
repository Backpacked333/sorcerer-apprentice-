import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { emptySession } from "./events";
import { emptyMap, WorkMapSchema } from "./workmap";
import { compileRoleProfile, currentProfile } from "./role-profile";
import { buildMemory, validateProposal } from "./memory";
import { assertV4Agent, v4AgentOptions } from "./agent-model";

const { generate } = vi.hoisted(() => ({ generate: vi.fn() }));
vi.mock("ai", () => ({ generateText: generate, Output: { object: (o: unknown) => o } }));
beforeEach(() => { vi.stubEnv("AI_GATEWAY_API_KEY", "mock"); vi.stubEnv("REASONING_MODE", "shadow"); generate.mockReset(); });
afterEach(() => vi.unstubAllEnvs());
function fixture() {
  const log = emptySession("role_test", "capture", "Review shipments", "Expert");
  log.transcript = [{ id: "t1", t: 10, speaker: "expert", final: true, text: "For damage, I ask the warehouse manager." }];
  const relationship = { subject: "Expert", relation: "escalates_to" as const, object: "warehouse manager for damage", evidenceId: "t1", quote: log.transcript[0].text };
  return { log, relationship, profile: validateProposal(buildMemory(log), { questions: [], relationships: [relationship] }).profile };
}
describe("persisted role profiles", () => {
  it("compiles supported proposed relationships while leaving rule confirmation untouched", async () => {
    const { log, relationship } = fixture();
    generate.mockResolvedValue({ output: { questions: [], relationships: [relationship] } });
    const { profile } = await compileRoleProfile(log);
    const map = WorkMapSchema.parse({ ...emptyMap(log.id, log.task, log.expertName), roleProfile: profile });
    expect(map.roleProfile?.relationships).toHaveLength(1);
    expect(map.roleProfile?.status).toBe("proposed"); expect(map.confirmedAt).toBeUndefined(); expect(map.rules).toEqual([]);
  });
  it("removes withdrawn, corrected, foreign and missing sources when read again", () => {
    const { log, profile } = fixture();
    expect(currentProfile(log, profile).relationships).toHaveLength(1);
    log.offRecord = [{ from: 9, to: 11 }];
    expect(currentProfile(log, profile).relationships).toEqual([]);
    log.offRecord = []; log.transcript[0].text = "That was incorrect.";
    expect(currentProfile(log, profile).relationships).toEqual([]);
    expect(currentProfile(emptySession("other", "capture", "Other", "Another"), profile).relationships).toEqual([]);
  });
  it("keeps conflicting statements as separate proposals rather than silently choosing policy", () => {
    const { log, relationship } = fixture();
    log.transcript.push({ ...log.transcript[0], id: "t2", t: 11, text: "For damage, I ask the shift supervisor." });
    const { profile } = validateProposal(buildMemory(log), { questions: [], relationships: [relationship,
      { ...relationship, object: "shift supervisor for damage", evidenceId: "t2", quote: log.transcript[1].text }] });
    expect(profile.relationships).toHaveLength(2); expect(profile.status).toBe("proposed");
  });
  it("skips absent evidence and preserves the map path on provider failure", async () => {
    expect((await compileRoleProfile(emptySession("empty", "capture", "Task", "Expert"))).profile).toBeUndefined();
    expect(generate).not.toHaveBeenCalled();
    generate.mockRejectedValue(new Error("private provider details"));
    expect(await compileRoleProfile(fixture().log)).toEqual({ note: "profile reasoning unavailable; map preserved" });
  });
});
describe("required V4 voice boundary", () => {
  it("preserves the serialized conversation configuration when overriding the stale SDK enum", () => {
    const config = v4AgentOptions({ agent: { firstMessage: "", prompt: { prompt: "Only approved questions" } }, tts: { expressiveMode: true, voiceId: "voice_test" } });
    expect(config.additionalBodyParameters.conversation_config).toMatchObject({
      agent: { first_message: "", prompt: { prompt: "Only approved questions" } },
      tts: { model_id: "eleven_v4_turbo", expressive_mode: true, voice_id: "voice_test" },
    });
  });
  it("requires V4 and refuses a silently substituted V3 model", () => {
    expect(() => assertV4Agent({ conversationConfig: { tts: { modelId: "eleven_v4_turbo" } } })).not.toThrow();
    expect(() => assertV4Agent({ conversationConfig: { tts: { modelId: "eleven_v3_conversational" } } })).toThrow("Voice release gate failed");
  });
});
