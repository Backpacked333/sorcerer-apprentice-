import type { VoiceApi } from "@/components/voice";
import type { AutopilotStep } from "@/lib/autopilot";
import type { Frame } from "@/lib/events";
import type { computeMetrics } from "@/lib/metrics";
import type { Slot, WorkMap } from "@/lib/workmap";

export type MapPhase = "idle" | "asking" | "teachback" | "confirmed";

export interface MapPatch {
  ruleTitle: string;
  before: string;
  after: string;
}

export interface MapVM {
  sessionId: string;
  map: WorkMap | null;
  frames: Frame[];
  compiling: boolean;
  note: string;
  phase: MapPhase;
  debriefOn: boolean;
  currentSlot: Slot | null;
  heard: string;
  teachback: { text: string; sure: string[]; unsure: string[] } | null;
  rounds: number;
  progress: {
    open: number;
    closed: number;
    total: number;
    evidenceOk: boolean;
    ready: boolean;
    judgment: number;
    guardrails: number;
  } | null;
  metrics: ReturnType<typeof computeMetrics> | null;
  autopilot: AutopilotStep[] | null;
  autopilotRunning: boolean;
  voice: Pick<VoiceApi, "mode" | "connected" | "status" | "isSpeaking">;
  sttEngine: "scribe" | "webspeech" | "none";
  startDebrief(): Promise<void>;
  submitAnswer(text: string): Promise<void>;
  startTeachback(): void;
  confirm(yes: boolean, correction?: string): Promise<void>;
  recompile(llm: boolean): Promise<void>;
  runAutopilot(): Promise<void>;
  onMapChange(map: WorkMap): void;
  /** P-5. Render-ready strings from lane C. Absent until they land. */
  lastPatch?: MapPatch[] | null;
  pending?: boolean;
  canonical?: { steps: number; judgment: number; guardrails: number } | null;
  /** P-20. The view renders a matrix only when this is an array of rows. */
  matrix?: { stepId: string; cells: { key: string; word: string }[] }[] | null;
  knowledge?: boolean;
  llm?: boolean;
}
