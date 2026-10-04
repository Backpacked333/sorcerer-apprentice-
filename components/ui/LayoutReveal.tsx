"use client";

import type { ReactNode } from "react";

/**
 * Holds the layout-dependent region at opacity 0 until the layout mode is known, then fades it in.
 * Opacity only (no display:none), so nothing reflows when it appears.
 */
export function LayoutReveal({ ready, children, className = "" }: { ready: boolean; children: ReactNode; className?: string }) {
  return (
    <div
      className={className}
      data-layout-ready={ready ? "true" : "false"}
      aria-busy={ready ? undefined : true}
      style={{ opacity: ready ? 1 : 0, transition: "opacity .28s var(--ease-rise, ease-out)" }}
    >
      {children}
    </div>
  );
}
