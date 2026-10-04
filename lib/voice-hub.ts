import { CommitStrategy, type ScribeHookOptions } from "@elevenlabs/react";
import { AgentSpeechTimeline, classifySegment, detectCommand, type VoiceCommand } from "./voice-protocol";

export interface VoiceTranscriptMeta {
  startedAtMs: number;
  endedAtMs: number;
  speaker: "human" | "agent";
}

export interface VoiceHubSubscriber {
  enabled: boolean;
  language?: string;
  onPartial: (text: string) => void;
  onCommitted: (text: string, startSecs?: number, endSecs?: number, meta?: VoiceTranscriptMeta) => void;
  onAgentEcho?: (text: string, startSecs?: number, endSecs?: number, meta?: VoiceTranscriptMeta) => void;
  onCommand?: (command: VoiceCommand, text: string, meta: VoiceTranscriptMeta) => void;
}

export type VoiceHubConnectionStatus = "disconnected" | "connecting" | "connected" | "error";
export type VoiceHubConnectionAction = "connect" | "disconnect" | "none";

export interface VoiceHubEffectiveConfig {
  language?: string;
  deviceId?: string;
  keyterms?: string[];
  filterBackgroundAudio: boolean;
}

export function voiceHubConfigFingerprint(config: VoiceHubEffectiveConfig): string {
  return JSON.stringify({
    language: config.language ?? "",
    deviceId: config.deviceId ?? "",
    keyterms: config.keyterms ?? [],
    filterBackgroundAudio: config.filterBackgroundAudio,
  });
}

export class VoiceHubConnectionCoordinator {
  private demanded = false;
  private configFingerprint = "";
  private inFlight: { generation: number; configFingerprint: string; demandWindow: number } | undefined;
  private fatalLatched = false;
  private fallbackAttempted = false;
  private tokenAttempted = false;
  private nextGeneration = 1;
  private demandWindow = 0;
  private controlledClose: { demandWindow: number; configFingerprint: string } | undefined;

  update({ demanded, configFingerprint }: { demanded: boolean; configFingerprint: string }): { stopResources: boolean; needsReconcile: boolean } {
    const demandStopped = this.demanded && !demanded;
    const demandStarted = !this.demanded && demanded;
    const configChanged = this.configFingerprint !== "" && this.configFingerprint !== configFingerprint;
    if (demandStopped || demandStarted) this.demandWindow += 1;
    this.demanded = demanded;
    this.configFingerprint = configFingerprint;
    if (demandStopped) {
      this.fatalLatched = false;
      this.fallbackAttempted = false;
      this.tokenAttempted = false;
      this.controlledClose = undefined;
    } else if (demandStarted) {
      this.fatalLatched = false;
      this.fallbackAttempted = false;
      this.tokenAttempted = false;
    } else if (configChanged) {
      this.fallbackAttempted = false;
      this.tokenAttempted = false;
    }
    return {
      stopResources: demandStopped || (demanded && configChanged),
      needsReconcile: demanded || demandStopped,
    };
  }

  beginTokenAttempt(): { generation: number; configFingerprint: string } | undefined {
    if (!this.demanded || this.fatalLatched || this.inFlight || this.tokenAttempted) return undefined;
    this.tokenAttempted = true;
    this.inFlight = { generation: this.nextGeneration++, configFingerprint: this.configFingerprint, demandWindow: this.demandWindow };
    return { generation: this.inFlight.generation, configFingerprint: this.inFlight.configFingerprint };
  }

  isCurrent(generation: number): boolean {
    return Boolean(
      this.demanded
      && !this.fatalLatched
      && this.inFlight?.generation === generation
      && this.inFlight.configFingerprint === this.configFingerprint
      && this.inFlight.demandWindow === this.demandWindow,
    );
  }

  settle(generation: number): boolean {
    if (this.inFlight?.generation === generation) this.inFlight = undefined;
    return this.demanded;
  }

  expectControlledClose(): void {
    if (!this.demanded) return;
    this.controlledClose = { demandWindow: this.demandWindow, configFingerprint: this.configFingerprint };
  }

  consumeControlledClose(): boolean {
    const expected = this.controlledClose;
    this.controlledClose = undefined;
    return Boolean(
      expected
      && this.demanded
      && expected.demandWindow === this.demandWindow
      && expected.configFingerprint === this.configFingerprint,
    );
  }

