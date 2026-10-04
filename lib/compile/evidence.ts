import type { QuestionWindow, SessionLog, TranscriptSegment } from "../events";
import { visibleAt } from "../memory";

/** A window answer is quotable only when its persisted clock proves it followed listen-open. */
export function isQuotableWindow(window: QuestionWindow): boolean {
  if (window.outcome !== "answered" || !window.answerText?.trim()) return false;
  if (window.askedAt === undefined || window.answeredAt === undefined) return false;
  if (window.answeredAt < window.askedAt) return false;
  if (window.closedAt !== undefined && window.answeredAt > window.closedAt) return false;
  return true;
}

/** Exclude transcript commits captured while an agent question was still speaking. */
export function isQuotableTranscript(segment: TranscriptSegment, windows: QuestionWindow[]): boolean {
  if (segment.speaker !== "expert" || segment.redacted || !segment.final || !segment.text.trim()) return false;
  const end = segment.tEnd ?? segment.t;
  return !windows.some((window) => {
    const speechStarted = window.spokeAt ?? window.openedAt;
    if (window.askedAt === undefined) {
      const activeUntil = window.closedAt ?? Number.POSITIVE_INFINITY;
      return segment.t <= activeUntil && end >= speechStarted;
    }
    return end >= speechStarted && end < window.askedAt;
  });
}

export function compileEvidence(log: SessionLog) {
  const eligible = log.transcript.filter((s) => isQuotableTranscript(s, log.windows) && visibleAt(log, s.t, s.tEnd));
  const windows = log.windows.filter((w) => {
    if (!isQuotableWindow(w) || !visibleAt(log, w.openedAt, w.closedAt ?? w.answeredAt)) return false;
    const next = Math.min(...log.windows.filter((other) => other.openedAt > w.openedAt).map((other) => other.openedAt));
    const spans = eligible.filter((s) => (!s.typedFor || s.typedFor === w.id) && (s.tEnd ?? s.t) >= w.askedAt! && (s.tEnd ?? s.t) < next);
    let answer = "";
    for (const s of spans) {
      answer = answer ? `${answer} ${s.text}` : s.text;
      if (answer === w.answerText) return visibleAt(log, w.openedAt, Math.max(w.closedAt ?? w.answeredAt!, s.tEnd ?? s.t));
      if (!w.answerText!.startsWith(`${answer} `)) return false;
    }
    return false;
  });
  return { windows, transcript: eligible.filter((s) => !s.typedFor || windows.some((w) => w.id === s.typedFor)) };
}
