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

/** A tutor decision as the view sees it. `guard` = it came from the server save guard (`save_blocked`). */
export type TeachDecision = TutorDecision & {
  t: number;
  guard?: boolean;
  /** The screen change the decision reacted to (real event fields only). */
  cause?: { kind: ScreenEvent["kind"]; field?: string; to?: string };
};

/** The merged invoice state the pipeline reports for the learner's screen. */
export interface TeachCurrentState {
  invoice?: string;
  supplier?: string;
  amount?: number;
  category?: string;
  costCenter?: string;
  status?: string;
}

type Pipeline = ReturnType<typeof useScreenPipeline>;

export interface TeachVM {
  log: SessionLog | null;
  map: WorkMap | null;
  started: boolean;
  ended: boolean;
  phase: "coached" | "independent";
  source: EventSource;
  decisions: TeachDecision[];
  replay: TeachReplay | null;
  closeReplay(): void;
  card: ReturnType<Matcher["masteryCard"]>;
  missed: ReturnType<Matcher["masteryCard"]>;
  flaggedCount: number;
  voice: Pick<VoiceApi, "mode" | "connected" | "status" | "isSpeaking">;
  pipeline: Pick<Pipeline, "videoRef" | "sharing" | "start" | "activity" | "visionLatency"> &
    CropHandle & {
      setOccluders?: (els: HTMLElement[]) => void;
      selfCapture?: boolean;
      degraded?: "wrong_surface" | null;
      lastSentUrl?: string | null;
    };
  currentInvoice?: string;
  /** WP4: supplier, amount, category, cost center and status of the invoice on the learner's screen. */
  currentState?: TeachCurrentState;
  /** WP4: epoch ms when Start was pressed (session clock). */
  startedAt?: number | null;
  /** WP4: the learner's name (stored as `log.expertName` on a teach session). */
  learnerName?: string;
  /** WP4: the expert whose confirmed map teaches. */
  expertName?: string;
  events: ScreenEvent[];
  /** `workspace`: the ERP is full width in this tab (current-tab capture). Call synchronously in the click. */
  start(opts?: { workspace?: boolean }): Promise<void>;
  endSession(): Promise<void>;
  /** WP4: re-open the last replay after it was closed. Undefined when there is none to re-open. */
  reopenReplay?: () => void;
  syncError?: string | null;
  /** Lane C. The view never infers listening from silence. */
  tutorState?: "watching" | "speaking" | "listening";
  practice?: (ruleId: string) => void;
}
