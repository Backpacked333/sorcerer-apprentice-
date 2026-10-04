import Link from "next/link";
import { listInvoices, type Queue } from "@/lib/erp";
import { statusBadge } from "@/lib/erp-ui";
import { ErpHeader } from "@/components/ErpHeader";
import { PresenterQueueTabs } from "@/components/erp/PresenterQueueTabs";
import { ResetQueueButton } from "@/components/erp/ResetQueueButton";

export const dynamic = "force-dynamic";

const QUEUES = ["expert", "newhire", "autopilot"] as const;
const LABEL: Record<Queue, string> = {
  expert: "Invoice queue · expert",
  newhire: "Invoice queue · new hire",
  autopilot: "Routine queue · agent",
};

export default async function ErpQueue({ searchParams }: { searchParams: Promise<{ queue?: string }> }) {
  const sp = await searchParams;
  const queue = (QUEUES.includes(sp.queue as Queue) ? sp.queue : "expert") as Queue;
  const invoices = await listInvoices(queue);
  const processed = invoices.filter((i) => i.status !== "open").length;
  const next = invoices.find((i) => i.status === "open");
  const done = invoices.length > 0 && !next;
  return (
    <main>
      <ErpHeader title={LABEL[queue]} queue={queue} />
      <div className="erp-wrap">
        <PresenterQueueTabs queue={queue} />
        <div className="erp-actions" style={{ marginBottom: 12 }}>
          {next && <Link className="erp-btn erp-btn-primary" href={`/erp/invoice/${next.id}`}>Open next invoice →</Link>}
          <span className="erp-meta">{processed} of {invoices.length} processed</span>
          {processed >= 1 && <ResetQueueButton queue={queue} />}
        </div>
        {done && <p className="erp-banner">Queue complete. Return to the Simon panel to finish.</p>}
        <table className="erp-table">
          <thead>
            <tr>
              <th>Invoice</th>
              <th>Supplier</th>
              <th>Date</th>
              <th>Amount</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((i) => {
              const badge = statusBadge(i.status);
              return (
                <tr key={i.id} className="erp-row" data-testid={`erp-row-${i.id}`}>
                  <td><Link href={`/erp/invoice/${i.id}`}>INV-{i.id}</Link></td>
                  <td>{i.supplier}<span className="erp-desc">{i.description}</span></td>
                  <td>{i.date}</td>
                  <td>{i.amount < 0 ? "-" : ""}€{Math.abs(i.amount).toLocaleString("en-IE")}</td>
                  <td><span className={`erp-badge erp-badge-${badge.tone}`}>{badge.label}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="erp-foot">Posting period 12/2025</p>
      </div>
    </main>
  );
}
