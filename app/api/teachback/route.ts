import { NextResponse } from "next/server";
import { getMap } from "@/lib/store";
import { generateTeachback } from "@/lib/teachback";
import { jsonError, readJson } from "@/lib/request";

export async function POST(req: Request) {
  try {
    const body = await readJson<{ sessionId?: string }>(req);
    if (!body || typeof body.sessionId !== "string") return NextResponse.json({ error: "invalid teachback request" }, { status: 400 });
    const map = await getMap(body.sessionId);
    if (!map) return NextResponse.json({ error: "no map" }, { status: 404 });
    return NextResponse.json({ ...generateTeachback(map), revision: map.revision });
  } catch (error) {
    return jsonError(error);
  }
}
