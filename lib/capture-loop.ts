import { CandidateQueue, extractThresholds, newContext, observe, type Candidate, type CuriosityContext } from "./curiosity";
import { Governor, type OpenWindow, type Signals } from "./governor";
import { redactText } from "./redact";
import type { QuestionWindow, SessionLog } from "./events";
import type { TurnResult } from "./voice-turn";

export interface LoopSignals extends Signals {
  currentInvoice?: string;
  sttHealthy: boolean;
  paused: boolean;
}

export type LoopAction =
  | { type: "open"; candidate: Candidate; retro: boolean; followup: boolean; forced: boolean }
  | { type: "wait"; reasons: string[] };

export interface MappedWindowOutcome {
  outcome: "answered" | "timeout" | "aborted" | "off_record" | "remove";
  closedBy?: "tool" | "scribe_fallback" | "timeout" | "user";
  answerText?: string;
  answerAudioId?: string;
  logged?: { reason?: string; guardrail?: string; kind?: string };
  candidateStatus: Candidate["status"];
  filledBy?: Candidate["filledBy"];
  userDeferred?: boolean;
  retryAfter?: number;
  governor: "close" | "short_close" | "abort";
  strike?: boolean;
}

/** During a question, a commit is answer evidence only after the listening gate opened. */
export function turnCommitEvidenceEligible(window: QuestionWindow | undefined, committedAt: number): boolean {
  if (!window) return true;
  return window.askedAt !== undefined && committedAt >= window.askedAt;
}

const loggedFields = (result: TurnResult): MappedWindowOutcome["logged"] => {
  if (result.tool?.name !== "log_answer") return undefined;
  const stringParam = (name: string) => (typeof result.tool?.params[name] === "string" ? (result.tool.params[name] as string) : undefined);
  const logged = { reason: stringParam("reason"), guardrail: stringParam("guardrail"), kind: stringParam("kind") };
  return Object.values(logged).some((value) => value !== undefined) ? logged : undefined;
};

/** Pure WA-4 lifecycle mapping. Callers apply the returned window, candidate and governor effects. */
export function windowOutcome(result: TurnResult): MappedWindowOutcome {
  const retryAfter = result.closedAt + 6;
  const answerClockIsValid = result.answeredAt !== undefined && result.answeredAt >= result.askedAt;
  if (result.via === "tool" && result.heard.trim() && answerClockIsValid) {
    return {
      outcome: "answered",
      closedBy: "tool",
      answerText: redactText(result.heard).text,
      ...(result.audioId ? { answerAudioId: result.audioId } : {}),
      ...(loggedFields(result) ? { logged: loggedFields(result) } : {}),
      candidateStatus: "filled",
      filledBy: "window",
      governor: "close",
    };
  }
  if ((result.via === "scribe" || result.via === "typed") && result.heard.trim() && answerClockIsValid) {
    return {
      outcome: "answered",
      closedBy: result.via === "scribe" ? "scribe_fallback" : "user",
      answerText: redactText(result.heard).text,
      ...(result.audioId ? { answerAudioId: result.audioId } : {}),
      candidateStatus: "filled",
      filledBy: "window",
      governor: "close",
    };
  }
  if (result.via === "tool") {
    return {
      outcome: "answered",
      closedBy: "tool",
      answerText: "",
      ...(loggedFields(result) ? { logged: loggedFields(result) } : {}),
      candidateStatus: "debrief",
      governor: "close",
    };
  }
  if (result.via === "timeout") {
    return { outcome: "timeout", closedBy: "timeout", candidateStatus: "debrief", governor: "close" };
  }
  if (result.via === "aborted" && result.command === "off_record") {
    return { outcome: "off_record", candidateStatus: "expired", governor: "short_close", strike: true };
  }
  if (result.via === "aborted" && (result.command === "not_now" || result.abortReason === "user")) {
    return { outcome: "aborted", closedBy: "user", candidateStatus: "debrief", userDeferred: true, governor: "short_close" };
  }
  if (result.via === "aborted" && (result.abortReason === "paused" || result.abortReason === "disconnected")) {
    return { outcome: "aborted", candidateStatus: "queued", retryAfter, governor: "short_close" };
  }
  if (result.via === "aborted" && !result.spoke) {
    return { outcome: "remove", candidateStatus: "queued", retryAfter, governor: "abort" };
  }
  return { outcome: "aborted", candidateStatus: "debrief", governor: "short_close" };
}

