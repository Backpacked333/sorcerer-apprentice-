import type { ReactNode } from "react";
import { Banner } from "./Banner";

export function Panel({ title, tone, footer, children }: { title?: string; tone?: "default" | "emphasized" | "degraded"; footer?: ReactNode; children: ReactNode }) {
  const ring = tone === "emphasized" ? "0 0 0 1px rgba(245,166,35,.45), 0 0 18px rgba(245,166,35,.14)" : "0 0 0 .5px rgba(0,0,0,.07)";
  return (
    <section
      className="p-4"
      style={{ borderRadius: 24, background: "linear-gradient(180deg,rgba(255,255,255,.8),rgba(255,255,255,.58))", boxShadow: `inset 0 1px 0 #fff, ${ring}, 0 12px 36px rgba(15,23,42,.05)` }}
    >
      {tone === "degraded" && <div className="mb-3"><Banner tone="degraded">{typeof title === "string" ? title : "Degraded"}</Banner></div>}
      {title && tone !== "degraded" && <p className="text-[12px] font-semibold text-[#8e8e93]">{title}</p>}
      <div className={title ? "mt-2" : ""}>{children}</div>
      {footer && <div className="mt-3">{footer}</div>}
    </section>
  );
}
