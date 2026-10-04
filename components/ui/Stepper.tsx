import Link from "next/link";

/**
 * Capture → Map → Teach. Teach unlocks only for a confirmed map (non-negotiable #7 shown in the UI).
 */
export function Stepper({ current, sessionId, confirmed }: { current: 1 | 2 | 3; sessionId?: string; confirmed?: boolean }) {
  const steps: { n: 1 | 2 | 3; label: string; href?: string; reason?: string }[] = [
    { n: 1, label: "Capture", href: "/capture" },
    { n: 2, label: "Map", href: sessionId ? `/map/${sessionId}` : undefined, reason: sessionId ? undefined : "Finish a capture first" },
    { n: 3, label: "Teach", href: confirmed && sessionId ? `/teach?from=${sessionId}` : undefined, reason: confirmed ? undefined : "Confirm the Work Map first" },
  ];
  return (
    <ol
      className="stepper m-0 flex list-none items-center gap-0.5 p-[3px]"
      data-current={current}
      style={{ borderRadius: 17, background: "rgba(0,0,0,.045)", boxShadow: "inset 0 0 0 .5px rgba(0,0,0,.05)" }}
    >
      {steps.map((s) => {
        const state = s.n < current ? "done" : s.n === current ? "current" : s.href ? "next" : "locked";
        const isCurrent = state === "current";
        const inner = (
          <span className="inline-flex items-center gap-1.5">
            <span
              aria-hidden
              className="inline-grid place-items-center font-mono text-[10.5px] font-semibold"
              style={{
                width: 17,
                height: 17,
                lineHeight: 1,
                borderRadius: 9,
                background: isCurrent ? "linear-gradient(180deg,#ffc552,#f5a623)" : state === "done" ? "rgba(34,180,94,.16)" : "rgba(0,0,0,.06)",
                color: isCurrent ? "#1d1300" : state === "done" ? "#1b8a4b" : "#6e6e73",
              }}
            >
              {s.n}
            </span>
            {" "}
            {s.label}
          </span>
        );
        return (
          <li
            key={s.n}
            className={`step step-${state}`}
            title={s.reason}
            aria-current={isCurrent ? "step" : undefined}
            style={{
              padding: 0,
              lineHeight: "18px",
              borderRadius: 14,
              background: isCurrent ? "#fff" : "transparent",
              boxShadow: isCurrent ? "0 1px 3px rgba(0,0,0,.08), 0 0 0 .5px rgba(0,0,0,.05)" : "none",
              color: isCurrent ? "#1d1d1f" : state === "locked" ? "#aeaeb2" : "#6e6e73",
              fontSize: 13,
              fontWeight: isCurrent ? 600 : 500,
              transition: "background-color .3s, box-shadow .3s, color .3s",
            }}
          >
            {s.href && s.n !== current ? (
              <Link href={s.href} className="block px-2 py-[4px] no-underline hover:text-[#1d1d1f]" style={{ color: "inherit" }}>{inner}</Link>
            ) : (
              <span className="block px-2 py-[4px]" style={{ cursor: state === "locked" ? "not-allowed" : "default" }}>{inner}</span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
