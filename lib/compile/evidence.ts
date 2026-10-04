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
    if (window.askedAt === undefined) return false;
    const speechStarted = window.spokeAt ?? window.openedAt;
    return end >= speechStarted && end < window.askedAt;
  });
}
