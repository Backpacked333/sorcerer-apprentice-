import { NextResponse } from "next/server";
import { getMap } from "@/lib/store";
import { generateTeachback } from "@/lib/teachback";

export async function POST(req: Request) {
  const { sessionId } = (await req.json()) as { sessionId: string };
  const map = await getMap(sessionId);
  if (!map) return NextResponse.json({ error: "no map" }, { status: 404 });
  return NextResponse.json({ ...generateTeachback(map), revision: map.revision });
}
