import { beforeEach, describe, expect, it, vi } from "vitest";
import { emptySession } from "./events";

const store = vi.hoisted(() => ({
  getSession: vi.fn(),
  getMap: vi.fn(),
  saveSession: vi.fn(),
}));
vi.mock("@/lib/store", () => store);

import { PUT } from "../app/api/sessions/[id]/route";

describe("session media metadata boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    store.getSession.mockResolvedValue(emptySession("s_1", "capture", "task", "expert"));
    store.saveSession.mockResolvedValue(undefined);
  });

  it("rejects data URLs and non-private frame references", async () => {
    for (const dataUrl of ["data:image/jpeg;base64,/9j/AA==", "https://example.test/frame.jpg"]) {
      const session = emptySession("s_1", "capture", "task", "expert");
      session.frames.push({ id: "f_1", t: 1, dataUrl, width: 1, height: 1, piiRegionsBlurred: 0 });
      const response = await PUT(new Request("http://localhost/api/sessions/s_1", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(session) }), { params: Promise.resolve({ id: "s_1" }) });
      expect(response.status).toBe(400);
    }
    expect(store.saveSession).not.toHaveBeenCalled();
  });

  it("accepts only the exact same-origin frame URL for the session", async () => {
    const session = emptySession("s_1", "capture", "task", "expert");
    session.frames.push({ id: "f_1", t: 1, dataUrl: "/api/sessions/s_1/frames?frameId=f_1", width: 1, height: 1, piiRegionsBlurred: 0 });
    const response = await PUT(new Request("http://localhost/api/sessions/s_1", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(session) }), { params: Promise.resolve({ id: "s_1" }) });
    expect(response.status).toBe(200);
    expect(store.saveSession).toHaveBeenCalledWith(session);
  });
});
