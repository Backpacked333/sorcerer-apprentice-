"use client";

export type SegmentState = "filled" | "open" | "skipped";
export type SegmentedBarProps = { segments: SegmentState[]; label?: string };

const BG: Record<SegmentState, string> = {
  filled: "rgba(34,180,94,.25)",
  open: "rgba(245,166,35,.3)",
  skipped: "rgba(0,0,0,.09)",
};

/** Gap/slot progress as segments: counts, never a percentage. */
export function SegmentedBar({ segments, label }: SegmentedBarProps) {
  const filled = segments.filter((s) => s === "filled").length;
  const aria = label ?? `${filled} of ${segments.length}`;
  return (
    <div role="img" aria-label={aria} title={aria} style={{ display: "flex", gap: 4, width: "100%" }}>
      {segments.map((s, i) => (
        <span
          key={i}
          data-state={s}
          style={{
            position: "relative",
            flex: 1,
            height: 6,
            borderRadius: 3,
            background: BG[s],
            transition: "background-color .6s, box-shadow .6s",
            boxShadow: s === "filled" ? "0 0 8px rgba(34,180,94,.35)" : "0 0 0 rgba(34,180,94,0)",
            overflow: "hidden",
          }}
        >
          <span
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: 3,
              background: "linear-gradient(90deg,#7fe0b0,#22b45e)",
              opacity: s === "filled" ? 1 : 0,
              transition: "opacity .6s",
            }}
          />
          {s === "skipped" ? (
            <span
              aria-hidden
              style={{ position: "absolute", inset: 0, background: "repeating-linear-gradient(135deg,rgba(0,0,0,.08) 0 3px,rgba(0,0,0,0) 3px 6px)" }}
            />
          ) : null}
        </span>
      ))}
    </div>
  );
}
