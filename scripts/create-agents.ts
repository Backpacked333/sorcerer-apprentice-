/**
 * Creates the two ElevenAgents agents (Interviewer, Tutor) with their client tools, system tools and voice settings.
 *
 *   ELEVENLABS_API_KEY=... npx tsx scripts/create-agents.ts
 *
 * Prints the agent ids to paste into .env.local. Re-run to create fresh agents; delete old ones in the dashboard.
 * Everything here mirrors agents/interviewer.md, agents/tutor.md and agents/tools.json so the dashboard and the repo agree.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";

const apiKey = process.env.ELEVENLABS_API_KEY;
if (!apiKey) {
  console.error("Set ELEVENLABS_API_KEY first.");
  process.exit(1);
}
const client = new ElevenLabsClient({ apiKey });
const root = path.join(process.cwd(), "agents");
const tools = JSON.parse(readFileSync(path.join(root, "tools.json"), "utf8")) as Record<string, ToolDef[]>;
type ToolDef = { name: string; description: string; expectsResponse: boolean; parameters: { type: "object"; required?: string[]; properties: Record<string, { type: string; description?: string }> } };

const LLM = (process.env.AGENT_LLM ?? "gemini-2.5-flash") as never; // low latency; "claude-haiku-4-5" also works well
const VOICE = process.env.ELEVENLABS_VOICE_ID;

async function createTool(t: ToolDef): Promise<string> {
  const res = await client.conversationalAi.tools.create({
    toolConfig: {
      type: "client",
      name: t.name,
      description: t.description,
      expectsResponse: t.expectsResponse,
      responseTimeoutSecs: 20,
      parameters: {
        type: "object",
        required: t.parameters.required ?? [],
        properties: Object.fromEntries(Object.entries(t.parameters.properties).map(([k, v]) => [k, { type: v.type as "string" | "number" | "boolean", description: v.description ?? k }])),
      },
    },
  });
  return res.id;
}

async function createAgent(name: string, promptFile: string, toolIds: string[], firstMessage: string, dynamicVars: Record<string, string>) {
  const prompt = readFileSync(path.join(root, promptFile), "utf8");
  const res = await client.conversationalAi.agents.create({
    name,
    tags: ["tacit", "hack-nation"],
    conversationConfig: {
      agent: {
        firstMessage,
        language: "en",
        dynamicVariables: { dynamicVariablePlaceholders: dynamicVars },
        prompt: {
          prompt,
          llm: LLM,
          temperature: 0.2,
          toolIds,
          builtInTools: {
            skipTurn: { type: "system", name: "skip_turn", description: "Stay silent when there is nothing to say: no tag was received, or the user needs a moment.", params: { systemToolType: "skip_turn" } },
            languageDetection: { type: "system", name: "language_detection", params: { systemToolType: "language_detection" } },
          },
        },
      },
      tts: { modelId: "eleven_v3_conversational", ...(VOICE ? { voiceId: VOICE } : {}) },
      turn: {
        // the governor decides timing; the agent must not re-engage on its own
        turnTimeout: 30,
        silenceEndCallTimeout: -1,
        turnEagerness: "patient",
      },
      conversation: { maxDurationSeconds: 3600, clientEvents: ["audio", "interruption", "user_transcript", "agent_response", "agent_response_correction", "client_tool_call", "vad_score"] },
    },
    platformSettings: {
      auth: { enableAuth: false },
      // the pages override first message, prompt and language per session (debrief, tutor language)
      overrides: { conversationConfigOverride: { agent: { firstMessage: true, language: true, prompt: { prompt: true } }, tts: { voiceId: true } } },
    },
  });
  return res.agentId;
}

(async () => {
  const interviewerTools = await Promise.all(tools.interviewer.map(createTool));
  const tutorTools = await Promise.all(tools.tutor.map(createTool));
  const interviewer = await createAgent("Tacit · Interviewer", "interviewer.md", interviewerTools, "", { expert_name: "Sabine" });
  const tutor = await createAgent("Tacit · Tutor", "tutor.md", tutorTools, "I'll watch while you work. I only speak when Sabine would.", { expert_name: "Sabine", newhire_name: "Lena" });
  console.log("\nAdd to .env.local:\n");
  console.log(`NEXT_PUBLIC_INTERVIEWER_AGENT_ID=${interviewer}`);
  console.log(`NEXT_PUBLIC_TUTOR_AGENT_ID=${tutor}`);
  console.log("\nIn the dashboard, confirm: TTS = Eleven v3 Conversational (Expressive Mode on), turn timeout 30 s, skip_turn enabled.");
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
