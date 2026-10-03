import { NextResponse } from "next/server";
import { readClip, saveClip } from "@/lib/store";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params;
  const form = await req.formData();
  const audioId = String(form.get("audioId") ?? "");
  const file = form.get("file");
  if (!audioId || !(file instanceof Blob)) return NextResponse.json({ error: "audioId and file required" }, { status: 400 });
  await saveClip(id, audioId, new Uint8Array(await file.arrayBuffer()));
  return NextResponse.json({ ok: true, audioId });
}

export async function GET(req: Request, { params }: Ctx) {
  const { id } = await params;
  const audioId = new URL(req.url).searchParams.get("audioId") ?? "";
  const bytes = await readClip(id, audioId);
  if (!bytes) return NextResponse.json({ error: "not found" }, { status: 404 });
  return new Response(new Uint8Array(bytes), { headers: { "content-type": "audio/webm", "cache-control": "no-store" } });
}
