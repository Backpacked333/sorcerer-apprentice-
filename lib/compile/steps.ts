import type { QuestionWindow, ScreenEvent, SessionLog } from "../events";
import { labelField } from "../events";
import { narrationMatch, type Candidate } from "../curiosity";
import { emptyMap, type Quote, type Step, type WorkMap, uid } from "../workmap";
import { isQuotableTranscript, isQuotableWindow } from "./evidence";
import { COST_CENTER_LABEL, deriveRules } from "./rules-regex";
import { buildSlots, seenCases } from "./slots";

export function stepRefOf(e: ScreenEvent): string {
  return `${e.invoice ?? "?"}:${e.field ?? e.kind}`;
}

// ---------- Pass 1: deterministic ----------

export function compileDeterministic(log: SessionLog): WorkMap {
  const map = emptyMap(log.id, log.task, log.expertName);
  const steps: Step[] = [];
  const byRef = new Map<string, Step>();
  const evidenceEventByStepId = new Map<string, ScreenEvent>();
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
        const step = addStep({ title: e.field === "costCenter" ? `Code invoice ${inv} to a cost center` : `Set ${fl} on invoice ${inv}`, invoice: inv, screenMoment: moment, action: { field: e.field ?? "field", from, to }, decision: from && from !== to ? `Re-coded from ${fromL} to ${toL}` : `Set ${fl} to ${toL}`, judgment: from !== to && (from !== "" || e.field === "costCenter") }, stepRefOf(e));
        evidenceEventByStepId.set(step.id, e);
        break;
      }
      case "route_changed": {
        const step = addStep({ title: `Set the approval route for invoice ${inv}`, invoice: inv, screenMoment: moment, action: { type: "route" }, decision: `Routed to ${String(e.to).replace(/_/g, " ")}`, judgment: e.to === "second_approval" }, `${inv}:route`);
        evidenceEventByStepId.set(step.id, e);
        break;
      }
      case "status_changed": {
        const step = addStep({ title: e.to === "hold" ? `Hold invoice ${inv}` : `Set status of invoice ${inv}`, invoice: inv, screenMoment: moment, action: { type: e.to === "hold" ? "hold" : "approve" }, decision: `Status ${e.from ?? "open"} to ${e.to}`, judgment: e.to === "hold" || e.to === "rejected" }, `${inv}:status`);
        evidenceEventByStepId.set(step.id, e);
        break;
      }
      case "save_clicked":
        addStep({ title: `Save invoice ${inv}`, invoice: inv, screenMoment: moment, action: { type: "save" }, decision: "Saved", judgment: false }, `${inv}:save`);
        break;
      default:
        break;
    }
  }

  // ---- attach verbatim quotes from question windows ----
  const quoteOf = (w: QuestionWindow): Quote | undefined =>
    isQuotableWindow(w) ? { text: w.answerText!, t: w.answeredAt!, audioId: w.answerAudioId, source: w.kind === "counterfactual" ? "counterfactual" : w.kind === "debrief" ? "debrief" : "live" } : undefined;

  const answered = log.windows.filter(isQuotableWindow);
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
    const event = evidenceEventByStepId.get(step.id);
    if (!event) continue;
    const candidate: Candidate = {
      id: `compile:${step.id}`,
      kind: "why",
      value: 0,
      question: "",
      questionRetro: "",
      invoice: event.invoice,
      field: event.field,
      stepRef: stepRefOf(event),
      eventId: event.id,
      createdAt: event.t,
      status: "queued",
      guardrail: false,
      aliases: [event.to, labelField(event.field)].filter((value): value is string => Boolean(value)),
    };
    const near = log.transcript.filter((segment) => isQuotableTranscript(segment, log.windows));
    const hit = near.find((segment) => narrationMatch(segment.text, candidate, segment.t).fills);
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
