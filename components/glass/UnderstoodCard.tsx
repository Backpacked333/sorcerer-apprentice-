"use client";

export type UnderstoodCardProps = {
  kind: string;
  text: string;
  /** True only when `text` is a literal Quote.text; quotation marks are shown only then. */
  isQuote: boolean;
  meta?: string;
};

const BORDER = "linear-gradient(90deg,#ffb8d9,#ffe2a8,#b9f0d3,#b5dcff,#d4c6ff)";

/** "Understood · {kind}" card with a self-drawing check (tc-draw). Re-key to replay. */
export function UnderstoodCard({ kind, text, isQuote, meta }: UnderstoodCardProps) {
  return (
    <div
      style={{
        display: "flex",
        gap: 10,
        alignItems: "center",
        padding: "10px 12px",
        borderRadius: 16,
        border: ".75px solid transparent",
        background: `linear-gradient(180deg,rgba(255,255,255,.9),rgba(255,255,255,.66)) padding-box,${BORDER} border-box`,
        boxShadow: "0 6px 20px rgba(160,140,255,.16)",
        animation: "tc-rise .6s var(--ease-rise, cubic-bezier(.2,.9,.3,1)) .15s both",
      }}
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" style={{ flex: "none" }} aria-hidden>
        <circle cx="12" cy="12" r="10" stroke="#22b45e" strokeOpacity=".25" strokeWidth="1.5" />
        <path
          d="M7.5 12.5l3 3 6-6.5"
          stroke="#1b8a4b"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          pathLength={1}
          strokeDasharray="1"
          style={{ animation: "tc-draw .5s ease-out .45s both" }}
        />
      </svg>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 10.5, fontWeight: 600, color: "#8e8e93" }}>Understood · {kind}</div>
        <div style={{ fontSize: 13.5, fontWeight: 600, marginTop: 1, color: "#1d1d1f", textWrap: "pretty", overflowWrap: "anywhere" }}>
          {isQuote ? `“${text}”` : text}
        </div>
      </div>
      {meta ? <span style={{ fontSize: 11, color: "#8e8e93", whiteSpace: "nowrap", flex: "none" }}>{meta}</span> : null}
    </div>
  );
}
