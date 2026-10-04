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

// ---------- WP4: floating teach companion (pure, tested in teachview.card.test.ts) ----------

/** The kinds `teachMood` understands. A guard verdict (`save_blocked`) is its own kind. */
export type TeachDecisionKind = "predict" | "intervene" | "stop" | "save-blocked" | "praise" | "novel" | "none";

export function teachKindOf(d?: { kind: string; guard?: boolean } | null): TeachDecisionKind {
  if (!d) return "none";
  if (d.guard) return "save-blocked";
  return (["predict", "intervene", "stop", "praise", "novel"] as const).find((k) => k === d.kind) ?? "none";
}

/** Invoice state fields → the sandbox ERP's `data-erp-target` hooks. */
const FIELD_TARGET: Record<string, string> = {
  costCenter: "cc",
  assetNumber: "asset",
  hasAssetNumber: "asset",
  route: "route",
  status: "status",
  amount: "amount",
  supplier: "vendor",
  description: "line",
};

/** The ERP field an event is about, as a `data-erp-target` key. Null when the event names no field. */
export function targetOfEvent(e?: { kind: string; field?: string } | null): string | null {
  if (!e) return null;
  switch (e.kind) {
    case "field_changed":
      return (e.field && FIELD_TARGET[e.field]) || null;
    case "route_changed":
      return "route";
    case "status_changed":
      return "status";
    case "save_clicked":
    case "save_intent":
    case "save_blocked":
      return "save";
    case "invoice_opened":
      return "vendor";
    default:
      return null;
  }
}

export function formatEuro(n: number): string {
  return n.toLocaleString("en-IE", { style: "currency", currency: "EUR" });
}

export interface TeachState {
  invoice?: string;
  supplier?: string;
  amount?: number;
  category?: string;
  costCenter?: string;
  status?: string;
}

/** Capsule line while the tutor watches: real invoice, supplier and amount only. */
export function watchingLine(learner: string, s?: TeachState | null): { title: string; sub: string } {
  const title = s?.invoice ? `Watching ${learner} · INV-${s.invoice}` : `Watching ${learner}`;
  const bits = [s?.supplier, s?.amount !== undefined ? formatEuro(s.amount) : undefined].filter(Boolean) as string[];
  const sub = s?.invoice ? (bits.length ? bits.join(" · ") : "Invoice open") : "Open the first invoice in your queue.";
  return { title, sub };
}

/** Sub line of the tutor card. "Not posted" only when the server guard actually held a save. */
export function teachSub(d: { guard?: boolean } | null | undefined, learner: string, expert: string): string {
  const who = `${learner}, learning from ${expert}`;
  return d?.guard ? `Not posted · ${who}` : who;
}

export function phaseLabel(phase: "coached" | "independent"): string {
  return phase === "independent" ? "On your own — the tutor stays quiet" : "Coached";
}

/** Learned chips: only rules exercised in this session, with the T3 labels unchanged. */
export function learnedChips(card: { ruleId: string; title: string; label: string; status: string }[]): { id: string; kind: "learned" | "practice"; text: string }[] {
  return card
    .filter((c) => c.status !== "untested")
    .map((c) => ({ id: c.ruleId, kind: c.status === "mastered" ? ("learned" as const) : ("practice" as const), text: `${c.title} · ${c.label}` }));
}

function mmssLocal(sec: number): string {
  const s = Math.max(0, Math.floor(Number.isFinite(sec) ? sec : 0));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

/** Replay caption: always a captured still (no video exists). */
export function replayCaption(expert: string, t?: number): string {
  return `Replay · ${expert}'s screen${t !== undefined ? ` · ${mmssLocal(t)}` : ""} · captured still`;
}

/** What the learner just did, from the event the decision reacted to (never invented). */
export function decisionContext(e: { kind: string; field?: string; to?: string } | null | undefined, learner: string, label: (f?: string) => string): string | null {
  if (!e || !e.to) return null;
  if (e.kind === "field_changed") return `${learner} set the ${label(e.field)} to ${e.to}`;
  if (e.kind === "route_changed") return `${learner} set the approval route to ${e.to}`;
  if (e.kind === "status_changed") return `${learner} set the status to ${e.to}`;
  return null;
}
