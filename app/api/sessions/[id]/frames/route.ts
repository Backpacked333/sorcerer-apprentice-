import { NextResponse } from "next/server";
import { allowRateLimit, getSession, readFrame, saveFrame } from "@/lib/store";
import { jsonError, RateLimitError, readRequestBytes, RequestLimitError, UnsupportedMediaError } from "@/lib/request";

type Ctx = { params: Promise<{ id: string }> };
const MAX_FRAME = 750 * 1024;

export async function POST(req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    if (!await getSession(id)) return NextResponse.json({ error: "not found" }, { status: 404 });
    if (!await allowRateLimit("frames", 120, 60)) throw new RateLimitError();
    const frameId = new URL(req.url).searchParams.get("frameId") ?? req.headers.get("x-frame-id") ?? "";
    const contentType = req.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
    if (contentType !== "image/jpeg" && contentType !== "image/png") throw new UnsupportedMediaError();
    const bytes = await readRequestBytes(req, MAX_FRAME);
    if (bytes.byteLength > MAX_FRAME) throw new RequestLimitError();
    const jpeg = contentType === "image/jpeg" && bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    const png = contentType === "image/png" && bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a;
    if (!frameId || (!jpeg && !png)) throw new UnsupportedMediaError();
    await saveFrame(id, frameId, bytes, contentType);
    return NextResponse.json({ ok: true, frameId, url: `/api/sessions/${id}/frames?frameId=${encodeURIComponent(frameId)}` });
  } catch (error) {
    return jsonError(error);
  }
}

export async function GET(req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const frameId = new URL(req.url).searchParams.get("frameId") ?? "";
    const session = await getSession(id);
    if (!session || !session.frames.some((frame) => frame.id === frameId)) return NextResponse.json({ error: "not found" }, { status: 404 });
    const bytes = await readFrame(id, frameId);
    if (!bytes) return NextResponse.json({ error: "not found" }, { status: 404 });
    const isPng = bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
    return new Response(new Uint8Array(bytes), { headers: { "content-type": isPng ? "image/png" : "image/jpeg", "cache-control": "no-store" } });
  } catch (error) {
    return jsonError(error);
  }
}
