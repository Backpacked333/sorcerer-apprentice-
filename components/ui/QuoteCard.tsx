import { Tag } from "./Tag";

/** Renders `text` verbatim inside curly quotes: only literal Quote.text belongs here (non-negotiable #2). */
export function QuoteCard({ text, speaker, source, t, audioSrc, translation, evidence }: { text: string; speaker: string; source?: string; t?: number; audioSrc?: string; translation?: string; evidence?: string }) {
  return (
    <blockquote
      className="quote-card"
      style={{ margin: "8px 0 0", padding: "10px 12px 10px 14px", borderLeft: 0, borderRadius: 16, position: "relative", background: "rgba(255,255,255,.55)", boxShadow: "inset 0 1px 0 #fff, inset 0 0 0 .5px rgba(0,0,0,.06)" }}
    >
      <span aria-hidden style={{ position: "absolute", left: 0, top: 10, bottom: 10, width: 2.5, borderRadius: 2, background: "linear-gradient(180deg,#ffd27a,#f5a623)" }} />
      <p className="text-[15px] font-medium leading-[1.45] text-[#1d1d1f]">“{text}”</p>
      <p className="mt-1 text-[12px] text-[#6e6e73]">
        {speaker}
        {source ? ` · ${source}` : ""}
        {t != null ? ` · ${t.toFixed(0)} s` : ""}
      </p>
      {translation && <p className="mt-0.5 text-[12px] text-[#6e6e73]">{translation}</p>}
      {evidence && <span className="mt-1.5 inline-block"><Tag>{evidence}</Tag></span>}
      {audioSrc && <audio className="mt-2 w-full" controls src={audioSrc} />}
    </blockquote>
  );
}
