import { CandidateQueue, type Candidate } from "./curiosity";
import { Governor, type OpenWindow, type Signals } from "./governor";
import { redactText } from "./redact";
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

const loggedFields = (result: TurnResult): MappedWindowOutcome["logged"] => {
  if (result.tool?.name !== "log_answer") return undefined;
  const stringParam = (name: string) => (typeof result.tool?.params[name] === "string" ? (result.tool.params[name] as string) : undefined);
  const logged = { reason: stringParam("reason"), guardrail: stringParam("guardrail"), kind: stringParam("kind") };
  return Object.values(logged).some((value) => value !== undefined) ? logged : undefined;
};

/** Pure WA-4 lifecycle mapping. Callers apply the returned window, candidate and governor effects. */
export function windowOutcome(result: TurnResult): MappedWindowOutcome {
  const retryAfter = result.closedAt + 6;
  if (result.via === "tool" && result.heard.trim()) {
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
  if ((result.via === "scribe" || result.via === "typed") && result.heard.trim()) {
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

  next(signals: LoopSignals): LoopAction {
    this.queue.expire(signals.now, signals.currentInvoice);
    if (signals.paused) return { type: "wait", reasons: ["paused"] };
    if (!signals.sttHealthy || signals.transcriberHealthy === false) return { type: "wait", reasons: ["transcriber unavailable"] };

    if (this.pendingWhy && !this.chainedParents.has(this.pendingWhy.id)) {
      const withinGrace = this.isCurrentOrGrace(this.pendingWhy, signals);
      const allowedByCount = this.chained < this.maxChained || this.mustChain.has(this.pendingWhy.id);
      if (withinGrace && allowedByCount && this.governor.canChain(signals)) {
        const sibling = this.bestSibling(this.pendingWhy.id, signals.now);
        if (sibling) {
          this.chained += 1;
          this.chainedParents.add(this.pendingWhy.id);
          this.pendingWhy = undefined;
          this.pendingSince = Number.NEGATIVE_INFINITY;
          return {
            type: "open",
            candidate: sibling,
            retro: sibling.invoice !== undefined && sibling.invoice !== signals.currentInvoice,
            followup: true,
            forced: this.mustChain.delete(sibling.parentId ?? ""),
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
    const candidate = this.queue.pick(forced, signals.now);
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

  opened(candidate: Candidate, now: number): OpenWindow {
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
      this.queue.markFilled(candidate.id, "window", heard);
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
      .filter((candidate) => candidate.filledBy === "narration" && candidate.heardQuote && candidate.heardAt !== undefined)
      .map((candidate) => ({ stepRef: candidate.stepRef, quote: candidate.heardQuote!, t: candidate.heardAt! }));
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
