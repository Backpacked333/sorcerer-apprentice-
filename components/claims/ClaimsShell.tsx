import Link from "next/link";
import { CLAIMS } from "@/lib/claims-model";

const icons = {
  home: <path d="M3 11l9-7 9 7v9H3z" />,
  folder: <path d="M4 6h6l2 2h8v11H4z" />,
  people: <><circle cx="9" cy="8" r="3.5" /><path d="M3 20c.8-3.5 3.2-5 6-5s5.2 1.5 6 5M16 11a3 3 0 100-6M18 15c1.6.6 2.6 2 3 5" /></>,
  chart: <path d="M5 20V10M12 20V4M19 20v-7" />,
};

function Icon({ name }: { name: keyof typeof icons }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {icons[name]}
    </svg>
  );
}

/** Rail + top bar + breadcrumb of the fictional claims workbench. */
export function ClaimsShell({ crumbs, q, children }: { crumbs: { label: string; href?: string }[]; q?: string; children: React.ReactNode }) {
  return (
    <div className="clm">
      <nav className="clm-rail" aria-label="Workbench">
        <Link href="/claims" className="clm-logo" aria-label="Kestrel Bay Mutual home">K</Link>
        <span className="clm-rail-btn" title="Home (not part of the sandbox)"><Icon name="home" /></span>
        <Link href="/claims" className="clm-rail-btn" aria-current="page" title="Claims"><Icon name="folder" /></Link>
        <span className="clm-rail-btn" title="Parties (not part of the sandbox)"><Icon name="people" /></span>
        <span className="clm-rail-btn" title="Reports (not part of the sandbox)"><Icon name="chart" /></span>
      </nav>
      <div className="clm-main">
        <header className="clm-top">
          <span className="clm-brand">Kestrel Bay Mutual<small>(fictional)</small></span>
          <span className="clm-app">Claims workbench</span>
          <form action="/claims" role="search">
            <input className="clm-search" type="search" name="q" defaultValue={q} placeholder="Search claims, policies, parties" aria-label="Search claims" />
          </form>
          <Link href="/claims" className="clm-queue-pill">My queue · {CLAIMS.length}</Link>
          <a href="/" className="clm-external-nav">Tacit ↗</a>
          <span className="clm-avatar" aria-label="Signed in as adjuster A">A</span>
        </header>
        <div className="clm-crumbs">
          <span>
            {crumbs.map((c, i) => (
              <span key={c.label}>
                {i > 0 && " › "}
                {c.href ? <Link href={c.href}>{c.label}</Link> : <span aria-current="page">{c.label}</span>}
              </span>
            ))}
          </span>
          <span className="clm-sandbox"><i aria-hidden="true" />Sandbox — changes are not saved</span>
        </div>
        {children}
      </div>
    </div>
  );
}
