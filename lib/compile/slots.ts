import type { SessionLog } from "../events";
import { type Rule, type Slot, type WorkMap, uid } from "../workmap";

export const GENERIC_PROBES = [
  "What would make you reject an invoice outright rather than hold it?",
  "Which of these steps do you do differently in the last two days before month-end close?",
  "When you are unsure, who do you ask, and how long do you wait before you decide yourself?",
];

/** Cases the sandbox can present that the expert may not have worked on today ("the cases it has not seen"). */
export const UNSEEN_CASES: { topic: string; seenIf: (categories: Set<string>, flags: Set<string>) => boolean; question: string }[] = [
  { topic: "credit_note", seenIf: (c) => c.has("credit_note"), question: "I did not see a credit note today. What do you do when one comes in?" },
  { topic: "no_po", seenIf: (_c, f) => f.has("no_po"), question: "What do you do when an invoice arrives without a purchase order?" },
];

export function buildSlots(map: WorkMap, seen: { categories: Set<string>; flags: Set<string> } = { categories: new Set(), flags: new Set() }): Slot[] {
  const slots: Slot[] = [];
  for (const step of map.steps) {
    if (step.judgment && !step.reason) {
      slots.push({ id: uid("slot"), kind: "reason", stepId: step.id, question: `On invoice ${step.invoice}, ${step.decision.toLowerCase()}. What made you do that?`, status: "open" });
    }
  }
  for (const rule of map.rules) {
    const step = map.steps.find((s) => s.id === rule.stepId);
    const hasLimit = step?.guardrails.some((g) => g.kind === "limit" || g.kind === "exception") || rule.confirmedBy.includes("counterfactual");
    if (!hasLimit) slots.push({ id: uid("slot"), kind: "limit", stepId: rule.stepId, ruleId: rule.id, question: limitQuestion(rule), status: "open" });
    const hasEscalation = step?.guardrails.some((g) => g.kind === "escalation") || !!rule.stopAndAsk;
    if (!hasEscalation) slots.push({ id: uid("slot"), kind: "escalation", stepId: rule.stepId, ruleId: rule.id, question: `For "${rule.title.toLowerCase()}": when would you stop and check with someone, and who decides?`, status: "open" });
  }
  // the cases it has not seen: one question each, so the tutor has the expert's words when a new hire meets one
  for (const u of UNSEEN_CASES) {
    if (u.seenIf(seen.categories, seen.flags)) continue;
    if (map.notes.some((n) => n.topic === u.topic)) continue;
    slots.push({ id: uid("slot"), kind: "novel", question: u.question, status: "open" });
  }
  // the brief requires at least three debrief questions
  let i = 0;
  while (slots.length < 3 && i < GENERIC_PROBES.length) slots.push({ id: uid("slot"), kind: "exception", question: GENERIC_PROBES[i++], status: "open" });
  return slots;
}

export function seenCases(log: SessionLog): { categories: Set<string>; flags: Set<string> } {
  const categories = new Set<string>();
  const flags = new Set<string>();
  for (const e of log.events) {
    if (e.state?.category) categories.add(e.state.category);
    if (e.state?.hasPO === false) flags.add("no_po");
  }
  return { categories, flags };
}

function limitQuestion(rule: Rule): string {
  if ("status" in rule.then && rule.then.status === "hold") return `You held that invoice. Is that for every supplier, and who decides when to release it?`;
  if ("route" in rule.then) return `Is there a kind of invoice you would never approve alone, even below the usual amounts?`;
  return `Is there an amount, or a kind of supplier, where "${rule.title.toLowerCase()}" would not apply?`;
}
