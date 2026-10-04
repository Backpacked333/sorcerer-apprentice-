import { openSlots, type WorkMap } from "./workmap";

export function confirmationIssues(map: WorkMap): string[] {
  const issues: string[] = [];
  if (!map.steps.length) issues.push("Capture a workflow before confirming.");
  if (!map.rules.length) issues.push("At least one expert-supported rule is needed to teach.");
  if (openSlots(map).length) issues.push("Answer the remaining debrief questions first.");
  if (map.slots.filter((slot) => slot.status === "filled" && slot.filledBy?.text.trim()).length < 3) issues.push("Complete at least three debrief answers.");
  for (const step of map.steps) {
    if (step.judgment && !step.reason?.text.trim()) issues.push(`Add the expert's reason for ${step.title}.`);
    if (!step.screenMoment.frameId) issues.push(`Capture screen evidence for ${step.title}.`);
    if (step.guardrails.some((guardrail) => !guardrail.quote?.text.trim())) issues.push(`Add the expert's words for the guardrails on ${step.title}.`);
  }
  if (map.rules.some((rule) => !rule.quotes.length || !map.steps.some((step) => step.id === rule.stepId))) issues.push("Each rule needs expert evidence and an observed step.");
  return issues;
}
