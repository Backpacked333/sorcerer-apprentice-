import type { ReactNode } from "react";
import { Stepper } from "./Stepper";

/**
 * Tacit page shell: a light glass top bar (brand, Capture → Map → Teach stepper, status slot).
 * `fill` makes the shell take its parent's height (side column / floating companion) instead of the viewport.
 */
export function AppShell({
  step,
  sessionId,
  confirmed,
  presenter,
  status,
  fill,
  children,
}: {
  step: 1 | 2 | 3;
  sessionId?: string;
  confirmed?: boolean;
  presenter?: boolean;
  status?: ReactNode;
  fill?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={fill ? "flex h-full min-h-0 flex-col" : "flex min-h-dvh flex-col"}>
      <header
        className="app-bar sticky top-0 z-10 flex flex-wrap items-center gap-x-3 gap-y-1.5"
        style={{
          minHeight: 52,
          padding: "6px 12px 6px 16px",
          background: "linear-gradient(180deg,rgba(255,255,255,.78),rgba(255,255,255,.56))",
          backdropFilter: "blur(24px) saturate(1.8)",
          WebkitBackdropFilter: "blur(24px) saturate(1.8)",
          boxShadow: "inset 0 -.5px 0 rgba(0,0,0,.08), 0 6px 20px rgba(15,23,42,.04)",
          borderBottom: 0,
        }}
      >
        <span className="inline-flex items-center gap-2">
          <span className="mark" aria-hidden style={{ width: 12, height: 12, borderRadius: 3, background: "#f5a623", boxShadow: "0 0 8px rgba(245,166,35,.45)" }} />
          <span className="text-[15px] font-semibold tracking-[-.01em] text-[#1d1d1f]">Tacit</span>
        </span>
        <Stepper current={step} sessionId={sessionId} confirmed={confirmed} />
        <span className="ml-auto flex min-w-0 items-center gap-2 text-[#6e6e73]">
          {presenter && (
            <span className="inline-flex h-[22px] items-center rounded-[11px] px-2 text-[11px] font-semibold" style={{ background: "rgba(245,166,35,.14)", color: "#a35f00" }}>
              Presenter
            </span>
          )}
          {status}
        </span>
      </header>
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}
