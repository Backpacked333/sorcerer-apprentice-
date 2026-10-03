import { generateObject } from "ai";
import { z } from "zod";
import type { SessionLog } from "../events";
import { CondSchema, ActSchema, evalCond, type Cond, type Quote, type Rule, type WorkMap, uid } from "../workmap";
import { buildSlots, seenCases } from "./slots";

const ALLOWED_FIELDS = new Set(["amount", "category", "supplier", "entity", "invoiceMonth", "costCenter", "hasAssetNumber", "knownSupplier", "hasPO", "route", "status"]);

// ---------- Pass 2: LLM refinement (optional, validated) ----------

const RefinementSchema = z.object({
  rules: z.array(
    z.object({
      stepId: z.string(),
      title: z.string(),
      when: CondSchema,
      then: ActSchema,
      unless: CondSchema.optional(),
      stopAndAsk: z.object({ who: z.string(), when: CondSchema }).optional(),
      quoteTexts: z.array(z.string()),
      confidence: z.enum(["high", "medium", "low"]),
    }),
  ),
  guardrails: z.array(z.object({ stepId: z.string(), kind: z.enum(["limit", "exception", "escalation"]), text: z.string(), quoteText: z.string().optional() })),
  slots: z.array(z.object({ stepId: z.string().optional(), kind: z.enum(["reason", "limit", "exception", "escalation", "counterfactual", "novel"]), question: z.string() })),
  stepReasons: z.array(z.object({ stepId: z.string(), quoteText: z.string() })),
});

export async function refineWithLLM(log: SessionLog, draft: WorkMap): Promise<{ map: WorkMap; used: boolean; note?: string }> {
  if (!process.env.AI_GATEWAY_API_KEY) return { map: draft, used: false, note: "no AI_GATEWAY_API_KEY; deterministic map" };
  const transcript = log.transcript.filter((s) => !s.redacted).map((s) => `[${s.t.toFixed(1)}s ${s.speaker}] ${s.text}`).join("\n");
  const answers = log.windows.filter((w) => w.outcome === "answered").map((w) => `[${(w.answeredAt ?? w.openedAt).toFixed(1)}s] Q(${w.kind}, ${w.stepRef}): ${w.question}\nA: ${w.answerText}`).join("\n\n");
  const steps = draft.steps.map((s) => `${s.id} | invoice ${s.invoice} | ${s.title} | ${s.decision} | judgment=${s.judgment} | reason=${s.reason?.text ?? "none"}`).join("\n");
  try {
    const { object } = await generateObject({
      model: process.env.COMPILE_MODEL ?? "anthropic/claude-sonnet-4.5",
      schema: RefinementSchema,
      system: [
        "You turn an expert's recorded work session into machine-checkable rules for an apprentice system.",
        "Hard constraints:",
        "1. Every quoteText MUST be copied verbatim from the transcript or answers below. Never paraphrase. If no quote supports a rule, set confidence to low and quoteTexts to [].",
        `2. Conditions may only use these fields: ${Array.from(ALLOWED_FIELDS).join(", ")}. amount is a number in EUR, invoiceMonth is 1-12, entity is 'parent' or 'subsidiary', category is one of equipment, freight, maintenance, cleaning, consumables, credit_note.`,
        "3. Prefer precise thresholds the expert stated (a counterfactual answer like 'no, then it is opex' confirms the threshold). Use 'unless' for exceptions the expert named.",
        "4. stopAndAsk captures when the expert would stop and who they ask. who is a role, not a name.",
        "5. slots are questions the debrief still needs to ask: one per judgment step without a reason, one limit per rule without a stated boundary, one escalation per rule without a stop condition, and kind 'novel' for a case type the expert did not work on today (a credit note, an invoice without a purchase order). Phrase them as spoken questions about the specific invoice.",
        "6. stepReasons attach a verbatim quote as the reason for a judgment step that has none.",
      ].join("\n"),
      prompt: `TASK: ${log.task}\nEXPERT: ${log.expertName}\n\nSTEPS (id | invoice | title | decision | judgment | reason):\n${steps}\n\nQUESTIONS AND ANSWERS:\n${answers || "(none)"}\n\nTRANSCRIPT:\n${transcript || "(none)"}`,
    });
    const corpus = (log.transcript.map((s) => s.text).join("\n") + "\n" + log.windows.map((w) => w.answerText ?? "").join("\n")).toLowerCase();
    const verbatim = (q: string) => corpus.includes(q.toLowerCase().trim());
    const findQuote = (text: string): Quote | undefined => {
      const w = log.windows.find((w) => w.answerText && w.answerText.toLowerCase().includes(text.toLowerCase().trim()));
      if (w) return { text, t: w.answeredAt ?? w.openedAt, audioId: w.answerAudioId, source: w.kind === "counterfactual" ? "counterfactual" : w.kind === "debrief" ? "debrief" : "live" };
      const s = log.transcript.find((s) => s.text.toLowerCase().includes(text.toLowerCase().trim()));
      return s ? { text, t: s.t, source: "narration" } : undefined;
    };
    const condOk = (c: Cond): boolean => ("all" in c ? c.all.every(condOk) : "any" in c ? c.any.every(condOk) : "not" in c ? condOk(c.not) : ALLOWED_FIELDS.has(c.field));
    const map: WorkMap = { ...draft, rules: [], slots: [] };
    for (const r of object.stepReasons) {
      const step = map.steps.find((s) => s.id === r.stepId);
      const q = verbatim(r.quoteText) ? findQuote(r.quoteText) : undefined;
      if (step && q && !step.reason) step.reason = q;
    }
    for (const g of object.guardrails) {
      const step = map.steps.find((s) => s.id === g.stepId);
      if (!step) continue;
      const q = g.quoteText && verbatim(g.quoteText) ? findQuote(g.quoteText) : undefined;
      if (!step.guardrails.some((x) => x.text === g.text)) step.guardrails.push({ id: uid("gr"), kind: g.kind, text: g.text, quote: q });
    }
    for (const r of object.rules) {
      if (!condOk(r.when) || (r.unless && !condOk(r.unless)) || (r.stopAndAsk && !condOk(r.stopAndAsk.when))) continue;
      const quotes = r.quoteTexts.filter(verbatim).map(findQuote).filter(Boolean) as Quote[];
      // sanity: the condition must evaluate without throwing on an empty state
      try {
        evalCond(r.when, {});
      } catch {
        continue;
      }
      map.rules.push({ id: uid("rule"), stepId: r.stepId, title: r.title, when: r.when, then: r.then, unless: r.unless, stopAndAsk: r.stopAndAsk, quotes, confidence: quotes.length ? r.confidence : "low", confirmedBy: Array.from(new Set(quotes.map((q) => (q.source === "counterfactual" ? "counterfactual" : q.source === "debrief" ? "debrief" : "live")))) as Rule["confirmedBy"] });
    }
    if (map.rules.length === 0) map.rules = draft.rules;
    map.slots = object.slots.map((s) => ({ id: uid("slot"), kind: s.kind, stepId: s.stepId, question: s.question, status: "open" as const }));
    const extra = buildSlots(map, seenCases(log)).filter((s) => (s.kind === "novel" && !map.slots.some((x) => x.kind === "novel")) || map.slots.length < 3);
    map.slots = [...map.slots, ...extra.filter((s) => !map.slots.some((x) => x.question === s.question))];
    map.compiledAt = Date.now();
    return { map, used: true };
  } catch (err) {
    return { map: draft, used: false, note: `LLM refinement failed: ${(err as Error).message}` };
  }
}
