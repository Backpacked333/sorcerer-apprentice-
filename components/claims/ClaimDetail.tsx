"use client";

import { useState } from "react";
import {
  CAUSE_OPTIONS, COVERAGE_OPTIONS, eur, estimateTotal, NEXT_STEPS, STATUS_LABEL,
  type ActivityItem, type Claim, type NextStepId,
} from "@/lib/claims-model";

const TABS = ["Summary", "Documents", "Payments", "Notes", "Parties"] as const;
type Tab = (typeof TABS)[number];

/**
 * One claim. Everything here is client state and resets on reload. The page posts no telemetry
 * and decides nothing: the adjuster picks cause, coverage and next step; Submit only records the choice locally.
 */
export function ClaimDetail({ claim }: { claim: Claim }) {
  const [tab, setTab] = useState<Tab>("Documents");
  const [cause, setCause] = useState(claim.intakeCause);
  const [coverage, setCoverage] = useState<string>(COVERAGE_OPTIONS[0]);
  const [nextStep, setNextStep] = useState<NextStepId | null>(null);
  const [submitted, setSubmitted] = useState<NextStepId | null>(null);
  const [added, setAdded] = useState<ActivityItem[]>([]);

  const stepLabel = (id: NextStepId) => NEXT_STEPS.find((s) => s.id === id)?.label ?? id;
  const submit = () => {
    if (!nextStep) return;
    setSubmitted(nextStep);
    setAdded((a) => [{ when: "Just now", what: `Decision submitted · ${stepLabel(nextStep)}` }, ...a]);
  };
  const reopen = () => {
    setSubmitted(null);
    setAdded((a) => [{ when: "Just now", what: "Decision reopened" }, ...a]);
  };
  const locked = submitted !== null;

  return (
    <>
      <section className="clm-head" aria-label="Claim">
        <div className="clm-head-row">
          <h1 className="clm-id">{claim.id}</h1>
          {submitted ? (
            <span className="clm-pill clm-pill-submitted">DECISION SUBMITTED</span>
          ) : (
            <span className={`clm-pill clm-pill-${claim.status}`}>{STATUS_LABEL[claim.status]}</span>
          )}
          <span className="clm-loss">{claim.lossType}</span>
          <div className="clm-reserve"><span>Reserve</span><strong>{eur(claim.reserve)}</strong></div>
        </div>
        <dl className="clm-facts">
          <div><dt>Policyholder</dt><dd data-pii="name">{claim.policyholder.name}</dd></div>
          <div><dt>Policy</dt><dd>{claim.policy}</dd></div>
          <div><dt>Loss date</dt><dd>{claim.lossDate}</dd></div>
          <div><dt>Reported</dt><dd>{claim.reported}</dd></div>
        </dl>
        <div className="clm-tabs" role="tablist" aria-label="Claim sections">
          {TABS.map((t) => (
            <button key={t} type="button" role="tab" id={`clm-tab-${t}`} aria-selected={tab === t} aria-controls="clm-tabpanel" className="clm-tab" onClick={() => setTab(t)}>
              {t}
            </button>
          ))}
        </div>
      </section>

      <div className="clm-body">
        <div className="clm-left" role="tabpanel" id="clm-tabpanel" aria-labelledby={`clm-tab-${tab}`}>
          <div key={tab} className="clm-panel-in">
            <TabPanel tab={tab} claim={claim} />
          </div>
        </div>

        <section className="clm-card clm-decision" aria-labelledby="clm-decision-title">
          <h2 className="clm-card-title" id="clm-decision-title">Coverage decision</h2>
          <div>
            <label className="clm-label" htmlFor="clm-cause">Cause of loss</label>
            <select id="clm-cause" name="cause" className="clm-select" value={cause} disabled={locked} onChange={(e) => setCause(e.target.value)}>
              {CAUSE_OPTIONS.map((o) => <option key={o}>{o}</option>)}
            </select>
          </div>
          <div>
            <label className="clm-label" htmlFor="clm-coverage">Coverage</label>
            <select id="clm-coverage" name="coverage" className="clm-select" value={coverage} disabled={locked} onChange={(e) => setCoverage(e.target.value)}>
              {COVERAGE_OPTIONS.map((o) => <option key={o}>{o}</option>)}
            </select>
          </div>
          <div>
            <span className="clm-label">Prior claims</span>
            <div>{claim.priorClaims}</div>
          </div>
          <fieldset className="clm-steps">
            <legend className="clm-label">Next step</legend>
            {NEXT_STEPS.map((s) => (
              <label key={s.id} className="clm-radio">
                <input type="radio" name="nextStep" value={s.id} checked={nextStep === s.id} disabled={locked} onChange={() => setNextStep(s.id)} />
                <span className="dot" aria-hidden="true" />
                {s.label}
              </label>
            ))}
          </fieldset>
          <button type="button" className="clm-submit" disabled={!nextStep || locked} onClick={submit}>
            Submit decision
          </button>
          {submitted && (
            <>
              <p className="clm-done" role="status">Submitted in this sandbox: {stepLabel(submitted)}. Reloading the page resets it.</p>
              <button type="button" className="clm-link-btn" onClick={reopen}>Reopen decision</button>
            </>
          )}
        </section>

        <section className="clm-card clm-activity" aria-labelledby="clm-activity-title">
          <h2 className="clm-card-title" id="clm-activity-title">Activity</h2>
          <ol>
            {added.map((a, i) => (
              <li key={`n${added.length - i}`} className="fresh"><span>{a.when}</span>{a.what}</li>
            ))}
            {claim.activity.map((a, i) => (
              <li key={`a${i}`}><span>{a.when}</span>{a.what}</li>
            ))}
          </ol>
        </section>
      </div>
    </>
  );
}

