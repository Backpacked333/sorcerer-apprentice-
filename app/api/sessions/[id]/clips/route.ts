import { NextResponse } from "next/server";
import { allowRateLimit, getSession, readClip, saveClip } from "@/lib/store";
import { BadRequestError, bytesToArrayBuffer, jsonError, readRequestBytes, RateLimitError, RequestLimitError, UnsupportedMediaError } from "@/lib/request";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    if (!await getSession(id)) return NextResponse.json({ error: "not found" }, { status: 404 });
    if (!await allowRateLimit("clips", 20, 60)) throw new RateLimitError();
    const raw = await readRequestBytes(req, 3 * 1024 * 1024 + 128 * 1024);
    let form: FormData;
    try {
      form = await new Request(req.url, { method: "POST", headers: req.headers, body: bytesToArrayBuffer(raw) }).formData();
    } catch {
      throw new BadRequestError();
    }
    const audioId = String(form.get("audioId") ?? "");
    const file = form.get("file");
    if (!audioId || !(file instanceof Blob)) return NextResponse.json({ error: "audioId and file required" }, { status: 400 });
    const contentType = file.type.split(";")[0].trim().toLowerCase();
    if (contentType !== "audio/webm" && contentType !== "video/webm") throw new UnsupportedMediaError();
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (bytes.byteLength > 3 * 1024 * 1024) throw new RequestLimitError();
    if (bytes.byteLength < 4 || !(bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3)) throw new UnsupportedMediaError();
    await saveClip(id, audioId, bytes);
    return NextResponse.json({ ok: true, audioId });
  } catch (error) {
    return jsonError(error);
  }
}

export async function GET(req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const audioId = new URL(req.url).searchParams.get("audioId") ?? "";
    const session = await getSession(id);
    if (!session || !session.windows.some((window) => window.answerAudioId === audioId)) return NextResponse.json({ error: "not found" }, { status: 404 });
    const bytes = await readClip(id, audioId);
    if (!bytes) return NextResponse.json({ error: "not found" }, { status: 404 });
    return new Response(new Uint8Array(bytes), { headers: { "content-type": "audio/webm", "cache-control": "no-store" } });
  } catch (error) {
    return jsonError(error);
  }
}
