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

  it("fails closed for transcript evidence inside a spoken window with no listen-open clock", () => {
    const window: QuestionWindow = {
      id: "win_aborted_before_listen",
      candidateId: "cand_aborted_before_listen",
      kind: "why",
      question: "What changed?",
      openedAt: 34,
      spokeAt: 34.5,
      closedAt: 40,
      outcome: "aborted",
    };

    expect(isQuotableTranscript({ id: "tr_uncertain", t: 36, tEnd: 37, text: "Unproven speech.", speaker: "expert", final: true }, [window])).toBe(false);
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

  it("uses the closest grounded narration across the existing pre/post event window", () => {
    const log = emptySession("s_nearest", "capture", "Process invoices", "Expert");
    log.events.push(changed("9001", 20, "1000", "2000"));
    log.transcript.push(
      { id: "tr_after", t: 23, text: "Invoice 9001 changed because policy requires equipment coding.", speaker: "expert", final: true },
      { id: "tr_before", t: 19, text: "Invoice 9001 changed because the documented policy requires this coding.", speaker: "expert", final: true },
    );

    const step = compileDeterministic(log).steps.find((candidate) => candidate.invoice === "9001");
    expect(step?.reason).toMatchObject({ text: log.transcript[1].text, t: 19, source: "narration" });
    expect(step?.confidence).toBe("low");
  });

  it("assigns ambiguous same-field narration to only the closest invoice step", () => {
    const log = emptySession("s_ambiguous", "capture", "Process invoices", "Expert");
    log.events.push(changed("9001", 10, "1000", "2000"), changed("9002", 20, "3000", "4000"));
    log.transcript.push({
      id: "tr_shared_field",
      t: 17,
      text: "The cost center changed because the documented policy requires it.",
      speaker: "expert",
      final: true,
    });

    const map = compileDeterministic(log);
    expect(map.steps.find((step) => step.invoice === "9001")?.reason).toBeUndefined();
    expect(map.steps.find((step) => step.invoice === "9002")?.reason?.text).toBe(log.transcript[0].text);
  });

  it("does not treat procedural bare-so narration as a reason", () => {
    const log = emptySession("s_procedural", "capture", "Process invoices", "Expert");
    log.events.push(changed("9001", 10, "1000", "2000"));
    log.transcript.push({
      id: "tr_procedural",
      t: 11,
      text: "So I changed the cost center on invoice 9001 to 2000.",
      speaker: "expert",
      final: true,
    });

    expect(compileDeterministic(log).steps.find((step) => step.invoice === "9001")?.reason).toBeUndefined();
  });
});
