/**
 * Numbers for slide 6. Everything is computed from the session log, nothing is typed by hand.
 */
import type { SessionLog } from "./events";
import type { WorkMap } from "./workmap";

export interface Metrics {
  durationMin: number;
  liveQuestions: number;
  questionsPer10Min: number;
  interruptionsWhileTyping: number;
  medianPauseToFirstWordSecs: number | null;
  medianAnswerSecs: number | null;
  framesSeen: number;
  framesKept: number;
  entitiesRedacted: number;
  secondsStruck: number;
  slotsFilledLive: number;
  slotsFilledNarration: number;
  slotsFilledDebrief: number;
  slotsFilledCounterfactual: number;
  slotsOpen: number;
  interventionLatencySecs: number | null; // teach mode: field change -> tutor speaks
}

export function computeMetrics(log: SessionLog, map?: WorkMap): Metrics {
  const end = (log.endedAt ?? Date.now()) - log.startedAt;
  const durationMin = Math.max(0.1, end / 60000);
  const live = log.windows.filter((w) => ["why", "counterfactual", "limit", "stop", "who"].includes(w.kind));
  const typingEvents = log.events.filter((e) => e.kind === "typing" || e.uiActivity === "typing");
  // a question counts as an interruption if a typing event occurred within 1.5 s before it was asked
  const interruptions = live.filter((w) => w.askedAt !== undefined && typingEvents.some((e) => e.t <= w.askedAt! && w.askedAt! - e.t <= 1.5)).length;
  const pauseToWord = live.filter((w) => w.askedAt !== undefined).map((w) => w.askedAt! - w.openedAt);
  const answerSecs = live.filter((w) => w.askedAt !== undefined && w.answeredAt !== undefined).map((w) => w.answeredAt! - w.askedAt!);
  const struck = log.offRecord.reduce((a, r) => a + (r.to - r.from), 0);
  const bySource = (src: string) => {
    if (!map) return 0;
    const quotes = map.steps.flatMap((s) => [s.reason, ...s.guardrails.map((g) => g.quote)]).filter(Boolean) as { source: string }[];
    return quotes.filter((q) => q.source === src).length;
  };
  const interventions = log.windows.filter((w) => w.kind === "intervene" && w.askedAt !== undefined);
  const interventionLatency = interventions.length ? median(interventions.map((w) => w.askedAt! - w.openedAt)) : null;
  return {
    durationMin: round(durationMin, 1),
    liveQuestions: live.length,
    questionsPer10Min: round((live.length / durationMin) * 10, 1),
    interruptionsWhileTyping: interruptions,
    medianPauseToFirstWordSecs: pauseToWord.length ? round(median(pauseToWord), 2) : null,
    medianAnswerSecs: answerSecs.length ? round(median(answerSecs), 1) : null,
    framesSeen: map?.privacy.framesSeen ?? log.frames.length,
    framesKept: log.frames.length,
    entitiesRedacted: map?.privacy.entitiesRedacted ?? 0,
    secondsStruck: round(struck, 1),
    slotsFilledLive: bySource("live"),
    slotsFilledNarration: bySource("narration"),
    slotsFilledDebrief: bySource("debrief"),
    slotsFilledCounterfactual: bySource("counterfactual"),
    slotsOpen: map?.slots.filter((s) => s.status === "open").length ?? 0,
    interventionLatencySecs: interventionLatency === null ? null : round(interventionLatency, 2),
  };
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}
const round = (n: number, d: number) => Math.round(n * 10 ** d) / 10 ** d;
