import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const createToken = vi.fn();

vi.mock("@elevenlabs/elevenlabs-js", () => ({
  ElevenLabsClient: class {
    tokens = { singleUse: { create: createToken } };
  },
}));

import { GET } from "../app/api/scribe-token/route";

describe("GET /api/scribe-token", () => {
  const originalKey = process.env.ELEVENLABS_API_KEY;

  beforeEach(() => {
    createToken.mockReset();
  });

  afterEach(() => {
    if (originalKey === undefined) delete process.env.ELEVENLABS_API_KEY;
    else process.env.ELEVENLABS_API_KEY = originalKey;
  });

  it("returns a non-cacheable keyless fallback", async () => {
    delete process.env.ELEVENLABS_API_KEY;

    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      token: null,
      reason: "ELEVENLABS_API_KEY not set; the browser recognizer is used instead",
    });
  });

  it("contains an invalid provider key as a truthful degraded response", async () => {
    process.env.ELEVENLABS_API_KEY = "test-secret-that-must-not-leak";
    createToken.mockRejectedValue(Object.assign(new Error("request included test-secret-that-must-not-leak"), { statusCode: 401 }));

    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const body = await response.json();
    expect(body).toEqual({
      token: null,
      reason: "ElevenLabs rejected the configured API key (401); the browser recognizer is used instead",
    });
    expect(JSON.stringify(body)).not.toContain(process.env.ELEVENLABS_API_KEY);
  });

  it("returns the single-use token without caching it", async () => {
    process.env.ELEVENLABS_API_KEY = "valid-test-key";
    createToken.mockResolvedValue({ token: "single-use-token" });

    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({ token: "single-use-token" });
    expect(createToken).toHaveBeenCalledWith("realtime_scribe");
  });
});
