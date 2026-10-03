import { notFound } from "next/navigation";
import { COST_CENTERS, getInvoice, listInvoices } from "@/lib/erp";
import { ErpHeader } from "@/components/ErpHeader";
import { InvoiceForm } from "@/components/InvoiceForm";

export const dynamic = "force-dynamic";

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const inv = await getInvoice(id);
  if (!inv) notFound();
  const siblings = (await listInvoices(inv.queue)).map((i) => i.id);
  const idx = siblings.indexOf(inv.id);
  const next = siblings[idx + 1];
  return (
    <main className="min-h-screen">
      <ErpHeader title={`Invoice INV-${inv.id}`} />
      <div className="mx-auto max-w-6xl px-6 py-6">
        <InvoiceForm invoice={inv} costCenters={COST_CENTERS} nextId={next} />
      </div>
    </main>
  );
}
