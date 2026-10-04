"use client";

import type { ReactNode } from "react";

/**
 * Disclosure for the mechanism. Children mount only while open (no hidden pre-render:
 * smoke waits for text that must exist only after the click). The label flips to
 * "Hide the mechanism" when open.
 */
export function Drawer({ open, onToggle, title, testId, children }: { open: boolean; onToggle: () => void; title: string; testId?: string; children: ReactNode }) {
  return (
    <div>
      <button
        type="button"
        data-testid={testId}
        aria-expanded={open}
        onClick={onToggle}
        className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-[20px] px-4 text-left text-[13.5px] font-medium text-[#1d1d1f] outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgba(245,166,35,.75)] hover:bg-[rgba(255,255,255,.85)]"
        style={{
          minHeight: 40,
          background: open ? "rgba(255,255,255,.8)" : "rgba(255,255,255,.5)",
          boxShadow: "inset 0 1px 0 #fff, inset 0 0 0 .5px rgba(0,0,0,.08)",
          transition: "background-color .2s, box-shadow .2s",
        }}
      >
        <span>{open ? "Hide the mechanism" : title}</span>
        <svg aria-hidden width="12" height="12" viewBox="0 0 12 12" style={{ flex: "none", transform: open ? "rotate(180deg)" : "none", transition: "transform .35s var(--ease-spring, cubic-bezier(.2,1.12,.3,1))", color: "#8e8e93" }}>
          <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open ? (
        <div
          className="mt-2 space-y-3 rounded-[22px] p-3"
          style={{
            background: "linear-gradient(180deg,rgba(255,255,255,.72),rgba(255,255,255,.5))",
            boxShadow: "inset 0 1px 0 #fff, 0 0 0 .5px rgba(0,0,0,.07), 0 10px 30px rgba(15,23,42,.06)",
            animation: "tc-rise .5s var(--ease-rise, cubic-bezier(.2,.9,.3,1)) both",
          }}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}
