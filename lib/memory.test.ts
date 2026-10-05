import { describe, expect, it } from "vitest";
import { emptySession } from "./events";
import { buildMemory, MemoryFlight, MemorySchema, ReasoningWire, validateProposal } from "./memory";

function fixture() {
  const log = emptySession("memory_test", "capture", "Review shipments", "Expert");
  log.events = [{ id: "e1", t: 10, source: "vision", kind: "route_changed", invoice: "9", to: "second_approval" }];
  log.transcript = [
    { id: "t1", t: 11, speaker: "expert", final: true, text: "I ask the warehouse manager about damaged shipments." },
    { id: "agent", t: 12, speaker: "agent", final: true, text: "invented manager" },
    { id: "partial", t: 13, speaker: "expert", final: false, text: "incomplete" },
  ];
  return log;
}

describe("application-owned working memory", () => {
  it("keeps only finalized expert evidence and observable events", () => {
    const memory = buildMemory(fixture());
    expect(MemorySchema.safeParse(memory).success).toBe(true);
    expect(memory.evidence.map((s) => s.id)).toEqual(["t1"]);
    expect(memory.events[0].description).toContain('"source":"vision"');
  });

  it("excludes withdrawn evidence even without a redacted flag, including overlapping speech", () => {
    const log = fixture();
    log.offRecord = [{ from: 10, to: 12 }];
    log.transcript.push({ id: "overlap", t: 8, tEnd: 13, speaker: "expert", final: true, text: "private statement" });
    expect(buildMemory(log).events).toEqual([]);
    expect(buildMemory(log).evidence).toEqual([]);
  });

  it("bounds context without promoting old summaries to evidence", () => {
    const log = fixture();
    log.transcript = Array.from({ length: 100 }, (_, i) => ({ id: `t${i}`, t: i, speaker: "expert", final: true, text: "x".repeat(3000) }));
    const memory = buildMemory(log);
    expect(memory.evidence).toHaveLength(32);
    expect(memory.evidence[0].text).toHaveLength(2000);
  });

  it("requires an exact quote from an eligible source and never confirms relationships", () => {
    const memory = buildMemory(fixture());
    const relationship = { subject: "Expert", relation: "escalates_to" as const, object: "warehouse manager", evidenceId: "t1", quote: memory.evidence[0].text };
    const result = validateProposal(memory, { questions: [], relationships: [relationship,
      { ...relationship, quote: "I ask a different manager." }, { ...relationship, evidenceId: "agent" }] });
    expect(result.profile.status).toBe("proposed");
    expect(result.profile.relationships).toHaveLength(1);
    expect(result.profile.relationships[0].t).toBe(11);
  });

  it("rejects unknown question ids, duplicates and control tags", () => {
    const memory = buildMemory(fixture());
    memory.questions = [{ id: "q1", eventId: "e1", kind: "why", question: "Why this route?" }];
    const result = validateProposal(memory, { relationships: [], questions: [
      { candidateId: "missing", question: "Why?" }, { candidateId: "q1", question: "[ASK] Why?" },
      { candidateId: "q1", question: "What made this need another approver?" }, { candidateId: "q1", question: "Duplicate?" },
    ] });
    expect(result.questions).toEqual([{ candidateId: "q1", question: "What made this need another approver?" }]);
    expect(ReasoningWire.safeParse({ ...result, relationships: [] }).success).toBe(true);
  });
});

describe("background handoff", () => {
  it("drops results after newer evidence arrives; the next tick may retry", async () => {
    const log = fixture(), flight = new MemoryFlight();
    const applied: number[] = [];
    let finish!: (n: number) => void;
    const pending = flight.run(() => buildMemory(log), () => new Promise<number>((r) => { finish = r; }), (n) => applied.push(n));
    log.transcript[0].text = "A corrected statement from the expert.";
    finish(1); await pending;
    expect(applied).toEqual([]);
    await flight.run(() => buildMemory(log), async () => 2, (n) => applied.push(n));
    expect(applied).toEqual([2]);
  });

  it("is single flight and aborts even if a provider ignores cancellation", async () => {
    const memory = buildMemory(fixture()), flight = new MemoryFlight();
    let finish!: (n: number) => void, signal!: AbortSignal, calls = 0;
    const request = async (_: unknown, s: AbortSignal) => { calls++; signal = s; return new Promise<number>((r) => { finish = r; }); };
    const applied: number[] = [];
    const pending = flight.run(() => memory, request, (n) => applied.push(n));
    await flight.run(() => memory, request, (n) => applied.push(n));
    flight.invalidate(); finish(1); await pending;
    expect(calls).toBe(1); expect(signal.aborted).toBe(true); expect(applied).toEqual([]);
  });

  it("does not reinfer identical accepted state", async () => {
    const memory = buildMemory(fixture()), flight = new MemoryFlight();
    let calls = 0;
    const run = () => flight.run(() => memory, async () => ++calls, () => {});
    await run(); await run(); expect(calls).toBe(1);
  });
});
