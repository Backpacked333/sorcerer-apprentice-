import { NextResponse } from "next/server";
import { resetErp, type Queue } from "@/lib/erp";

async function reset(req: Request) {
  const url = new URL(req.url);
  const queue = url.searchParams.get("queue") as Queue | null;
  const invoices = await resetErp(queue ?? undefined);
  return { queue, count: invoices.length };
}

export async function POST(req: Request) {
  const r = await reset(req);
  return NextResponse.json({ ok: true, ...r });
}

/** Convenience for the demo: a plain link resets the queue and returns to it. */
export async function GET(req: Request) {
  const r = await reset(req);
  return NextResponse.redirect(new URL(`/erp?queue=${r.queue ?? "expert"}`, req.url));
}
