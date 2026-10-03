export interface HeadlineInput {
  steps: { judgment?: boolean; guardrails?: unknown[] }[];
  canonical?: { steps: number; judgment: number; guardrails: number } | null;
}

export function headlineCounts(input: HeadlineInput): string {
  if (input.canonical) {
    const c = input.canonical;
    return `${c.steps} steps · ${c.judgment} judgment calls · ${c.guardrails} guardrails`;
  }
  const steps = input.steps.length;
  const judgment = input.steps.filter((s) => s.judgment).length;
  const guardrails = input.steps.reduce((n, s) => n + (s.guardrails?.length ?? 0), 0);
  return `${steps} recorded steps · ${judgment} judgment calls · ${guardrails} guardrails`;
}

export function evidenceBadge(quote?: { source?: string; evidence?: string } | null): "described" | "demonstrated" | undefined {
  if (!quote) return undefined;
  if (quote.evidence === "described" || quote.evidence === "demonstrated") return quote.evidence;
  return quote.source === "debrief" ? "described" : "demonstrated";
}

export function dedupeConfirmedBy(values: readonly string[]): string[] {
  return [...new Set(values)];
}

export function lowConfidenceLine(confidence?: string): string | null {
  return confidence === "low" ? "No quote backs this yet" : null;
}

export function frameSrc(frame?: { dataUrl: string; url?: string } | null): string | undefined {
  if (!frame) return undefined;
  return frame.url ?? frame.dataUrl;
}

export function quoteSourceLabel(source?: string): string {
  if (source === "live") return "live answer";
  if (source === "narration") return "narration";
  if (source === "debrief") return "debrief";
  if (source === "counterfactual") return "what-if";
  return source ?? "";
}
