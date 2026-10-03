import Link from "next/link";
import { listInvoices, type Queue } from "@/lib/erp";
import { ErpHeader } from "@/components/ErpHeader";

export const dynamic = "force-dynamic";

const QUEUES: { key: Queue; label: string; who: string }[] = [
  { key: "expert", label: "Sabine's queue", who: "expert" },
  { key: "newhire", label: "Lena's queue", who: "new hire" },
  { key: "autopilot", label: "Routine queue", who: "autopilot" },
];

export default async function ErpQueue({ searchParams }: { searchParams: Promise<{ queue?: string }> }) {
  const sp = await searchParams;
  const queue = (QUEUES.some((q) => q.key === sp.queue) ? sp.queue : "expert") as Queue;
  const invoices = await listInvoices(queue);
  return (
    <main className="min-h-screen">
      <ErpHeader title="Accounts payable · invoice queue" />
      <div className="mx-auto max-w-6xl px-6 py-6">
        <div className="mb-4 flex items-center gap-2">
          {QUEUES.map((q) => (
            <Link key={q.key} href={`/erp?queue=${q.key}`} className={`btn ${queue === q.key ? "btn-primary" : ""}`}>
              {q.label}
            </Link>
          ))}
          <div className="ml-auto">
            <ResetButton queue={queue} />
          </div>
        </div>
        <table className="panel w-full text-sm">
          <thead>
            <tr className="panel-title text-left">
              <th className="px-4 py-3">Invoice</th>
              <th className="px-4 py-3">Supplier</th>
              <th className="px-4 py-3">Entity</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Description</th>
              <th className="px-4 py-3 text-right">Amount</th>
              <th className="px-4 py-3">Cost center</th>
              <th className="px-4 py-3">Route</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((i) => (
              <tr key={i.id} className="border-t border-line hover:bg-panel-2">
                <td className="px-4 py-3 mono">
                  <Link href={`/erp/invoice/${i.id}`} className="text-amber underline-offset-4 hover:underline">
                    INV-{i.id}
                  </Link>
                </td>
                <td className="px-4 py-3">{i.supplier}</td>
                <td className="px-4 py-3">
                  <span className={`tag ${i.entity === "subsidiary" ? "tag-blue" : ""}`}>{i.entity}</span>
                </td>
                <td className="px-4 py-3 mono">{i.date}</td>
                <td className="px-4 py-3 text-muted">{i.description}</td>
                <td className="px-4 py-3 mono text-right">{i.amount < 0 ? "-" : ""}€{Math.abs(i.amount).toLocaleString("en-IE")}</td>
                <td className="px-4 py-3 mono">{i.costCenter}</td>
                <td className="px-4 py-3">{i.route === "second_approval" ? "second approval" : "single"}</td>
                <td className="px-4 py-3">
                  <span className={`tag ${i.status === "hold" ? "tag-amber" : i.status === "posted" || i.status === "approved" ? "tag-green" : ""}`}>{i.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 text-xs text-muted">Month-end close is in two days. {invoices.filter((i) => i.status === "open").length} invoices still open in this queue.</p>
      </div>
    </main>
  );
}

function ResetButton({ queue }: { queue: Queue }) {
  return (
    <Link href={`/api/erp/reset?queue=${queue}`} prefetch={false} className="btn text-muted" title="POST /api/erp/reset">
      reset queue
    </Link>
  );
}
