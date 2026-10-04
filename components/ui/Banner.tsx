export function Banner({ tone = "info", children, action }: { tone?: "info" | "degraded" | "error"; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className={`banner banner-${tone}`} role={tone === "error" ? "alert" : "status"}>
      <div className="flex-1">{children}</div>
      {action}
    </div>
  );
}
