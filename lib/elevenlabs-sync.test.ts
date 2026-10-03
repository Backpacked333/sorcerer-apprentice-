import { describe, expect, it, vi } from "vitest";

import { emptyMap } from "./workmap";
import { syncTutorKnowledgeWithClient, type KnowledgeSyncClient } from "./elevenlabs-sync";

function mapFixture() {
  const map = emptyMap("session-neutral", "Review requests", "Expert");
  map.notes.push({
    topic: "Edge case",
    question: "What happens when the request is incomplete?",
    quote: { text: "I pause and ask the team lead.", t: 12, source: "debrief" },
  });
  return map;
}

function clientFixture(afterPrompt?: Record<string, unknown>) {
  const originalPrompt = {
    prompt: "original prompt",
    llm: "model-a",
    toolIds: ["tool-a"],
    knowledgeBase: [
      { type: "text", id: "keep", name: "Other document", usageMode: "auto" },
      {
        type: "text",
        id: "old",
        name: "Tacit Work Map · Expert · Review requests · session-neutral",
        usageMode: "auto",
      },
    ],
  };
  const createFromText = vi.fn().mockResolvedValue({ id: "new", name: "created-name" });
  const get = vi
    .fn()
    .mockResolvedValueOnce({ conversationConfig: { agent: { prompt: originalPrompt } } })
    .mockResolvedValueOnce({
      conversationConfig: {
        agent: {
          prompt: afterPrompt ?? {
            ...originalPrompt,
            knowledgeBase: [
              originalPrompt.knowledgeBase[0],
              { type: "text", id: "new", name: "created-name", usageMode: "auto" },
            ],
          },
        },
      },
    });
  const update = vi.fn().mockResolvedValue({});
  const remove = vi.fn().mockResolvedValue({});
  const client = {
    conversationalAi: {
      agents: { get, update },
      knowledgeBase: { documents: { createFromText, delete: remove } },
    },
  } as unknown as KnowledgeSyncClient;
  return { client, createFromText, get, update, remove, originalPrompt };
}

describe("syncTutorKnowledgeWithClient", () => {
  it("uploads SOP, notes, and prompt; patches only knowledgeBase; then deletes the superseded session document", async () => {
    const f = clientFixture();

    const result = await syncTutorKnowledgeWithClient(mapFixture(), f.client, "agent-1", 1_000);

    expect(result).toEqual({ synced: true, documentId: "new" });
    const upload = f.createFromText.mock.calls[0][0];
    expect(upload.text).toContain("# Review requests");
    expect(upload.text).toContain("## Debrief notes");
    expect(upload.text).toContain("Edge case");
    expect(upload.text).toContain("What happens when the request is incomplete?");
    expect(upload.text).toContain('> "I pause and ask the team lead."');
    expect(upload.text).toContain("You process review requests");
    expect(f.update).toHaveBeenCalledTimes(1);
    expect(f.update.mock.calls[0].slice(0, 2)).toEqual([
      "agent-1",
      {
        conversationConfig: {
          agent: {
            prompt: {
              knowledgeBase: [
                { type: "text", id: "keep", name: "Other document", usageMode: "auto" },
                { type: "text", id: "new", name: "created-name", usageMode: "auto" },
              ],
            },
          },
        },
      },
    ]);
    expect(f.remove).toHaveBeenCalledWith("old", undefined, expect.objectContaining({ timeoutInSeconds: 1 }));
    expect(f.remove.mock.invocationCallOrder[0]).toBeGreaterThan(f.get.mock.invocationCallOrder[1]);
  });

  it("detects prompt drift, restores the prior knowledge-base leaf, and removes the unattached new document", async () => {
    const f = clientFixture({
      prompt: "changed prompt",
      llm: "model-b",
      toolIds: ["tool-a"],
      knowledgeBase: [],
    });

    const result = await syncTutorKnowledgeWithClient(mapFixture(), f.client, "agent-1", 1_000);

    expect(result.synced).toBe(false);
    expect(result.note).toMatch(/configuration drift/i);
    expect(f.update).toHaveBeenCalledTimes(2);
    expect(f.update.mock.calls[1][1]).toEqual({
      conversationConfig: { agent: { prompt: { knowledgeBase: f.originalPrompt.knowledgeBase } } },
    });
    expect(f.remove).toHaveBeenCalledWith("new", undefined, expect.objectContaining({ timeoutInSeconds: 1 }));
    expect(f.remove.mock.calls.some((call) => call[0] === "old")).toBe(false);
  });

  it("returns a truthful note instead of throwing when the API fails", async () => {
    const f = clientFixture();
    f.createFromText.mockRejectedValueOnce(new Error("service unavailable"));

    await expect(syncTutorKnowledgeWithClient(mapFixture(), f.client, "agent-1", 1_000)).resolves.toEqual({
      synced: false,
      note: "knowledge sync failed: service unavailable",
    });
  });

  it("fails closed when the knowledge-base patch is not reflected", async () => {
    const f = clientFixture({
      prompt: "original prompt",
      llm: "model-a",
      toolIds: ["tool-a"],
      knowledgeBase: fPlaceholderKnowledge(),
    });

    const result = await syncTutorKnowledgeWithClient(mapFixture(), f.client, "agent-1", 1_000);

    expect(result.synced).toBe(false);
    expect(result.note).toMatch(/configuration drift/i);
    expect(f.update).toHaveBeenCalledTimes(2);
  });

  it("caps a hung API call", async () => {
    const f = clientFixture();
    f.get.mockReset().mockReturnValue(new Promise(() => undefined));

    const started = Date.now();
    const result = await syncTutorKnowledgeWithClient(mapFixture(), f.client, "agent-1", 15);

    expect(Date.now() - started).toBeLessThan(250);
    expect(result).toEqual({ synced: false, note: "knowledge sync failed: knowledge sync timed out after 15ms" });
  });
});

function fPlaceholderKnowledge() {
  return [
    { type: "text", id: "keep", name: "Other document", usageMode: "auto" },
    {
      type: "text",
      id: "old",
      name: "Tacit Work Map · Expert · Review requests · session-neutral",
      usageMode: "auto",
    },
  ];
}
