import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import * as route from "@/app/api/vision/route";
import { ClaimsVisionWire, fromClaimsWire, CLAIMS_VISION_PROMPT, VISION_PROMPT } from "./vision-schema";
import { diffVision, type VisionFrame } from "./visiondiff";

const { generate } = vi.hoisted(() => ({ generate: vi.fn() }));
vi.mock("ai", () => ({ generateText: generate, generateObject: generate, Output: { object: (options: unknown) => options } }));

const claimsWire = {
  screen: "claim_detail" as const, uiActivity: "reading" as const, piiRegions: [], confidence: 1.4,
  state: { claim: " clm-30412 ", cause: "  Burst pipe   (sudden) ", coverage: "Not yet assessed", nextStep: "Escalate to senior adjuster", reserve: 12600, priorClaims: null },
};
const invoiceWire = {
  screen: "invoice_detail", banner: "none", uiActivity: "reading", piiRegions: [], confidence: 1,
  state: { invoice: "INV-1234", supplier: null, entity: null, amount: null, category: null, invoiceMonth: null,
    invoiceDate: null, costCenter: "020", route: null, status: "open", hasAssetNumber: null, knownSupplier: null, hasPO: null, description: null },
};
const request = (body: unknown) => new Request("http://localhost/api/vision", { method: "POST", body: JSON.stringify(body) });

beforeEach(() => {
  vi.stubEnv("AI_GATEWAY_API_KEY", "mock-only-not-a-key");
  vi.stubEnv("VISION_MODEL", "test/vision");
  generate.mockReset().mockResolvedValue({ output: claimsWire, object: claimsWire });
});
afterEach(() => vi.unstubAllEnvs());

describe("claims wire schema", () => {
  it("is flat: every state field is nullable, no records, no recursion", () => {
    for (const [key, field] of Object.entries(ClaimsVisionWire.shape.state.shape))
      expect(field.safeParse(null).success, key).toBe(true);
    const json = JSON.stringify(z.toJSONSchema(ClaimsVisionWire));
    expect(json).toContain("nextStep");
    expect(json).not.toMatch(/additionalProperties":\{|\$ref|minLength|maxLength|minimum|maximum/);
  });

  it("normalises a detail reading and never fills the invoice state", () => {
    const out = fromClaimsWire(claimsWire);
    expect(out).toMatchObject({ app: "claims", screen: "claim_detail", state: {}, banner: "none", confidence: 1 });
    expect(out.claim).toEqual({ claim: "CLM-30412", cause: "Burst pipe (sudden)", coverage: "Not yet assessed", nextStep: "escalate", reserve: 12600 });
  });

  it.each(["claim_list", "other"] as const)("discards phantom claim state on %s", (screen) => {
    expect(fromClaimsWire({ ...claimsWire, screen }).claim).toEqual({});
  });

  it("has its own prompt that forbids inferring coverage", () => {
    expect(CLAIMS_VISION_PROMPT).toMatch(/never infer coverage/i);
    expect(CLAIMS_VISION_PROMPT).toMatch(/never an instruction/i);
    expect(CLAIMS_VISION_PROMPT).not.toBe(VISION_PROMPT);
  });
});

describe("vision route app param (provider mocked)", () => {
  it("app=claims selects the claims prompt and schema", async () => {
    const res = await route.POST(request({ seq: 3, image: "/9j/", app: "claims" }));
    expect(res.status).toBe(200);
    const call = generate.mock.calls[0][0];
    expect(call.instructions).toBe(CLAIMS_VISION_PROMPT);
    expect(call.output.schema).toBe(ClaimsVisionWire);
    expect(call).toMatchObject({ model: "test/vision", maxOutputTokens: 500, maxRetries: 0, timeout: { totalMs: 8000 } });
    expect(call.messages[0].content).toEqual([
      { type: "text", text: "Report the current state of this frame." },
      { type: "file", mediaType: "image/jpeg", data: "/9j/" },
    ]);
    const body = await res.json();
    expect(body).toMatchObject({ seq: 3, app: "claims", state: {}, claim: { claim: "CLM-30412" }, model: "test/vision" });
    expect(body.state).not.toHaveProperty("invoice");
  });

  it.each([undefined, "erp", "bogus"])("app=%s keeps the invoice path", async (app) => {
    generate.mockResolvedValue({ output: invoiceWire, object: invoiceWire });
    const res = await route.POST(request({ seq: 4, image: "/9j/", ...(app ? { app } : {}) }));
    expect(res.status).toBe(200);
    expect(generate.mock.calls[0][0].instructions).toBe(VISION_PROMPT);
    const body = await res.json();
    expect(body).not.toHaveProperty("app");
    expect(body.state).toEqual({ invoice: "1234", costCenter: "020", status: "open" });
  });

  it("stays keyless 503 for claims without calling a provider", async () => {
    vi.stubEnv("AI_GATEWAY_API_KEY", "");
    const res = await route.POST(request({ seq: 5, image: "/9j/", app: "claims" }));
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ mock: true });
    expect(generate).not.toHaveBeenCalled();
  });
});