  replacementInstalled(generation: number): void {
    if (this.isCurrent(generation)) this.controlledClose = undefined;
  }

  latchFatal(): boolean {
    if (!this.demanded || this.fatalLatched) return false;
    this.fatalLatched = true;
    return true;
  }

  beginFallback(): boolean {
    if (!this.demanded || !this.fatalLatched || this.fallbackAttempted) return false;
    this.fallbackAttempted = true;
    return true;
  }

  snapshot() {
    return {
      demanded: this.demanded,
      inFlight: Boolean(this.inFlight),
      fatalLatched: this.fatalLatched,
      fallbackAttempted: this.fallbackAttempted,
      configFingerprint: this.configFingerprint,
    };
  }
}

interface VoiceHubRecognizerResource {
  onend: (() => void) | null;
  stop(): void;
}

export function cleanupVoiceHubProvider({
  disableDemand,
  recognizer,
  clearRecognizer,
  disconnectScribe,
}: {
  disableDemand: () => void;
  recognizer: VoiceHubRecognizerResource | null;
  clearRecognizer: () => void;
  disconnectScribe: () => void;
}): void {
  disableDemand();
  if (recognizer) {
    recognizer.onend = null;
    clearRecognizer();
    try { recognizer.stop(); } catch { /* it may already be stopped */ }
  }
  disconnectScribe();
}

export class AgentSpeechTracker {
  private activeId: string | undefined;
  private speaking = false;
  private fallingTimer: ReturnType<typeof globalThis.setTimeout> | undefined;
  private pendingEnd: number | undefined;

  constructor(
    private readonly timeline: AgentSpeechTimeline,
    private readonly options: {
      fallingEdgeMs?: number;
      schedule?: (callback: () => void, ms: number) => ReturnType<typeof globalThis.setTimeout>;
      cancelTimer?: (timer: ReturnType<typeof globalThis.setTimeout>) => void;
    } = {},
  ) {}

  onMode(mode: "speaking" | "listening", at: number, text: string): { rising: boolean } {
    const rising = mode === "speaking" && !this.speaking;
    if (mode === "speaking") {
      this.cancelFalling();
      this.speaking = true;
      if (!this.activeId) this.activeId = this.timeline.start(at, text, "agent");
      return { rising };
    }
    this.speaking = false;
    if (!this.activeId || this.fallingTimer !== undefined) return { rising: false };
    this.pendingEnd = at;
    const schedule = this.options.schedule ?? ((callback, ms) => globalThis.setTimeout(callback, ms));
    this.fallingTimer = schedule(() => {
      this.fallingTimer = undefined;
      const end = this.pendingEnd;
      this.pendingEnd = undefined;
      if (end !== undefined && this.activeId) this.timeline.end(end, this.activeId);
      this.activeId = undefined;
    }, this.options.fallingEdgeMs ?? 600);
    return { rising: false };
  }

  refine(text: string): void {
    if (this.activeId) this.timeline.updateText(text, this.activeId);
  }

  close(at: number): void {
    this.cancelFalling();
    if (this.activeId) this.timeline.end(at, this.activeId);
    this.activeId = undefined;
    this.speaking = false;
  }

  private cancelFalling(): void {
    if (this.fallingTimer === undefined) return;
    (this.options.cancelTimer ?? ((timer) => globalThis.clearTimeout(timer)))(this.fallingTimer);
    this.fallingTimer = undefined;
    this.pendingEnd = undefined;
  }
}

export function buildVoiceHubScribeOptions({
  token,
  deviceId,
  language,
  keyterms,
  filterBackgroundAudio,
}: {
  token: string;
  deviceId?: string;
  language?: string;
  keyterms?: string[];
  filterBackgroundAudio: boolean;
}): Partial<ScribeHookOptions> {
  return {
    token,
    modelId: "scribe_v2_realtime",
    commitStrategy: CommitStrategy.VAD,
    vadSilenceThresholdSecs: 1,
    filterBackgroundAudio,
    ...(language ? { languageCode: language } : {}),
    ...(keyterms?.length ? { keyterms } : {}),
    microphone: {
      ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
      echoCancellation: true,
      noiseSuppression: true,
    },
  };
}

