import { describe, expect, it } from "vitest";

import { windowOutcome } from "./capture-loop";
import { compileDeterministic } from "./compile/steps";
import { emptySession, type QuestionWindow } from "./events";
import { initialTurnState, reduce, type TurnEffect, type TurnState } from "./voice-turn";

const resolvedResult = (effects: TurnEffect[]) => {
  const effect = effects.find((candidate) => candidate.type === "RESOLVE");
  if (!effect || effect.type !== "RESOLVE") throw new Error("turn did not resolve");
  return effect.result;
};

describe("authoritative answer evidence", () => {
  it("does not turn a commit during agent speech into answer evidence", () => {
    let state: TurnState = reduce(initialTurnState, {
      type: "SEND",
      at: 34,
      agentConnected: true,
      audioId: "clip-real-answer",
      options: {
        tag: "ASK",
        text: "You re-coded invoice 4473 from 4300 to 4050. What made you choose 4050?",
        listen: true,
        timeoutSecs: 12,
        silenceCloseSecs: 2.5,
        recordClip: { sessionId: "s_reproduced" },
      },
    }).state;
    state = reduce(state, { type: "TICK", at: 34 }).state;
    state = reduce(state, { type: "SPEAK_START", at: 34.587, source: "agent" }).state;

    // Exact false-quote timing from the live session: this commit overlaps agent speech.
    state = reduce(state, { type: "HUMAN_COMMIT", at: 37.65, text: "Пусть.", source: "scribe" }).state;
    state = reduce(state, { type: "SPEAK_END", at: 43.992 }).state;
    state = reduce(state, { type: "TICK", at: 44.592 }).state;
    expect(state).toMatchObject({ phase: "listening", askedAt: 44.592, scribeText: "" });

    // The real human answer starts after listening opens and commits later.
    const realAnswer = "The invoice required a consumable cost center, so I changed it to 4050.";
    state = reduce(state, { type: "HUMAN_PARTIAL", at: 51.434, text: "The invoice required" }).state;
    state = reduce(state, { type: "HUMAN_COMMIT", at: 61.201, text: realAnswer, source: "scribe" }).state;
    state = reduce(state, { type: "TICK", at: 63.701 }).state;
    const finished = reduce(state, { type: "TICK", at: 66.201 });
    const result = resolvedResult(finished.effects);

    expect(result).toMatchObject({
      via: "scribe",
      heard: realAnswer,
      askedAt: 44.592,
      answeredAt: 61.201,
      audioId: "clip-real-answer",
    });

    const mapped = windowOutcome(result);
    expect(mapped.answerText).toBe(realAnswer);
    const log = emptySession("s_reproduced", "capture", "Process invoices", "Expert");
    log.events.push({
      id: "evt_4473_cost_center",
      t: 23.466,
      source: "dom",
      kind: "field_changed",
      invoice: "4473",
      field: "costCenter",
      from: "4300",
      to: "4050",
    });
    log.windows.push({
      id: "win_4473",
      candidateId: "cand_4473",
      kind: "why",
      question: "What made you choose 4050?",
      stepRef: "4473:costCenter",
      openedAt: 34,
      spokeAt: 34.587,
      askedAt: result.askedAt,
      answeredAt: result.answeredAt,
      closedAt: result.closedAt,
      outcome: mapped.outcome === "remove" ? "aborted" : mapped.outcome,
      answerText: mapped.answerText,
      answerAudioId: mapped.answerAudioId,
    });

    expect(compileDeterministic(log).steps.find((step) => step.invoice === "4473")?.reason).toMatchObject({
      text: realAnswer,
      t: 61.201,
      audioId: "clip-real-answer",
    });
  });

  it("does not return a clip when the accepted commit began before recording opened", () => {
    let state: TurnState = reduce(initialTurnState, {
      type: "SEND",
      at: 10,
      agentConnected: true,
      audioId: "clip-started-at-listen-open",
      options: {
        tag: "ASK",
        text: "What changed?",
        listen: true,
        silenceCloseSecs: 2.5,
        recordClip: { sessionId: "s_barge_in" },
      },
    }).state;
    state = reduce(state, { type: "TICK", at: 10 }).state;
    state = reduce(state, { type: "SPEAK_START", at: 11, source: "agent" }).state;
    state = reduce(state, { type: "SPEAK_END", at: 13 }).state;
    state = reduce(state, { type: "TICK", at: 13.6 }).state;
    state = reduce(state, {
      type: "HUMAN_COMMIT",
      startedAt: 13.2,
      at: 14.2,
      text: "I began answering while the question was ending.",
      source: "scribe",
    }).state;
    state = reduce(state, { type: "TICK", at: 16.7 }).state;
    const finished = reduce(state, { type: "TICK", at: 19.2 });

    expect(resolvedResult(finished.effects)).toMatchObject({
      heard: "I began answering while the question was ending.",
      askedAt: 13.6,
      answeredAt: 14.2,
    });
    expect(resolvedResult(finished.effects).audioId).toBeUndefined();
  });
});
