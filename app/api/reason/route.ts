import { NextResponse } from "next/server";
import { MemorySchema } from "@/lib/memory";
import { reasonAbout, reasoningAvailable } from "@/lib/reasoning";

export const maxDuration = 30;

export async function POST(req: Request) {
  if (req.headers.get("origin") !== new URL(req.url).origin) return NextResponse.json({ error: "same-origin requests only" }, { status: 403 });
  if (!reasoningAvailable()) return NextResponse.json({ mode: "off" });
  // Bound the actual stream, not just the caller-controlled Content-Length header.
  const reader = req.body?.getReader();
  if (!reader) return NextResponse.json({ error: "memory required" }, { status: 400 });
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 128 * 1024) {
      await reader.cancel();
      return NextResponse.json({ error: "memory too large" }, { status: 413 });
    }
    chunks.push(value);
  }
  let body: unknown;
  try { body = JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { return NextResponse.json({ error: "invalid JSON" }, { status: 400 }); }
  const parsed = MemorySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "invalid memory" }, { status: 400 });
  try {
    const result = await reasonAbout(parsed.data, req.signal);
    return NextResponse.json({ ...result, mode: process.env.REASONING_MODE === "live" ? "live" : "shadow" }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "reasoning unavailable; deterministic capture continues" }, { status: 503 });
  }
}
