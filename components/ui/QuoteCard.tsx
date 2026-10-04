export function QuoteCard({ text, speaker, source, t, audioSrc, translation, evidence }: { text: string; speaker: string; source?: string; t?: number; audioSrc?: string; translation?: string; evidence?: string }) {
  return (
    <blockquote className="quote-card">
      <p className="t-body">“{text}”</p>
      <p className="t-small text-muted">
        {speaker}
        {source ? ` · ${source}` : ""}
        {t != null ? ` · ${t.toFixed(0)} s` : ""}
      </p>
      {translation && <p className="t-small text-muted">{translation}</p>}
      {evidence && <span className="tag">{evidence}</span>}
      {audioSrc && <audio className="mt-2 w-full" controls src={audioSrc} />}
    </blockquote>
  );
}
