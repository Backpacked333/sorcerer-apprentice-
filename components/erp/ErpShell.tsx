"use client";

import Link from "next/link";
import { createContext, useContext, useState, type ReactNode } from "react";
import { queueAvatar } from "@/lib/erp-ui";

/** The live queue-search text, shared by the top bar and the queue table. */
const ErpSearchContext = createContext("");

export function useErpSearch(): string {
  return useContext(ErpSearchContext);
}

type NavItem = { key: string; label: string; icon: ReactNode };

const I = (d: string) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d={d} />
  </svg>
);

const NAV: NavItem[] = [
  { key: "dashboard", label: "Dashboard", icon: I("M4 13h6V4H4zM14 20h6v-9h-6zM4 20h6v-3H4zM14 7h6V4h-6z") },
  { key: "banking", label: "Banking", icon: I("M3 10l9-6 9 6M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18") },
  { key: "bills", label: "Expenses & Bills", icon: I("M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6") },
  { key: "sales", label: "Sales", icon: I("M4 19l5-6 4 3 7-9M15 7h5v5") },
  { key: "payroll", label: "Payroll", icon: I("M16 19v-1a4 4 0 0 0-8 0v1M12 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6z") },
  { key: "reports", label: "Reports", icon: I("M5 20V10M12 20V4M19 20v-7") },
  { key: "taxes", label: "Taxes", icon: I("M6 18L18 6M8 8.5a1.5 1.5 0 1 0 0-.01M16 16.5a1.5 1.5 0 1 0 0-.01") },
  { key: "accounting", label: "Accounting", icon: I("M5 4h14v16H5zM8 8h8M8 12h3M13 12h3M8 16h3M13 16h3") },
];

/**
 * MB-ERP chrome: navy sidebar (Expenses & Bills is the only live item), white top bar with a
 * working search, the posting period, help and a neutral role avatar. Everything that has no
 * function in the sandbox renders as an inert span with aria-disabled.
 */
export function ErpShell({
  queue = "expert",
  initialQuery = "",
  searchMode = "navigate",
  children,
}: {
  queue?: string;
  initialQuery?: string;
  /** "filter": the queue page filters its table live. "navigate": Enter opens the filtered queue. */
  searchMode?: "filter" | "navigate";
  children: ReactNode;
}) {
  const [q, setQ] = useState(initialQuery);
  const avatar = queueAvatar(queue);
  const queueHref = `/erp?queue=${queue}`;
  return (
    <ErpSearchContext.Provider value={q}>
      <div className="erp-shell">
        <aside className="erp-side" aria-label="MB-ERP navigation">
          <div className="erp-brand-row">
            <span className="erp-mark" aria-hidden />
            <span className="erp-brand">MB-ERP</span>
          </div>
          <span className="erp-new" aria-disabled="true" title="New">
            <span aria-hidden>+</span>
            <span className="erp-side-label">New</span>
          </span>
          <nav className="erp-nav">
            {NAV.map((n) =>
              n.key === "bills" ? (
                <Link key={n.key} href={queueHref} className="erp-nav-item is-active" aria-current="page" title={n.label}>
                  {n.icon}
                  <span className="erp-side-label">{n.label}</span>
                </Link>
              ) : (
                <span key={n.key} className="erp-nav-item" aria-disabled="true" title={n.label}>
                  {n.icon}
                  <span className="erp-side-label">{n.label}</span>
                </span>
              ),
            )}
          </nav>
          <span className="erp-side-foot erp-side-label">Maschinenbau Stuttgart GmbH</span>
        </aside>

        <header className="erp-top">
          <span className="erp-top-mark" aria-hidden />
          <form
            className="erp-search"
            role="search"
            action="/erp"
            method="get"
            onSubmit={(e) => {
              if (searchMode === "filter") e.preventDefault();
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <circle cx="11" cy="11" r="6.5" />
              <path d="M20 20l-4-4" />
            </svg>
            <input type="hidden" name="queue" value={queue} />
            <input
              type="search"
              name="q"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search bills, vendors, accounts"
              aria-label="Search bills"
              autoComplete="off"
              spellCheck={false}
            />
          </form>
          <span className="erp-period">Posting period 12/2025</span>
          <span className="erp-help" aria-disabled="true" title="Help">?</span>
          <span className="erp-avatar" role="img" title={avatar.label} aria-label={`Signed in as ${avatar.label}`}>{avatar.initials}</span>
          <Link href="/" className="erp-external-nav">Simon</Link>
        </header>

        <main className="erp-main">{children}</main>
      </div>
    </ErpSearchContext.Provider>
  );
}
