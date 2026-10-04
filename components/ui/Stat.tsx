export function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded border border-line bg-bg px-2 py-1.5">
      <p className="text-muted">{label}</p>
      <p className="mono text-base text-ink">{value}</p>
      {hint && <p className="text-muted">{hint}</p>}
    </div>
  );
}
