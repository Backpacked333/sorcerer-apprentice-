import { expect, it, vi } from "vitest";
import { emptySession } from "./events";
import { createSessionSync } from "./session-sync";

it("normalizes the additive frame url field without persisting inline bytes or uploading twice", async () => {
  const log = emptySession("session", "capture", "Task", "Expert");
  log.frames.push({ id: "frame", t: 0, url: "data:image/png;base64,aGVsbG8=", width: 1, height: 1, piiRegionsBlurred: 0 });
  const url = "/api/sessions/session/frames?frameId=frame";
  const request = vi.fn(async (_url: string | URL | Request, init?: RequestInit) =>
    Response.json(init?.method === "POST" ? { url } : { ok: true }));
  const sync = createSessionSync(log.id, request);
  await sync.sync(log);
  await sync.sync(log);
  expect(request.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(1);
  for (const [, init] of request.mock.calls.filter(([, init]) => init?.method === "PUT")) {
    const frame = JSON.parse(init!.body as string).frames[0];
    expect(frame.dataUrl).toBe(url);
    expect(frame.url).toBeUndefined();
  }
  expect(log.frames[0].url).toMatch(/^data:/);
});
