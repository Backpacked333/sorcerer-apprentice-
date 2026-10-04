import Link from "next/link";
import { listInvoices } from "@/lib/erp";
import { QUEUE_LABEL, queueOf } from "@/lib/erp-ui";
import { ErpShell } from "@/components/erp/ErpShell";
import { PresenterQueueTabs } from "@/components/erp/PresenterQueueTabs";
import { ResetQueueButton } from "@/components/erp/ResetQueueButton";
import { QueueTable } from "./QueueTable";

export const dynamic = "force-dynamic";

export default async function ErpQueue({ searchParams }: { searchParams: Promise<{ queue?: string; q?: string }> }) {
  const sp = await searchParams;
  const queue = queueOf(sp.queue);
  const invoices = await listInvoices(queue);
  const processed = invoices.filter((i) => i.status !== "open").length;
  const next = invoices.find((i) => i.status === "open");
  const done = invoices.length > 0 && !next;
  return (
    <ErpShell queue={queue} initialQuery={typeof sp.q === "string" ? sp.q : ""} searchMode="filter">
      <p className="erp-crumbs">Expenses &amp; Bills <span aria-hidden>›</span> Bills</p>
      <PresenterQueueTabs queue={queue} />
      <div className="erp-title-row">
        <h1 className="erp-title">{QUEUE_LABEL[queue]}</h1>
        <span className="erp-muted">{processed} of {invoices.length} processed</span>
        <div className="erp-title-actions">
          {processed >= 1 && <ResetQueueButton queue={queue} />}
          {next && <Link className="erp-btn erp-btn-primary" href={`/erp/invoice/${next.id}`}>Open next invoice →</Link>}
        </div>
      </div>
      {done && (
        <div className="erp-banner-slot">
          <p className="erp-banner erp-banner-ok">Queue complete. Return to the Tacit panel to finish.</p>
        </div>
      )}
      <QueueTable invoices={invoices} />
    </ErpShell>
  );
}
