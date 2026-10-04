import Link from "next/link";

const QUEUE_LABEL: Record<string, string> = {
  expert: "Invoice queue · expert",
  newhire: "Invoice queue · new hire",
  autopilot: "Routine queue · agent",
};

export function ErpHeader({ title, queue = "expert" }: { title: string; queue?: string }) {
  return (
    <header className="erp-header">
      <span className="erp-mark" aria-hidden />
      <span className="erp-brand">MB-ERP</span>
      <span className="erp-quiet">Maschinenbau Stuttgart GmbH</span>
      <span className="erp-quiet">Posting period 12/2025</span>
      <span>{QUEUE_LABEL[queue] ?? title}</span>
      <span className="erp-quiet">{title}</span>
      <nav>
        <Link href={`/erp?queue=${queue}`}>Queue</Link>
        <Link href="/" className="erp-external-nav">Simon</Link>
      </nav>
    </header>
  );
}
