"use client";
// "Export for agents": the confirmed map in three formats (offered only once confirmed).
// A native <details> disclosure: keyboard accessible, no buttons (keeps smoke's button text matches clean).

import { useEffect, useRef } from "react";

const FORMATS = [
  { format: "policy", label: "policy.json", sub: "rules an agent can load" },
  { format: "prompt", label: "agent prompt", sub: "system prompt with the guardrails" },
  { format: "sop", label: "SOP markdown", sub: "the procedure, for people" },
] as const;

export function ExportMenu({ sessionId }: { sessionId: string }) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => {
      const d = ref.current;
      if (d?.open && !d.contains(e.target as Node)) d.open = false;
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);
  return (
    <details ref={ref} className="relative" data-testid="map-export">
      <summary
        className="inline-flex h-[34px] cursor-pointer list-none items-center rounded-[17px] px-3.5 text-[13px] font-medium text-[#1d1d1f] outline-none transition-transform hover:-translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgba(245,166,35,.75)] [&::-webkit-details-marker]:hidden"
        style={{ background: "#fff", boxShadow: "0 0 0 .5px rgba(0,0,0,.1),0 2px 8px rgba(0,0,0,.05)" }}
      >
        Export for agents
      </summary>
      <div
        className="glass-panel absolute right-0 z-20 mt-2 flex w-[260px] flex-col gap-0.5 p-1.5"
        style={{ borderRadius: 18, animation: "tc-rise .4s var(--ease-rise, cubic-bezier(.2,.9,.3,1)) both" }}
      >
        {FORMATS.map((f) => (
          <a
            key={f.format}
            href={`/api/export?sessionId=${sessionId}&format=${f.format}`}
            className="flex flex-col rounded-[12px] px-3 py-2 no-underline hover:bg-[rgba(255,255,255,.85)]"
          >
            <span className="font-mono text-[13px] text-[#1d1d1f]">{f.label}</span>
            <span className="text-[12px] text-[#8e8e93]">{f.sub}</span>
          </a>
        ))}
      </div>
    </details>
  );
}
