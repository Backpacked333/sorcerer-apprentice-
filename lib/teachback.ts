/**
 * The teach-back: the apprentice explains the process back, from the map, not the transcript.
 * Calibrated: says what it is sure of and what it is guessing, so the expert corrects only the uncertain claims.
 * Hard cap of 130 words (about 55 seconds spoken).
 */
import { describeCond, type WorkMap } from "./workmap";

export const TEACHBACK_WORD_CAP = 130;

export function generateTeachback(map: WorkMap): { text: string; sure: string[]; unsure: string[] } {
  const judgment = map.steps.filter((s) => s.judgment).sort((a, b) => a.index - b.index);
  const sure: string[] = [];
  const unsure: string[] = [];
  for (const step of judgment) {
    const rule = map.rules.find((r) => r.stepId === step.id);
    const cond = rule ? describeCond(rule.when) : `on invoice ${step.invoice}`;
    const reason = step.reason?.text ? shorten(step.reason.text, 14) : undefined;
    const sentence = reason ? `When ${cond}, you ${verb(step)}, because, in your words, "${reason}".` : `When ${cond}, you ${verb(step)}.`;
    if (rule?.confidence === "high" || (step.reason && rule?.confidence === "medium")) sure.push(sentence);
    else unsure.push(sentence);
  }
  const stops = map.rules.filter((r) => r.stopAndAsk).map((r) => `You stop and ask ${r.stopAndAsk!.who} when ${describeCond(r.stopAndAsk!.when)}.`);
  const routine = map.steps.filter((s) => !s.judgment).length;
  const parts: string[] = [];
  parts.push(`Here is how I understand it. ${routine ? `${routine} routine steps, ` : ""}${judgment.length} decisions.`);
  if (sure.length) parts.push(`I am confident about this: ${sure.join(" ")}`);
  if (stops.length) parts.push(stops.join(" "));
  if (unsure.length) parts.push(`I am less sure about this, correct me there: ${unsure.join(" ")}`);
  parts.push("Is that how it works?");
  return { text: capWords(parts.join(" "), TEACHBACK_WORD_CAP), sure, unsure };
}

function verb(step: WorkMap["steps"][number]): string {
  if ("field" in step.action) return `code it to ${step.action.to}`;
  switch (step.action.type) {
    case "hold":
      return "put it on hold";
    case "route":
      return "send it for a second approval";
    case "approve":
      return "approve it";
    default:
      return step.decision.toLowerCase();
  }
}

function shorten(text: string, words: number): string {
  const w = text.replace(/\s+/g, " ").trim().split(" ");
  return w.length <= words ? w.join(" ") : w.slice(0, words).join(" ") + "...";
}

export function capWords(text: string, cap: number): string {
  const w = text.split(/\s+/);
  if (w.length <= cap) return text;
  // drop from the "less sure" tail first, keep the closing question
  const cut = w.slice(0, cap - 5).join(" ");
  return cut.replace(/[,;:]?\s*\S*$/, "") + ". Is that how it works?";
}

export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}
