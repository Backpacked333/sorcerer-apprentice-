import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/vision/route";

const { generate } = vi.hoisted(() => ({ generate: vi.fn() }));
vi.mock("ai", () => ({ generateText: generate, Output: { object: (options: unknown) => options } }));
const request = () => new Request("http://localhost/api/vision", { method: "POST", body: JSON.stringify({ seq: 1, image: "/9j/" }) });

beforeEach(() => {
  vi.stubEnv("AI_GATEWAY_API_KEY", "mock-only-not-a-key");
  vi.stubEnv("VISION_MODEL", undefined);
  generate.mockReset().mockResolvedValue({ output: { screen: "other", state: {}, banner: "none", uiActivity: "idle", piiRegions: [], confidence: 0 } });
});
afterEach(() => vi.unstubAllEnvs());

describe("live Gateway vision regressions (provider mocked)", () => {
  it("reserves output room for Gemini reasoning and JSON without extending the deadline", async () => {
    expect((await POST(request())).status).toBe(200);
    expect(generate.mock.calls[0][0]).toMatchObject({ model: "google/gemini-3.8-flash", reasoning: "low", maxOutputTokens: 2048, maxRetries: 0, timeout: { totalMs: 8000 } });
    expect(generate.mock.calls[0][0].instructions).toContain("A company name alone does not establish knownSupplier.");
  });

  it.each([
    new Error("private gateway details", { cause: new Error("private transport details", { cause: new DOMException("private timeout", "TimeoutError") }) }),
    Object.assign(new Error("private timeout"), { name: "GatewayTimeoutError" }),
  ])("reports wrapped SDK timeouts without exposing provider details", async (error) => {
    generate.mockRejectedValue(error);
    const response = await POST(request());
    expect(response.status).toBe(504);
    expect(await response.json()).toEqual({ error: "vision timeout", seq: 1 });
  });

  it("does not misclassify other wrapped failures as timeouts", async () => {
    generate.mockRejectedValue(new Error("private gateway details", { cause: new Error("private provider details") }));
    const response = await POST(request());
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "vision unavailable", seq: 1 });
  });
});