/** Find the closed window a late log_answer may safely enrich without touching the active replacement. */
export function findLateAnswerWindow(windows: QuestionWindow[], stepRef: string, now: number, maxAgeSecs = 15): QuestionWindow | undefined {
  return windows
    .filter(
      (window) =>
        window.stepRef === stepRef &&
        window.closedAt !== undefined &&
        now - window.closedAt >= 0 &&
        now - window.closedAt <= maxAgeSecs &&
        window.outcome !== "aborted" &&
        window.outcome !== "off_record",
    )
    .sort((left, right) => (right.closedAt ?? Number.NEGATIVE_INFINITY) - (left.closedAt ?? Number.NEGATIVE_INFINITY))[0];
}

const TOOL_WINDOW_SEPARATOR = "::window:";

/** Correlate an agent tool call to one exact Capture turn while preserving the canonical stepRef separately. */
export function captureToolStepRef(stepRef: string, windowId: string): string {
  return `${stepRef}${TOOL_WINDOW_SEPARATOR}${windowId}`;
}

export function captureAnswerToolRejection(active: QuestionWindow | undefined, stepRef: unknown): { dispatch: false; message: string } | undefined {
  if (!active || active.outcome || active.closedAt !== undefined) {
    return { dispatch: false, message: "not_logged: no active question. Do not retry or claim the answer was saved." };
  }
  const currentRef = captureToolStepRef(active.stepRef ?? "", active.id);
  if (stepRef === currentRef) return;
  return {
    dispatch: false,
    message: `not_logged: stale or missing question reference. The current question is ${JSON.stringify(active.question)}; stepRef=${currentRef}. Retry only if the expert's latest answer belongs to this current question. Never move an older answer to it. Do not claim it was saved.`,
  };
}

export function parseCaptureToolStepRef(value: string): { stepRef: string; windowId?: string } {
  const separatorAt = value.lastIndexOf(TOOL_WINDOW_SEPARATOR);
  if (separatorAt < 0) return { stepRef: value };
  const stepRef = value.slice(0, separatorAt);
  const windowId = value.slice(separatorAt + TOOL_WINDOW_SEPARATOR.length);
  return stepRef && windowId ? { stepRef, windowId } : { stepRef: value };
}

/** Keep voice.tsx's eventual TOOL event away from a different turn generation. */
export async function awaitReplacementBeforeToolDispatch(
  activeWindowId: string | undefined,
  toolWindowId: string | undefined,
  replacement: Promise<unknown> | null,
): Promise<void> {
  if (!activeWindowId || activeWindowId === toolWindowId || !replacement) return;
  await replacement.catch(() => undefined);
}

/** A struck turn was already redacted before its async result arrived. */
export function shouldPersistAgentSpokenText(mapped: MappedWindowOutcome): boolean {
  return mapped.outcome !== "off_record" && !mapped.strike;
}

const LIMIT_ANSWER = /\b(only|every|always|never|unless|except|over|above|under|below|more than|less than|at least|up to)\b/i;
const WHO_ANSWER = /\b(ask|check with|sign|approv\w*|releas\w*|decid\w*)\b/i;
const STOP_ANSWER = /\b(stop|wait|hold off|check with|ask)\b/i;

export class CaptureLoop {
  private readonly graceSecs: number;
  private readonly maxChained: number;
  private pendingWhy: Candidate | undefined;
  private pendingSince = Number.NEGATIVE_INFINITY;
  private mustChain = new Set<string>();
  private chainedParents = new Set<string>();
  private chained = 0;

