import type { PresenceState } from "@/lib/ui/presence";

export function Presence({ state, label, sub }: { state: PresenceState; label: string; sub?: string }) {
  return (
    <div className={`presence presence-${state}`} data-testid="capture-presence" aria-live="polite">
      <span className={`presence-mark presence-mark-${state}`} />
      <div>
        <p className="t-h2">{label}</p>
        {sub ? <p className="t-small">{sub}</p> : null}
      </div>
    </div>
  );
}
