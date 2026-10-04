"use client";

import type { ReactNode } from "react";

export function OpenErpButton({ queue, children }: { queue: string; children?: ReactNode }) {
  const href = `/erp?queue=${queue}`;
  return (
    <a
      href={href}
      target="tacit-erp"
      className="inline-flex items-center justify-center gap-1.5 no-underline transition-transform hover:-translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a35f00]"
      style={{ height: 40, padding: "0 18px", borderRadius: 20, fontSize: 14, fontWeight: 600, color: "#6b3f00", background: "linear-gradient(180deg,rgba(255,222,160,.85),rgba(255,196,95,.6))", boxShadow: "inset 0 1px 0 rgba(255,255,255,.8), inset 0 0 0 .5px rgba(200,120,0,.2)" }}
      onClick={(e) => {
        const w = Math.round(window.screen.availWidth * 0.65);
        const h = window.screen.availHeight;
        const opened = window.open(href, "tacit-erp", `popup=yes,left=0,top=0,width=${w},height=${h}`);
        if (opened) e.preventDefault();
      }}
    >
      {children ?? "Open the ERP"}
      <span aria-hidden style={{ fontSize: 13 }}>↗</span>
    </a>
  );
}
