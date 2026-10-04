import type { useScreenPipeline, EventSource } from "@/components/useScreenPipeline";
import type { VoiceApi } from "@/components/voice";
import type { Candidate } from "@/lib/curiosity";
import type { QuestionWindow, ScreenEvent, TranscriptSegment } from "@/lib/events";
import type { Decision } from "@/lib/governor";
import type { CaptureAppInfo, Evidence } from "@/lib/ui/capture-copy";

/** P-23 crop / paint-out handles. Optional so older pipelines compile. */
export type CropHandle = {
  setCropTarget?(el: HTMLElement | null): void;
  surface?: "browser" | "window" | "monitor";
};

export type PipelineExtras = {
  setOccluders?(els: HTMLElement[]): void;
  selfCapture?: boolean;
  degraded?: "wrong_surface" | null;
  lastSentUrl?: string | null;
  piiMode?: "dom" | "manual-only";
};

/** One answered window, for the understood card and the learned chips. */
export interface UnderstoodItem {
  windowId: string;
  kind: "reason" | "guardrail";
  /** `logged.reason` (model summary, isQuote false) or the expert's literal answer (isQuote true). */
  text: string;
  isQuote: boolean;
  /** epoch ms */
  at: number;
  question: string;
  /** The expert's answer as transcribed (redacted), literal. */
  answerText?: string;
  eyebrow: string;
  stepRef: string;
}

export interface CaptureVM {
  started: boolean;
  expertName: string;
  task: string;
  consented: boolean;
  setExpertName(v: string): void;
  setTask(v: string): void;
  setConsented(v: boolean): void;
  /** Call synchronously inside the click: the screen share prompt needs the user activation. */
  start(opts?: { mode?: "tab" | "workspace" }): Promise<void>;
  endTask(): Promise<void>;
  sessionId: string;
  source: EventSource;
  voice: Pick<VoiceApi, "mode" | "connected" | "status" | "isSpeaking"> & { degraded?: boolean; lastError?: string };
  sttEngine: "scribe" | "webspeech" | "none";
  pipeline: Pick<
    ReturnType<typeof useScreenPipeline>,
    "videoRef" | "sharing" | "start" | "activity" | "framesSeen" | "framesSent" | "dropped" | "visionLatency" | "visionError" | "masks" | "addMask" | "clearMasks" | "paused"
  > &
    CropHandle &
    PipelineExtras;
  decision?: Decision;
  questionsLast10Min: number;
  budget: number;
  openWindow?: QuestionWindow & {
    phase: "asking" | "answering";
    /** Seconds of quiet before the window opened (speech, screen change, typing). */
    pauseSecs?: number;
    evidence?: Evidence;
    /** Field label the question is about. */
    about?: string | null;
  };
  partial: string;
  queued: Candidate[];
  askedCount: number;
  guardrailAsked: boolean;
  toDebrief: number;
  events: ScreenEvent[];
  candidateFor(eventId: string): Candidate | undefined;
  transcript: TranscriptSegment[];
  ledger: { framesSeen: number; framesKept: number; entitiesRedacted: number; secondsStruck: number };
  strike(): void;
  notNow(): void;
  holding: boolean;
  setHolding(b: boolean): void;
  submitTypedAnswer(text: string): void;
  synced: number | null;
  /** Narration already gave the reason: verbatim (redacted) segment, the question is dropped. */
  reasonHeard?: { stepRef: string; quote: string; t: number; at?: number; about?: string | null }[];

  // ---- companion redesign (all optional)
  app?: CaptureAppInfo;
  share0?: boolean;
  /** epoch ms of the session start, null before start */
  startedAt?: number | null;
  starting?: boolean;
  startError?: string | null;
  ending?: boolean;
  understood?: UnderstoodItem[];
  lastNotice?: { eventId: string; text: string; field?: string; at: number; queued: boolean };
  lastStrike?: { at: number; from: number; to: number };
  lastDeferred?: { at: number };
  governorThresholds?: { silenceSecs: number; stillSecs: number; typingQuietSecs: number };
  /** /api/health gateway key: false = keyless (vision off), null = unknown */
  visionKey?: boolean | null;
}
