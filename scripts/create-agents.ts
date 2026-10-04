/**
 * Creates or updates the Tacit ElevenAgents agents and their client tools.
 *
 *   npm run agents:create
 *   npm run agents:create -- --check     # read-only remote configuration check
 *   npm run agents:create -- --force-new # intentionally create fresh agents
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import type { ElevenLabs } from "@elevenlabs/elevenlabs-js";
import { assertV4Agent, REQUIRED_VOICE_MODEL, v4AgentOptions } from "../lib/agent-model";

for (const file of [".env.local", ".env"]) {
  try {
    process.loadEnvFile(file);
  } catch {
    // Optional local environment files.
  }
}

type Role = "interviewer" | "tutor";
type AgentBody = ElevenLabs.conversationalAi.BodyCreateAgentV1ConvaiAgentsCreatePost;
type ToolDef = {
  name: string;
  description: string;
  expectsResponse: boolean;
  parameters: {
    type: "object";
    required?: string[];
    properties: Record<string, { type: string; description?: string }>;
  };
};

const CHECK = process.argv.includes("--check");
const FORCE_NEW = process.argv.includes("--force-new");
if (CHECK && FORCE_NEW) {
  console.error("Choose either --check or --force-new, not both.");
  process.exit(1);
}

const apiKey = process.env.ELEVENLABS_API_KEY;
if (!apiKey) {
  console.error("Set ELEVENLABS_API_KEY in .env.local, .env, or the environment first.");
  process.exit(1);
}

const client = new ElevenLabsClient({ apiKey });
const root = path.join(process.cwd(), "agents");
const tools = JSON.parse(readFileSync(path.join(root, "tools.json"), "utf8")) as Record<Role, ToolDef[]>;
const LLM = (process.env.AGENT_LLM ?? "gemini-2.5-flash") as ElevenLabs.Llm;
const VOICE = process.env.ELEVENLABS_VOICE_ID;
const PLACEHOLDERS = {
  expert_name: "the expert",
  newhire_name: "the new hire",
  task: "the task on screen",
};
const ROLES: Record<Role, { name: string; promptFile: string; envId: string; firstMessage: string }> = {
  interviewer: {
    name: "Tacit · Interviewer",
    promptFile: "interviewer.md",
    envId: "NEXT_PUBLIC_INTERVIEWER_AGENT_ID",
    firstMessage: "",
  },
  tutor: {
    name: "Tacit · Tutor",
    promptFile: "tutor.md",
    envId: "NEXT_PUBLIC_TUTOR_AGENT_ID",
    firstMessage: "I'll watch while you work. I only speak when {{expert_name}} would.",
  },
};

function toolConfig(tool: ToolDef): ElevenLabs.ClientToolConfigInput & { type: "client" } {
  const hasParameters = Object.keys(tool.parameters.properties).length > 0;
  return {
    type: "client",
    name: tool.name,
    description: tool.description,
    expectsResponse: tool.expectsResponse,
    responseTimeoutSecs: 20,
    preToolSpeech: "off",
    ...(hasParameters
      ? {
          parameters: {
            type: "object",
            required: tool.parameters.required ?? [],
            properties: Object.fromEntries(
              Object.entries(tool.parameters.properties).map(([name, value]) => [
                name,
                {
                  type: value.type as "string" | "number" | "boolean",
                  description: value.description ?? name,
                },
              ]),
            ),
          },
        }
      : {}),
  };
}

async function listAllTools() {
  const result: ElevenLabs.ToolResponseModel[] = [];
  const seenCursors = new Set<string>();
  let cursor: string | undefined;
  do {
    const page = await client.conversationalAi.tools.list({ pageSize: 100, ...(cursor ? { cursor } : {}) });
    result.push(...page.tools);
    if (!page.hasMore) break;
    const next = page.nextCursor;
    if (!next || next === cursor || seenCursors.has(next)) {
      throw new Error("ElevenLabs returned malformed or repeated pagination while listing tools; no changes were made.");
    }
    seenCursors.add(next);
    cursor = next;
  } while (cursor);
  return result;
}

async function syncTools(existing: ElevenLabs.ToolResponseModel[]) {
  const byName = new Map<string, ElevenLabs.ToolResponseModel>();
  for (const tool of existing) {
    if (tool.toolConfig.type === "client") byName.set(tool.toolConfig.name, tool);
  }
  const ids = {} as Record<Role, string[]>;

  for (const role of Object.keys(ROLES) as Role[]) {
    ids[role] = [];
    for (const definition of tools[role]) {
      const config = toolConfig(definition);
      const found = byName.get(definition.name);
      const result = found
        ? await client.conversationalAi.tools.update(found.id, { toolConfig: config })
        : await client.conversationalAi.tools.create({ toolConfig: config });
      ids[role].push(result.id);
    }
  }
  return ids;
}

function buildBody(role: Role, toolIds: string[], knowledgeBase?: ElevenLabs.KnowledgeBaseLocator[]): AgentBody {
  const config = ROLES[role];
  const prompt = readFileSync(path.join(root, config.promptFile), "utf8");
  return {
    name: config.name,
    tags: ["tacit", "hack-nation"],
    conversationConfig: {
      agent: {
        firstMessage: config.firstMessage,
        language: "en" as const,
        dynamicVariables: { dynamicVariablePlaceholders: PLACEHOLDERS },
        prompt: {
          prompt,
          llm: LLM,
          temperature: 0,
          toolIds,
          ...(knowledgeBase ? { knowledgeBase } : {}),
          builtInTools: {
            skipTurn: {
              type: "system" as const,
              name: "skip_turn",
              description: "Stay silent when no tagged message was received, or the user needs a moment.",
              params: { systemToolType: "skip_turn" as const },
            },
          },
        },
      },
      tts: {
        expressiveMode: true,
        suggestedAudioTags: (role === "interviewer"
          ? [{ tag: "curious" }, { tag: "thoughtful" }, { tag: "warm" }]
          : [{ tag: "calm" }, { tag: "warm" }, { tag: "encouraging" }]),
        ...(VOICE ? { voiceId: VOICE } : {}),
      },
      turn: { turnTimeout: 30, silenceEndCallTimeout: -1, turnEagerness: "patient" as const },
      conversation: {
        maxDurationSeconds: 3600,
        clientEvents: [
          "audio" as const,
          "interruption" as const,
          "user_transcript" as const,
          "agent_response" as const,
          "agent_response_correction" as const,
          "client_tool_call" as const,
          "agent_tool_response" as const,
          "vad_score" as const,
        ],
      },
    },
    platformSettings: {
      auth: { enableAuth: false },
      privacy: { recordVoice: false, retentionDays: 7 },
      overrides: {
        conversationConfigOverride: {
          agent: { firstMessage: true, language: true, prompt: { prompt: true } },
          tts: { voiceId: true },
        },
      },
    },
  };
}

function isPrivacyValidationError(error: unknown) {
  const candidate = error as { statusCode?: number; status?: number; body?: unknown; message?: string };
  const status = candidate?.statusCode ?? candidate?.status;
  const text = `${candidate?.message ?? ""} ${JSON.stringify(candidate?.body ?? "")}`.toLowerCase();
  return (status === 400 || status === 422) && (text.includes("privacy") || text.includes("retention"));
}

async function writeAgent(
  id: string | undefined,
  body: AgentBody,
): Promise<{
  id: string;
  privacy: "recordVoice=false, retentionDays=7" | "recordVoice=false" | "not applied";
}> {
  const write = async (request: AgentBody) => {
    const options = v4AgentOptions(request.conversationConfig);
    if (id) {
      const response = await client.conversationalAi.agents.update(id, request, options);
      assertV4Agent(response);
      return response.agentId;
    }
    const response = await client.conversationalAi.agents.create(request, options);
    assertV4Agent(await client.conversationalAi.agents.get(response.agentId));
    return response.agentId;
  };

  try {
    return { id: await write(body), privacy: "recordVoice=false, retentionDays=7" };
  } catch (error) {
    if (!isPrivacyValidationError(error)) throw error;
    const recordVoiceOnly: AgentBody = {
      ...body,
      platformSettings: { ...body.platformSettings, privacy: { recordVoice: false } },
    };
    console.warn(`${body.name ?? "Agent"}: privacy configuration was rejected; retrying with recordVoice=false only.`);
    try {
      return { id: await write(recordVoiceOnly), privacy: "recordVoice=false" };
    } catch (recordVoiceError) {
      if (!isPrivacyValidationError(recordVoiceError)) throw recordVoiceError;
      const withoutPrivacy: AgentBody = {
        ...body,
        platformSettings: { ...body.platformSettings, privacy: undefined },
      };
      console.warn(`${body.name ?? "Agent"}: recordVoice-only privacy was rejected; continuing without privacy settings.`);
      return { id: await write(withoutPrivacy), privacy: "not applied" };
    }
  }
}

async function findAgentId(name: string, envId: string) {
  if (!FORCE_NEW && process.env[envId]) return process.env[envId];
  if (FORCE_NEW) return undefined;

  const exactMatches: ElevenLabs.AgentSummaryResponseModel[] = [];
  const seenCursors = new Set<string>();
  let cursor: string | undefined;
  do {
    const page = await client.conversationalAi.agents.list({
      search: name,
      pageSize: 100,
      ...(cursor ? { cursor } : {}),
    });
    exactMatches.push(...page.agents.filter((agent) => agent.name === name));
    if (!page.hasMore) break;
    const next = page.nextCursor;
    if (!next || next === cursor || seenCursors.has(next)) {
      throw new Error(`ElevenLabs returned malformed or repeated pagination while finding ${name}; no changes were made.`);
    }
    seenCursors.add(next);
    cursor = next;
  } while (cursor);

  if (exactMatches.length > 1) {
    throw new Error(
      `Found ${exactMatches.length} agents named ${name}. Set ${envId} to the intended agent id and run again. No changes were made.`,
    );
  }
  return exactMatches[0]?.agentId;
}

async function resolveAgent(role: Role) {
  const config = ROLES[role];
  const id = await findAgentId(config.name, config.envId);
  if (!id) throw new Error(`${config.name} was not found. Run without --check to create it.`);
  return client.conversationalAi.agents.get(id);
}

function sha1(value: string) {
  return createHash("sha1").update(value).digest("hex");
}

async function check() {
  const allTools = await listAllTools();
  const toolNameById = new Map(
    allTools.map((tool) => [
      tool.id,
      tool.toolConfig.type === "mcp" ? "mcp" : tool.toolConfig.name,
    ]),
  );

  for (const role of Object.keys(ROLES) as Role[]) {
    const agent = await resolveAgent(role);
    const prompt = agent.conversationConfig.agent?.prompt;
    const tts = agent.conversationConfig.tts;
    const localPrompt = readFileSync(path.join(root, ROLES[role].promptFile), "utf8");
    const remotePrompt = prompt?.prompt ?? "";
    const names = (prompt?.toolIds ?? []).map((id) => toolNameById.get(id) ?? `unknown:${id}`);
    console.log(JSON.stringify({
      name: agent.name,
      id: agent.agentId,
      llm: prompt?.llm ?? null,
      ttsModel: tts?.modelId ?? null,
      expressiveMode: tts?.expressiveMode ?? false,
      voiceId: tts?.voiceId ?? null,
      tools: names,
      privacy: agent.platformSettings?.privacy ?? null,
      promptSha1: { remote: sha1(remotePrompt), local: sha1(localPrompt), equal: remotePrompt === localPrompt },
    }, null, 2));
    assertV4Agent(agent);
  }
}

async function main() {
  if (process.env.ELEVENLABS_TTS_MODEL && process.env.ELEVENLABS_TTS_MODEL !== REQUIRED_VOICE_MODEL) {
    throw new Error(`ELEVENLABS_TTS_MODEL must be ${REQUIRED_VOICE_MODEL}; other voice models do not satisfy this release.`);
  }
  if (CHECK) {
    await check();
    return;
  }

  // Complete every paginated lookup and existing-agent read before the first mutation.
  const existingTools = await listAllTools();
  const existingIds = {} as Record<Role, string | undefined>;
  const existingAgents = {} as Record<Role, ElevenLabs.GetAgentResponseModel | undefined>;
  for (const role of Object.keys(ROLES) as Role[]) {
    const config = ROLES[role];
    existingIds[role] = await findAgentId(config.name, config.envId);
    existingAgents[role] = existingIds[role]
      ? await client.conversationalAi.agents.get(existingIds[role])
      : undefined;
  }

  const toolIds = await syncTools(existingTools);
  const ids = {} as Record<Role, string>;
  const privacy = {} as Record<Role, string>;

  for (const role of Object.keys(ROLES) as Role[]) {
    const config = ROLES[role];
    const existingId = existingIds[role];
    const existing = existingAgents[role];
    const knowledgeBase = existing?.conversationConfig.agent?.prompt?.knowledgeBase;
    const result = await writeAgent(existingId, buildBody(role, toolIds[role], knowledgeBase));
    ids[role] = result.id;
    privacy[role] = result.privacy;
    console.log(`${config.name}: ${existingId ? "updated" : "created"}; verified ${REQUIRED_VOICE_MODEL}; privacy ${result.privacy}.`);
  }

  console.log(`NEXT_PUBLIC_INTERVIEWER_AGENT_ID=${ids.interviewer}`);
  console.log(`NEXT_PUBLIC_TUTOR_AGENT_ID=${ids.tutor}`);
  console.log(`MERGED: agents created/updated — interviewer=${ids.interviewer}, tutor=${ids.tutor}; privacy interviewer=${privacy.interviewer}, tutor=${privacy.tutor}`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Agent setup failed: ${message}`);
  process.exit(1);
});
