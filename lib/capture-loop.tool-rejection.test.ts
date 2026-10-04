import { describe, expect, it, vi } from "vitest";
import { dispatchClientTool } from "@/components/voice";
import { captureAnswerToolRejection, captureToolStepRef, windowOutcome } from "./capture-loop";
import type { QuestionWindow } from "./events";
import { withAnswerConfirmation } from "./voice-turn";
import { VoiceTurnAdapter } from "./voice-turn-adapter";

const active: QuestionWindow = {
  id: "current", candidateId: "candidate", stepRef: "invoice:route", kind: "why",
  question: "Why did you choose that route?", openedAt: 10, askedAt: 13.6,
};
const currentRef = captureToolStepRef(active.stepRef!, active.id);

describe("Capture tool rejection", () => {
  it.each([undefined, "", "invoice:route", "invoice:route::window:old", "another:route::window:current"])("rejects %s promptly without dispatch or window mutation", async (stepRef) => {
    const snapshot = structuredClone(active);
    const dispatch = vi.fn();
    const reply = await dispatchClientTool((params) => captureAnswerToolRejection(active, params.stepRef) ?? "logged", { stepRef }, dispatch);
    expect(reply).toContain("not_logged:");
    expect(reply).toContain(currentRef);
    expect(reply).toContain("Never move an older answer");
    expect(dispatch).not.toHaveBeenCalled();
    expect(active).toEqual(snapshot);
  });

  it.each([undefined, { ...active, outcome: "off_record" as const }, { ...active, closedAt: 20 }])("rejects absent or closed questions without inviting a retry", (window) => {
    expect(captureAnswerToolRejection(window, currentRef)).toMatchObject({ dispatch: false, message: expect.stringContaining("Do not retry") });
  });

  it("keeps listening after a stale tool and accepts a corrected reference only with literal current speech", async () => {
    let now = 10;
    const effects: string[] = [];
    const adapter = new VoiceTurnAdapter({ now: () => now, agentConnected: () => true, applyEffect: (effect) => { effects.push(effect.type); } });
    const result = adapter.turn(withAnswerConfirmation({ tag: "ASK", text: `${active.question} | stepRef=${currentRef}`, listen: true }));
    adapter.tick(10);
    adapter.dispatch({ type: "SPEAK_START", at: 11, source: "agent" });
    adapter.dispatch({ type: "SPEAK_END", at: 13 });
    adapter.tick(13.6);
    const reason = "I chose this route because the invoice needs a second reviewer.";
    adapter.dispatch({ type: "HUMAN_COMMIT", at: 14, text: reason });
    now = 15;
    const call = (stepRef: string) => dispatchClientTool(
      (params) => captureAnswerToolRejection(active, params.stepRef) ?? "logged",
      { stepRef, reason },
      () => adapter.dispatch({ type: "TOOL", at: now, name: "log_answer", params: { stepRef, reason } }),
    );
    expect(await call("invoice:route::window:old")).toContain("not_logged:");
    expect(adapter.snapshot().phase).toBe("listening");
    expect(effects).not.toContain("RESOLVE");
    expect(await call(currentRef)).toBe("logged");
    expect(adapter.snapshot().close).toMatchObject({ via: "tool", heard: reason });
    adapter.tick(19);
    expect(windowOutcome(await result)).toMatchObject({ outcome: "answered", answerText: reason });
  });

  it.each(["logged", undefined])("preserves existing %s handler dispatch", async (response) => {
    const dispatch = vi.fn();
    expect(await dispatchClientTool(() => response, {}, dispatch)).toBe(response ?? "ok");
    expect(dispatch).toHaveBeenCalledOnce();
  });

  it.each([
    { stepRef: "invoice:route::window:old", reason: "This needs a second reviewer." },
    { stepRef: currentRef, reason: "A model-written answer that was never spoken." },
  ])("never uploads a clip or fills a slot for an unconfirmed call: %s", async (params) => {
    const stopClip = vi.fn();
    const adapter = new VoiceTurnAdapter({
      now: () => 10, agentConnected: () => true,
      applyEffect: (effect) => { if (effect.type === "CLIP_STOP") stopClip(effect.upload); },
    });
    const result = adapter.turn(withAnswerConfirmation({
      tag: "ASK", text: active.question, listen: true, timeoutSecs: 12,
      recordClip: { sessionId: "test-session" },
    }));
    adapter.tick(10);
    adapter.dispatch({ type: "SPEAK_START", at: 11, source: "agent" });
    adapter.dispatch({ type: "SPEAK_END", at: 13 });
    adapter.tick(13.6);
    adapter.dispatch({ type: "HUMAN_COMMIT", at: 14, text: "This needs a second reviewer." });
    await dispatchClientTool(
      () => captureAnswerToolRejection(active, params.stepRef) ?? "logged", params,
      () => adapter.dispatch({ type: "TOOL", at: 15, name: "log_answer", params }),
    );
    adapter.tick(30);
    adapter.tick(34);
    const outcome = await result;
    expect(outcome).toMatchObject({ via: params.stepRef === currentRef ? "tool" : "timeout", heard: "" });
    expect(outcome.audioId).toBeUndefined();
    expect(windowOutcome(outcome)).toMatchObject({ candidateStatus: "debrief" });
    expect(windowOutcome(outcome).answerText ?? "").toBe("");
    expect(stopClip).toHaveBeenCalledExactlyOnceWith(false);
  });

  it("preserves tool lifecycle dispatch when a legacy handler fails", async () => {
    const dispatch = vi.fn();
    await expect(dispatchClientTool(() => { throw new Error("failed"); }, {}, dispatch)).rejects.toThrow("failed");
    expect(dispatch).toHaveBeenCalledOnce();
  });
});
