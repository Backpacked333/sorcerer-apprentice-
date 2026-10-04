import { describe, expect, it, vi } from "vitest";
import { emptySession } from "./events";
import { createSessionSync } from "./session-sync";

const frame = "data:image/jpeg;base64,/9j/AA==";

describe("serialized session sync", () => {
  it("uploads frames before metadata and never sends base64 in the log", async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    const request = vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      if (url.includes("/frames?")) return new Response(JSON.stringify({ url: "/api/sessions/s_1/frames?frameId=f_1" }), { status: 200 });
      return new Response("{}", { status: 200 });
    });
    const sync = createSessionSync("s_1", request as unknown as typeof fetch);
    const log = emptySession("s_1", "capture", "task", "expert");
    log.frames.push({ id: "f_1", t: 1, dataUrl: frame, width: 1, height: 1, piiRegionsBlurred: 0 });
    await sync.sync(log);
    expect(calls.map((call) => call.url)).toEqual(["/api/sessions/s_1/frames?frameId=f_1", "/api/sessions/s_1"]);
    expect(String(calls[1].init?.body)).not.toContain("data:image");
  });

  it("serializes overlapping snapshots so the newest off-record state wins", async () => {
    const bodies: string[] = [];
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const request = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith("/s_2")) {
        bodies.push(String(init?.body));
        if (bodies.length === 1) await gate;
      }
      return new Response("{}", { status: 200 });
    });
    const sync = createSessionSync("s_2", request as unknown as typeof fetch);
    const first = emptySession("s_2", "capture", "task", "expert");
    const second = emptySession("s_2", "capture", "task", "expert");
    second.offRecord.push({ from: 2, to: 3 });
    const one = sync.sync(first);
    const two = sync.sync(second);
    release();
    await Promise.all([one, two]);
    expect(bodies).toHaveLength(2);
    expect(JSON.parse(bodies[1]).offRecord).toEqual([{ from: 2, to: 3 }]);
  });

  it("rejects failed uploads and final metadata writes", async () => {
    const failedUpload = createSessionSync("s_3", vi.fn(async () => new Response("{}", { status: 413 })) as unknown as typeof fetch);
    const withFrame = emptySession("s_3", "capture", "task", "expert");
    withFrame.frames.push({ id: "f_3", t: 1, dataUrl: frame, width: 1, height: 1, piiRegionsBlurred: 0 });
    await expect(failedUpload.sync(withFrame)).rejects.toThrow("frame upload rejected");

    const failedSave = createSessionSync("s_4", vi.fn(async () => new Response("{}", { status: 503 })) as unknown as typeof fetch);
    await expect(failedSave.sync(emptySession("s_4", "capture", "task", "expert"))).rejects.toThrow("session sync rejected");
  });
});
