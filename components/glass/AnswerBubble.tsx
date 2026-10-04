"use client";

import { StruckBand } from "./StruckBand";

export type AnswerBubbleProps = {
  text: string;
  partial?: string;
  /** True only while the governor-opened mic window is open; drives the audio bars. */
  listening: boolean;
  /** Key phrase to sweep-highlight. Applied only when it is a literal substring of `text`. */
  highlight?: string;
  struck?: boolean;
};

const BARS = [8, 15, 20, 13, 7];
const SWEEP =
  "linear-gradient(90deg,rgba(255,184,217,.55),rgba(255,226,168,.6),rgba(185,240,211,.6),rgba(181,220,255,.6),rgba(212,198,255,.55))";

/** The expert's own words, streamed (Scribe partial) into a green glass bubble. */
export function AnswerBubble({ text, partial, listening, highlight, struck }: AnswerBubbleProps) {
  const at = highlight ? text.indexOf(highlight) : -1;
  const hasKey = !!highlight && at >= 0;
  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        gap: 10,
        alignItems: "flex-start",
        padding: "12px 14px",
        borderRadius: 18,
        background: "linear-gradient(180deg,rgba(230,251,239,.7),rgba(214,247,229,.42))",
        boxShadow: "inset 0 0 0 .5px rgba(34,180,94,.2),inset 0 1px 0 rgba(255,255,255,.7)",
        animation: "tc-rise .5s var(--ease-rise, cubic-bezier(.2,.9,.3,1)) both",
      }}
    >
      <div aria-hidden style={{ display: "flex", gap: 2.5, alignItems: "center", height: 20, flex: "none", marginTop: 1 }}>
        {BARS.map((h, i) => (
          <span
            key={i}
            style={{
              width: 3,
              height: h,
              borderRadius: 2,
              background: "linear-gradient(180deg,#5fe09a,#1fa65a)",
              transformOrigin: "center",
              animation: listening ? `tc-bar ${(0.55 + i * 0.13).toFixed(2)}s ease-in-out ${(i * 0.07).toFixed(2)}s infinite` : "none",
              transform: listening ? undefined : "scaleY(.35)",
              transition: "transform .4s",
            }}
          />
        ))}
      </div>
      <div style={{ fontSize: 14.5, lineHeight: 1.45, color: "#16543a", textWrap: "pretty", minHeight: 21, minWidth: 0, overflowWrap: "anywhere" }}>
        {hasKey ? (
          <>
            {text.slice(0, at)}
            <span
              key={highlight}
              style={{
                backgroundImage: SWEEP,
                backgroundRepeat: "no-repeat",
                backgroundSize: "100% 100%",
                borderRadius: 4,
                padding: "1px 2px",
                color: "#0f3b27",
                fontWeight: 500,
                animation: "tc-sweep .9s cubic-bezier(.3,.8,.3,1) both",
              }}
            >
              {highlight}
            </span>
            {text.slice(at + (highlight as string).length)}
          </>
        ) : (
          text
        )}
        {partial ? (
          <span style={{ color: "rgba(22,84,58,.55)" }}>
            {text ? " " : ""}
            {partial}
          </span>
        ) : null}
      </div>
      <StruckBand active={!!struck} />
    </div>
  );
}
