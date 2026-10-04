"use client";

import Link from "next/link";
import type { Invoice } from "@/lib/erp-model";
import { matchesQuery, money, statusBadge } from "@/lib/erp-ui";
import { useErpSearch } from "@/components/erp/ErpShell";

/** The bills table of one queue, filtered live by the top-bar search. */
export function QueueTable({ invoices }: { invoices: Invoice[] }) {
  const q = useErpSearch();
  const rows = invoices.filter((i) => matchesQuery(i, q));
  return (
    <section className="erp-card erp-card-flush">
      <div className="erp-card-title">
        <h2>Bills</h2>
        <span className="erp-muted">{q.trim() ? `${rows.length} of ${invoices.length} shown` : `${invoices.length} bills`}</span>
      </div>
      <table className="erp-table">
        <thead>
          <tr>
            <th scope="col">Bill</th>
            <th scope="col">Vendor</th>
            <th scope="col">Bill date</th>
            <th scope="col" className="is-num">Amount</th>
            <th scope="col">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((i) => {
            const badge = statusBadge(i.status);
            return (
              <tr key={i.id} className="erp-row" data-testid={`erp-row-${i.id}`}>
                <td className="erp-row-id"><Link href={`/erp/invoice/${i.id}`}>INV-{i.id}</Link></td>
                <td>{i.supplier}<span className="erp-desc">{i.description}</span></td>
                <td className="erp-num-plain">{i.date}</td>
                <td className="is-num">{money(i.amount)}</td>
                <td><span className={`erp-pill erp-pill-${badge.tone}`}>{badge.label}</span></td>
              </tr>
            );
          })}
          {rows.length === 0 && (
            <tr>
              <td colSpan={5} className="erp-empty">No bills match this search.</td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  );
}