  constructor(
    readonly governor: Governor,
    readonly queue: CandidateQueue,
    config: { graceSecs?: number; maxChained?: number } = {},
  ) {
    this.graceSecs = config.graceSecs ?? queue.graceSecs;
    this.maxChained = config.maxChained ?? governor.config.maxChained ?? 2;
  }

  next(signals: LoopSignals, preferredId?: string): LoopAction {
    this.queue.expire(signals.now, signals.currentInvoice);
    if (signals.paused) return { type: "wait", reasons: ["paused"] };
    if (!signals.sttHealthy || signals.transcriberHealthy === false) return { type: "wait", reasons: ["transcriber unavailable"] };

    if (this.pendingWhy && !this.chainedParents.has(this.pendingWhy.id)) {
      const withinGrace = this.isCurrentOrGrace(this.pendingWhy, signals);
      const allowedByCount = this.chained < this.maxChained || this.mustChain.has(this.pendingWhy.id);
      if (withinGrace && allowedByCount && this.governor.canChain(signals)) {
        const sibling = this.bestSibling(this.pendingWhy.id, signals.now);
        if (sibling) {
          return {
            type: "open",
            candidate: sibling,
            retro: sibling.invoice !== undefined && sibling.invoice !== signals.currentInvoice,
            followup: true,
            forced: this.mustChain.has(sibling.parentId ?? ""),
          };
        }
      }
      const chainWindow = this.governor.config.chainWindowSecs ?? 0;
      if (!withinGrace || signals.now - this.pendingSince > chainWindow) {
        this.pendingWhy = undefined;
        this.pendingSince = Number.NEGATIVE_INFINITY;
      }
    }

    const forced = this.queue.windowsAsked >= 2 && !this.queue.guardrailAsked;
    const candidate = this.queue.pick(forced, signals.now, 3, preferredId, (candidate) =>
      this.governor.canOpen(signals, candidate.value - (candidate.leftAt === undefined ? 0 : 0.1)));
    if (!candidate) return { type: "wait", reasons: ["no ready question"] };
    const value = candidate.value - (candidate.leftAt === undefined ? 0 : 0.1);
    if (!this.governor.canOpen(signals, value)) return { type: "wait", reasons: this.governor.evaluate(signals).reasons };
    if (forced && !candidate.guardrail) this.mustChain.add(candidate.id);
    return {
      type: "open",
      candidate,
      retro: candidate.invoice !== undefined && candidate.invoice !== signals.currentInvoice,
      followup: false,
      forced,
    };
  }

  /** Revalidate the selected action against the newest activity snapshot immediately before opening it. */
  isFresh(action: Extract<LoopAction, { type: "open" }>, signals: LoopSignals): boolean {
    this.queue.expire(signals.now, signals.currentInvoice);
    const candidate = action.candidate;
    if (signals.paused || !signals.sttHealthy || signals.transcriberHealthy === false) return false;
    if (candidate.status !== "queued" || (candidate.retryAfter !== undefined && candidate.retryAfter > signals.now)) return false;
    if (!this.isCurrentOrGrace(candidate, signals)) return false;
    if (action.followup) return this.governor.canChain(signals);
    const value = candidate.value - (candidate.leftAt === undefined ? 0 : 0.1);
    return this.governor.canOpen(signals, value);
  }

  opened(candidate: Candidate, now: number): OpenWindow {
    if (candidate.parentId && this.pendingWhy?.id === candidate.parentId) {
      this.chained += 1;
      this.chainedParents.add(candidate.parentId);
      this.mustChain.delete(candidate.parentId);
      this.pendingWhy = undefined;
      this.pendingSince = Number.NEGATIVE_INFINITY;
    }
    this.queue.markAsked(candidate.id);
    return this.governor.open(candidate.id, now);
  }

