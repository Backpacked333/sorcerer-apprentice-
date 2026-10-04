"use client";

import { Orb } from "@/components/glass/Orb";
import type { OrbMood } from "@/lib/ui/moods";
import type { PresenceState } from "@/lib/ui/presence";

const MOOD_OF: Record<PresenceState, OrbMood> = {
  "off-record": "off",
  asking: "asking",
  listening: "listening",
  quiet: "quiet",
};

/**
 * The presence line: the orb plus the label and sub-line from `presenceOf` (test-locked copy).
 * `mood` overrides the orb mood when a richer real state is known (e.g. from `captureMood`).
 * The orb animates inside its own aria-hidden layers; this row holds no controls.
 */
export function Presence({ state, label, sub, mood, rippleKey, ringMs }: { state: PresenceState; label: string; sub?: string; mood?: OrbMood; rippleKey?: string | number; ringMs?: number | null }) {
  return (
    <div className={`presence presence-${state} flex items-center gap-3`} data-testid="capture-presence" aria-live="polite" style={{ minHeight: 64 }}>
      <Orb mood={mood ?? MOOD_OF[state]} size={44} rippleKey={rippleKey ?? state} ringMs={ringMs} />
      <div className="min-w-0">
        <p key={label} className="text-[17px] font-semibold leading-tight tracking-[-.01em] text-[#1d1d1f]" style={{ animation: "tc-rise .55s var(--ease-rise, cubic-bezier(.2,.9,.3,1)) both" }}>
          {label}
        </p>
        {sub ? <p className="mt-0.5 text-[13px] leading-snug text-[#6e6e73]">{sub}</p> : null}
      </div>
    </div>
  );
}
