import { describe, expect, it } from "vitest";
import { buildCandidates, CandidateQueue, newContext } from "./curiosity";
import type { ScreenEvent } from "./events";

const edit = (invoice: string, t = 10): ScreenEvent => ({
  id: `edit-${invoice}`,
  source: "dom",
  t,
  kind: "field_changed",
  invoice,
  field: "costCenter",
  from: "1000",
  to: "2000",
  state: { amount: 3200 },
});

describe("candidate queue cadence", () => {
  it("keeps a departed invoice live through grace, then demotes it", () => {
    const queue = new CandidateQueue(90, 18);
    queue.add(buildCandidates(edit("9001"), newContext(), 10));
    queue.expire(20, "9002");
    expect(queue.pick(false, 20)?.invoice).toBe("9001");
    expect(queue.pick(false, 20)?.leftAt).toBe(20);
    queue.expire(38, "9002");
    expect(queue.pick(false, 38)?.invoice).toBe("9001");
    queue.expire(38.1, "9002");
    expect(queue.items.filter((candidate) => candidate.status === "queued")).toHaveLength(0);
  });

  it("never returns a sibling before its why", () => {
    const queue = new CandidateQueue();
    queue.add(buildCandidates(edit("9001"), newContext(), 10));
    expect(queue.pick(true, 13)?.kind).toBe("why");
    const why = queue.pick(false, 13)!;
    queue.markAsked(why.id);
    expect(queue.pick(true, 13)?.guardrail).toBe(true);
  });

  it("skips candidates until their retry time", () => {
    const queue = new CandidateQueue();
    queue.add(buildCandidates(edit("9001"), newContext(), 10));
    const why = queue.items.find((candidate) => candidate.kind === "why")!;
    why.retryAfter = 20;
    expect(queue.pick(false, 19)).toBeUndefined();
    expect(queue.pick(false, 20)?.id).toBe(why.id);
  });

  it("counts narration as evidence but not as a live window", () => {
    const queue = new CandidateQueue();
    queue.add(buildCandidates(edit("9001"), newContext(), 10));
    const why = queue.items.find((candidate) => candidate.kind === "why")!;
    queue.markFilled(why.id, "narration", "Invoice 9001 changed because the policy requires it.");
    expect(queue.windowsAsked).toBe(0);
    expect(queue.guardrailAsked).toBe(false);
  });
});
