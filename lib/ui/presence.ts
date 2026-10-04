export type PresenceState = "off-record" | "asking" | "listening" | "quiet";

export interface PresenceInput {
  holding: boolean;
  /** Milliseconds since the last strike. Undefined when nothing has been struck. */
  struckAgoMs?: number | null;
  phase?: "asking" | "answering";
  sharing: boolean;
  queued: number;
  /** First governor reason, already in the governor's words. */
  waitingReason?: string;
}

export interface PresenceView {
  state: PresenceState;
  label: string;
  sub: string;
}

/** Priority: paused, then a fresh strike, then the open window, then quiet. */
export function presenceOf(input: PresenceInput): PresenceView {
  if (input.holding) return { state: "off-record", label: "Paused", sub: "Nothing is being sent" };
  if (input.struckAgoMs != null && input.struckAgoMs < 4000) return { state: "off-record", label: "Paused", sub: "Struck from the record" };
  if (input.phase === "asking") return { state: "asking", label: "Asking", sub: "" };
  if (input.phase === "answering") return { state: "listening", label: "Listening to your answer", sub: "" };
  if (!input.sharing) return { state: "quiet", label: "Quiet while you work", sub: "Not watching — no screen shared" };
  if (input.queued > 0 && input.waitingReason) return { state: "quiet", label: "Quiet while you work", sub: `Waiting — ${input.waitingReason}` };
  return { state: "quiet", label: "Quiet while you work", sub: "" };
}