  closed(result: {
    candidate: Candidate;
    outcome: "answered" | "timeout" | "unspoken" | "deferred" | "off_record";
    heard: string;
    now: number;
  }): void {
    const { candidate, outcome, heard, now } = result;
    if (outcome === "unspoken") {
      candidate.status = "queued";
      candidate.retryAfter = now + 6;
      this.governor.abort();
      return;
    }

    if (outcome === "answered" && heard.trim()) {
      this.queue.markFilled(candidate.id, "window", heard, now);
      this.governor.markAnswered(now);
      this.governor.close(now);
      if (candidate.kind === "why" && !this.chainedParents.has(candidate.id)) {
        this.fillCoveredSiblings(candidate.id, heard);
        if (this.bestSibling(candidate.id, now)) {
          this.pendingWhy = candidate;
          this.pendingSince = now;
        }
      }
      return;
    }

    if (outcome === "off_record") {
      candidate.status = "expired";
      this.governor.closeWith(now, { cooldownSecs: this.governor.config.abortCooldownSecs ?? 8, refund: true });
      return;
    }
    candidate.status = "debrief";
    if (outcome === "deferred") candidate.userDeferred = true;
    this.governor.close(now);
  }

  /** Apply the exact candidate and governor effects produced by windowOutcome. */
  applyOutcome(candidate: Candidate, mapped: MappedWindowOutcome, now: number): void {
    if (mapped.candidateStatus === "filled" && mapped.answerText?.trim()) {
      this.closed({ candidate, outcome: "answered", heard: mapped.answerText, now });
      return;
    }

    candidate.status = mapped.candidateStatus;
    candidate.filledBy = mapped.filledBy;
    candidate.userDeferred = mapped.userDeferred;
    candidate.retryAfter = mapped.retryAfter;

    if (mapped.governor === "abort") {
      this.governor.abort();
      return;
    }
    if (mapped.governor === "short_close") {
      this.governor.closeWith(now, { cooldownSecs: this.governor.config.abortCooldownSecs ?? 8, refund: true });
      return;
    }
    this.governor.close(now);
  }

