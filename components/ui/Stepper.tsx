import Link from "next/link";

export function Stepper({ current, sessionId, confirmed }: { current: 1 | 2 | 3; sessionId?: string; confirmed?: boolean }) {
  const steps: { n: 1 | 2 | 3; label: string; href?: string; reason?: string }[] = [
    { n: 1, label: "Capture", href: "/capture" },
    { n: 2, label: "Map", href: sessionId ? `/map/${sessionId}` : undefined, reason: sessionId ? undefined : "Finish a capture first" },
    { n: 3, label: "Teach", href: confirmed && sessionId ? `/teach?from=${sessionId}` : undefined, reason: confirmed ? undefined : "Confirm the Work Map first" },
  ];
  return (
    <ol className="stepper">
      {steps.map((s) => {
        const state = s.n < current ? "done" : s.n === current ? "current" : s.href ? "next" : "locked";
        const inner = <span>{s.n} {s.label}</span>;
        return (
          <li key={s.n} className={`step step-${state}`} title={s.reason}>
            {s.href && s.n !== current ? <Link href={s.href}>{inner}</Link> : inner}
          </li>
        );
      })}
    </ol>
  );
}
