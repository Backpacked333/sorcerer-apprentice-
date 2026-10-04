"use client";

export function Drawer({ open, onToggle, title, testId, children }: { open: boolean; onToggle: () => void; title: string; testId?: string; children: React.ReactNode }) {
  return (
    <div>
      <button type="button" className="btn w-full" data-testid={testId} aria-expanded={open} onClick={onToggle}>
        {open ? "Hide the mechanism" : title}
      </button>
      {open ? <div className="mt-3 space-y-3">{children}</div> : null}
    </div>
  );
}
