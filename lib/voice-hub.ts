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

const wordCount = (text: string) => text.match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu)?.length ?? 0;

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
    return [(startedAtMs - this.sessionStartMs) / 1_000, (endedAtMs - this.sessionStartMs) / 1_000];
  }
}
