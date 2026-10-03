/**
 * Engine 1: the governor. Decides WHEN the apprentice may speak.
 *
 * Runs as a 500 ms tick in the browser, but it is pure: feed it signals, read a decision.
 * The agent's microphone is muted whenever no window is open, so timing never depends on a prompt.
 */

export interface GovernorConfig {
  silenceSecs: number; // expert has not spoken for this long
  stillSecs: number; // screen has not changed for this long
  typingQuietSecs: number; // no typing-like diffs for this long
  cooldownSecs: number; // minimum gap between windows
  maxPer10Min: number; // live question budget
  boundaryBonusSecs: number; // a step boundary (save/close) makes the next N seconds a preferred pause
  windowTimeoutSecs: number; // give up waiting for an answer
  minValue: number; // candidate value needed to open a window
  warmupSecs: number; // no questions in the first seconds of a session: the expert is settling in
  readingSecs: number; // no questions right after an invoice opens: a still screen there means reading, not pausing
  abortCooldownSecs?: number;
  chainWindowSecs?: number;
  chainSilenceSecs?: number;
  maxChained?: number;
}

export const DEFAULT_GOVERNOR: GovernorConfig = {
  silenceSecs: 2.5,
  stillSecs: 2,
  typingQuietSecs: 3,
  cooldownSecs: 60,
  maxPer10Min: 5,
  boundaryBonusSecs: 8,
  windowTimeoutSecs: 20,
  minValue: 0.6,
  warmupSecs: 15,
  readingSecs: 8,
};

export const DEMO_GOVERNOR: GovernorConfig = {
  ...DEFAULT_GOVERNOR,
  cooldownSecs: 20,
  warmupSecs: 8,
  readingSecs: 5,
  abortCooldownSecs: 8,
  chainWindowSecs: 6,
  chainSilenceSecs: 1.2,
  maxChained: 2,
};

export interface Signals {
  now: number; // seconds since session start
  lastSpeechAt: number; // last Scribe partial from the expert (-Infinity if never)
  lastScreenChangeAt: number; // last frame diff above threshold
  lastTypingAt: number; // last localized-diff typing pattern or vision uiActivity=typing
  lastBoundaryAt: number; // last save/close/back-to-list event
  lastInvoiceOpenedAt: number; // last invoice_opened event: the expert is reading
  agentSpeaking: boolean;
  transcriberHealthy?: boolean;
}

export interface Lights {
  silence: boolean;
  still: boolean;
  notTyping: boolean;
  notReading: boolean;
  budget: boolean;
}

export interface Decision {
  interruptible: boolean;
  lights: Lights;
  boundaryBonus: number; // 0 or 0.2
  reasons: string[]; // human readable, for the meter
  state: "listening" | "waiting" | "asking" | "answering";
}

export interface OpenWindow {
  id: string;
  candidateId: string;
  openedAt: number;
  askedAt?: number;
  answeredAt?: number;
  phase: "asking" | "answering";
}

export class Governor {
  readonly config: GovernorConfig;
  private asked: number[] = []; // timestamps of questions asked
  private lastClosedAt = -Infinity;
  private closeCooldownSecs: number | undefined;
  window: OpenWindow | null = null;

  constructor(config: Partial<GovernorConfig> = {}) {
    this.config = { ...DEFAULT_GOVERNOR, ...config };
  }

  evaluate(s: Signals): Decision {
    const c = this.config;
    const silence = s.transcriberHealthy !== false && s.now - s.lastSpeechAt >= c.silenceSecs && !s.agentSpeaking;
    const still = s.now - s.lastScreenChangeAt >= c.stillSecs;
    const notTyping = s.now - s.lastTypingAt >= c.typingQuietSecs;
    const notReading = s.now - (s.lastInvoiceOpenedAt ?? -Infinity) >= c.readingSecs;
    const cooldownSecs = this.closeCooldownSecs ?? c.cooldownSecs;
    const budget = this.questionsInLast10Min(s.now) < c.maxPer10Min && s.now - this.lastClosedAt >= cooldownSecs && s.now >= c.warmupSecs;
    const boundaryBonus = s.now - s.lastBoundaryAt <= c.boundaryBonusSecs ? 0.2 : 0;
    const reasons: string[] = [];
    if (!silence) reasons.push(s.agentSpeaking ? "agent speaking" : "expert talking");
    if (!still) reasons.push("screen moving");
    if (!notTyping) reasons.push("typing");
    if (!notReading) reasons.push("reading a new invoice");
    if (!budget) reasons.push(s.now < c.warmupSecs ? "warming up" : s.now - this.lastClosedAt < cooldownSecs ? "cooldown" : "budget spent");
    const quiet = silence && still && notTyping && notReading;
    const state = this.window ? this.window.phase : quiet ? "waiting" : "listening";
    return { interruptible: quiet && budget && !this.window, lights: { silence, still, notTyping, notReading, budget }, boundaryBonus, reasons, state };
  }

  /** Should a window open now for a candidate of this value? */
  canOpen(s: Signals, candidateValue: number): boolean {
    const d = this.evaluate(s);
    return d.interruptible && candidateValue + d.boundaryBonus >= this.config.minValue;
  }

  open(candidateId: string, now: number): OpenWindow {
    if (this.window) throw new Error("window already open");
    this.window = { id: `win_${Math.random().toString(36).slice(2, 8)}`, candidateId, openedAt: now, phase: "asking" };
    return this.window;
  }

  /** The agent finished speaking the question; the mic is now open. */
  markAsked(now: number) {
    if (!this.window) return;
    this.window.askedAt = now;
    this.window.phase = "answering";
    this.asked.push(now);
  }

  markAnswered(now: number) {
    if (this.window) this.window.answeredAt = now;
  }

  close(now: number): OpenWindow | null {
    return this.closeWith(now);
  }

  closeWith(now: number, options: { cooldownSecs?: number; refund?: boolean } = {}): OpenWindow | null {
    const w = this.window;
    this.window = null;
    this.lastClosedAt = now;
    this.closeCooldownSecs = options.cooldownSecs;
    if (options.refund && w?.askedAt !== undefined) {
      const index = this.asked.lastIndexOf(w.askedAt);
      if (index >= 0) this.asked.splice(index, 1);
    }
    return w;
  }

  canChain(s: Signals): boolean {
    const c = this.config;
    if (this.window || s.transcriberHealthy === false || s.agentSpeaking) return false;
    if (this.questionsInLast10Min(s.now) >= c.maxPer10Min) return false;
    if (s.now - s.lastScreenChangeAt < c.stillSecs || s.now - s.lastTypingAt < c.typingQuietSecs) return false;
    if (s.now - s.lastSpeechAt < (c.chainSilenceSecs ?? c.silenceSecs)) return false;
    return s.now - this.lastClosedAt <= (c.chainWindowSecs ?? 0);
  }

  /** Abort before the question was spoken (expert started talking again). No budget consumed, no cooldown. */
  abort(): OpenWindow | null {
    const w = this.window;
    this.window = null;
    return w;
  }

  timedOut(now: number): boolean {
    if (!this.window) return false;
    const since = this.window.askedAt ?? this.window.openedAt;
    return now - since >= this.config.windowTimeoutSecs;
  }

  questionsInLast10Min(now: number): number {
    return this.asked.filter((t) => now - t <= 600).length;
  }

  get questionsAsked(): number {
    return this.asked.length;
  }
}
