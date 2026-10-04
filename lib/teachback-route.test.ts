import { beforeEach, describe, expect, it, vi } from "vitest";
import { emptyMap } from "./workmap";
import { generateTeachback } from "./teachback";

const store = vi.hoisted(() => ({
  getMap: vi.fn(),
}));
vi.mock("@/lib/store", () => store);

import { POST } from "../app/api/teachback/route";

const request = (body: string) =>
  new Request("http://localhost/api/teachback", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  });

describe("teachback route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects invalid JSON", async () => {
    const response = await POST(request("{"));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid JSON" });
    expect(store.getMap).not.toHaveBeenCalled();
  });

  it.each(["{}", '{"sessionId":42}', "null"])("rejects invalid request body %s", async (body) => {
    const response = await POST(request(body));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid teachback request" });
    expect(store.getMap).not.toHaveBeenCalled();
  });

  it("returns 404 when the map does not exist", async () => {
    store.getMap.mockResolvedValue(undefined);

    const response = await POST(request(JSON.stringify({ sessionId: "s_1" })));

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "no map" });
    expect(store.getMap).toHaveBeenCalledWith("s_1");
  });

  it("returns the generated teachback and map revision", async () => {
    const map = emptyMap("s_1", "task", "expert");
    store.getMap.mockResolvedValue(map);

    const response = await POST(request(JSON.stringify({ sessionId: map.sessionId })));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ...generateTeachback(map), revision: map.revision });
  });

  it("maps InvalidIdError to a bad request", async () => {
    const error = new Error("invalid id");
    error.name = "InvalidIdError";
    store.getMap.mockRejectedValue(error);

    const response = await POST(request(JSON.stringify({ sessionId: "bad/id" })));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid id" });
  });
});
