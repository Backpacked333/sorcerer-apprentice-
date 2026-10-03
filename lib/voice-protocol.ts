import { describeEvent, type ScreenEvent, type SessionLog } from "./events";
import type { InvoiceState } from "./workmap";

export type AgentSpeechKind = "agent" | "fallback" | "clip";

export interface AgentSpeechInterval {
  id?: string;
  start: number;
  end?: number;
  text: string;
  kind?: AgentSpeechKind;
}

export interface SpeechSegment {
  text: string;
  tStart: number;
  tEnd?: number;
}

export interface ClassifiedSegment {
  kind: "agent" | "mixed" | "human";
  /** Human-attributed text. Empty for agent audio. */
  text: string;
  interval?: AgentSpeechInterval;
}

/** Pure timeline used by the voice hub to distinguish agent audio from human speech. */
export class AgentSpeechTimeline {
  private readonly entries: AgentSpeechInterval[] = [];
  private nextId = 1;

  constructor(intervals: AgentSpeechInterval[] = []) {
    for (const interval of intervals) this.add(interval);
  }

  add(interval: AgentSpeechInterval): string {
    const id = interval.id ?? `speech_${this.nextId++}`;
    this.entries.push({ ...interval, id, kind: interval.kind ?? "agent" });
    this.entries.sort((a, b) => a.start - b.start);
    return id;
  }

  start(start: number, text: string, kind: AgentSpeechKind = "agent"): string {
    return this.add({ start, text, kind });
  }

  end(end: number, id?: string): void {
    const entry = id
      ? this.entries.find((candidate) => candidate.id === id)
      : [...this.entries].reverse().find((candidate) => candidate.end === undefined);
    if (entry) entry.end = Math.max(entry.start, end);
  }

  all(): readonly AgentSpeechInterval[] {
    return this.entries;
  }

  clear(before = Number.POSITIVE_INFINITY): void {
    for (let index = this.entries.length - 1; index >= 0; index -= 1) {
      const entry = this.entries[index];
      if (entry.end !== undefined && entry.end < before) this.entries.splice(index, 1);
    }
  }
}

interface Token {
  normalized: string;
  start: number;
  end: number;
}

const tokenDetails = (text: string): Token[] => {
  const tokens: Token[] = [];
  for (const match of text.matchAll(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu)) {
    const value = match[0];
    const start = match.index ?? 0;
    tokens.push({ normalized: value.toLocaleLowerCase().replaceAll("’", "'"), start, end: start + value.length });
  }
  return tokens;
};

const containment = (heard: Token[], spoken: Token[]): number => {
  if (heard.length === 0 || spoken.length === 0) return 0;
  const remaining = new Map<string, number>();
  for (const token of spoken) remaining.set(token.normalized, (remaining.get(token.normalized) ?? 0) + 1);
  let found = 0;
  for (const token of heard) {
    const count = remaining.get(token.normalized) ?? 0;
    if (count > 0) {
      found += 1;
      remaining.set(token.normalized, count - 1);
    }
  }
  return found / heard.length;
};

const leadingEchoLength = (heard: Token[], spoken: Token[]): number => {
  let count = 0;
  while (count < heard.length && count < spoken.length && heard[count].normalized === spoken[count].normalized) count += 1;
  return count;
};

const stripLeadingTokens = (text: string, tokens: Token[], count: number): string => {
  if (count <= 0) return text.trim();
  if (count >= tokens.length) return "";
  return text.slice(tokens[count].start).trim();
};

const overlapsHalfOpen = (segment: SpeechSegment, start: number, end: number): boolean =>
  segment.tEnd === undefined ? segment.tStart >= start && segment.tStart < end : segment.tStart < end && segment.tEnd > start;

export function classifySegment(segment: SpeechSegment, timeline: AgentSpeechTimeline | readonly AgentSpeechInterval[]): ClassifiedSegment {
  const intervals = timeline instanceof AgentSpeechTimeline ? timeline.all() : timeline;
  const heard = tokenDetails(segment.text);

  for (let index = intervals.length - 1; index >= 0; index -= 1) {
    const interval = intervals[index];
    const end = interval.end ?? Number.POSITIVE_INFINITY;
    const inside = overlapsHalfOpen(segment, interval.start - 0.2, end + 0.8);
    if (interval.kind === "clip") {
      if (overlapsHalfOpen(segment, interval.start, end)) return { kind: "agent", text: "", interval };
      continue;
    }

    const spoken = tokenDetails(interval.text);
    const overlap = containment(heard, spoken);
    if (inside) {
      const leading = leadingEchoLength(heard, spoken);
      if (spoken.length > 0 && leading === spoken.length) {
        const humanText = stripLeadingTokens(segment.text, heard, leading);
        return tokenDetails(humanText).length >= 2
          ? { kind: "mixed", text: humanText, interval }
          : { kind: "agent", text: "", interval };
      }
      if (overlap >= 0.6) return { kind: "agent", text: "", interval };
    }

    const late = interval.end !== undefined && segment.tStart > interval.end + 0.8 && segment.tStart <= interval.end + 4;
    if (late && overlap >= 0.8) return { kind: "agent", text: "", interval };
  }

  return { kind: "human", text: segment.text.trim() };
}