  deferred(): { kind: string; question: string; stepRef: string }[] {
    const unresolved = (candidate: Candidate) => candidate.status === "queued" || candidate.status === "debrief" || candidate.status === "asked";
    const userDeferred = this.queue.items.filter((candidate) => unresolved(candidate) && candidate.userDeferred);
    const siblings = this.queue.items.filter((candidate) => {
      if (!unresolved(candidate) || !candidate.parentId || candidate.userDeferred) return false;
      const parent = this.queue.items.find((item) => item.id === candidate.parentId);
      return parent?.kind === "why" && parent.status === "filled" && parent.filledBy === "window";
    });
    const whys = this.queue.items.filter((candidate) => unresolved(candidate) && candidate.kind === "why" && !candidate.userDeferred);
    const seen = new Set<string>();
    return [...userDeferred, ...siblings, ...whys]
      .filter((candidate) => {
        const key = `${candidate.kind}\u0000${candidate.question}\u0000${candidate.stepRef}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 12)
      .map(({ kind, question, stepRef }) => ({ kind, question, stepRef }));
  }

  get reasonHeard(): { stepRef: string; quote: string; t: number }[] {
    return this.queue.items
      .filter((candidate) => candidate.status === "filled" && candidate.filledBy === "narration" && candidate.heardQuote && candidate.heardAt !== undefined)
      .map((candidate) => ({ stepRef: candidate.stepRef, quote: candidate.heardQuote!, t: candidate.heardAt! }));
  }

  withdrawEvidence(from: number, to: number, candidateIds: string[]): void {
    const affected = new Set(candidateIds);
    for (const candidate of this.queue.items) {
      if ((candidate.createdAt >= from && candidate.createdAt <= to) ||
          (candidate.heardAt !== undefined && candidate.heardAt >= from && candidate.heardAt <= to)) affected.add(candidate.id);
    }
    for (const candidate of this.queue.items) {
      const dependsOnAnswer = candidate.parentId && affected.has(candidate.parentId) && candidate.filledBy !== "window" && candidate.filledBy !== "narration";
      if (!affected.has(candidate.id) && !dependsOnAnswer) continue;
      candidate.status = "expired";
      candidate.filledBy = undefined;
      candidate.heardQuote = undefined;
      candidate.heardAt = undefined;
      candidate.userDeferred = undefined;
      candidate.retryAfter = undefined;
      this.mustChain.delete(candidate.id);
      this.chainedParents.delete(candidate.id);
    }
    if (this.pendingWhy && affected.has(this.pendingWhy.id)) {
      this.pendingWhy = undefined;
      this.pendingSince = Number.NEGATIVE_INFINITY;
    }
  }

  get chainedCount(): number {
    return this.chained;
  }

  private bestSibling(parentId: string, now: number): Candidate | undefined {
    return this.queue.items
      .filter(
        (candidate) =>
          candidate.parentId === parentId &&
          candidate.status === "queued" &&
          (candidate.retryAfter === undefined || candidate.retryAfter <= now),
      )
      .sort((left, right) => right.value - left.value)[0];
  }

  private fillCoveredSiblings(parentId: string, answer: string): void {
    for (const sibling of this.queue.items.filter((candidate) => candidate.parentId === parentId && candidate.status === "queued")) {
      const covered =
        ((sibling.kind === "limit" || sibling.kind === "counterfactual") && LIMIT_ANSWER.test(answer)) ||
        (sibling.kind === "who" && WHO_ANSWER.test(answer)) ||
        (sibling.kind === "stop" && STOP_ANSWER.test(answer));
      if (covered) this.queue.markFilled(sibling.id, "answer", answer);
    }
  }

  private isCurrentOrGrace(candidate: Candidate, signals: LoopSignals): boolean {
    if (!candidate.invoice || candidate.invoice === signals.currentInvoice) return true;
    return candidate.leftAt !== undefined && signals.now - candidate.leftAt <= this.graceSecs;
  }
}

export function captureEvidenceIsOffRecord(ranges: SessionLog["offRecord"], start: number, end = start): boolean {
  return ranges.some(({ from, to }) => start <= to && end >= from);
}

export function redactCaptureRange(session: SessionLog, loop: CaptureLoop, context: CuriosityContext, from: number, to: number): void {
  const range = [{ from, to }];
  for (const segment of session.transcript) {
    if (captureEvidenceIsOffRecord(range, segment.t, segment.tEnd)) Object.assign(segment, { text: "", redacted: true });
  }
  for (const event of session.events) {
    if (captureEvidenceIsOffRecord(range, event.t)) Object.assign(event, { redacted: true, from: undefined, to: undefined, state: undefined });
  }
  session.frames = session.frames.filter((frame) => !captureEvidenceIsOffRecord(range, frame.t));
  for (const window of session.windows) {
    if (captureEvidenceIsOffRecord(range, window.openedAt, window.closedAt ?? to)) {
      Object.assign(window, { answerText: "", outcome: "off_record", logged: undefined, answerAudioId: undefined });
    }
  }
  loop.withdrawEvidence(from, to, session.windows.filter((window) => window.outcome === "off_record").map((window) => window.candidateId));
  session.deferred = loop.deferred();
  const labels = context.valueLabels;
  Object.assign(context, newContext(), { valueLabels: labels });
  for (const event of session.events) if (!event.redacted) observe(event, context);
  for (const segment of session.transcript) {
    if (segment.redacted || segment.speaker !== "expert") continue;
    for (const threshold of extractThresholds(segment.text)) if (!context.knownThresholds.includes(threshold)) context.knownThresholds.push(threshold);
  }
  const previous = session.offRecord.at(-1);
  if (previous && Math.abs(previous.from - from) < 0.01 && from <= previous.to + 2) previous.to = Math.max(previous.to, to);
  else session.offRecord.push({ from, to });
}
