import type { QuestionWindow, TranscriptSegment } from "../events";

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
