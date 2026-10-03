/** Attach a confirmed Work Map to the shared tutor without round-tripping prompt output fields. */
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { toAgentPrompt, toSopMarkdown } from "./export";
import type { WorkMap } from "./workmap";

const DOC_PREFIX = "Tacit Work Map";
const DEFAULT_TIMEOUT_MS = 6_000;

type KnowledgeLocator = {
  type: string;
  id: string;
  name: string;
  usageMode?: string;
  [key: string]: unknown;
};

type PromptSnapshot = {
  prompt?: string;
  llm?: unknown;
  toolIds?: string[];
  knowledgeBase?: KnowledgeLocator[];
};

type RequestOptions = { abortSignal?: AbortSignal; timeoutInSeconds?: number; maxRetries?: number };

/** Narrow structural surface used by the sync and its keyless unit tests. */
export interface KnowledgeSyncClient {
  conversationalAi: {
    agents: {
      get(agentId: string, request?: unknown, options?: RequestOptions): Promise<unknown>;
      update(agentId: string, request: unknown, options?: RequestOptions): Promise<unknown>;
    };
    knowledgeBase: {
      documents: {
        createFromText(request: { text: string; name: string }, options?: RequestOptions): Promise<{ id: string; name?: string }>;
        delete(documentId: string, request?: unknown, options?: RequestOptions): Promise<unknown>;
      };
    };
  };
}

export type KnowledgeSyncResult = { synced: boolean; documentId?: string; note?: string };

function promptOf(agent: unknown): PromptSnapshot {
  const value = agent as { conversationConfig?: { agent?: { prompt?: PromptSnapshot } } };
  return value.conversationConfig?.agent?.prompt ?? {};
}

function stable(value: unknown): string {
  return JSON.stringify(value ?? null);
}

function unchanged(before: PromptSnapshot, after: PromptSnapshot): boolean {
  return (
    (before.prompt?.length ?? 0) === (after.prompt?.length ?? 0) &&
    stable(before.llm) === stable(after.llm) &&
    stable(before.toolIds ?? []) === stable(after.toolIds ?? [])
  );
}

function attachedAsRequested(after: PromptSnapshot, retained: KnowledgeLocator[], newId: string, superseded: KnowledgeLocator[]): boolean {
  const afterIds = new Set((after.knowledgeBase ?? []).map((entry) => entry.id));
  return newId !== "" && afterIds.has(newId) && retained.every((entry) => afterIds.has(entry.id)) && superseded.every((entry) => !afterIds.has(entry.id));
}

function notesMarkdown(map: WorkMap): string {
  if (map.notes.length === 0) return "## Debrief notes\n\nNone recorded.";
  return [
    "## Debrief notes",
    ...map.notes.flatMap((note) => [
      "",
      `### ${note.topic}`,
      `Question: ${note.question}`,
      `> \"${note.quote.text.replaceAll('"', '\\"')}\"`,
    ]),
  ].join("\n");
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return String(error);
}

/** Exported for deterministic keyless tests; production callers use syncTutorKnowledge. */
export async function syncTutorKnowledgeWithClient(
  map: WorkMap,
  client: KnowledgeSyncClient,
  agentId: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<KnowledgeSyncResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new Error(`knowledge sync timed out after ${timeoutMs}ms`)), timeoutMs);
  const options: RequestOptions = {
    abortSignal: controller.signal,
    timeoutInSeconds: Math.max(0.001, timeoutMs / 1_000),
    maxRetries: 0,
  };

  const operation = async (): Promise<KnowledgeSyncResult> => {
    const name = `${DOC_PREFIX} · ${map.expert.name} · ${map.task} · ${map.sessionId}`;
    const text = `${toSopMarkdown(map)}\n\n---\n\n${notesMarkdown(map)}\n\n---\n\n${toAgentPrompt(map)}`;
    const before = promptOf(await client.conversationalAi.agents.get(agentId, undefined, options));
    const priorKnowledge = before.knowledgeBase ?? [];
    const superseded = priorKnowledge.filter((entry) => entry.name.startsWith(DOC_PREFIX) && entry.name.endsWith(`· ${map.sessionId}`));
    const retained = priorKnowledge.filter((entry) => !superseded.includes(entry));
    const doc = await client.conversationalAi.knowledgeBase.documents.createFromText({ text, name }, options);
    const locator: KnowledgeLocator = { type: "text", id: doc.id, name: doc.name ?? name, usageMode: "auto" };

    await client.conversationalAi.agents.update(
      agentId,
      { conversationConfig: { agent: { prompt: { knowledgeBase: [...retained, locator] } } } },
      options,
    );

    const after = promptOf(await client.conversationalAi.agents.get(agentId, undefined, options));
    if (!unchanged(before, after) || !attachedAsRequested(after, retained, doc.id, superseded)) {
      // The WA-1 body is CLI-local, so restore the exact prior KB leaf and report
      // the required full-body repair rather than duplicating live config logic.
      await client.conversationalAi.agents.update(
        agentId,
        { conversationConfig: { agent: { prompt: { knowledgeBase: priorKnowledge } } } },
        options,
      );
      await client.conversationalAi.knowledgeBase.documents.delete(doc.id, undefined, options);
      return {
        synced: false,
        note: "knowledge sync detected agent configuration drift; restored the prior knowledge base. Run agents:create to repair the full WA-1 agent body.",
      };
    }

    for (const entry of superseded) {
      await client.conversationalAi.knowledgeBase.documents.delete(entry.id, undefined, options);
    }
    return { synced: true, documentId: doc.id };
  };

  try {
    return await Promise.race([
      operation(),
      new Promise<never>((_, reject) => {
        controller.signal.addEventListener("abort", () => reject(controller.signal.reason), { once: true });
      }),
    ]);
  } catch (error) {
    return { synced: false, note: `knowledge sync failed: ${errorMessage(error)}` };
  } finally {
    clearTimeout(timeout);
  }
}

/** No-op without credentials; never throws into the confirm route. */
export async function syncTutorKnowledge(map: WorkMap): Promise<KnowledgeSyncResult> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const agentId = process.env.NEXT_PUBLIC_TUTOR_AGENT_ID;
  if (!apiKey || !agentId) return { synced: false, note: "no ELEVENLABS_API_KEY or tutor agent id" };
  const client = new ElevenLabsClient({ apiKey, timeoutInSeconds: DEFAULT_TIMEOUT_MS / 1_000, maxRetries: 0 });
  return syncTutorKnowledgeWithClient(map, client as unknown as KnowledgeSyncClient, agentId);
}
