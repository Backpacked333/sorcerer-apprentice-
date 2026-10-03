import type { SessionLog } from "../events";
import type { WorkMap } from "../workmap";

type SampleCandidate = Pick<SessionLog, "id" | "mode" | "startedAt"> & {
  map?: Pick<WorkMap, "confirmedAt" | "steps">;
};

export function pickSample(candidates: readonly SampleCandidate[]) {
  return candidates
    .filter((s) => s.mode === "capture" && s.id.startsWith("demo_") && s.map?.confirmedAt && s.map.steps.length > 0)
    .sort((a, b) => b.startedAt - a.startedAt)[0];
}
