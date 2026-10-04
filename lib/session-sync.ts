import type { SessionLog } from "./events";

type CachedFrame = { dataUrl: string; url: string };

function cloneLog(log: SessionLog): SessionLog {
  return JSON.parse(JSON.stringify(log)) as SessionLog;
}

function decodeDataUrl(dataUrl: string): { bytes: Uint8Array; contentType: "image/jpeg" | "image/png" } {
  const match = /^data:(image\/(?:jpeg|png));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!match) throw new Error("unsupported frame data");
  const binary = atob(match[2]);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return { bytes, contentType: match[1] as "image/jpeg" | "image/png" };
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

export function createSessionSync(sessionId: string, request: typeof fetch = fetch) {
  const cached = new Map<string, CachedFrame>();
  let queue = Promise.resolve();

  const persist = async (snapshot: SessionLog): Promise<void> => {
    const payload = cloneLog(snapshot);
    for (const frame of payload.frames) {
      if (!frame.dataUrl) frame.dataUrl = frame.url;
      delete frame.url;
      if (!frame.dataUrl?.startsWith("data:")) continue;
      const dataUrl = frame.dataUrl;
      const existing = cached.get(frame.id);
      if (existing?.dataUrl === frame.dataUrl) {
        frame.dataUrl = existing.url;
        continue;
      }
      const { bytes, contentType } = decodeDataUrl(frame.dataUrl);
      const upload = await request(`/api/sessions/${encodeURIComponent(sessionId)}/frames?frameId=${encodeURIComponent(frame.id)}`, {
        method: "POST",
        headers: { "content-type": contentType },
        body: toArrayBuffer(bytes),
      });
      if (!upload.ok) throw new Error("frame upload rejected");
      const result = (await upload.json()) as { url?: string };
      const url = result.url;
      const expectedUrl = `/api/sessions/${encodeURIComponent(sessionId)}/frames?frameId=${encodeURIComponent(frame.id)}`;
      if (url !== expectedUrl) throw new Error("frame upload returned invalid URL");
      cached.set(frame.id, { dataUrl, url });
      frame.dataUrl = url;
    }
    if (payload.frames.some((frame) => frame.dataUrl?.startsWith("data:"))) throw new Error("frame data was not uploaded");
    const response = await request(`/api/sessions/${encodeURIComponent(sessionId)}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error("session sync rejected");
  };

  return {
    sync(snapshot: SessionLog): Promise<void> {
      const copy = cloneLog(snapshot);
      const next = queue.then(() => persist(copy));
      queue = next.catch(() => {});
      return next;
    },
  };
}
