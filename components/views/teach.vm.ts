import type { useScreenPipeline, EventSource } from "@/components/useScreenPipeline";
import type { VoiceApi } from "@/components/voice";
import type { Frame, ScreenEvent, SessionLog } from "@/lib/events";
import type { Matcher, TutorDecision } from "@/lib/matcher";
import type { Step, WorkMap } from "@/lib/workmap";
import type { CropHandle } from "./capture.vm";

export interface TeachReplay {
  step?: Step;
  frame?: Frame;
  quote?: string;
  audioUrl?: string;
  rule?: string;
}

export interface TeachVM {
  log: SessionLog | null;
  map: WorkMap | null;
  started: boolean;
  ended: boolean;
  phase: "coached" | "independent";
  source: EventSource;
  decisions: (TutorDecision & { t: number })[];
  replay: TeachReplay | null;
  closeReplay(): void;
  card: ReturnType<Matcher["masteryCard"]>;
  missed: ReturnType<Matcher["masteryCard"]>;
  flaggedCount: number;
  voice: Pick<VoiceApi, "mode" | "connected" | "status" | "isSpeaking">;
  pipeline: Pick<ReturnType<typeof useScreenPipeline>, "videoRef" | "sharing" | "start" | "activity" | "visionLatency"> & CropHandle;
  currentInvoice?: string;
  events: ScreenEvent[];
  start(): Promise<void>;
  endSession(): Promise<void>;
  /** Lane C. The view never infers listening from silence. */
  tutorState?: "watching" | "speaking" | "listening";
  practice?: (ruleId: string) => void;
}
