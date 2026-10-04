"use client";
// Companion header row (design §6.1/§6.2): orb · eyebrow / title / sub (re-keyed → tc-rise) · clock.
import type { OrbMood } from "@/lib/ui/moods";
import { Eyebrow } from "./Eyebrow";
import { Orb } from "./Orb";
import { SessionClock } from "./SessionClock";

export function CompanionHeader(p: {
  mood: OrbMood;
  eyebrow?: string;
  title: string;
  sub?: string;
  startedAt?: number | null;
  frozen?: boolean;
  ringMs?: number | null;
  rippleKey?: string | number;
}) {
  const { mood, eyebrow, title, sub, startedAt, frozen, ringMs, rippleKey } = p;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "1px 2px", minWidth: 0 }}>
      <Orb mood={mood} size={38} ringMs={ringMs} rippleKey={rippleKey} />
      <div style={{ flex: 1, minWidth: 0, minHeight: 38, display: "flex", flexDirection: "column", justifyContent: "center" }}>
        {eyebrow ? (
          <div key={`e|${eyebrow}`} style={{ animation: "tc-rise .55s var(--ease-rise, cubic-bezier(.2,.9,.3,1)) both" }}>
            <Eyebrow text={eyebrow} mood={mood} />
          </div>
        ) : null}
        <div key={`t|${title}|${sub ?? ""}`} style={{ animation: "tc-rise .55s var(--ease-rise, cubic-bezier(.2,.9,.3,1)) both", minWidth: 0 }}>
          <div
            className="tc-companion-title"
            data-mood={mood}
            title={title}
            style={{
              fontSize: 15,
              fontWeight: 600,
              letterSpacing: "-.01em",
              lineHeight: 1.3,
              color: "#1d1d1f",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {title}
          </div>
          {sub ? (
            <div
              style={{
                fontSize: eyebrow ? 12 : 12.5,
                color: "#6e6e73",
                marginTop: 1,
                lineHeight: 1.35,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {sub}
            </div>
          ) : null}
        </div>
      </div>
      {startedAt !== undefined ? <SessionClock startedAt={startedAt} frozen={frozen} /> : null}
    </div>
  );
}
