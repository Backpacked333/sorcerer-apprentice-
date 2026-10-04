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

export function frameSrc(frame?: { dataUrl?: string; url?: string } | null): string | undefined {
  if (!frame) return undefined;
  return frame.url || frame.dataUrl || undefined;
}

export function quoteSourceLabel(source?: string): string {
  if (source === "live") return "live answer";
  if (source === "narration") return "narration";
  if (source === "debrief") return "debrief";
  if (source === "counterfactual") return "what-if";
  return source ?? "";
}

// ---------- Work Map page (WP3): pure, render-ready strings from real map data ----------

/** Seconds → "mm:ss". Non-finite → "--:--". */
export function mmssOf(sec?: number | null): string {
  if (sec == null || !Number.isFinite(sec)) return "--:--";
  const s = Math.max(0, Math.floor(sec));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

type RailStep = {
  index: number;
  invoice?: string;
  judgment?: boolean;
  screenMoment: { t: number };
  action: { field: string; from?: string; to: string } | { type: string };
};

/** Rail sub line: "00:41 · 4711 → 0400" for a field change, "03:25 · INV-4473" otherwise, or just the time. */
export function railMeta(step: RailStep): string {
  const time = mmssOf(step.screenMoment.t);
  if ("field" in step.action) return `${time} · ${step.action.from || "empty"} → ${step.action.to}`;
  if (step.invoice) return `${time} · INV-${step.invoice}`;
  return time;
}

/** "10 steps · 3 judgment calls" for the rail header. */
export function railHeadline(steps: { judgment?: boolean }[]): string {
  const j = steps.filter((s) => s.judgment).length;
  return `${steps.length} step${steps.length === 1 ? "" : "s"} · ${j} judgment call${j === 1 ? "" : "s"}`;
}

/** "Step 6 of 10 · Judgment". */
export function stepHeading(step: { index: number; judgment?: boolean }, total: number): string {
  return `Step ${step.index + 1} of ${total}${step.judgment ? " · Judgment" : ""}`;
}

type SlotLike = { status: "open" | "filled" | "skipped"; filledBy?: { source?: string } | null };

/** Right-hand tag of an open-question row, from where the answer really came from. */
export function slotTag(slot: SlotLike): string {
  if (slot.status === "skipped") return "skipped";
  if (slot.status === "open") return "open";
  const src = slot.filledBy?.source;
  if (src === "debrief") return "answered in debrief";
  if (src === "live" || src === "narration" || src === "counterfactual") return "answered live";
  return "answered";
}

export function slotSegments(slots: SlotLike[]): ("filled" | "open" | "skipped")[] {
  return slots.map((s) => s.status);
}

/** Companion eyebrow while asking: "EXCEPTION · STEP 6" (step only when the slot names one). */
export function slotEyebrow(slot: { kind: string; stepId?: string }, steps: { id: string; index: number }[]): string {
  const step = slot.stepId ? steps.find((s) => s.id === slot.stepId) : undefined;
  return `${slot.kind.toUpperCase()}${step ? ` · STEP ${step.index + 1}` : ""}`;
}

/** Why the apprentice is asking, derived from the slot kind only (no invented context). */
export function slotSub(kind: string): string {
  if (kind === "novel") return "A case I haven't seen";
  if (kind === "limit" || kind === "escalation") return "A rule I'm unsure about";
  return "Not answered during the task";
}

/** Caption under a verbatim quote: "Sabine · said while working · 03:27". */
export function quoteCaption(name: string, quote: { source?: string; t?: number }): string {
  const label = quote.source === "narration" ? "said while working" : quote.source === "debrief" ? "in the debrief" : quoteSourceLabel(quote.source);
  return [name, label, quote.t != null ? mmssOf(quote.t) : ""].filter(Boolean).join(" · ");
}

export function splitSentences(text: string): string[] {
  return text.split(/(?<=[.?!])\s+/).map((x) => x.trim()).filter(Boolean);
}

/** Teach-back meta line. Counts only, never a percentage. */
export function teachbackMeta(tb: { text: string; sure: string[]; unsure: string[] }): string {
  const words = tb.text.trim().split(/\s+/).filter(Boolean).length;
  return `${words} words · about ${Math.round(words / 2.4)} s · ${tb.sure.length} confident · ${tb.unsure.length} unsure`;
}

/** Ids of slots that went from not-filled to filled between two snapshots (for the "understood" flash). */
export function newlyFilled(prev: { id: string; status: string }[], next: { id: string; status: string }[]): string[] {
  const before = new Map(prev.map((s) => [s.id, s.status]));
  return next.filter((s) => s.status === "filled" && before.has(s.id) && before.get(s.id) !== "filled").map((s) => s.id);
}
