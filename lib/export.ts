/**
 * Agent-ready guardrails: the Work Map as a policy an agent can load, plus a human SOP.
 * The autopilot consumes policy.json; the same file is what the moonshot slide points at.
 */
import { describeAct, describeCond, type WorkMap } from "./workmap";

export interface Policy {
  version: 1;
  generatedFrom: string;
  task: string;
  expert: string;
  onet?: WorkMap["onet"];
  confirmed: boolean;
  rules: {
    id: string;
    title: string;
    when: WorkMap["rules"][number]["when"];
    then: WorkMap["rules"][number]["then"];
    unless?: WorkMap["rules"][number]["unless"];
    stopAndAsk?: WorkMap["rules"][number]["stopAndAsk"];
    confidence: string;
    evidence: string[];
  }[];
  steps: { index: number; title: string; judgment: boolean; decision: string }[];
  humanInTheLoop: string;
}

export function toPolicy(map: WorkMap): Policy {
  return {
    version: 1,
    generatedFrom: map.sessionId,
    task: map.task,
    expert: map.expert.name,
    onet: map.onet,
    confirmed: !!map.confirmedAt,
    rules: map.rules.map((r) => ({ id: r.id, title: r.title, when: r.when, then: r.then, unless: r.unless, stopAndAsk: r.stopAndAsk, confidence: r.confidence, evidence: r.quotes.map((q) => q.text) })),
    steps: map.steps.map((s) => ({ index: s.index, title: s.title, judgment: s.judgment, decision: s.decision })),
    humanInTheLoop: "Apply a rule only when its `when` holds and `unless` does not. If any stopAndAsk.when holds, do not act: hand the case to a human with the rule's evidence. If no rule applies to a judgment, do not act.",
  };
}

/** A system-prompt snippet so any LLM agent follows the same steps and stops where the expert would. */
export function toAgentPrompt(map: WorkMap): string {
  const lines = [
    `You process ${map.task.toLowerCase()} the way ${map.expert.name} does. Follow these rules exactly and stop where she would.`,
    "",
    "RULES",
    ...map.rules.map((r, i) => `${i + 1}. When ${describeCond(r.when)}${r.unless ? `, unless ${describeCond(r.unless)}` : ""}: ${describeAct(r.then)}. (${r.quotes[0]?.text ?? "no quote"})`),
    "",
    "STOP AND ASK A HUMAN",
    ...map.rules.filter((r) => r.stopAndAsk).map((r) => `- When ${describeCond(r.stopAndAsk!.when)}: stop, hand the case to ${r.stopAndAsk!.who}, attach the invoice and this rule.`),
    "- When a case matches no rule and a decision is needed: stop, flag it for the expert, do not guess.",
    "",
    "STEPS",
    ...map.steps.map((s) => `${s.index + 1}. ${s.title}${s.judgment ? " (judgment call)" : ""}`),
  ];
  return lines.join("\n");
}

export function toSopMarkdown(map: WorkMap): string {
  const out: string[] = [];
  out.push(`# ${map.task}`);
  out.push("");
  out.push(`Captured from ${map.expert.name}${map.onet ? ` · O*NET ${map.onet.code} ${map.onet.occupation}` : ""}${map.confirmedAt ? ` · confirmed ${new Date(map.confirmedAt).toISOString().slice(0, 10)}` : " · not yet confirmed"}`);
  out.push("");
  out.push("## Steps");
  for (const s of map.steps.sort((a, b) => a.index - b.index)) {
    out.push(`${s.index + 1}. **${s.title}**${s.judgment ? " (judgment call)" : ""}: ${s.decision}`);
    if (s.reason) out.push(`   - Why, in her words: "${s.reason.text}"`);
    for (const g of s.guardrails) out.push(`   - ${g.kind}: ${g.text}`);
  }
  out.push("");
  out.push("## Rules");
  for (const r of map.rules) {
    out.push(`- **${r.title}**: when ${describeCond(r.when)}${r.unless ? `, unless ${describeCond(r.unless)}` : ""}, ${describeAct(r.then)}.`);
    if (r.stopAndAsk) out.push(`  - Stop and ask ${r.stopAndAsk.who} when ${describeCond(r.stopAndAsk.when)}.`);
    for (const q of r.quotes) out.push(`  - "${q.text}"`);
  }
  if (map.slots.some((s) => s.status === "open")) {
    out.push("");
    out.push("## Still open");
    for (const s of map.slots.filter((s) => s.status === "open")) out.push(`- ${s.question}`);
  }
  return out.join("\n");
}
