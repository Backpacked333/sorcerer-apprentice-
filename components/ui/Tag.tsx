export function Tag({ tone = "neutral", children }: { tone?: "neutral" | "amber" | "green" | "red" | "blue"; children: React.ReactNode }) {
  const extra = tone === "neutral" ? "" : ` tag-${tone}`;
  return <span className={`tag${extra}`}>{children}</span>;
}
