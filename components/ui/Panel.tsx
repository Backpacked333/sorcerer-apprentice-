export function Panel({ title, tone, footer, children }: { title?: string; tone?: "default" | "emphasized" | "degraded"; footer?: React.ReactNode; children: React.ReactNode }) {
  const border = tone === "emphasized" ? " border-amber" : "";
  return (
    <section className={`panel p-4${border}`}>
      {tone === "degraded" && <p className="banner banner-degraded mb-3">{typeof title === "string" ? title : "Degraded"}</p>}
      {title && tone !== "degraded" && <p className="panel-title">{title}</p>}
      <div className={title ? "mt-2" : ""}>{children}</div>
      {footer && <div className="mt-3">{footer}</div>}
    </section>
  );
}
