import { NextResponse } from "next/server";
import { getMap, saveMap } from "@/lib/store";
import { WorkMapSchema } from "@/lib/workmap";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const map = await getMap(id);
  if (!map) return NextResponse.json({ error: "no map; compile first" }, { status: 404 });
  return NextResponse.json({ map });
}

/** The expert can delete steps, quotes or frames before confirming. The confirmed map is what the tutor loads. */
export async function PUT(req: Request, { params }: Ctx) {
  const { id } = await params;
  const parsed = WorkMapSchema.safeParse(await req.json());
  if (!parsed.success || parsed.data.sessionId !== id) return NextResponse.json({ error: "invalid map" }, { status: 400 });
  await saveMap(parsed.data);
  return NextResponse.json({ map: parsed.data });
}
