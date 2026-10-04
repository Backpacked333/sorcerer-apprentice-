import type { QuestionWindow, TranscriptSegment } from "../events";
import type { Quote, Rule } from "../workmap";

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

/** Provenance of an answer quote, from the kind of question window it answered. */
export function sourceForWindowKind(kind: QuestionWindow["kind"]): Quote["source"] {
  return kind === "counterfactual" ? "counterfactual" : kind === "debrief" ? "debrief" : "live";
}

/** How each quote confirms a rule; narration and live answers both count as live. */
export function confirmedByOf(quotes: Quote[]): Rule["confirmedBy"] {
  return quotes.map((q) => (q.source === "counterfactual" ? "counterfactual" : q.source === "debrief" ? "debrief" : "live"));
}
