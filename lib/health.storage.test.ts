import { beforeEach, expect, it, vi } from "vitest";

const store = vi.hoisted(() => ({ listSessions: vi.fn(), storageBackend: vi.fn() }));
vi.mock("@/lib/store", () => store);
import { GET } from "../app/api/health/route";

beforeEach(() => {
  vi.resetAllMocks();
  store.storageBackend.mockReturnValue("supabase");
  store.listSessions.mockResolvedValue([]);
});

it("reports reachable private storage without requiring a shared sample and never caches health", async () => {
  const response = await GET();
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect((await response.json()).storage).toEqual({ configured: true, reachable: true, backend: "supabase" });
});

it.each(["configuration", "connection"])("fails closed without leaking %s errors", async (failure) => {
  const secret = "provider-credential-must-not-escape";
  if (failure === "configuration") store.storageBackend.mockImplementation(() => { throw new Error(secret); });
  else store.listSessions.mockRejectedValue(new Error(secret));
  const response = await GET();
  expect(response.status).toBe(503);
  expect(response.headers.get("cache-control")).toBe("no-store");
  const body = await response.json();
  expect(body.ok).toBe(false);
  expect(body.storage.reachable).toBe(false);
  expect(JSON.stringify(body)).not.toContain(secret);
});
