import Link from "next/link";
import { ClaimsShell } from "@/components/claims/ClaimsShell";
import { CLAIMS, eur, STATUS_LABEL } from "@/lib/claims-model";

export default async function ClaimsQueuePage({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  const raw = (await searchParams).q;
  const q = (Array.isArray(raw) ? raw[0] : raw)?.trim() ?? "";
  const needle = q.toLowerCase();
  const rows = needle
    ? CLAIMS.filter((c) => [c.id, c.lossType, c.summary, c.policy, c.policyholder.name].some((v) => v.toLowerCase().includes(needle)))
    : CLAIMS;
  return (
    <ClaimsShell crumbs={[{ label: "Claims", href: "/claims" }, { label: "My queue" }]} q={q}>
      <main className="clm-queue">
        <div>
          <h1>My queue</h1>
          <p className="clm-queue-sub">
            {q ? `${rows.length} of ${CLAIMS.length} claims match “${q}”` : `${CLAIMS.length} open claims`} · fictional data
          </p>
        </div>
        <table className="clm-qtable">
          <thead>
            <tr>
              <th>Claim</th>
              <th>Status</th>
              <th className="hide-sm">Policyholder</th>
              <th className="hide-sm">Loss date</th>
              <th className="num">Reserve</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id} className="clm-qrow">
                <td>
                  <Link href={`/claims/${c.id}`}>{c.id}</Link>
                  <span className="sub">{c.lossType} · {c.summary}</span>
                </td>
                <td><span className={`clm-pill clm-pill-${c.status}`}>{STATUS_LABEL[c.status]}</span></td>
                <td className="hide-sm"><span data-pii="name">{c.policyholder.name}</span></td>
                <td className="hide-sm">{c.lossDate}</td>
                <td className="num">{eur(c.reserve)}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={5} className="clm-empty">No claims match. <Link href="/claims">Clear search</Link></td></tr>
            )}
          </tbody>
        </table>
      </main>
    </ClaimsShell>
  );
}
