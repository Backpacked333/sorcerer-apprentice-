import { describe, expect, it } from "vitest";

import { compileDeterministic } from "./compile/steps";
import { isQuotableTranscript } from "./compile/evidence";
import { emptySession, type QuestionWindow, type ScreenEvent } from "./events";

const changed = (invoice: string, t: number, from: string, to: string): ScreenEvent => ({
  id: `evt_${invoice}`,
  t,
  source: "dom",
  kind: "field_changed",
  invoice,
  field: "costCenter",
  from,
  to,
});

describe("compiled reason evidence integrity", () => {
  it("refuses an answered-window quote whose evidence predates listening eligibility", () => {
    const log = emptySession("s_bad_clock", "capture", "Process invoices", "Expert");
    log.events.push(changed("4473", 23.466, "4300", "4050"));
    log.windows.push({
      id: "win_bad_clock",
      candidateId: "cand_bad_clock",
      kind: "why",
      question: "What made you choose 4050?",
      stepRef: "4473:costCenter",
      openedAt: 34.007,
      spokeAt: 34.587,
      askedAt: 44.592,
      answeredAt: 37.65,
      closedAt: 49.606,
      outcome: "answered",
      answerText: "Unattributable pre-listening text.",
      answerAudioId: "clip_started_at_44_592",
    } satisfies QuestionWindow);

    const step = compileDeterministic(log).steps.find((candidate) => candidate.invoice === "4473");
    expect(step?.reason).toBeUndefined();
  });

  it("excludes pre-listening commits from the quotable expert corpus", () => {
    const window: QuestionWindow = {
      id: "win_4473",
      candidateId: "cand_4473",
      kind: "why",
      question: "What made you choose 4050?",
      stepRef: "4473:costCenter",
      openedAt: 34.007,
      spokeAt: 34.587,
      askedAt: 44.592,
    };

    expect(isQuotableTranscript({ id: "tr_false", t: 36.644, tEnd: 37.65, text: "Pre-listening noise.", speaker: "expert", final: true }, [window])).toBe(false);
    expect(isQuotableTranscript({ id: "tr_real", t: 51.434, tEnd: 61.201, text: "The real human answer.", speaker: "expert", final: true }, [window])).toBe(true);
  });

  it("attaches nearby narration only to the invoice it explicitly names", () => {
    const log = emptySession("s_two_invoices", "capture", "Process invoices", "Expert");
    log.events.push(changed("9001", 10, "1000", "2000"), changed("9002", 20, "3000", "4000"));
    log.transcript.push({
      id: "tr_9002_reason",
      t: 21,
      text: "Invoice 9002 changed because the policy requires research equipment coding.",
      speaker: "expert",
      final: true,
    });

    const map = compileDeterministic(log);
    expect(map.steps.find((step) => step.invoice === "9001")?.reason).toBeUndefined();
    expect(map.steps.find((step) => step.invoice === "9002")?.reason).toMatchObject({
      text: "Invoice 9002 changed because the policy requires research equipment coding.",
      source: "narration",
    });
  });
});