function TabPanel({ tab, claim }: { tab: Tab; claim: Claim }) {
  const doc = claim.document;
  switch (tab) {
    case "Documents":
      return (
        <section className="clm-card clm-doc" aria-label={doc.kind}>
          <div className="clm-doc-bar">
            <strong>{doc.kind}</strong>
            <span className="clm-file">{doc.file}</span>
            <span className="clm-page">Page {doc.page} of {doc.pages}</span>
            <span className="clm-page" style={{ marginLeft: 0 }}>100%</span>
          </div>
          <div className="clm-doc-stage">
            <article className="clm-sheet">
              <div className="clm-vendor">{doc.vendorBanner}</div>
              <h3>{doc.heading}</h3>
              <dl className="clm-lines">
                {doc.lines.map((l) => (
                  <div key={l.item} style={{ display: "contents" }}>
                    <dt>{l.item}</dt>
                    <dd>{eur(l.amount)}</dd>
                  </div>
                ))}
              </dl>
              <h4>Findings</h4>
              <p>{doc.findings}</p>
              <h4>Photos</h4>
              <div className="clm-photos">
                {Array.from({ length: Math.min(doc.photos, 3) }, (_, i) => (
                  <div key={i} className="clm-photo">Photo {i + 1}</div>
                ))}
              </div>
              {doc.photos > 3 && <p className="clm-empty" style={{ marginTop: 6, fontSize: 12.5 }}>+{doc.photos - 3} more in the claim file</p>}
              <div className="clm-total"><span>Estimate total</span><span>{eur(estimateTotal(doc))}</span></div>
            </article>
          </div>
        </section>
      );
    case "Summary":
      return (
        <section className="clm-card clm-pane" aria-label="Summary">
          <h2 className="clm-card-title">Summary</h2>
          <p style={{ margin: 0 }}>{claim.summaryText}</p>
          <dl className="clm-kv">
            <dt>Loss</dt><dd>{claim.lossType}</dd>
            <dt>Cause at intake</dt><dd>{claim.intakeCause}</dd>
            <dt>Policy</dt><dd>{claim.policy}</dd>
            <dt>Contact</dt><dd data-pii="name">{claim.policyholder.name}</dd>
            <dt>Email</dt><dd data-pii="email">{claim.policyholder.email}</dd>
            <dt>Phone</dt><dd data-pii="phone">{claim.policyholder.phone}</dd>
          </dl>
        </section>
      );
    case "Payments":
      return (
        <section className="clm-card clm-pane" aria-label="Payments">
          <h2 className="clm-card-title">Payments</h2>
          {claim.payments.length === 0 ? (
            <p className="clm-empty">No payments on this claim yet.</p>
          ) : (
            <table className="clm-table">
              <thead><tr><th>Date</th><th>Payee</th><th>Type</th><th className="num">Amount</th></tr></thead>
              <tbody>
                {claim.payments.map((p) => (
                  <tr key={p.when + p.payee}>
                    <td>{p.when}</td>
                    <td>{p.payee === "Policyholder" ? <span data-pii="name">{claim.policyholder.name}</span> : p.payee}</td>
                    <td>{p.state}</td>
                    <td className="num">{eur(p.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      );
    case "Notes":
      return (
        <section className="clm-card clm-pane" aria-label="Notes">
          <h2 className="clm-card-title">Notes</h2>
          {claim.notes.map((n) => (
            <div key={n.when + n.author} className="clm-note">
              <small>{n.when} · {n.author}</small>
              {n.text}
            </div>
          ))}
        </section>
      );
    case "Parties":
      return (
        <section className="clm-card clm-pane" aria-label="Parties">
          <h2 className="clm-card-title">Parties</h2>
          <table className="clm-table">
            <thead><tr><th>Role</th><th>Name</th><th>Detail</th></tr></thead>
            <tbody>
              {claim.parties.map((p) => (
                <tr key={p.role + p.name}>
                  <td>{p.role}</td>
                  <td>{p.pii ? <span data-pii={p.pii}>{p.name}</span> : p.name}</td>
                  <td>{p.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      );
  }
}
