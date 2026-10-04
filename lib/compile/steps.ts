import type { QuestionWindow, ScreenEvent, SessionLog } from "../events";
import { labelField } from "../events";
import { emptyMap, type Quote, type Step, type WorkMap, uid } from "../workmap";
import { COST_CENTER_LABEL, deriveRules } from "./rules-regex";
import { buildSlots, seenCases } from "./slots";

const NARRATION_CUES = /\b(because|since|so|always|never|over|above|under|has to|must|only|every|whenever|unless|rule|double)\b/i;

export function stepRefOf(e: ScreenEvent): string {
  return `${e.invoice ?? "?"}:${e.field ?? e.kind}`;
}

// ---------- Pass 1: deterministic ----------

export function compileDeterministic(log: SessionLog): WorkMap {
  const map = emptyMap(log.id, log.task, log.expertName);
  const steps: Step[] = [];
  const byRef = new Map<string, Step>();
  let index = 0;

  const addStep = (s: Omit<Step, "id" | "index" | "guardrails" | "confidence">, ref: string) => {
    const existing = byRef.get(ref);
    if (existing) {
      // a later edit of the same field: keep the first screen moment, update the decision
      existing.action = s.action;
      existing.decision = s.decision;
      existing.judgment = existing.judgment || s.judgment;
      return existing;
    }
    const step: Step = { id: uid("step"), index: index++, guardrails: [], confidence: "medium", ...s };
    steps.push(step);
    byRef.set(ref, step);
    return step;
  };

  for (const e of log.events) {
    if (e.redacted) continue;
    const inv = e.invoice ?? "?";
    const moment = { t: e.t, frameId: e.frameId };
    switch (e.kind) {
      case "invoice_opened":
        addStep({ title: `Open invoice ${inv}`, invoice: inv, screenMoment: moment, action: { type: "open" }, decision: `Opened ${inv}${e.state?.supplier ? ` from ${e.state.supplier}` : ""}${e.state?.amount !== undefined ? `, €${e.state.amount.toLocaleString("en-IE")}` : ""}`, judgment: false }, `${inv}:open`);
        break;
      case "field_changed": {
        const from = e.from ?? "";
        const to = e.to ?? "";
        const fl = labelField(e.field);
        const fromL = COST_CENTER_LABEL[from] ? `${COST_CENTER_LABEL[from]} (${from})` : from || "empty";
        const toL = COST_CENTER_LABEL[to] ? `${COST_CENTER_LABEL[to]} (${to})` : to;
        addStep({ title: e.field === "costCenter" ? `Code invoice ${inv} to a cost center` : `Set ${fl} on invoice ${inv}`, invoice: inv, screenMoment: moment, action: { field: e.field ?? "field", from, to }, decision: from && from !== to ? `Re-coded from ${fromL} to ${toL}` : `Set ${fl} to ${toL}`, judgment: from !== to && (from !== "" || e.field === "costCenter") }, stepRefOf(e));
        break;
      }
      case "route_changed":
        addStep({ title: `Set the approval route for invoice ${inv}`, invoice: inv, screenMoment: moment, action: { type: "route" }, decision: `Routed to ${String(e.to).replace(/_/g, " ")}`, judgment: e.to === "second_approval" }, `${inv}:route`);
        break;
      case "status_changed":
        addStep({ title: e.to === "hold" ? `Hold invoice ${inv}` : `Set status of invoice ${inv}`, invoice: inv, screenMoment: moment, action: { type: e.to === "hold" ? "hold" : "approve" }, decision: `Status ${e.from ?? "open"} to ${e.to}`, judgment: e.to === "hold" || e.to === "rejected" }, `${inv}:status`);
        break;
      case "save_clicked":
        addStep({ title: `Save invoice ${inv}`, invoice: inv, screenMoment: moment, action: { type: "save" }, decision: "Saved", judgment: false }, `${inv}:save`);
        break;
      default:
        break;
    }
  }

  // ---- attach verbatim quotes from question windows ----
  const quoteOf = (w: QuestionWindow): Quote | undefined =>
    w.answerText && w.outcome === "answered" ? { text: w.answerText, t: w.answeredAt ?? w.openedAt, audioId: w.answerAudioId, source: w.kind === "counterfactual" ? "counterfactual" : w.kind === "debrief" ? "debrief" : "live" } : undefined;

  const answered = log.windows.filter((w) => w.outcome === "answered" && w.answerText);
  for (const w of answered) {
    const step = w.stepRef ? byRef.get(w.stepRef) : undefined;
    const q = quoteOf(w);
    if (!q) continue;
    if (!step) continue;
    if (w.kind === "why" || w.kind === "debrief") {
      if (!step.reason) step.reason = q;
      else step.guardrails.push({ id: uid("gr"), kind: "exception", text: q.text, quote: q });
    } else if (w.kind === "counterfactual" || w.kind === "limit") {
      step.guardrails.push({ id: uid("gr"), kind: "limit", text: q.text, quote: q });
    } else if (w.kind === "stop" || w.kind === "who") {
      step.guardrails.push({ id: uid("gr"), kind: "escalation", text: q.text, quote: q });
    }
  }

  // ---- narration: a reason the expert said out loud without being asked ----
  for (const step of steps) {
    if (step.reason || !step.judgment) continue;
    const near = log.transcript.filter((s) => s.speaker === "expert" && !s.redacted && s.final && s.t >= step.screenMoment.t - 20 && s.t <= step.screenMoment.t + 25);
    const hit = near.find((s) => NARRATION_CUES.test(s.text) && s.text.split(/\s+/).length >= 6);
    if (hit) step.reason = { text: hit.text, t: hit.t, source: "narration" };
  }

  // ---- rules by heuristic ----
  const invoiceMonths = new Map<string, number>();
  for (const e of log.events) if (e.invoice && e.state?.invoiceMonth) invoiceMonths.set(e.invoice, e.state.invoiceMonth);
  map.rules = deriveRules(steps, log.transcript, invoiceMonths);
  map.steps = steps;
  map.slots = buildSlots(map, seenCases(log));
  map.privacy = { framesSeen: log.metrics?.framesSeen ?? log.frames.length, framesKept: log.frames.length, entitiesRedacted: log.metrics?.entitiesRedacted ?? 0, offRecord: log.offRecord };
  map.compiledAt = Date.now();
  return map;
}
