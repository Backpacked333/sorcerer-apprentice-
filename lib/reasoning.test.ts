import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/reason/route";
import { buildMemory } from "./memory";
import { emptySession } from "./events";
import { PreparedQuestions } from "./prepared-question";
import { buildCandidates, CandidateQueue, newContext } from "./curiosity";

const { generate } = vi.hoisted(() => ({ generate: vi.fn() }));
vi.mock("ai", () => ({ generateText: generate, Output: { object: (o: unknown) => o } }));
const memory = () => buildMemory(emptySession("test", "capture", "Review shipments", "Expert"));
const request = (body = JSON.stringify(memory()), origin = "http://localhost") => new Request("http://localhost/api/reason", {
  method: "POST", headers: { origin, "content-type": "application/json" }, body,
});
beforeEach(() => {
  vi.stubEnv("AI_GATEWAY_API_KEY", "mock"); vi.stubEnv("VERCEL_OIDC_TOKEN", "");
  vi.stubEnv("REASONING_MODEL", "test/reasoner"); vi.stubEnv("REASONING_MODE", "shadow");
  generate.mockReset().mockResolvedValue({ output: { questions: [], relationships: [] } });
});
afterEach(() => vi.unstubAllEnvs());

describe("bounded background reasoning", () => {
  it("defaults to shadow, uses structured high reasoning and forwards cancellation", async () => {
    const req = request(), res = await POST(req);
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toMatchObject({ mode: "shadow", profile: { status: "proposed", relationships: [] } });
    expect(generate.mock.calls[0][0]).toMatchObject({ model: "test/reasoner", reasoning: "high", maxRetries: 0,
      maxOutputTokens: 4096, timeout: { totalMs: 25000 }, abortSignal: req.signal });
  });
  it("supports explicitly opted-in live questions and Vercel OIDC", async () => {
    vi.stubEnv("AI_GATEWAY_API_KEY", ""); vi.stubEnv("VERCEL_OIDC_TOKEN", "mock-oidc"); vi.stubEnv("REASONING_MODE", "live");
    expect(await (await POST(request())).json()).toMatchObject({ mode: "live" });
    expect(generate).toHaveBeenCalledOnce();
  });
  it.each(["off", "keyless"])("does not spend in %s mode", async (mode) => {
    if (mode === "off") vi.stubEnv("REASONING_MODE", "off"); else vi.stubEnv("AI_GATEWAY_API_KEY", "");
    expect(await (await POST(request())).json()).toEqual({ mode: "off" });
    expect(generate).not.toHaveBeenCalled();
  });
  it("rejects cross-origin, malformed, invalid and oversized requests before inference", async () => {
    expect((await POST(request("{}", "https://untrusted.example"))).status).toBe(403);
    expect((await POST(request("{"))).status).toBe(400);
    expect((await POST(request("{}"))).status).toBe(400);
    expect((await POST(request("x".repeat(131073)))).status).toBe(413);
    expect(generate).not.toHaveBeenCalled();
  });
  it("fails closed without returning provider errors or secrets", async () => {
    generate.mockRejectedValue(new Error("private provider details"));
    const res = await POST(request());
    expect(res.status).toBe(503); expect(await res.text()).not.toContain("private");
  });
});

describe("prepared question dispatch", () => {
  it("never lets model preference bypass age, parent or forced guardrail eligibility", () => {
    const queue = new CandidateQueue();
    queue.add(buildCandidates({ id: "edit", t: 10, kind: "field_changed", source: "dom", invoice: "9", field: "costCenter", from: "1", to: "2" }, newContext(), 10));
    const why = queue.items.find((c) => c.kind === "why")!, guard = queue.items.find((c) => c.guardrail)!;
    expect(queue.pick(false, 11, 3, why.id)).toBeUndefined();
    expect(queue.pick(false, 14, 3, guard.id)?.id).toBe(why.id);
    queue.markAsked(why.id);
    expect(queue.pick(true, 14, 3, why.id)?.guardrail).toBe(true);
  });
  it("expires or rejects stale and wrong-session questions at the last handoff", () => {
    const m = memory(), packet = new PreparedQuestions();
    packet.set(m, [{ candidateId: "q1", question: "Why this route?" }], 100);
    expect(packet.get(m, "q1", 200)).toBe("Why this route?");
    expect(packet.get({ ...m, sessionId: "other" }, "q1", 200)).toBeUndefined();
    expect(packet.get({ ...m, history: [{ question: "Already answered?", outcome: "answered" }] }, "q1", 200)).toBeUndefined();
    expect(packet.get(m, "q1", 20100)).toBeUndefined();
    packet.clear(); expect(packet.get(m, "q1", 200)).toBeUndefined();
  });
});
