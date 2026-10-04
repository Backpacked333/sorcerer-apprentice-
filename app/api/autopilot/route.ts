import { NextResponse } from "next/server";
import { planInvoice } from "@/lib/autopilot";
import { listInvoices, patchInvoice, resetErp } from "@/lib/erp";
import { jsonError, readJson } from "@/lib/request";
import { getMap } from "@/lib/store";

/** Runs the compiled policy over the routine queue. Applies through the ERP's own API, halts where the expert would. */
export async function POST(req: Request) {
  try {
    const body = await readJson<{ sessionId?: unknown; apply?: unknown }>(req);
    if (!body || typeof body.sessionId !== "string" || (body.apply !== undefined && typeof body.apply !== "boolean")) return NextResponse.json({ error: "invalid autopilot request" }, { status: 400 });
    const apply = body.apply ?? true;
    const map = await getMap(body.sessionId);
    if (!map) return NextResponse.json({ error: "no map" }, { status: 404 });
    if (!map.confirmedAt) return NextResponse.json({ error: "Confirm the Work Map before applying it" }, { status: 409 });
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
  } catch (error) {
    return jsonError(error);
  }
}
