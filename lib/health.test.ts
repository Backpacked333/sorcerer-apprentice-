import { beforeEach, describe, expect, it, vi } from "vitest";

const store = vi.hoisted(() => ({
  listSessions: vi.fn(async () => []),
  storageBackend: vi.fn(() => "local"),
}));
vi.mock("@/lib/store", () => store);

import { GET } from "../app/api/health/route";

beforeEach(() => {
  vi.unstubAllEnvs();
  store.listSessions.mockResolvedValue([]);
  store.storageBackend.mockReturnValue("local");
});

describe("health integration configuration", () => {
  it("reports configured only when both voice agents and the key are present", async () => {
    vi.stubEnv("ELEVENLABS_API_KEY", "test-only");
    vi.stubEnv("NEXT_PUBLIC_INTERVIEWER_AGENT_ID", "interviewer");
    vi.stubEnv("NEXT_PUBLIC_TUTOR_AGENT_ID", "tutor");
    vi.stubEnv("AI_GATEWAY_API_KEY", "");
    vi.stubEnv("VERCEL_OIDC_TOKEN", "oidc");

    const response = await GET();
    const body = await response.json();

    expect(body.integrations.voice).toEqual({
      configured: true,
      apiKey: true,
      interviewerAgent: true,
      tutorAgent: true,
      status: "configured",
    });
    expect(body.integrations.gateway).toEqual({ configured: true, status: "configured" });
    expect(JSON.stringify(body)).not.toContain('"ready"');
  });

  it("reports degraded when a voice agent id is missing", async () => {
    vi.stubEnv("ELEVENLABS_API_KEY", "test-only");
    vi.stubEnv("NEXT_PUBLIC_INTERVIEWER_AGENT_ID", "interviewer");
    vi.stubEnv("NEXT_PUBLIC_TUTOR_AGENT_ID", "");
    vi.stubEnv("AI_GATEWAY_API_KEY", "");
    vi.stubEnv("VERCEL_OIDC_TOKEN", "");

    const response = await GET();
    const body = await response.json();

    expect(body.integrations.voice).toEqual({
      configured: false,
      apiKey: true,
      interviewerAgent: true,
      tutorAgent: false,
      status: "degraded",
    });
    expect(body.integrations.gateway).toEqual({ configured: false, status: "degraded" });
  });
});