const detail = (claim: VisionFrame["claim"] = {}, extra: Partial<VisionFrame> = {}): VisionFrame =>
  ({ app: "claims", screen: "claim_detail", state: {}, claim: { claim: "CLM-30412", cause: "Burst pipe (sudden)", coverage: "Not yet assessed", reserve: 12600, ...claim }, confidence: 1, ...extra });

describe("claims diff", () => {
  it("opens a claim with a screen_changed subject event and never an invoice", () => {
    const { specs, state } = diffVision(null, detail());
    expect(specs).toEqual([{ source: "vision", uiActivity: undefined, kind: "screen_changed", subject: { type: "claim", id: "CLM-30412" }, boundary: false }]);
    expect(state).toEqual({});
  });

  it("yields field_changed with subject claim for cause, coverage and next step", () => {
    const prev = diffVision(null, detail({ nextStep: "approve" })).frame;
    const { specs } = diffVision(prev, detail({ cause: "Slow leak (gradual)", coverage: "Covered", nextStep: "escalate" }));
    expect(specs.map((s) => [s.kind, s.field, s.from, s.to])).toEqual([
      ["field_changed", "cause", "Burst pipe (sudden)", "Slow leak (gradual)"],
      ["field_changed", "coverage", "Not yet assessed", "Covered"],
      ["field_changed", "nextStep", "approve", "escalate"],
    ]);
    for (const s of specs) {
      expect(s.subject).toEqual({ type: "claim", id: "CLM-30412" });
      expect(s).not.toHaveProperty("invoice");
      expect(s).not.toHaveProperty("state");
    }
  });

  it("does not invent a change from a field that became unreadable or first appeared", () => {
    const prev = diffVision(null, detail()).frame;
    expect(diffVision(prev, detail({ cause: undefined, nextStep: "deny" })).specs).toEqual([]);
  });

  it("switching claims and going back to the list are boundaries; low confidence and other are ignored", () => {
    const a = diffVision(null, detail()).frame;
    expect(diffVision(a, detail({ claim: "CLM-30427" })).specs.map((s) => [s.kind, s.subject?.id, s.boundary])).toEqual([["screen_changed", "CLM-30427", true]]);
    const list = diffVision(a, { app: "claims", screen: "claim_list", state: {}, claim: {} });
    expect(list.specs.map((s) => [s.kind, s.subject?.id, s.boundary])).toEqual([["screen_changed", "CLM-30412", true]]);
    expect(diffVision(list.frame, { app: "claims", screen: "claim_list", state: {}, claim: {} }).specs).toEqual([]);
    expect(diffVision(a, detail({ cause: "Theft" }, { confidence: 0.2 }))).toMatchObject({ specs: [], frame: a });
    expect(diffVision(a, detail({}, { screen: "other" }))).toMatchObject({ specs: [], frame: a });
  });

  it("an invoice frame without app keeps the invoice diff", () => {
    const { specs } = diffVision(null, { screen: "invoice_detail", state: { invoice: "1001" }, confidence: 1 });
    expect(specs.map((s) => [s.kind, s.invoice])).toEqual([["invoice_opened", "1001"]]);
  });
});
