import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { emptySession } from "./events";
import { emptyMap } from "./workmap";

const { rpc, from } = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }));
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({ rpc, from }) }));
vi.mock("./workspace", () => ({ getWorkspaceId: async () => "workspace_a" }));
import { saveCompiledMap } from "./store";

beforeEach(() => {
  vi.stubEnv("STORAGE_BACKEND", "supabase"); vi.stubEnv("SUPABASE_URL", "https://example.invalid");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "mock-only"); rpc.mockReset(); from.mockReset();
});
afterEach(() => vi.unstubAllEnvs());

it("publishes using one workspace-scoped compare-and-publish RPC, not a client-side read/write", async () => {
  const source = emptySession("s", "capture", "Review", "Expert");
  const map = emptyMap(source.id, source.task, source.expertName);
  rpc.mockResolvedValue({ data: { ...map, revision: 4 }, error: null });
  expect(await saveCompiledMap(map, source)).toBe(true);
  expect(rpc).toHaveBeenCalledExactlyOnceWith("tacit_publish_compiled_map", {
    p_owner: "workspace_a", p_session: "s", p_source: source, p_data: expect.objectContaining({ sessionId: "s", revision: 0 }),
  });
  expect(from).not.toHaveBeenCalled();
  expect(map.revision).toBe(4);
});

it("returns a conflict without mutating or overwriting the previous map", async () => {
  const source = emptySession("s", "capture", "Review", "Expert");
  const map = emptyMap(source.id, source.task, source.expertName);
  rpc.mockResolvedValue({ data: null, error: null });
  expect(await saveCompiledMap(map, source)).toBe(false);
  expect(map.revision).toBe(0);
  expect(rpc).toHaveBeenCalledTimes(1);
  expect(from).not.toHaveBeenCalled();
});

it.each(["missing migration", "invalid result"])("fails closed on %s without falling back to an unguarded write", async (failure) => {
  const source = emptySession("s", "capture", "Review", "Expert");
  rpc.mockResolvedValue(failure === "missing migration" ? { data: null, error: new Error("missing RPC") } : { data: {}, error: null });
  await expect(saveCompiledMap(emptyMap(source.id, source.task, source.expertName), source)).rejects.toThrow();
  expect(rpc).toHaveBeenCalledTimes(1);
  expect(from).not.toHaveBeenCalled();
});
