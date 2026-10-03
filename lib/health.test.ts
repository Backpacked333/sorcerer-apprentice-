import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("./store", () => ({ getSession: vi.fn(), getMap: vi.fn() }));
import { getMap, getSession } from "./store";
import { GET } from "../app/api/health/route";
import { emptySession } from "./events";
import { emptyMap } from "./workmap";

describe("health without credentials disclosure", () => {
  beforeEach(() => { vi.resetAllMocks(); vi.unstubAllEnvs(); });
  it("returns only key and agent presence, never their values", async () => {
    vi.stubEnv("ELEVENLABS_API_KEY", "test-not-a-real-key");
    vi.stubEnv("AI_GATEWAY_API_KEY", "test-not-a-real-gateway-key");
    vi.stubEnv("NEXT_PUBLIC_INTERVIEWER_AGENT_ID", "private-test-agent");
    vi.mocked(getSession).mockImplementation(async (id) => emptySession(id, "capture", "sample", "Tester"));
    vi.mocked(getMap).mockImplementation(async (id) => ({ ...emptyMap(id, "sample", "Tester"), confirmedAt: 1 }));
    const response = await GET();
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body).toMatchObject({ ok: true, store: "fs", keys: { elevenlabs: true, gateway: true }, agents: { interviewer: true }, sample: { present: true } });
    expect(JSON.stringify(body)).not.toContain("test-");
    expect(response.headers.get("cache-control")).toContain("no-store");
  });
  it("fails readiness for missing samples or unreadable storage without exposing paths", async () => {
    expect((await GET()).status).toBe(503);
    vi.mocked(getSession).mockRejectedValue(new Error("private storage error"));
    const response = await GET();
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("private storage error");
  });
  it("fails readiness when the Teach sample is not confirmed or has mismatched identity", async () => {
    vi.mocked(getSession).mockImplementation(async (id) => emptySession(id, "capture", "sample", "Tester"));
    vi.mocked(getMap).mockImplementation(async (id) => emptyMap(id, "sample", "Tester"));
    expect((await GET()).status).toBe(503);
    vi.mocked(getMap).mockImplementation(async () => ({ ...emptyMap("wrong", "sample", "Tester"), confirmedAt: 1 }));
    expect((await GET()).status).toBe(503);
  });
});
