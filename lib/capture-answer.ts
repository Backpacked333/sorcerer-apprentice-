import type { SessionLog } from "./events";
import { visibleAt } from "./memory";
import { redactText } from "./redact";

/** Persist an accepted typed turn before applying its closed-window outcome. */
export function recordTypedAnswer(log: SessionLog, windowId: string | undefined, text: string, t: number): number | undefined {
  const w = log.windows.find((w) => w.id === windowId);
  if (log.mode !== "capture" || !w || w.outcome || !text.trim() || !Number.isFinite(t)
    || t < (w.askedAt ?? w.openedAt) || !visibleAt(log, w.openedAt, t)) return;
  const clean = redactText(text.trim(), [log.expertName]);
  log.transcript.push({ id: `tr_${log.transcript.length}`, typedFor: w.id, t, text: clean.text,
    speaker: "expert", final: true, redacted: clean.entities.length > 0 });
  w.answerText = [w.answerText, clean.text].filter(Boolean).join(" ");
  w.answeredAt ??= t;
  w.closedBy = "user";
  return clean.entities.length;
}
