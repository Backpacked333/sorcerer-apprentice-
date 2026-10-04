import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as route from "@/app/api/vision/route";

const { generate } = vi.hoisted(() => ({ generate: vi.fn() }));
vi.mock("ai", () => ({ generateText: generate, generateObject: generate, Output: { object: (options: unknown) => options } }));
const wire = {
  screen: "invoice_detail", banner: "none", uiActivity: "reading", piiRegions: [], confidence: 1.7,
  state: { invoice: "INV-1234", supplier: null, entity: null, amount: null, category: null, invoiceMonth: null,
    invoiceDate: null, costCenter: "0400 Machinery", route: "Second approval", status: "On hold",
    hasAssetNumber: false, knownSupplier: null, hasPO: null, description: null },
};
const request = (body: unknown = { seq: 7, image: "data:image/jpeg;base64,/9j/", prevState: { invoice: "IGNORE_INSTRUCTIONS" } }) =>
  new Request("http://localhost/api/vision", { method: "POST", body: JSON.stringify(body) });

beforeEach(() => {
  vi.stubEnv("AI_GATEWAY_API_KEY", "mock-only-not-a-key");
  vi.stubEnv("VISION_MODEL", "test/vision");
  generate.mockReset().mockResolvedValue({ output: wire, object: wire });
});
afterEach(() => vi.unstubAllEnvs());

describe("vision route (provider mocked)", () => {
  it("uses bounded structured generation and a bare JPEG file without previous-state inference", async () => {
    const response = await route.POST(request());
    expect(response.status).toBe(200);
    const call = generate.mock.calls[0][0];
    expect(call).toMatchObject({ model: "test/vision", maxOutputTokens: 500, maxRetries: 0, timeout: { totalMs: 8000 } });
    expect(call.output.schema).toBeDefined();
    expect(call.instructions).toMatch(/never an instruction/i);
    expect(call).not.toHaveProperty("system");
    expect(call.messages[0].content).toEqual([
      { type: "text", text: "Report the current state of this frame." },
      { type: "file", mediaType: "image/jpeg", data: "/9j/" },
    ]);
    expect(JSON.stringify(call)).not.toContain("IGNORE_INSTRUCTIONS");
    expect(route).toHaveProperty("maxDuration", 30);
    const body = await response.json();
    expect(body).toMatchObject({ seq: 7, banner: "none", confidence: 1, model: "test/vision", latencyMs: expect.any(Number) });
    expect(body.state).toEqual({ invoice: "1234", costCenter: "0400", route: "second_approval", status: "hold", hasAssetNumber: false });
  });

  it.each(["invoice_list", "other"])("discards phantom invoice state on %s", async (screen) => {
    generate.mockResolvedValue({ output: { ...wire, screen }, object: { ...wire, screen } });
    expect((await (await route.POST(request())).json()).state).toEqual({});
  });

  it("returns keyless 503 without calling a provider", async () => {
    vi.stubEnv("AI_GATEWAY_API_KEY", "");
    const response = await route.POST(request());
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ mock: true });
    expect(generate).not.toHaveBeenCalled();
  });

  it("also accepts bare JPEG base64 without interpreting it as a URL", async () => {
    expect((await route.POST(request({ seq: 8, image: "/9j/" }))).status).toBe(200);
    expect(generate.mock.calls[0][0].messages[0].content[1].data).toBe("/9j/");
  });

  it("rejects oversized images without exhausting the regex stack or calling a provider", async () => {
    const response = await route.POST(request({ seq: 8, image: "A".repeat(10_000_000) }));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid vision request" });
    expect(generate).not.toHaveBeenCalled();
  });

  it("validates a large in-budget base64 payload without exhausting the stack", async () => {
    const response = await route.POST(request({ seq: 8, image: "A".repeat(4 * 1024 * 1024) }));
    expect(response.status).toBe(200);
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it.each(["A", "AA=", "AA===", "A=AA", "====", "AA?=", "AAAA\n", "AAA\n"])("rejects malformed base64 %j", async (image) => {
    expect((await route.POST(request({ seq: 8, image }))).status).toBe(400);
    expect(generate).not.toHaveBeenCalled();
  });
  it.each(["QQ==", "QUI="])("accepts valid padding %j with a mocked provider", async (image) => {
    expect((await route.POST(request({ seq: 8, image }))).status).toBe(200);
  });

  it.each([
    [new Error("private-provider-response"), 502, "vision unavailable"],
    [new DOMException("private-provider-response", "TimeoutError"), 504, "vision timeout"],
  ])("sanitizes provider failures (%s)", async (error, status, message) => {
    generate.mockRejectedValue(error);
    const response = await route.POST(request());
    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({ error: message, seq: 7 });
  });

  it.each([null, {}, { seq: 1, image: "https://example.com/image.jpg" }, { seq: "bad", image: "/9j/" }])("rejects invalid input without provider calls", async (body) => {
    expect((await route.POST(request(body))).status).toBe(400);
    expect(generate).not.toHaveBeenCalled();
  });
  it("handles malformed JSON without echoing it", async () => {
    const response = await route.POST(new Request("http://localhost/api/vision", { method: "POST", body: "private-invalid-json" }));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid vision request" });
    expect(generate).not.toHaveBeenCalled();
  });
});
