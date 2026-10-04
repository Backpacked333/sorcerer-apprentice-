import type { PresenceState } from "@/lib/ui/presence";

export function Presence({ state, label, sub }: { state: PresenceState; label: string; sub?: string }) {
  const dotState = state === "listening" ? "answering" : state;
  return (
    <div className={`presence presence-${state}`} data-testid="capture-presence" role="status" aria-live="polite" aria-atomic="true">
      <PresenceDot state={dotState} />
      <div>
        <p className="text-base font-medium">{label}</p>
        {sub ? <p className="t-small text-muted">{sub}</p> : null}
      </div>
    </div>
  );
}

export function PresenceDot({ state = "unavailable" }: { state?: "listening" | "waiting" | "asking" | "answering" | "unavailable" | "quiet" | "off-record" }) {
  return (
    <svg className="presence-dot" data-state={state} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <circle cx="16" cy="16" r="15" fill="currentColor" opacity={state === "unavailable" ? 0.3 : 1} />
      <g fill="var(--color-bg)">
        <ellipse cx="12" cy="14" rx="1.3" ry={state === "waiting" ? 1 : 2} />
        <ellipse cx="20" cy="14" rx="1.3" ry={state === "waiting" ? 1 : 2} />
      </g>
      <path d="M13 20 Q16 22 19 20" fill="none" stroke="var(--color-bg)" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}
