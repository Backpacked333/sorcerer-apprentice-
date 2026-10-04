import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { emptyMap, evalCond, type WorkMap } from "./workmap";
import { confirmationIssues } from "./confirmation";
import { modelAction, modelCondition, RefinementSchema, visibleState, VisionSchema } from "./model-contracts";

const store = vi.hoisted(() => ({ getMap: vi.fn(), saveMap: vi.fn() }));
vi.mock("./store", () => store);
import { POST as confirm } from "../app/api/sessions/[id]/confirm/route";
import { GET as exportMap } from "../app/api/export/route";
import { POST as vision } from "../app/api/vision/route";

function readyMap(): WorkMap {
  const map = emptyMap("sample", "Review invoices", "Expert");
  const quote = { text: "I check with finance when there is no purchase order.", t: 1, source: "debrief" as const };
  map.revision = 4;
  map.steps = [{ id: "step", index: 0, title: "Check purchase order", screenMoment: { t: 1, frameId: "frame" }, action: { type: "hold" }, decision: "Hold for review", judgment: true, reason: quote, guardrails: [{ id: "g", kind: "escalation", text: "Ask finance", quote }], confidence: "high" }];
  map.rules = [{ id: "rule", stepId: "step", title: "Missing PO", when: { field: "hasPO", op: "==", value: false }, then: { status: "hold" }, quotes: [quote], confidence: "high", confirmedBy: ["debrief"] }];
  map.slots = [0, 1, 2].map((i) => ({ id: `slot_${i}`, kind: "exception", question: `Follow-up ${i}`, status: "filled", filledBy: quote }));
  return map;
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.unstubAllEnvs());

describe("confirmed-map boundary", () => {
  it("rejects missing evidence, open gaps and fewer than three answers", () => {
    const map = readyMap();
    expect(confirmationIssues(map)).toEqual([]);
    map.slots[0].status = "open";
    delete map.steps[0].reason;
    delete map.steps[0].screenMoment.frameId;
    expect(confirmationIssues(map).length).toBeGreaterThanOrEqual(4);
  });

  it("requires the reviewed revision and never publishes incomplete maps", async () => {
    const map = readyMap();
    store.getMap.mockResolvedValue(map);
    const request = (revision: number) => new Request("http://localhost/api/sessions/sample/confirm", { method: "POST", body: JSON.stringify({ confirmed: true, revision }) });
    const ctx = { params: Promise.resolve({ id: "sample" }) };
    expect((await confirm(request(3), ctx)).status).toBe(409);
    expect(store.saveMap).not.toHaveBeenCalled();
    map.slots[0].status = "open";
    expect((await confirm(request(4), ctx)).status).toBe(409);
    map.slots[0].status = "filled";
    expect((await confirm(request(4), ctx)).status).toBe(200);
    expect(store.saveMap).toHaveBeenCalledOnce();
    expect(map.confirmedAt).toBeGreaterThan(0);
  });

  it("blocks draft exports", async () => {
    store.getMap.mockResolvedValue(readyMap());
    expect((await exportMap(new Request("http://localhost/api/export?sessionId=sample"))).status).toBe(409);
  });
});

describe("provider contracts", () => {
  it("uses finite JSON schemas and validates triggers and actions", () => {
    expect(() => z.toJSONSchema(RefinementSchema)).not.toThrow();
    expect(() => z.toJSONSchema(VisionSchema)).not.toThrow();
    expect(() => modelCondition({ anyOf: [] })).toThrow();
    const when = modelCondition({ anyOf: [{ allOf: [{ field: "supplier", op: "matches", value: "ACME (West)" }] }] });
    expect(evalCond(when, { supplier: "ACME (West)" })).toBe(true);
    expect(evalCond(when, { supplier: "ACME West" })).toBe(false);
    expect(() => modelAction({ kind: "status", field: null, value: "invented" })).toThrow();
  });

  it("drops unknown vision fields and labels unavailable vision", async () => {
    const shape = Object.fromEntries(Object.keys(VisionSchema.shape.state.shape).map((key) => [key, null]));
    const state = VisionSchema.shape.state.parse({ ...shape, amount: 0, hasPO: false });
    expect(visibleState(state)).toEqual({ amount: 0, hasPO: false });
    vi.stubEnv("AI_GATEWAY_API_KEY", "");
    vi.stubEnv("VERCEL_OIDC_TOKEN", "");
    const response = await vision(new Request("http://localhost/api/vision", { method: "POST", body: "{}" }));
    expect(response.status).toBe(503);
    expect((await response.json()).mock).toBe(true);
  });
});
