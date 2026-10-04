"use client";

export function OpenErpButton({ queue, children }: { queue: string; children?: React.ReactNode }) {
  const href = `/erp?queue=${queue}`;
  return (
    <a
      className="btn btn-primary"
      href={href}
      target="tacit-erp"
      onClick={(e) => {
        const w = Math.round(window.screen.availWidth * 0.65);
        const h = window.screen.availHeight;
        const opened = window.open(href, "tacit-erp", `popup=yes,left=0,top=0,width=${w},height=${h}`);
        if (opened) e.preventDefault();
      }}
    >
      {children ?? "Open the ERP"}
    </a>
  );
}