export function nextVoiceHubConnectionAction({ demanded, status }: { demanded: boolean; status: VoiceHubConnectionStatus }): VoiceHubConnectionAction {
  if (demanded) return status === "disconnected" || status === "error" ? "connect" : "none";
  return status === "disconnected" ? "none" : "disconnect";
}

export function routeWebSpeechResult(
  hub: Pick<VoiceHubRouter, "partial" | "commit">,
  result: { text: string; isFinal: true; atMs: number },
): { kind: "commit"; routed: ReturnType<VoiceHubRouter["commit"]> };
export function routeWebSpeechResult(
  hub: Pick<VoiceHubRouter, "partial" | "commit">,
  result: { text: string; isFinal: false; atMs: number },
): { kind: "partial"; routed: ReturnType<VoiceHubRouter["partial"]> };
export function routeWebSpeechResult(
  hub: Pick<VoiceHubRouter, "partial" | "commit">,
  result: { text: string; isFinal: boolean; atMs: number },
) {
  return result.isFinal
    ? { kind: "commit" as const, routed: hub.commit(result.text, result.atMs) }
    : { kind: "partial" as const, routed: hub.partial(result.text, result.atMs) };
}

const wordCount = (text: string) => text.match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu)?.length ?? 0;

export function routeAgentAsrMessage({
  text,
  atMs,
  timeline,
  sessionStartMs,
}: {
  text: string;
  atMs: number;
  timeline: AgentSpeechTimeline;
  sessionStartMs?: number;
}): { human: boolean; text: string; at: number } {
  const clean = text.trim();
  const classified = classifySegment({ text: clean, tStart: atMs / 1_000, tEnd: atMs / 1_000 }, timeline);
  const human = classified.kind === "human" || (classified.kind === "mixed" && wordCount(classified.text) >= 2);
  return {
    human,
    text: human ? classified.text : "",
    at: sessionStartMs === undefined ? atMs / 1_000 : Math.max(0, (atMs - sessionStartMs) / 1_000),
  };
}

export function createTurnHubSubscriber({
  sessionActive,
  turnActive,
  now,
  dispatch,
  noteHumanSpeech,
}: {
  sessionActive: boolean;
  turnActive: boolean;
  now: () => number;
  dispatch: (event:
    | { type: "HUMAN_PARTIAL"; at: number; text: string }
    | { type: "HUMAN_COMMIT"; at: number; startedAt?: number; text: string; source: "scribe" }
    | { type: "COMMAND"; at: number; command: "off_record" | "not_now" }) => void;
  noteHumanSpeech: (at: number) => void;
}): VoiceHubSubscriber {
  return {
    enabled: sessionActive || turnActive,
    onPartial: (text) => {
      const at = now();
      noteHumanSpeech(at);
      if (turnActive) dispatch({ type: "HUMAN_PARTIAL", at, text });
    },
    onCommitted: (text, startSecs, endSecs) => {
      const at = endSecs ?? now();
      noteHumanSpeech(at);
      if (turnActive) dispatch({ type: "HUMAN_COMMIT", at, ...(startSecs === undefined ? {} : { startedAt: startSecs }), text, source: "scribe" });
    },
    onCommand: (command) => {
      if (turnActive && (command === "off_record" || command === "not_now")) dispatch({ type: "COMMAND", at: now(), command });
    },
  };
}

export class VoiceHubRouter {
  private readonly subscribers = new Map<string, () => VoiceHubSubscriber>();
  private sessionStartMs: number | undefined;
  private segmentStartedAtMs: number | undefined;
  private segmentEndedAtMs: number | undefined;
  private previousPartial = "";
  private deliveredCommand: VoiceCommand | null = null;

  constructor(private readonly options: { timeline: AgentSpeechTimeline; onHumanActivity?: () => void }) {}

  subscribe(id: string, read: () => VoiceHubSubscriber): () => void {
    this.subscribers.set(id, read);
    return () => { this.subscribers.delete(id); };
  }

  setSessionStart(epochMs: number | undefined): void {
    if (epochMs === undefined || this.sessionStartMs !== epochMs) this.resetSegment();
    this.sessionStartMs = epochMs;
  }

  enabledSubscriberCount(): number {
    return this.enabledSubscribers().length;
  }

