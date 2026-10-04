const KIND_WORD: Record<string, string> = {
  predict: "Before you decide",
  intervene: "Hold on",
  stop: "Stop and ask",
  praise: "Good",
  novel: "Not taught yet",
};

export interface TutorLine {
  word: string;
  message: string;
  quote?: string;
}

/** Predictions do not reveal the quote. Intervene, stop and praise do. */
export function tutorLine(d: { kind: string; message: string; quote?: string }): TutorLine {
  const show = d.kind === "intervene" || d.kind === "stop" || d.kind === "praise";
  return { word: KIND_WORD[d.kind] ?? d.kind, message: d.message, quote: show ? d.quote : undefined };
}

export function visibleRules<T extends { status: string }>(card: T[], presenter: boolean): { shown: T[]; hidden: number } {
  if (presenter) return { shown: card, hidden: 0 };
  const shown = card.filter((c) => c.status !== "untested");
  return { shown, hidden: card.length - shown.length };
}
