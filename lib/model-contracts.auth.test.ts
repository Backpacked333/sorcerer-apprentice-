import { afterEach, describe, expect, it, vi } from "vitest";
import { gatewayConfigured } from "./model-contracts";

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("AI Gateway runtime credentials", () => {
  it("recognizes Vercel's request-context OIDC token without an environment token", () => {
    vi.stubEnv("AI_GATEWAY_API_KEY", "");
    vi.stubEnv("VERCEL_OIDC_TOKEN", "");
    vi.stubGlobal(Symbol.for("@vercel/request-context"), {
      get: () => ({ headers: { "x-vercel-oidc-token": "test-request-token" } }),
    });
    expect(gatewayConfigured()).toBe(true);
  });

  it("retains API-key and local OIDC support, and fails closed without credentials", () => {
    vi.stubGlobal(Symbol.for("@vercel/request-context"), undefined);
    vi.stubEnv("AI_GATEWAY_API_KEY", "");
    vi.stubEnv("VERCEL_OIDC_TOKEN", "");
    expect(gatewayConfigured()).toBe(false);
    vi.stubEnv("VERCEL_OIDC_TOKEN", "test-local-token");
    expect(gatewayConfigured()).toBe(true);
    vi.stubEnv("VERCEL_OIDC_TOKEN", "");
    vi.stubEnv("AI_GATEWAY_API_KEY", "test-gateway-key");
    expect(gatewayConfigured()).toBe(true);
  });
});
