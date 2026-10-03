import { NextResponse } from "next/server";
import { checkSave, getInvoice, patchInvoice, toInvoiceState, type InvoicePatch } from "@/lib/erp";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const inv = await getInvoice(id);
  if (!inv) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ invoice: inv, state: toInvoiceState(inv) });
}

export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  const body = (await req.json()) as InvoicePatch;
  const allowed: InvoicePatch = {};
  if (typeof body.costCenter === "string") allowed.costCenter = body.costCenter;
  if (body.route === "single" || body.route === "second_approval") allowed.route = body.route;
  if (body.status === "open" || body.status === "approved" || body.status === "hold" || body.status === "posted") allowed.status = body.status;
  if (typeof body.assetNumber === "string") allowed.assetNumber = body.assetNumber;
  if (typeof body.notes === "string") allowed.notes = body.notes;
  const current = await getInvoice(id);
  if (!current) return NextResponse.json({ error: "not found" }, { status: 404 });
  // the authoritative save path: a draft that breaks a confirmed rule never commits, whatever the UI did
  const verdict = await checkSave(current, allowed);
  if (verdict.blocked) return NextResponse.json({ ...verdict, invoice: current, state: toInvoiceState(current) }, { status: 409 });
  const inv = await patchInvoice(id, allowed);
  if (!inv) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ invoice: inv, state: toInvoiceState(inv) });
}
