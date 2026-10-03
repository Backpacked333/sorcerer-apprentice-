import Link from "next/link";

export function ErpHeader({ title }: { title: string }) {
  return (
    <header className="border-b border-line bg-panel">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-6 py-3">
        <div className="flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded-sm bg-amber" />
          <span className="font-semibold tracking-tight">MB-ERP</span>
          <span className="text-xs text-muted">Maschinenbau Stuttgart GmbH · sandbox</span>
        </div>
        <span className="text-muted">·</span>
        <span className="text-sm">{title}</span>
        <nav className="ml-auto flex items-center gap-3 text-sm text-muted">
          <Link href="/erp" className="hover:text-ink">Queue</Link>
          <Link href="/" className="hover:text-ink">Tacit</Link>
        </nav>
      </div>
    </header>
  );
}
