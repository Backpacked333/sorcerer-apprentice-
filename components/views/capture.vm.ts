import type { useScreenPipeline, EventSource } from "@/components/useScreenPipeline";
import type { VoiceApi } from "@/components/voice";
import type { Candidate } from "@/lib/curiosity";
import type { QuestionWindow, ScreenEvent, TranscriptSegment } from "@/lib/events";
import type { Decision } from "@/lib/governor";
import type { TurnPhase } from "@/lib/voice-turn";

/** Reserved for P-23. Optional until the pipeline owner wires it. */
export type CropHandle = {
  setCropTarget?(el: HTMLElement | null): void;
  surface?: "browser" | "window" | "monitor";
};

export interface CaptureVM {
  started: boolean;
  expertName: string;
  task: string;
  consented: boolean;
  setExpertName(v: string): void;
  setTask(v: string): void;
  setConsented(v: boolean): void;
  start(): Promise<void>;
  endTask(): Promise<void>;
  sessionId: string;
  source: EventSource;
  voice: Pick<VoiceApi, "mode" | "connected" | "status" | "isSpeaking"> & { degraded?: boolean; lastError?: string };
  turnPhase: TurnPhase;
  gateOpen: boolean;
  sttEngine: "scribe" | "webspeech" | "none";
  stt: { engine: "scribe" | "webspeech" | "none"; connected: boolean };
  pipeline: Pick<
    ReturnType<typeof useScreenPipeline>,
    "videoRef" | "sharing" | "start" | "activity" | "framesSeen" | "framesSent" | "dropped" | "visionLatency" | "visionError" | "masks" | "addMask" | "clearMasks" | "paused"
  > &
    CropHandle;
  decision?: Decision;
  questionsLast10Min: number;
  budget: number;
  openWindow?: QuestionWindow & { phase: "asking" | "answering" };
  partial: string;
  queued: Candidate[];
  askedCount: number;
  guardrailAsked: boolean;
  toDebrief: number;
  deferred: { kind: string; question: string; stepRef: string }[];
  deferredCount: number;
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
  /** Set by lane A when narration already filled the reason. */
  reasonHeard?: string;
  reasonHeardItems: { stepRef: string; quote: string; t: number }[];
  noisy: boolean;
  chainedCount: number;
  forced: boolean;
}
