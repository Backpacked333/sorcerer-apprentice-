/**
 * The brief's wiring, step 4: "The Work Map goes into the tutor's knowledge base."
 * On confirmation, the SOP and the agent prompt are uploaded as a knowledge base document and attached to the Tutor agent,
 * so the tutor can answer the new hire's own questions in the expert's words, beyond the scripted interventions.
 * No-op without ELEVENLABS_API_KEY and NEXT_PUBLIC_TUTOR_AGENT_ID.
 */
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { toAgentPrompt, toSopMarkdown } from "./export";
import type { WorkMap } from "./workmap";

const DOC_PREFIX = "Tacit Work Map";

export async function syncTutorKnowledge(map: WorkMap): Promise<{ synced: boolean; documentId?: string; note?: string }> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const agentId = process.env.NEXT_PUBLIC_TUTOR_AGENT_ID;
  if (!apiKey || !agentId) return { synced: false, note: "no ELEVENLABS_API_KEY or tutor agent id" };
  const client = new ElevenLabsClient({ apiKey });
  const name = `${DOC_PREFIX} · ${map.expert.name} · ${map.task} · ${map.sessionId}`;
  const text = `${toSopMarkdown(map)}\n\n---\n\n${toAgentPrompt(map)}`;
  const doc = await client.conversationalAi.knowledgeBase.documents.createFromText({ text, name });
  // merge, never replace: keep every other prompt setting the agent already has
  const agent = await client.conversationalAi.agents.get(agentId);
  const prompt = agent.conversationConfig?.agent?.prompt ?? {};
  const existing = (prompt.knowledgeBase ?? []).filter((k) => !k.name.startsWith(DOC_PREFIX));
  await client.conversationalAi.agents.update(agentId, {
    conversationConfig: {
      agent: {
        prompt: {
          ...prompt,
          knowledgeBase: [...existing, { type: "text", id: doc.id, name: doc.name, usageMode: "auto" }],
        },
      },
    },
  });
  return { synced: true, documentId: doc.id };
}
