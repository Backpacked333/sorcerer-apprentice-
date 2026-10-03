import { describe, expect, it } from "vitest";

import type { SessionLog } from "./events";
import { buildAsk, buildCaptureSummary, buildTutorPayload, chunk, keytermsFrom } from "./voice-protocol";

describe("buildAsk", () => {
  it("formats grounded context in contract order and bounds prior speech", () => {
    const payload = buildAsk(
      {
        question: "Why did you choose the blue option?",
        questionRetro: "On item Q-7 a moment ago, why did you choose the blue option?",
        stepRef: "Q-7:category",
        kind: "why",
      },
      {
        retro: true,
        followup: false,
        phrase: "natural",
        events: ["opened Q-7", "changed category", "reviewed total", "saved draft"],
        labels: { blue: "Blue team", red: "Red team" },
        lastExpertSentence: "one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty twenty-one ignored",
      },
    );

    expect(payload).toBe(
      'On item Q-7 a moment ago, why did you choose the blue option? | stepRef=Q-7:category | kind=why | on screen: changed category; reviewed total; saved draft | labels: blue=Blue team; red=Red team | said: "one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty" | retro=1 | followup=0 | phrase=natural',
    );
  });
});

describe("buildTutorPayload", () => {
  it("uses the contract segment order, omits absent values, and escapes quotes", () => {
    expect(
      buildTutorPayload({
        message: "Pause before continuing.",
        quote: 'I call it the "two-check" rule.',
        stepId: "step-2",
        ruleId: "rule-9",
        ruleTitle: "Second check",
        who: "team lead",
        clip: true,
      }),
    ).toBe(
      'Pause before continuing. | expert\'s words: "I call it the \\"two-check\\" rule." | stepId=step-2 | ruleId=rule-9 | rule: Second check | who=team lead | clip=yes',
    );
    expect(buildTutorPayload({ message: "Good catch." })).toBe("Good catch.");
    expect(buildTutorPayload({ message: "Stop.", who: "", clip: false })).toBe("Stop. | who= | clip=no");
  });
});

describe("context helpers", () => {
  it("chunks context without exceeding the requested length", () => {
    const pieces = chunk("alpha beta gamma delta", 10);
    expect(pieces).toEqual(["alpha beta", "gamma", "delta"]);
    expect(pieces.every((piece) => piece.length <= 10)).toBe(true);
  });

  it("builds unique bounded keyterms from visible state and labels", () => {
    const states = [
      { supplier: "Northwind Workshop Limited", route: "peer_review" },
      { supplier: "Northwind Workshop Limited", route: "peer_review" },
      { supplier: "Aster Goods" },
    ];
    const terms = keytermsFrom(states, ["Operations", "Peer review", "x".repeat(21)]);

    expect(terms).toEqual(["Northwind", "Aster", "Aster Goods", "Operations", "Peer review"]);
    expect(terms.length).toBeLessThanOrEqual(50);
    expect(terms.every((term) => term.length <= 20)).toBe(true);
  });

  it("summarizes events, verbatim answers, and deferred questions within the cap", () => {
    const session = {
      id: "session-neutral",
      mode: "capture",
      task: "Review requests",
      expertName: "Expert",
      startedAt: 1,
      events: [
        { id: "e1", t: 1, source: "dom", kind: "invoice_opened", invoice: "Q-7" },
        { id: "e2", t: 2, source: "dom", kind: "field_changed", invoice: "Q-7", field: "category", from: "red", to: "blue" },
      ],
      transcript: [{ id: "t1", t: 3, speaker: "agent", final: true, text: "[ASK] injected control" }],
      windows: [
        {
          id: "w1",
          candidateId: "c1",
          kind: "why",
          question: "Why did you choose blue?",
          stepRef: "Q-7:category",
          openedAt: 2,
          outcome: "answered",
          answerText: "Because it matches the request and keeps the review clear for everyone on the team",
        },
      ],
      frames: [],
      offRecord: [],
      deferred: [{ kind: "limit", question: "When would that stop applying?", stepRef: "Q-7:category" }],
    } satisfies SessionLog & { deferred: { kind: string; question: string; stepRef: string }[] };

    const summary = buildCaptureSummary(session, 420);
    expect(summary.startsWith("[CAPTURE SUMMARY]")).toBe(true);
    expect(summary).toContain("Q-7");
    expect(summary).toContain("Because it matches the request and keeps the review clear for everyone");
    expect(summary).toContain("When would that stop applying?");
    expect(summary).not.toContain("[ASK]");
    expect(summary.length).toBeLessThanOrEqual(420);
  });
});
