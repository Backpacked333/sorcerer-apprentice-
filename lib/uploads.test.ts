import { describe, expect, it, vi } from "vitest";

const store = vi.hoisted(() => ({
  getSession: vi.fn(async () => ({ id: "s_1", frames: [], windows: [] })),
  allowRateLimit: vi.fn(async () => true),
  saveFrame: vi.fn(async () => "s_1/s_1/frames/f_1.jpg"),
  readFrame: vi.fn(),
  saveClip: vi.fn(async () => "s_1/s_1/clips/a_1.webm"),
  readClip: vi.fn(),
  deleteClip: vi.fn(async () => {}),
}));
vi.mock("@/lib/store", () => store);

import { POST as postFrame } from "../app/api/sessions/[id]/frames/route";
import { DELETE as deleteClipRoute, POST as postClip } from "../app/api/sessions/[id]/clips/route";

describe("frame upload boundary", () => {
  it("rejects non-image media", async () => {
    const response = await postFrame(new Request("http://localhost/api/sessions/s_1/frames?frameId=f_1", { method: "POST", headers: { "content-type": "image/gif" }, body: "gif" }), { params: Promise.resolve({ id: "s_1" }) });
    expect(response.status).toBe(415);
    expect(store.saveFrame).not.toHaveBeenCalled();
  });

  it("checks the actual JPEG signature", async () => {
    const response = await postFrame(new Request("http://localhost/api/sessions/s_1/frames?frameId=f_1", { method: "POST", headers: { "content-type": "image/jpeg" }, body: "not jpeg" }), { params: Promise.resolve({ id: "s_1" }) });
    expect(response.status).toBe(415);
    expect(store.saveFrame).not.toHaveBeenCalled();
  });

  it("accepts a bounded JPEG only after the workspace session exists", async () => {
    const response = await postFrame(new Request("http://localhost/api/sessions/s_1/frames?frameId=f_1", { method: "POST", headers: { "content-type": "image/jpeg" }, body: new Uint8Array([0xff, 0xd8, 0xff, 0xd9]) }), { params: Promise.resolve({ id: "s_1" }) });
    expect(response.status).toBe(200);
    expect(store.saveFrame).toHaveBeenCalledOnce();
  });

  it("rejects frames above 750 KiB and rate-limited uploads", async () => {
    const large = new Uint8Array(750 * 1024 + 1);
    large.set([0xff, 0xd8, 0xff]);
    const response = await postFrame(new Request("http://localhost/api/sessions/s_1/frames?frameId=f_2", { method: "POST", headers: { "content-type": "image/jpeg" }, body: large }), { params: Promise.resolve({ id: "s_1" }) });
    expect(response.status).toBe(413);

    store.allowRateLimit.mockResolvedValueOnce(false);
    const throttled = await postFrame(new Request("http://localhost/api/sessions/s_1/frames?frameId=f_3", { method: "POST", headers: { "content-type": "image/jpeg" }, body: new Uint8Array([0xff, 0xd8, 0xff]) }), { params: Promise.resolve({ id: "s_1" }) });
    expect(throttled.status).toBe(429);
  });

  it("checks WebM signatures and the 3 MiB clip limit", async () => {
    const form = new FormData();
    form.append("audioId", "a_1");
    form.append("file", new Blob([new Uint8Array([1, 2, 3, 4])], { type: "audio/webm" }), "clip.webm");
    const invalid = await postClip(new Request("http://localhost/api/sessions/s_1/clips", { method: "POST", body: form }), { params: Promise.resolve({ id: "s_1" }) });
    expect(invalid.status).toBe(415);
    expect(store.saveClip).not.toHaveBeenCalled();

    const largeForm = new FormData();
    largeForm.append("audioId", "a_1");
    const clip = new Uint8Array(3 * 1024 * 1024 + 1);
    clip.set([0x1a, 0x45, 0xdf, 0xa3]);
    largeForm.append("file", new Blob([clip], { type: "audio/webm" }), "clip.webm");
    const oversized = await postClip(new Request("http://localhost/api/sessions/s_1/clips", { method: "POST", body: largeForm }), { params: Promise.resolve({ id: "s_1" }) });
    expect(oversized.status).toBe(413);
  });

  it("deletes clips only after an owned session lookup", async () => {
    store.getSession.mockResolvedValueOnce(null as never);
    const missing = await deleteClipRoute(new Request("http://localhost/api/sessions/s_1/clips?audioId=a_1", { method: "DELETE" }), { params: Promise.resolve({ id: "s_1" }) });
    expect(missing.status).toBe(404);
    expect(store.deleteClip).not.toHaveBeenCalled();

    const response = await deleteClipRoute(new Request("http://localhost/api/sessions/s_1/clips?audioId=a_1", { method: "DELETE" }), { params: Promise.resolve({ id: "s_1" }) });
    expect(response.status).toBe(200);
    expect(store.deleteClip).toHaveBeenCalledWith("s_1", "a_1");
  });
});
