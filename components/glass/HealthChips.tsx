"use client";

export type HealthTone = "green" | "amber" | "red" | "neutral";
export type HealthChipsProps = { items: { label: string; tone: HealthTone }[] };

const TONE: Record<HealthTone, { bg: string; fg: string; dot: string | null }> = {
  green: { bg: "rgba(34,180,94,.1)", fg: "#52606d", dot: "#22b45e" },
  amber: { bg: "rgba(245,166,35,.14)", fg: "#8a5200", dot: "#f5a623" },
  red: { bg: "rgba(229,72,77,.1)", fg: "#c9342f", dot: "#e5484d" },
  neutral: { bg: "rgba(0,0,0,.05)", fg: "#6e6e73", dot: "#aeaeb2" },
};

/** Source-status row (Redesign 1b): real connection health only, honest labels. */
export function HealthChips({ items }: HealthChipsProps) {
  if (!items.length) return null;
  return (
    <div role="list" style={{ display: "flex", flexWrap: "wrap", gap: 5, alignItems: "center" }}>
      {items.map((it, i) => {
        const t = TONE[it.tone];
        return (
          <span
            role="listitem"
            key={`${it.label}-${i}`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              height: 22,
              padding: "0 8px",
              borderRadius: 11,
              fontSize: 11,
              fontWeight: 500,
              lineHeight: 1,
              whiteSpace: "nowrap",
              color: t.fg,
              background: t.bg,
              transition: "background-color .5s, color .5s",
            }}
          >
            {t.dot ? (
              <span
                aria-hidden
                style={{ width: 5, height: 5, borderRadius: "50%", flex: "none", background: t.dot, boxShadow: it.tone === "neutral" ? "none" : `0 0 6px ${t.dot}`, transition: "background-color .5s, box-shadow .5s" }}
              />
            ) : null}
            {it.label}
          </span>
        );
      })}
    </div>
  );
}
