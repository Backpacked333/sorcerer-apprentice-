import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { COST_CENTERS, getInvoice, listInvoices } from "@/lib/erp";
import { ErpShell } from "@/components/erp/ErpShell";
import { InvoiceForm } from "@/components/InvoiceForm";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  return { title: `MB-ERP · Bill INV-${id}` };
}

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const inv = await getInvoice(id);
  if (!inv) notFound();
  const siblings = await listInvoices(inv.queue);
  const idx = siblings.findIndex((i) => i.id === inv.id);
  const next = siblings.slice(idx + 1).find((i) => i.status === "open" || i.status === "hold");
  const remainingOpen = siblings.filter((i) => i.status === "open").length;
  return (
    <ErpShell queue={inv.queue}>
      <InvoiceForm
        key={inv.id}
        invoice={inv}
        costCenters={COST_CENTERS}
        nextId={next?.id}
        queue={inv.queue}
        queueProgress={{ position: idx + 1, total: siblings.length, remainingOpen }}
      />
    </ErpShell>
  );
}
