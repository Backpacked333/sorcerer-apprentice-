import { NextResponse } from "next/server";
import { fillSlot } from "@/lib/compile";
import { getMap, saveMap } from "@/lib/store";
import { understanding } from "@/lib/workmap";

type Ctx = { params: Promise<{ id: string }> };

/** A debrief answer fills one slot, verbatim, and threads into its step and rule. */
export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params;
  const map = await getMap(id);
  if (!map) return NextResponse.json({ error: "no map" }, { status: 404 });
  const body = (await req.json()) as { slotId: string; text: string; t?: number; audioId?: string };
  if (!body.slotId || typeof body.text !== "string" || !body.text.trim()) return NextResponse.json({ error: "slotId and text required" }, { status: 400 });
  if (!map.slots.some((slot) => slot.id === body.slotId)) return NextResponse.json({ error: "slot not found" }, { status: 404 });
  delete map.confirmedAt;
  const next = fillSlot(map, body.slotId, { text: body.text, t: body.t ?? 0, audioId: body.audioId, source: "debrief" });
  await saveMap(next);
  return NextResponse.json({ map: next, understanding: understanding(next) });
}