  preferredLanguage(): string | undefined {
    return this.enabledSubscribers().map((subscriber) => subscriber.language).find(Boolean);
  }

  shouldConnect({ sessionActive, forcedOff }: { sessionActive: boolean; forcedOff: boolean }): boolean {
    return !forcedOff && (sessionActive || this.enabledSubscriberCount() > 0);
  }

  partial(text: string, atMs: number): { text: string; human: boolean; command: VoiceCommand | null; changed: boolean } {
    const clean = text.trim();
    if (!clean || clean === this.previousPartial) return { text: "", human: false, command: null, changed: false };
    if (this.segmentStartedAtMs === undefined) this.segmentStartedAtMs = atMs;
    this.segmentEndedAtMs = atMs;
    this.previousPartial = clean;
    const routed = this.classify(clean, this.segmentStartedAtMs, atMs);
    if (!routed.human) return { text: "", human: false, command: null, changed: true };

    const meta = this.meta(this.segmentStartedAtMs, atMs, "human");
    const command = detectCommand(routed.text);
    this.options.onHumanActivity?.();
    for (const subscriber of this.enabledSubscribers()) {
      subscriber.onPartial(routed.text);
      if (command && command !== this.deliveredCommand) subscriber.onCommand?.(command, routed.text, meta);
    }
    if (command) this.deliveredCommand = command;
    return { text: routed.text, human: true, command, changed: true };
  }

  commit(text: string, atMs: number): { text: string; speaker: "human" | "agent"; command: VoiceCommand | null } {
    const clean = text.trim();
    const fallbackAt = atMs - 1_000;
    const startedAtMs = this.segmentStartedAtMs ?? fallbackAt;
    const endedAtMs = this.segmentEndedAtMs ?? fallbackAt;
    const routed = this.classify(clean, startedAtMs, endedAtMs);
    const speaker = routed.human ? "human" : "agent";
    const meta = this.meta(startedAtMs, endedAtMs, speaker);
    const [startSecs, endSecs] = this.relativeTimes(startedAtMs, endedAtMs);
    let command: VoiceCommand | null = null;

    if (clean) {
      if (routed.human) {
        command = detectCommand(routed.text);
        if (this.segmentStartedAtMs === undefined) this.options.onHumanActivity?.();
        for (const subscriber of this.enabledSubscribers()) {
          subscriber.onCommitted(routed.text, startSecs, endSecs, meta);
          if (command && command !== this.deliveredCommand) subscriber.onCommand?.(command, routed.text, meta);
        }
      } else {
        for (const subscriber of this.enabledSubscribers()) subscriber.onAgentEcho?.(clean, startSecs, endSecs, meta);
      }
    }

    this.segmentStartedAtMs = undefined;
    this.segmentEndedAtMs = undefined;
    this.previousPartial = "";
    this.deliveredCommand = null;
    return { text: routed.human ? routed.text : "", speaker, command };
  }

  private enabledSubscribers(): VoiceHubSubscriber[] {
    return Array.from(this.subscribers.values(), (read) => read()).filter((subscriber) => subscriber.enabled);
  }

  private classify(text: string, startedAtMs: number, endedAtMs: number): { human: boolean; text: string } {
    const classified = classifySegment({ text, tStart: startedAtMs / 1_000, tEnd: endedAtMs / 1_000 }, this.options.timeline);
    if (classified.kind === "human") return { human: true, text: classified.text };
    if (classified.kind === "mixed" && wordCount(classified.text) >= 2) return { human: true, text: classified.text };
    return { human: false, text: "" };
  }

  private meta(startedAtMs: number, endedAtMs: number, speaker: VoiceTranscriptMeta["speaker"]): VoiceTranscriptMeta {
    return { startedAtMs, endedAtMs, speaker };
  }

  private relativeTimes(startedAtMs: number, endedAtMs: number): [number | undefined, number | undefined] {
    if (this.sessionStartMs === undefined) return [undefined, undefined];
    const start = Math.max(0, (startedAtMs - this.sessionStartMs) / 1_000);
    const end = Math.max(start, (endedAtMs - this.sessionStartMs) / 1_000);
    return [start, end];
  }

  private resetSegment(): void {
    this.segmentStartedAtMs = undefined;
    this.segmentEndedAtMs = undefined;
    this.previousPartial = "";
    this.deliveredCommand = null;
  }
}
