import { NextResponse } from "next/server";
import { applyCorrection } from "@/lib/compile";
import { confirmationIssues } from "@/lib/confirmation";
import { getMap, saveMap } from "@/lib/store";
import { generateTeachback } from "@/lib/teachback";
import { understanding, openSlots } from "@/lib/workmap";

type Ctx = { params: Promise<{ id: string }> };

/** confirm_teachback: a yes locks the map; a correction patches it and returns the changed teach-back. */
export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params;
  const map = await getMap(id);
  if (!map) return NextResponse.json({ error: "no map" }, { status: 404 });
  const body = (await req.json()) as { confirmed: boolean; correction?: string; t?: number; revision?: number };
  if (body.revision !== map.revision) return NextResponse.json({ error: "The Work Map changed. Review its latest teach-back before confirming.", map }, { status: 409 });
  const knowledge = { synced: false, note: "Private Work Map context is supplied per tutor conversation; no shared knowledge base is modified." };
  if (body.confirmed === true) {
    const issues = confirmationIssues(map);
    if (issues.length) return NextResponse.json({ error: issues.join(" "), issues, map }, { status: 409 });
    map.confirmedAt = Date.now();
    for (const r of map.rules) if (!r.confirmedBy.includes("teachback")) r.confirmedBy.push("teachback");
    for (const r of map.rules) if (r.confidence === "medium") r.confidence = "high";
  } else if (body.correction) {
    delete map.confirmedAt;
    applyCorrection(map, body.correction, body.t ?? 0);
  } else {
    return NextResponse.json({ error: "Explicit confirmation or a correction is required" }, { status: 400 });
  }
  await saveMap(map);
  return NextResponse.json({ map, teachback: generateTeachback(map), understanding: understanding(map), open: openSlots(map).length, knowledge });
}
