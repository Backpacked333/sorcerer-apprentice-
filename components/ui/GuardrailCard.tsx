import { QuoteCard } from "./QuoteCard";

const KIND: Record<string, string> = { limit: "Limit", exception: "Exception", escalation: "Stop and ask" };

export function GuardrailCard({ kind, text, quote, evidence }: { kind: string; text: string; quote?: { text: string; speaker: string; source?: string; t?: number; audioSrc?: string }; evidence?: string }) {
  return (
    <div className="rounded border border-line p-3">
      <span className="tag">{KIND[kind] ?? kind}</span>
      {evidence && <span className="tag ml-1">{evidence}</span>}
      <p className="mt-2 t-body">{text}</p>
      {quote && <div className="mt-2"><QuoteCard {...quote} /></div>}
    </div>
  );
}
