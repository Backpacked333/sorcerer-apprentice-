import { describe, expect, it } from "vitest";
import { buildCandidates, newContext, templates } from "./curiosity";
import type { ScreenEvent } from "./events";

const event = (partial: Partial<ScreenEvent> & Pick<ScreenEvent, "kind">): ScreenEvent => ({
  id: "tone-event",
  source: "dom",
  t: 12,
  invoice: "INV-4474",
  ...partial,
});

describe("grounded question tone", () => {
  it("describes a hold-to-active status change as taking the invoice off hold", () => {
    const statusEvent = event({ kind: "status_changed", field: "status", from: "hold", to: "active" });
    const questions = templates(statusEvent);

    expect(questions.why).toBe("You took INV-4474 off hold. What changed?");
    expect(questions.why).not.toMatch(/changed status|from hold to active/i);

    const candidates = buildCandidates(statusEvent, newContext(), 12);
    expect(candidates.map(({ kind }) => kind)).toEqual(["why", "limit", "who", "counterfactual", "stop"]);
    expect(candidates[0]).toMatchObject({ kind: "why", question: "You took INV-4474 off hold. What changed?", stepRef: "INV-4474:status" });
  });

  it("describes the second-approval route in coworker language", () => {
    const routeEvent = event({ kind: "route_changed", field: "route", from: "single", to: "second_approval" });
    const questions = templates(routeEvent);

    expect(questions.why).toBe("You sent INV-4474 for a second approval. What prompted that?");
    expect(questions.why).not.toMatch(/changed route|from single to second_approval/i);

    const candidates = buildCandidates(routeEvent, newContext(), 12);
    expect(candidates.map(({ kind }) => kind)).toEqual(["why", "limit", "who", "stop"]);
    expect(candidates[0].questionRetro).toBe("On INV-4474 a moment ago, you sent it for a second approval. What prompted that?");
  });

  it("describes a cost-center edit naturally while preserving both exact codes", () => {
    const questions = templates(event({ kind: "field_changed", field: "costCenter", from: "4711", to: "0400" }));

    expect(questions.why).toBe("You re-coded INV-4474 from 4711 to 0400. What made you choose 0400?");
    expect(questions.why).not.toContain("on the cost center");
  });

  it("humanizes an unknown field only in the generic fallback", () => {
    const questions = templates(event({ kind: "field_changed", field: "paymentTerms", from: "net_30", to: "net_45" }));

    expect(questions.why).toBe("You updated the payment terms on INV-4474 from net_30 to net_45. What drove that change?");
    expect(questions.limit).toBe("Is there an amount, or a kind of supplier, where you would handle the payment terms on INV-4474 differently?");
    expect(questions.why).not.toContain("paymentTerms");
    expect(questions.limit).not.toContain("paymentTerms");
  });
});
