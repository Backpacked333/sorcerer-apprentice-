import { describe, expect, it, vi } from "vitest";
import { dispatchClientTool } from "@/components/voice";
import { withAnswerConfirmation, type ToolName, type TurnEffect } from "./voice-turn";
import { VoiceTurnAdapter } from "./voice-turn-adapter";

const transcript = "I checked the route because of the limit.";

function harness(source: "agent" | "fallback" = "agent") {
  const effects: TurnEffect[] = [];
  const adapter = new VoiceTurnAdapter({ now: () => 10, agentConnected: () => source === "agent", applyEffect: (effect) => { effects.push(effect); } });
  const result = adapter.turn(withAnswerConfirmation({ tag: "ASK", text: "Why this route?", listen: true, recordClip: { sessionId: "test" } }));
  const handler = vi.fn(() => "logged");
  const call = (reason = transcript, at = 17, name: ToolName = "log_answer") => dispatchClientTool(
    handler, { stepRef: "current::window:current", reason },
    () => adapter.dispatch({ type: "TOOL", at, name, params: { reason } }),
    { state: adapter.snapshot(), name },
  );
  const commit = () => adapter.dispatch({ type: "HUMAN_COMMIT", at: 15, text: transcript });
  const speak = () => {
    adapter.dispatch({ type: "SPEAK_START", at: 11, source });
    adapter.dispatch({ type: "SPEAK_END", at: 13 });
  };
  const listen = () => { speak(); adapter.tick(13.6); commit(); };
  return { adapter, result, effects, handler, call, commit, speak, listen };
}

describe("guarded answer-tool lifecycle", () => {
  it.each(["sending", "waiting_for_speech"])("rejects tools during %s before the speech source is known", async (phase) => {
    const h = harness();
    if (phase === "waiting_for_speech") h.adapter.tick(10);
    h.commit();
    const before = h.adapter.snapshot();
    const reply = await h.call();
    expect(reply).toContain("not_logged:");
    expect(reply).not.toContain(transcript);
    expect(h.handler).not.toHaveBeenCalled();
    expect(h.adapter.snapshot()).toBe(before);
  });

  it("rejects during the speech-end hold, then accepts a first answer once listening", async () => {
    const h = harness();
    h.speak();
    h.adapter.tick(13.1);
    const reply = await h.call(transcript, 13.1);
    expect(reply).toContain("not_logged:");
    expect(h.handler).not.toHaveBeenCalled();
    expect(h.adapter.snapshot().phase).toBe("speaking");
    h.adapter.tick(13.6);
    h.commit();
    expect(await h.call()).toBe("logged");
    expect(h.adapter.snapshot().close?.heard).toBe(transcript);
  });

  it("rejects a second answer during closing without replacing the first excerpt or timestamp", async () => {
    const h = harness();
    h.listen();
    expect(await h.call("I checked the route")).toBe("logged");
    const close = h.adapter.snapshot().close;
    const reply = await h.call("because of the limit", 17.1);
    expect(reply).toContain("not_logged:");
    expect(reply).not.toContain(transcript);
    expect(h.handler).toHaveBeenCalledOnce();
    expect(h.adapter.snapshot().close).toBe(close);
    h.adapter.tick(21);
    expect(await h.result).toMatchObject({ via: "tool", heard: "I checked the route", answeredAt: 15 });
    expect(h.effects).toContainEqual(expect.objectContaining({ type: "CLIP_STOP", upload: true }));
  });

  it("cannot reuse a pre-listening commit after the current UI opens its answer window", async () => {
    const h = harness();
    h.speak();
    h.adapter.dispatch({ type: "HUMAN_COMMIT", at: 13.1, text: transcript });
    expect(await h.call(transcript, 13.2)).toContain("not_logged:");
    h.adapter.tick(13.6);
    expect(await h.call(transcript, 13.7)).toContain("no committed expert transcript");
    expect(h.handler).not.toHaveBeenCalled();
    h.commit();
    expect(await h.call()).toBe("logged");
    h.adapter.tick(21);
    expect(await h.result).toMatchObject({ heard: transcript, answerStartedAt: 15, answeredAt: 15 });
  });

  it("also ignores duplicate TOOL events at the reducer boundary", async () => {
    const h = harness();
    h.listen();
    await h.call("I checked the route");
    const close = h.adapter.snapshot().close;
    h.adapter.dispatch({ type: "TOOL", at: 17.1, name: "log_answer", params: { reason: "because of the limit" } });
    expect(h.adapter.snapshot().close).toBe(close);
  });

  it("still accepts a first literal answer during timeout closing", async () => {
    const h = harness();
    h.listen();
    h.adapter.tick(30);
    expect(h.adapter.snapshot().close).toMatchObject({ via: "timeout", heard: "" });
    expect(await h.call(transcript, 30.1)).toBe("logged");
    expect(h.adapter.snapshot().close).toMatchObject({ via: "tool", heard: transcript });
  });

  it("still allows mark_off_record to override an accepted answer", async () => {
    const h = harness();
    h.listen();
    await h.call();
    await h.call("", 17.1, "mark_off_record");
    expect(h.adapter.snapshot().close).toMatchObject({ via: "aborted", command: "off_record", heard: "" });
    expect(await h.call()).toContain("not_logged:");
    h.adapter.tick(21);
    expect(await h.result).toMatchObject({ via: "aborted", heard: "", command: "off_record" });
    expect(h.effects).toContainEqual(expect.objectContaining({ type: "CLIP_STOP", upload: false }));
  });

  it("preserves intentional browser-fallback completion without a literal tool reason", async () => {
    const h = harness("fallback");
    h.listen();
    expect(await h.call("provider paraphrase")).toBe("logged");
    expect(h.adapter.snapshot().close?.heard).toBe(transcript);
  });
});
