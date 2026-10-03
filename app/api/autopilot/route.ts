import { NextResponse } from "next/server";
import { planInvoice } from "@/lib/autopilot";
import { listInvoices, patchInvoice, resetErp } from "@/lib/erp";
import { getMap } from "@/lib/store";

/** Runs the compiled policy over the routine queue. Applies through the ERP's own API, halts where the expert would. */
export async function POST(req: Request) {
  const { sessionId, apply = true } = (await req.json()) as { sessionId: string; apply?: boolean };
  const map = await getMap(sessionId);
  if (!map) return NextResponse.json({ error: "no map" }, { status: 404 });
  await resetErp("autopilot");
  const queue = await listInvoices("autopilot");
  const steps = [];
  for (const inv of queue) {
    const step = planInvoice(map, inv);
    if (apply && step.action) await patchInvoice(inv.id, step.action);
    steps.push(step);
    if (step.outcome === "halted") break; // the agent stops where she would and hands the rest to a human
  }
  return NextResponse.json({ steps, remaining: queue.length - steps.length });
}
