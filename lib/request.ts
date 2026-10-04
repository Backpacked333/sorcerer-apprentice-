const JSON_LIMIT = 1_048_576;

export function bytesToArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

export class RequestLimitError extends Error {
  readonly status = 413;
  constructor() {
    super("request too large");
  }
}

export class BadRequestError extends Error {
  readonly status = 400;
  constructor(message = "invalid request") {
    super(message);
  }
}

export class UnsupportedMediaError extends Error {
  readonly status = 415;
  constructor() {
    super("unsupported media");
  }
}

export class RateLimitError extends Error {
  readonly status = 429;
  constructor() {
    super("upload rate limit exceeded");
  }
}

export async function readRequestBytes(request: Request, maxBytes: number): Promise<Uint8Array> {
  const contentLength = request.headers.get("content-length");
  if (contentLength !== null) {
    const parsed = Number(contentLength);
    if (!Number.isSafeInteger(parsed) || parsed < 0) throw new BadRequestError("invalid content length");
    if (parsed > maxBytes) throw new RequestLimitError();
  }
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const next = await reader.read();
      if (next.done) break;
      total += next.value.byteLength;
      if (total > maxBytes) throw new RequestLimitError();
      chunks.push(next.value);
    }
  } finally {
    reader.releaseLock();
  }
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

export async function readJson<T>(request: Request, maxBytes = JSON_LIMIT): Promise<T> {
  const bytes = await readRequestBytes(request, maxBytes);
  try {
    return JSON.parse(new TextDecoder().decode(bytes)) as T;
  } catch {
    throw new BadRequestError("invalid JSON");
  }
}

export function jsonError(error: unknown): Response {
  const invalidId = error instanceof Error && error.name === "InvalidIdError";
  const status = error instanceof RequestLimitError || error instanceof BadRequestError || error instanceof UnsupportedMediaError || error instanceof RateLimitError ? error.status : invalidId ? 400 : 500;
  const message = status === 500 ? "storage unavailable" : error instanceof Error ? error.message : "request failed";
  return Response.json({ error: message }, { status });
}