export type VoiceCommand = "off_record" | "pause" | "not_now";

const words = (text: string) => tokenDetails(text).map((token) => token.normalized);

export function detectCommand(text: string): VoiceCommand | null {
  const normalized = text.toLocaleLowerCase().replaceAll("’", "'").replace(/[^\p{L}\p{N}']+/gu, " ").trim();
  if (!normalized) return null;

  const commandPrefix = "(?:(?:actually|please|wait|no) )?";
  const offRecord = new RegExp(
    `^${commandPrefix}(?:off the record|(?:scratch|strike) that(?: last (?:point|answer|explanation|part))?|(?:don't|do not) keep that|forget (?:that|what i (?:just )?said))$`,
  );
  if (offRecord.test(normalized)) {
    return "off_record";
  }

  const count = words(normalized).length;
  if (count <= 5 && /^(?:pause(?: listening| recording| capture)?|tacit pause|stop listening)$/.test(normalized)) return "pause";
  if (count <= 4 && /^(?:not now|not right now|later|ask me later|skip (?:that|it))$/.test(normalized)) return "not_now";
  return null;
}

export type Confirmation = "yes" | "correction" | "unclear";

export function classifyConfirmation(text: string): Confirmation {
  const normalized = words(text).join(" ");
  if (!normalized) return "unclear";
  const correction = /\b(?:but|except|not|no|only|actually|instead|wrong)\b/.test(normalized);
  const affirmation = /^(?:yes|yeah|yep|correct|right|exactly|that's right|that is right)\b/.test(normalized);
  if (affirmation && !correction) return "yes";
  if (correction) return "correction";
  return "unclear";
}

/** Noise-resistant partial gating. Final commits always count at the caller. */
export function countsAsSpeech(previousPartial: string, partial: string): boolean {
  const current = partial.trim();
  if (words(current).length >= 2) return true;
  return Math.max(0, current.length - previousPartial.trim().length) >= 6;
}

export interface AskCandidate {
  question: string;
  questionRetro?: string;
  stepRef: string;
  kind: string;
}

export interface AskContext {
  events?: Array<string | ScreenEvent>;
  labels?: Record<string, string> | Array<{ code: string; label: string }>;
  lastExpertSentence?: string;
  retro?: boolean;
  followup?: boolean;
  phrase?: "natural" | "exact";
}

/** Reversible escaping for dynamic tag fields; prevents them from creating new ` | key=value` segments. */
const serializeDynamic = (value: string) =>
  value.replaceAll("\\", "\\\\").replaceAll("\r", "\\r").replaceAll("\n", "\\n").replaceAll("|", "\\|");
const quoted = (value: string) => serializeDynamic(value).replaceAll('"', '\\"');
const quotedVerbatim = (value: string) => value.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
const firstWords = (value: string, limit: number) => value.trim().split(/\s+/u).filter(Boolean).slice(0, limit).join(" ");

const labelPairs = (labels: AskContext["labels"]): string[] => {
  if (!labels) return [];
  return Array.isArray(labels)
    ? labels.map(({ code, label }) => `${serializeDynamic(code)}=${serializeDynamic(label)}`)
    : Object.entries(labels).map(([code, label]) => `${serializeDynamic(code)}=${serializeDynamic(label)}`);
};

export function buildAsk(candidate: AskCandidate, context: AskContext = {}): string {
  const retro = context.retro ?? false;
  const question = retro && candidate.questionRetro ? candidate.questionRetro : candidate.question;
  const events = (context.events ?? []).slice(-3).map((event) => (typeof event === "string" ? event : describeEvent(event)));
  const labels = labelPairs(context.labels);
  return [
    serializeDynamic(question),
    `stepRef=${serializeDynamic(candidate.stepRef)}`,
    `kind=${serializeDynamic(candidate.kind)}`,
    `on screen: ${events.map(serializeDynamic).join("; ")}`,
    `labels: ${labels.join("; ")}`,
    `said: "${quoted(firstWords(context.lastExpertSentence ?? "", 20))}"`,
    `retro=${retro ? 1 : 0}`,
    `followup=${context.followup ? 1 : 0}`,
    `phrase=${context.phrase ?? "natural"}`,
  ].join(" | ");
}

export interface TutorPayloadOptions {
  message: string;
  quote?: string;
  stepId?: string;
  ruleId?: string;
  ruleTitle?: string;
  who?: string;
  clip?: boolean;
}

export function buildTutorPayload(options: TutorPayloadOptions): string {
  const segments = [serializeDynamic(options.message)];
  if (options.quote !== undefined) segments.push(`expert's words: "${quoted(options.quote)}"`);
  if (options.stepId !== undefined) segments.push(`stepId=${serializeDynamic(options.stepId)}`);
  if (options.ruleId !== undefined) segments.push(`ruleId=${serializeDynamic(options.ruleId)}`);
  if (options.ruleTitle !== undefined) segments.push(`rule: ${serializeDynamic(options.ruleTitle)}`);
  if (options.who !== undefined) segments.push(`who=${serializeDynamic(options.who)}`);
  if (options.clip !== undefined) segments.push(`clip=${options.clip ? "yes" : "no"}`);
  return segments.join(" | ");
}

export function chunk(text: string, maxChars: number): string[] {
  if (!Number.isFinite(maxChars) || maxChars < 1) throw new RangeError("maxChars must be a positive number");
  const clean = text.trim();
  if (!clean) return [];
  const output: string[] = [];
  let remaining = clean;
  while (remaining.length > maxChars) {
    const candidate = remaining.slice(0, maxChars + 1);
    const boundary = Math.max(candidate.lastIndexOf("\n"), candidate.lastIndexOf(" "));
    let take = boundary > 0 && boundary <= maxChars ? boundary : maxChars;
    const before = remaining.charCodeAt(take - 1);
    const after = remaining.charCodeAt(take);
    if (before >= 0xd800 && before <= 0xdbff && after >= 0xdc00 && after <= 0xdfff) take -= 1;
    if (take === 0) take = remaining.codePointAt(0)! > 0xffff ? 2 : 1;
    output.push(remaining.slice(0, take).trim());
    remaining = remaining.slice(take).trimStart();
  }
  if (remaining) output.push(remaining);
  return output;
}

type VisibleState = Pick<InvoiceState, "supplier" | "route">;
type VisibleLabels = string[] | Array<{ label: string }> | Record<string, string>;

export function keytermsFrom(states: VisibleState[], labels: VisibleLabels = []): string[] {
  const candidates: string[] = [];
  for (const state of states) {
    const supplier = state.supplier?.trim();
    if (!supplier) continue;
    const first = supplier.split(/\s+/u)[0];
    candidates.push(first);
    if (supplier.length <= 20) candidates.push(supplier);
  }
  if (Array.isArray(labels)) {
    for (const label of labels) candidates.push(typeof label === "string" ? label : label.label);
  } else {
    candidates.push(...Object.values(labels));
  }

  const seen = new Set<string>();
  const terms: string[] = [];
  for (const candidate of candidates) {
    const term = candidate.trim();
    const key = term.toLocaleLowerCase();
    if (!term || term.length > 20 || seen.has(key)) continue;
    seen.add(key);
    terms.push(term);
    if (terms.length === 50) break;
  }
  return terms;
}

interface DeferredQuestion {
  kind: string;
  question: string;
  stepRef: string;
}

type CaptureSession = SessionLog & { deferred?: DeferredQuestion[] };

const controlPrefix = /^\s*\[[A-Z][A-Z_]*(?:\s+[^\]]*)?\]/;
const withoutControlTags = (text: string) => text.replace(/\[[A-Z][A-Z_]*(?:\s+[^\]]*)?\]\s*/g, "").trim();

const excerptWords = (text: string, limit: number): string => {
  const matches = [...text.matchAll(/\S+/gu)];
  if (matches.length === 0) return "";
  const last = matches[Math.min(limit, matches.length) - 1];
  return text.slice(matches[0].index, (last.index ?? 0) + last[0].length);
};

export function buildCaptureSummary(session: CaptureSession, maxChars = 1200): string {
  if (!Number.isFinite(maxChars) || maxChars < 1) throw new RangeError("maxChars must be a positive number");
  const byInvoice = new Map<string, string[]>();
  const add = (invoice: string, line: string) => {
    const lines = byInvoice.get(invoice) ?? [];
    lines.push(line);
    byInvoice.set(invoice, lines);
  };

  for (const event of session.events) {
    if (event.redacted) continue;
    add(event.invoice ?? "unassigned", `seen: ${describeEvent(event)}`);
  }
  for (const window of session.windows) {
    if (window.outcome === "off_record") continue;
    const invoice = window.stepRef?.split(":", 1)[0] || "unassigned";
    const answer = window.answerText && !controlPrefix.test(window.answerText) ? excerptWords(window.answerText, 12) : "";
    add(invoice, `asked (${window.kind}): ${withoutControlTags(window.question)} — ${answer ? `answered: "${quotedVerbatim(answer)}"` : "unanswered"}`);
  }
  for (const deferred of session.deferred ?? []) {
    const invoice = deferred.stepRef.split(":", 1)[0] || "unassigned";
    add(invoice, `deferred (${deferred.kind}): ${withoutControlTags(deferred.question)}`);
  }

  const lines = ["[CAPTURE SUMMARY]"];
  for (const [invoice, details] of byInvoice) {
    lines.push(`Item ${invoice}`);
    lines.push(...details.map((detail) => `- ${detail}`));
  }
  const summary = lines.join("\n");
  if (summary.length <= maxChars) return summary;
  if (maxChars <= 1) return summary.slice(0, maxChars);
  return `${summary.slice(0, maxChars - 1).trimEnd()}…`;
}
