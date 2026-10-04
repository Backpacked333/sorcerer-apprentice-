import { describe, expect, it, vi } from "vitest";
import { dispatchClientTool } from "@/components/voice";
import { windowOutcome } from "./capture-loop";
import { withAnswerConfirmation, type ToolName, type TurnEffect } from "./voice-turn";
import { VoiceTurnAdapter } from "./voice-turn-adapter";

const literal = "I chose second approval because the invoice amount is above 5,000 euros.";
const paraphrase = "the invoice amount is above five thousand euros";

function harness(tag = "ASK", source: "agent" | "fallback" = "agent") {
  const effects: TurnEffect[] = [];
  const adapter = new VoiceTurnAdapter({ now: () => 10, agentConnected: () => source === "agent", applyEffect: (effect) => { effects.push(effect); } });
  const result = adapter.turn(withAnswerConfirmation({ tag, text: "Why this route?", listen: true, recordClip: { sessionId: "test" } }));
  adapter.tick(10);
  adapter.dispatch({ type: "SPEAK_START", at: 11, source });
  adapter.dispatch({ type: "SPEAK_END", at: 13 });
  adapter.tick(13.6);
  const handler = vi.fn(() => "logged");
  const call = (reason: unknown, name: ToolName = "log_answer") => dispatchClientTool(
    handler, { stepRef: "current::window:current", reason },
    () => adapter.dispatch({ type: "TOOL", at: 17, name, params: { reason } }),
    { state: adapter.snapshot(), name },
  );
  const commit = (text = literal, source: "scribe" | "agent_asr" = "scribe") => adapter.dispatch({ type: "HUMAN_COMMIT", at: 15, text, source });
  return { adapter, result, effects, handler, call, commit };
}

describe("client-tool evidence acknowledgment", () => {
  it.each(["ASK", "DEBRIEF"])("keeps %s open on numeric wording mismatch, then saves the literal retry and clip", async (tag) => {
    const h = harness(tag);
    h.commit();
    const reply = await h.call(paraphrase);
    expect(reply).toContain("not_logged:");
    expect(reply).toContain("Retry");
    expect(reply).toContain(literal);
    expect(h.handler).not.toHaveBeenCalled();
    expect(h.adapter.snapshot().phase).toBe("listening");
    expect(h.effects.some((effect) => effect.type === "CLIP_STOP")).toBe(false);
    expect(await h.call(literal)).toBe("logged");
    h.adapter.tick(21);
    expect(windowOutcome(await h.result)).toMatchObject({ outcome: "answered", answerText: literal });
    expect(h.effects).toContainEqual(expect.objectContaining({ type: "CLIP_STOP", upload: true }));
  });

  it.each([undefined, "", "A rule that was never said."])("rejects %s without acknowledging or closing, then times out without uploading", async (reason) => {
    const h = harness();
    h.commit("Would you like some coffee?");
    expect(await h.call(reason)).toContain("not_logged:");
    expect(h.adapter.snapshot().phase).toBe("listening");
    h.adapter.tick(30);
    h.adapter.tick(34);
    expect(await h.result).toMatchObject({ via: "timeout", heard: "" });
    expect(h.effects).toContainEqual(expect.objectContaining({ type: "CLIP_STOP", upload: false }));
  });

  it("does not confirm partial-only evidence, but can retry after a committed transcript arrives", async () => {
    const h = harness();
    h.adapter.dispatch({ type: "HUMAN_PARTIAL", at: 15, text: literal });
    expect(await h.call(literal)).toContain("not_logged:");
    expect(h.adapter.snapshot().phase).toBe("listening");
    h.commit();
    expect(await h.call(literal)).toBe("logged");
    expect(h.adapter.snapshot().close?.heard).toBe(literal);
  });

  it("accepts an exact provider-ASR substring when Scribe differs", async () => {
    const h = harness();
    h.commit("Different Scribe wording.");
    h.commit(literal, "agent_asr");
    expect(await h.call("the invoice amount is above 5,000 euros")).toBe("logged");
    expect(h.adapter.snapshot().close).toMatchObject({ heard: "the invoice amount is above 5,000 euros", heardSource: "agent_asr" });
  });

  it("does not disclose or revive withdrawn text through the error response", async () => {
    const h = harness();
    h.commit();
    h.adapter.dispatch({ type: "COMMAND", at: 16, command: "off_record" });
    const reply = await h.call(literal);
    expect(reply).toContain("not_logged:");
    expect(reply).not.toContain(literal);
    expect(h.handler).not.toHaveBeenCalled();
    expect(h.adapter.snapshot().close).toMatchObject({ via: "aborted", command: "off_record", heard: "" });
  });

  it("preserves mark_off_record precedence even with no evidence", async () => {
    const h = harness();
    await h.call(undefined, "mark_off_record");
    expect(h.handler).toHaveBeenCalledOnce();
    expect(h.adapter.snapshot().close).toMatchObject({ via: "aborted", command: "off_record", heard: "" });
  });

  it("preserves typed completion against subsequent answer calls", async () => {
    const h = harness();
    h.adapter.dispatch({ type: "TYPED", at: 15, text: literal });
    expect(await h.call(literal)).toContain("not_logged:");
    expect(h.handler).not.toHaveBeenCalled();
    expect(h.adapter.snapshot().close).toMatchObject({ via: "typed", heard: literal });
  });

  it("leaves legacy/keyless completion unchanged", async () => {
    const h = harness("ASK", "fallback");
    h.commit();
    expect(await h.call(paraphrase)).toBe("logged");
    expect(h.adapter.snapshot().close?.heard).toBe(literal);
  });
});
