"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Invoice } from "@/lib/erp-model";
import { toInvoiceState } from "@/lib/erp-model";
import { postTelemetry } from "@/lib/telemetry";

export function InvoiceForm({ invoice, costCenters, nextId }: { invoice: Invoice; costCenters: { code: string; label: string }[]; nextId?: string }) {
  const router = useRouter();
  const [inv, setInv] = useState<Invoice>(invoice);
  const [confirm, setConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [held, setHeld] = useState<{ title: string; quote?: string; who?: string } | null>(null);
  const opened = useRef(false);
  const pendingClose = useRef<number | undefined>(undefined);

  // telemetry: opened / closed. The close is debounced so React's dev-mode double mount does not fake a close.
  useEffect(() => {
    let closeTimer: number | undefined;
    if (!opened.current) {
      opened.current = true;
      postTelemetry({ kind: "invoice_opened", invoice: invoice.id, state: toInvoiceState(invoice), mode: invoice.mode });
    }
    return () => {
      closeTimer = window.setTimeout(() => postTelemetry({ kind: "invoice_closed", invoice: invoice.id, boundary: true }), 400);
      pendingClose.current = closeTimer;
    };
  }, [invoice]);
  useEffect(() => {
    if (pendingClose.current !== undefined) {
      window.clearTimeout(pendingClose.current);
      pendingClose.current = undefined;
    }
  });

  const change = <K extends keyof Invoice>(field: K, value: Invoice[K], kind: "field_changed" | "status_changed" | "route_changed" = "field_changed") => {
    const from = String(inv[field] ?? "");
    const nextInv = { ...inv, [field]: value };
    setInv(nextInv);
    setSaved(false);
    setHeld(null);
    postTelemetry({ kind, invoice: inv.id, field: String(field), from, to: String(value), state: toInvoiceState(nextInv), mode: inv.mode });
  };

  const save = async () => {
    setSaving(true);
    const res = await fetch(`/api/erp/invoices/${inv.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ costCenter: inv.costCenter, route: inv.route, status: inv.status === "open" ? "approved" : inv.status, assetNumber: inv.assetNumber ?? "", notes: inv.notes ?? "" }),
    });
    const data = await res.json();
    setSaving(false);
    if (res.status === 409 && data.blocked) {
      // the sandbox's pre-save guard: the learner corrects it; nothing is changed for them
      setHeld({ title: data.title, quote: data.quote, who: data.who });
      setConfirm(false);
      postTelemetry({ kind: "save_blocked", invoice: inv.id, state: toInvoiceState({ ...inv, status: inv.status === "open" ? "approved" : inv.status }), mode: inv.mode, blocked: { ruleId: data.ruleId, title: data.title, quote: data.quote, who: data.who } });
      return;
    }
    setInv(data.invoice);
    setSaved(true);
    setConfirm(false);
    postTelemetry({ kind: "save_clicked", invoice: inv.id, state: toInvoiceState(data.invoice), boundary: true, mode: inv.mode });
  };

  const money = (n: number) => `${n < 0 ? "-" : ""}€${Math.abs(n).toLocaleString("en-IE", { minimumFractionDigits: 2 })}`;

  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
      {/* ---- the document ---- */}
      <section className="panel p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="panel-title">Supplier invoice</p>
            <h1 className="mt-1 text-2xl font-semibold mono">INV-{inv.id}</h1>
          </div>
          <div className="text-right">
            <p className="panel-title">Amount</p>
            <p className="mt-1 text-3xl font-semibold mono">{money(inv.amount)}</p>
          </div>
        </div>
        <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <Field k="Supplier" v={inv.supplier} />
          <Field k="Entity" v={inv.entity === "subsidiary" ? "Subsidiary (intercompany)" : "Parent company"} />
          <Field k="Invoice date" v={inv.date} mono />
          <Field k="Category" v={inv.category.replace(/_/g, " ")} />
          <Field k="Purchase order" v={inv.hasPO ? inv.poNumber ?? "yes" : "none"} mono />
          <Field k="Supplier status" v={inv.knownSupplier ? "Known supplier" : "NEW SUPPLIER · not in master data"} warn={!inv.knownSupplier} />
        </dl>
        <div className="mt-6 border-t border-line pt-4">
          <p className="panel-title">Line item</p>
          <p className="mt-1 text-base">{inv.description}</p>
        </div>
      </section>

      {/* ---- the decisions ---- */}
      <section className="panel p-6">
        <p className="panel-title">Coding and approval</p>
        <label className="mt-4 block text-sm">
          <span className="text-muted">Cost center</span>
          <select className="mt-1 w-full text-base" value={inv.costCenter} onChange={(e) => change("costCenter", e.target.value)}>
            {costCenters.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code} · {c.label}
              </option>
            ))}
          </select>
        </label>
        <label className="mt-4 block text-sm">
          <span className="text-muted">Asset number (capex only)</span>
          <input className="mt-1 w-full text-base mono" placeholder="A-2026-000" value={inv.assetNumber ?? ""} onChange={(e) => change("assetNumber", e.target.value)} />
        </label>
        <label className="mt-4 block text-sm">
          <span className="text-muted">Approval route</span>
          <select className="mt-1 w-full text-base" value={inv.route} onChange={(e) => change("route", e.target.value as Invoice["route"], "route_changed")}>
            <option value="single">Single approval (Sabine Koch)</option>
            <option value="second_approval">Second approval (Markus Weber, group controller)</option>
          </select>
        </label>
        <div className="mt-4 text-sm">
          <span className="text-muted">Status</span>
          <div className="mt-1 flex gap-2">
            {(["open", "hold", "approved"] as const).map((s) => (
              <button key={s} type="button" className={`btn ${inv.status === s ? (s === "hold" ? "btn-danger" : "btn-primary") : ""}`} onClick={() => change("status", s, "status_changed")}>
                {s}
              </button>
            ))}
          </div>
        </div>
        <label className="mt-4 block text-sm">
          <span className="text-muted">Note</span>
          <textarea className="mt-1 w-full" rows={2} value={inv.notes ?? ""} onChange={(e) => change("notes", e.target.value)} />
        </label>
        <div className="mt-6 flex items-center gap-3">
          {!confirm ? (
            <button type="button" className="btn btn-primary" onClick={() => setConfirm(true)}>
              Save and post
            </button>
          ) : (
            <div className="flex items-center gap-2 rounded border border-amber/60 bg-panel-2 p-2 text-sm">
              <span>Post INV-{inv.id} to {inv.costCenter} ({inv.status === "open" ? "approved" : inv.status})?</span>
              <button type="button" className="btn btn-primary" onClick={save} disabled={saving}>
                {saving ? "Saving…" : "Confirm"}
              </button>
              <button type="button" className="btn" onClick={() => setConfirm(false)}>
                Cancel
              </button>
            </div>
          )}
          {saved && <span className="tag tag-green">saved</span>}
          {held && (
            <div className="w-full rounded border border-red/60 bg-panel-2 p-3 text-sm">
              <p className="text-red">Not posted. The apprentice holds this save: {held.title}.</p>
              {held.quote && <p className="mt-1 text-muted">“{held.quote}”</p>}
              {held.who && <p className="mt-1 text-muted">Check with {held.who} before posting.</p>}
            </div>
          )}
          {nextId && (
            <button type="button" className="btn ml-auto" onClick={() => router.push(`/erp/invoice/${nextId}`)}>
              Next invoice →
            </button>
          )}
        </div>
      </section>
    </div>
  );
}

function Field({ k, v, mono, warn }: { k: string; v: string; mono?: boolean; warn?: boolean }) {
  return (
    <div>
      <dt className="text-muted">{k}</dt>
      <dd className={`${mono ? "mono" : ""} ${warn ? "text-amber font-medium" : ""}`}>{v}</dd>
    </div>
  );
}
