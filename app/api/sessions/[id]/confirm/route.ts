import { NextResponse } from "next/server";
import { applyCorrection } from "@/lib/compile";
import { syncTutorKnowledge } from "@/lib/elevenlabs-sync";
import { getMap, saveMap } from "@/lib/store";
import { generateTeachback } from "@/lib/teachback";
import { understanding, openSlots } from "@/lib/workmap";

type Ctx = { params: Promise<{ id: string }> };

/** confirm_teachback: a yes locks the map; a correction patches it and returns the changed teach-back. */
export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params;
  const map = await getMap(id);
  if (!map) return NextResponse.json({ error: "no map" }, { status: 404 });
  const body = (await req.json()) as { confirmed: boolean; correction?: string; t?: number };
  let knowledge: { synced: boolean; documentId?: string; note?: string } = { synced: false };
  if (body.confirmed) {
    map.confirmedAt = Date.now();
    for (const r of map.rules) if (!r.confirmedBy.includes("teachback")) r.confirmedBy.push("teachback");
    for (const r of map.rules) if (r.confidence === "medium") r.confidence = "high";
    // the brief's wiring step 4: the confirmed map goes into the tutor's knowledge base
    knowledge = await syncTutorKnowledge(map).catch((err: Error) => ({ synced: false, note: err.message }));
  } else if (body.correction) {
    applyCorrection(map, body.correction, body.t ?? 0);
  }
  await saveMap(map);
  return NextResponse.json({ map, teachback: generateTeachback(map), understanding: understanding(map), open: openSlots(map).length, knowledge });
}
