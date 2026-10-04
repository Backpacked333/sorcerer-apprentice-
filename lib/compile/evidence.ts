import type { SessionLog } from "../events";
import { visibleAt } from "../memory";

export function compileEvidence(log: SessionLog) {
  const eligible = log.transcript.filter((s) => s.speaker === "expert" && s.final && !s.redacted && visibleAt(log, s.t, s.tEnd));
  const windows = log.windows.filter((w) => {
    if (w.outcome !== "answered" || !w.answerText) return false;
    const end = w.closedAt ?? w.answeredAt ?? w.openedAt;
    const next = log.windows.find((other) => other.openedAt > w.openedAt)?.openedAt ?? Infinity;
    const spans = eligible.filter((s) => (!s.typedFor || s.typedFor === w.id) && s.t >= (w.askedAt ?? w.openedAt) && s.t < next);
    let answer = "";
    // Final transcripts may arrive while Capture awaits clip upload, after closedAt.
    for (const s of spans) {
      answer = answer ? `${answer} ${s.text}` : s.text;
      if (answer === w.answerText) return visibleAt(log, w.openedAt, Math.max(end, s.tEnd ?? s.t));
      if (!w.answerText.startsWith(`${answer} `)) return false;
    }
    return false;
  });
  return { windows, transcript: eligible.filter((s) => !s.typedFor || windows.some((w) => w.id === s.typedFor)) };
}
