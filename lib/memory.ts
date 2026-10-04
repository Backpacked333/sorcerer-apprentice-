import { z } from "zod";
import type { SessionLog } from "./events";
import type { Candidate } from "./curiosity";

const text = z.string().max(2000);
export const MemorySchema = z.object({
  sessionId: z.string().regex(/^[\w-]{1,64}$/),
  task: text,
  expert: text,
  events: z.array(z.object({ id: text, t: z.number().nonnegative(), description: text })).max(16),
  evidence: z.array(z.object({ id: text, t: z.number().nonnegative(), text })).max(32),
  questions: z.array(z.object({ id: text, eventId: text, kind: text, question: text })).max(12),
  history: z.array(z.object({ question: text, outcome: text })).max(12),
});
export type WorkingMemory = z.infer<typeof MemorySchema>;

// Model-facing schemas deliberately have no recursive types or numeric constraints.
export const ReasoningWire = z.object({
  questions: z.array(z.object({ candidateId: z.string(), question: z.string() })),
  relationships: z.array(z.object({
    subject: z.string(), relation: z.enum(["performs", "uses", "requires", "escalates_to", "exception"]),
    object: z.string(), evidenceId: z.string(), quote: z.string(),
  })),
});
export type ReasoningProposal = z.infer<typeof ReasoningWire>;
export const RoleProfileSchema = z.object({
  task: text,
  status: z.literal("proposed"),
  relationships: z.array(z.object({
    subject: z.string().min(1).max(160), relation: z.enum(["performs", "uses", "requires", "escalates_to", "exception"]),
    object: z.string().min(1).max(300), evidenceId: text, quote: text, t: z.number(),
  })).max(16),
});
export type RoleProfile = z.infer<typeof RoleProfileSchema>;

export function visibleAt(log: SessionLog, start: number, end = start) {
  return !log.offRecord.some((r) => start <= r.to && end >= r.from);
}

/** A bounded projection of the authoritative log, never an independent model memory. */
export function buildMemory(log: SessionLog, candidates: Candidate[] = []): WorkingMemory {
  const events = log.events.filter((e) => !e.redacted && visibleAt(log, e.t) && e.kind !== "typing").slice(-16);
  const eventIds = new Set(events.map((e) => e.id));
  return {
    sessionId: log.id, task: log.task.slice(0, 2000), expert: log.expertName.slice(0, 2000),
    events: events.map((e) => ({ id: e.id, t: e.t, description: JSON.stringify({
      source: e.source, kind: e.kind, invoice: e.invoice, field: e.field, from: e.from, to: e.to, state: e.state,
    }).slice(0, 2000) })),
    evidence: log.transcript.filter((s) => s.speaker === "expert" && s.final && !s.redacted && s.text.trim()
      && visibleAt(log, s.t, s.tEnd)).slice(-32).map((s) => ({ id: s.id, t: s.t, text: s.text.slice(0, 2000) })),
    questions: candidates.filter((c) => c.status === "queued" && eventIds.has(c.eventId))
      .sort((a, b) => b.value - a.value).slice(0, 12)
      .map((c) => ({ id: c.id, eventId: c.eventId, kind: c.kind, question: c.question.slice(0, 2000) })),
    history: log.windows.filter((w) => visibleAt(log, w.openedAt, w.closedAt ?? w.answeredAt ?? w.openedAt)
      && w.outcome !== "off_record").slice(-12)
      .map((w) => ({ question: w.question.slice(0, 2000), outcome: w.outcome ?? "active" })),
  };
}

export function validateProposal(memory: WorkingMemory, raw: ReasoningProposal) {
  const seen = new Set<string>();
  const questions = raw.questions.filter((q) => {
    const candidate = memory.questions.find((c) => c.id === q.candidateId);
    if (!candidate || seen.has(q.candidateId) || q.question.length > 240 || !q.question.trim().endsWith("?") || /[\[\]<>]/.test(q.question)) return false;
    seen.add(q.candidateId);
    return true;
  }).slice(0, 3);
  const relationships: RoleProfile["relationships"] = [];
  for (const r of raw.relationships.slice(0, 16)) {
    const evidence = memory.evidence.find((s) => s.id === r.evidenceId);
    if (!evidence || !r.quote.trim() || r.quote.length < 8 || !evidence.text.includes(r.quote)) continue;
    const parsed = RoleProfileSchema.shape.relationships.element.safeParse({ ...r, t: evidence.t });
    if (parsed.success && !relationships.some((x) => x.subject === r.subject && x.relation === r.relation && x.object === r.object)) relationships.push(parsed.data);
  }
  return { questions, profile: { task: memory.task, status: "proposed" as const, relationships } };
}

/** Single-flight, latest-state acceptance. The caller schedules work; no unbounded queue. */
export class MemoryFlight {
  private controller?: AbortController;
  private epoch = 0;
  private completed = "";

  invalidate() {
    this.epoch++;
    this.completed = "";
    this.controller?.abort();
  }

  async run<T>(read: () => WorkingMemory, request: (memory: WorkingMemory, signal: AbortSignal) => Promise<T>, apply: (value: T) => void) {
    if (this.controller) return;
    const memory = read(), key = JSON.stringify(memory);
    if (key === this.completed) return;
    const controller = new AbortController(), epoch = this.epoch;
    this.controller = controller;
    try {
      const value = await request(memory, controller.signal);
      if (!controller.signal.aborted && epoch === this.epoch && JSON.stringify(read()) === key) {
        this.completed = key;
        apply(value);
      }
    } finally {
      if (this.controller === controller) this.controller = undefined;
    }
  }
}
