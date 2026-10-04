"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Invoice, Queue } from "@/lib/erp-model";
import { toInvoiceState } from "@/lib/erp-model";
import Link from "next/link";
import { canCommit, commitStatus, confirmCopy, decisionOf, money, progressLine, proposedState, QUEUE_LABEL, routeLabelOf, statusBadge, textCommit } from "@/lib/erp-ui";
import { postTelemetry } from "@/lib/telemetry";

/** Survives a strict-mode remount so a fake unmount does not close the invoice. */
const pendingCloses = new Map<string, number>();

export function InvoiceForm({
  invoice,
  costCenters,
  nextId,
  queue,
  queueProgress,
}: {
  invoice: Invoice;
  costCenters: { code: string; label: string }[];
  nextId?: string;
  queue: Queue;
  queueProgress?: { position: number; total: number; remainingOpen: number };
}) {
  const router = useRouter();
  const [inv, setInv] = useState<Invoice>(invoice);
  const [asset, setAsset] = useState(invoice.assetNumber ?? "");
  const [notes, setNotes] = useState(invoice.notes ?? "");
  const [confirm, setConfirm] = useState(false);
  const [arm, setArm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [held, setHeld] = useState<{ title: string; quote?: string; who?: string; missing?: string } | null>(null);
  const invRef = useRef(inv);
  invRef.current = inv;
  const assetRef = useRef(asset);
  assetRef.current = asset;
  const notesRef = useRef(notes);
  notesRef.current = notes;
  const focusVal = useRef<{ field: "assetNumber" | "notes"; value: string } | null>(null);
  const lastType = useRef(0);
  const costRef = useRef<HTMLSelectElement>(null);
  useEffect(() => {
    const id = invoice.id;
    const queued = pendingCloses.get(id);
    if (queued !== undefined) {
      window.clearTimeout(queued);
      pendingCloses.delete(id);
    } else {
      postTelemetry({ kind: "invoice_opened", invoice: id, state: toInvoiceState(invoice), mode: invoice.mode, queue });
    }
    return () => {
      const timer = window.setTimeout(() => {
        pendingCloses.delete(id);
        postTelemetry({ kind: "invoice_closed", invoice: id, boundary: true, queue });
      }, 400);
      pendingCloses.set(id, timer);
    };
  }, [invoice, queue]);
  useEffect(() => {
    if (!confirm) {
      setArm(false);
      return;
    }
    const id = window.setTimeout(() => setArm(true), 600);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setConfirm(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener("keydown", onKey);
    };
  }, [confirm]);

  const locked = inv.status === "posted" || inv.status === "approved";
  const decision = decisionOf(inv);
  const badge = statusBadge(inv.status);

  const emit = (msg: Parameters<typeof postTelemetry>[0]) => {
    const cur = invRef.current;
    postTelemetry({ ...msg, invoice: cur.id, mode: cur.mode, queue: cur.queue });
  };

  const commitText = (field: "assetNumber" | "notes", after: string) => {
    const before = focusVal.current?.field === field ? focusVal.current.value : after;
    const diff = textCommit(field, before, after);
    focusVal.current = { field, value: after };
    if (!diff) return;
    const cur = invRef.current;
    const next = { ...cur, [field]: field === "assetNumber" ? after.trim() : after } as Invoice;
    invRef.current = next;
    setInv(next);
    emit({ kind: "field_changed", field, from: diff.from, to: diff.to, state: toInvoiceState(next) });
  };

  const onType = (field: "assetNumber" | "notes") => {
    const now = Date.now();
    if (now - lastType.current < 400) return;
    lastType.current = now;
    emit({ kind: "typing", field });
  };

  const flushText = () => {
    commitText("assetNumber", assetRef.current);
    commitText("notes", notesRef.current);
  };

  const setStatus = (nextStatus: "open" | "hold") => {
    const cur = invRef.current;
    const from = cur.status === "hold" ? "hold" : "open";
    const to = nextStatus;
    if (from === to || locked) return;
    const next = { ...cur, status: nextStatus };
    invRef.current = next;
    setInv(next);
    setHeld(null);
    setError(null);
    emit({ kind: "status_changed", field: "status", from, to, state: toInvoiceState(next) });
  };

  const openIntent = () => {
    if (locked || saving) return;
    flushText();
    const cur = invRef.current;
    const gate = canCommit({ status: cur.status, costCenter: cur.costCenter });
    if (!gate.ok) {
      setFieldError(gate.message);
      costRef.current?.focus();
      return;
    }
    setFieldError(null);
    setConfirm(true);
    emit({ kind: "save_intent", state: proposedState(cur) });
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    const cur = invRef.current;
    try {
      const res = await fetch(`/api/erp/invoices/${cur.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          costCenter: cur.costCenter,
          route: cur.route,
          status: commitStatus(cur),
          assetNumber: assetRef.current.trim(),
          notes: notesRef.current,
        }),
      });
      const data = await res.json().catch(() => null);
      if (res.status === 409 && data?.blocked) {
        setHeld({ title: data.title, quote: data.quote, who: data.who, missing: data.missing });
        setConfirm(false);
        emit({
          kind: "save_blocked",
          state: proposedState(cur),
          blocked: { ruleId: data.ruleId, title: data.title, quote: data.quote, who: data.who },
        });
        return;
      }
      if (!res.ok || !data?.invoice) {
        setError(`Could not save (HTTP ${res.status}). Nothing was changed.`);
        return;
      }
      setInv(data.invoice);
      invRef.current = data.invoice;
      setConfirm(false);
      setHeld(null);
      emit({ kind: "save_clicked", state: toInvoiceState(data.invoice), boundary: true });
    } catch {
      setError("Could not save (HTTP 0). Nothing was changed.");
    } finally {
      setSaving(false);
    }
  };

  const routeLabel = routeLabelOf(inv.route);
  const ccEmpty = !inv.costCenter;

  return (
    <div className="erp-invoice">
      <p className="erp-crumbs">
        Expenses &amp; Bills <span aria-hidden>›</span> Bills <span aria-hidden>›</span>{" "}
        <Link href={`/erp?queue=${queue}`}>{QUEUE_LABEL[queue] ?? QUEUE_LABEL.expert}</Link>
      </p>

      <div className="erp-title-row">
        <h1 className="erp-title">Bill INV-{inv.id}</h1>
        <span className={`erp-pill erp-pill-${badge.tone}`} data-testid="erp-status-badge">{badge.label}</span>
        {queueProgress && <span className="erp-muted">{progressLine(queueProgress, inv.mode)}</span>}
        <div className="erp-title-actions">
          {nextId && !locked && (
            <button type="button" className="erp-btn" data-testid="erp-next" onClick={() => router.push(`/erp/invoice/${nextId}`)}>Next invoice →</button>
          )}
          {locked && nextId && (
            <button type="button" className="erp-btn erp-btn-primary" data-testid="erp-next" onClick={() => router.push(`/erp/invoice/${nextId}`)}>Next invoice →</button>
          )}
          <div className="erp-save-anchor">
            <button
              type="button"
              className="erp-btn erp-btn-primary erp-btn-save"
              data-testid="erp-save"
              data-erp-target="save"
              aria-haspopup="dialog"
              aria-expanded={confirm}
              disabled={locked || saving}
              onClick={confirm ? undefined : openIntent}
            >
              {decision === "hold" ? "Save as held" : "Post invoice"}
            </button>
            {confirm && (
              <div className="erp-confirm" role="dialog" aria-label="Save this bill" data-testid="erp-confirm-popover">
                <span className="erp-confirm-caret" aria-hidden />
                <p className="erp-confirm-text">{confirmCopy(inv)}</p>
                <div className="erp-confirm-actions">
                  <button type="button" className="erp-btn" data-testid="erp-cancel" onClick={() => setConfirm(false)}>Cancel</button>
                  <button type="button" className="erp-btn erp-btn-primary" data-testid="erp-confirm" disabled={!arm || saving} onClick={() => void save()}>
                    {saving ? "Saving…" : "Confirm"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {(locked || error || held) && (
        <div className="erp-banner-slot">
          {locked && (
            <div className="erp-banner erp-banner-ok">
              <p data-testid="erp-posted-banner">POSTED · INV-{inv.id} · cost center {inv.costCenter} · {routeLabel}</p>
              {!nextId && <p className="erp-banner-sub">Queue complete. Return to the Tacit panel to finish.</p>}
            </div>
          )}
          {error && <p className="erp-banner erp-banner-blocked" data-testid="erp-error" role="alert">{error}</p>}
          {held && (
            <div className="erp-banner erp-banner-blocked" data-testid="erp-held-panel" role="alert">
              <p className="erp-banner-head">Not posted. {held.title}</p>
              {held.missing && <p>Missing: {held.missing}</p>}
              {held.quote && <p className="erp-banner-quote">“{held.quote}”</p>}
              {held.who && <p>Check with {held.who}</p>}
            </div>
          )}
        </div>
      )}

      <section className="erp-card erp-head-card" aria-label="Bill header">
        <Fact k="Vendor" v={inv.supplier} target="vendor" />
        <Fact k="Bill date" v={inv.date} />
        <Fact k="Purchase order" v={inv.hasPO ? inv.poNumber ?? "yes" : "none"} />
        <Fact k="Entity" v={inv.entity === "subsidiary" ? "Subsidiary (intercompany)" : "Parent company"} />
        <div className="erp-amount-cell">
          <div className="erp-k">Amount due</div>
          <div className="erp-amount" data-erp-target="amount">{money(inv.amount)}</div>
          <div className="erp-k erp-k-gap">Supplier status</div>
          <div className="erp-supplier">{inv.knownSupplier ? "Known supplier" : "New supplier, not in master data"}</div>
        </div>
        {inv.contactName && <Fact k="Contact" v={inv.contactName} pii="name" />}
        {inv.contactEmail && <Fact k="Email" v={inv.contactEmail} pii="email" />}
        {inv.contactPhone && <Fact k="Phone" v={inv.contactPhone} pii="phone" />}
        {inv.iban && <Fact k="Bank (IBAN)" v={inv.iban} pii="iban" wide />}
      </section>

      <section className="erp-card erp-card-flush" aria-label="Category details">
        <div className="erp-card-title">
          <h2>Category details</h2>
          <span className="erp-muted">Category <b className="erp-cat">{inv.category.replace(/_/g, " ")}</b></span>
        </div>
        <div className="erp-lines-head" aria-hidden>
          <span>#</span>
          <span>Account · cost center</span>
          <span>Description</span>
          <span>Asset number</span>
          <span className="is-num">Amount</span>
        </div>
        <div className="erp-line-row">
          <span className="erp-line-n">1</span>
          <select
            ref={costRef}
            className={`erp-select${ccEmpty ? " is-empty" : ""}`}
            aria-label="Cost center"
            data-testid="erp-cost-center"
            data-erp-target="cc"
            value={inv.costCenter}
            disabled={locked}
            onChange={(e) => {
              const cur = invRef.current;
              const next = { ...cur, costCenter: e.target.value };
              invRef.current = next;
              setInv(next);
              setFieldError(null);
              setHeld(null);
              emit({ kind: "field_changed", field: "costCenter", from: cur.costCenter, to: e.target.value, state: toInvoiceState(next) });
            }}
          >
            <option value="" disabled>Select cost center…</option>
            {costCenters.map((c) => (
              <option key={c.code} value={c.code}>{c.code} · {c.label}</option>
            ))}
          </select>
          <span className="erp-line-desc" data-erp-target="line">{inv.description}</span>
          <input
            aria-label="Asset number"
            data-testid="erp-asset-number"
            data-erp-target="asset"
            className="erp-input erp-mono"
            placeholder="A-2025-000"
            value={asset}
            disabled={locked}
            onFocus={() => { focusVal.current = { field: "assetNumber", value: assetRef.current }; }}
            onChange={(e) => { setAsset(e.target.value); onType("assetNumber"); }}
            onBlur={() => commitText("assetNumber", assetRef.current)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commitText("assetNumber", assetRef.current); } }}
          />
          <span className="erp-line-amt is-num">{money(inv.amount)}</span>
        </div>
        {fieldError && <p className="erp-field-error erp-line-error" role="alert">{fieldError}</p>}
        <div className="erp-lines-foot">
          <span className="erp-add-lines" aria-disabled="true">+ Add lines</span>
          <span>Total <b className="erp-total">{money(inv.amount)}</b></span>
        </div>
      </section>

      <section className="erp-card erp-approval-card" aria-label="Approval">
        <label className="erp-field">
          <span className="erp-k">Approval route</span>
          <select
            className="erp-select"
            data-testid="erp-route"
            data-erp-target="route"
            value={inv.route}
            disabled={locked}
            onChange={(e) => {
              const cur = invRef.current;
              const to = e.target.value as Invoice["route"];
              const next = { ...cur, route: to };
              invRef.current = next;
              setInv(next);
              emit({ kind: "route_changed", field: "route", from: cur.route, to, state: toInvoiceState(next) });
            }}
          >
            <option value="single">Single approval</option>
            <option value="second_approval">Second approval (Group Controlling)</option>
          </select>
        </label>
        <div className="erp-field">
          <span className="erp-k" id="erp-status-label">Status</span>
          <div className={`erp-seg is-${decision}`} role="group" aria-labelledby="erp-status-label" data-erp-target="status">
            <span className="erp-seg-thumb" aria-hidden />
            <button type="button" data-testid="erp-decision-post" aria-pressed={decision === "post"} className={decision === "post" ? "is-on" : ""} disabled={locked} onClick={() => setStatus("open")}>Post</button>
            <button type="button" data-testid="erp-decision-hold" aria-pressed={decision === "hold"} className={decision === "hold" ? "is-on" : ""} disabled={locked} onClick={() => setStatus("hold")}>Hold</button>
          </div>
        </div>
        <label className="erp-field">
          <span className="erp-k">Memo</span>
          <textarea
            className="erp-input erp-memo"
            data-testid="erp-note"
            rows={1}
            value={notes}
            disabled={locked}
            onFocus={() => { focusVal.current = { field: "notes", value: notesRef.current }; }}
            onChange={(e) => { setNotes(e.target.value); onType("notes"); }}
            onBlur={() => commitText("notes", notesRef.current)}
          />
        </label>
      </section>
    </div>
  );
}

function Fact({ k, v, pii, target, wide }: { k: string; v: string; pii?: string; target?: string; wide?: boolean }) {
  return (
    <div className={`erp-fact${wide ? " erp-fact-wide" : ""}`}>
      <div className="erp-k">{k}</div>
      <div className="erp-ro" data-pii={pii} data-erp-target={target}>{v}</div>
    </div>
  );
}
