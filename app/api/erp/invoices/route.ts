import { NextResponse } from "next/server";
import { listInvoices, type Queue } from "@/lib/erp";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const queue = url.searchParams.get("queue") as Queue | null;
  const invoices = await listInvoices(queue ?? undefined);
  return NextResponse.json({ invoices });
}
