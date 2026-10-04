import { QuoteCard } from "./QuoteCard";
import { Tag, type TagTone } from "./Tag";

const KIND: Record<string, string> = { limit: "Limit", exception: "Exception", escalation: "Stop and ask" };
// Red only for "Stop and ask" (a stop); limits amber, exceptions violet.
const TONE: Record<string, TagTone> = { limit: "amber", exception: "violet", escalation: "red" };

export function GuardrailCard({ kind, text, quote, evidence }: { kind: string; text: string; quote?: { text: string; speaker: string; source?: string; t?: number; audioSrc?: string }; evidence?: string }) {
  return (
    <div
      className="p-3"
      style={{ borderRadius: 18, background: "linear-gradient(180deg,rgba(255,255,255,.75),rgba(255,255,255,.5))", boxShadow: "inset 0 1px 0 #fff, 0 0 0 .5px rgba(0,0,0,.07)" }}
    >
      <div className="flex flex-wrap items-center gap-1">
        <Tag tone={TONE[kind] ?? "neutral"} dot>{KIND[kind] ?? kind}</Tag>
        {evidence && <Tag>{evidence}</Tag>}
      </div>
      <p className="mt-2 text-[15px] leading-[1.5] text-[#1d1d1f]">{text}</p>
      {quote && <div className="mt-1"><QuoteCard {...quote} /></div>}
    </div>
  );
}
