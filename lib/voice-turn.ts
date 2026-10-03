/** Pure voice-turn lifecycle. SDK and React adapters consume the emitted effects. */

export type TurnPhase =
  | "idle"
  | "sending"
  | "waiting_for_speech"
  | "speaking"
  | "listening"
  | "closing";

export type ToolName =
  | "log_answer"
  | "mark_off_record"
  | "confirm_teachback"
  | "end_task"
  | "flag_for_expert"
  | "show_replay"
  | "record_prediction"
  | "record_mastery"
  | "end_session";

export interface TurnOptions {
  tag: string;
  text: string;
  spoken?: string;
  listen?: boolean;
  timeoutSecs?: number;
  maxSecs?: number;
  recordClip?: { sessionId: string };
  abortOnHumanSpeech?: boolean;
  watchdogSecs?: number;
  silenceCloseSecs?: number;
  ackMaxSecs?: number;
  onPhase?: (phase: TurnPhase, at: number) => void;
}

export interface TurnResult {
  spoke: boolean;
  heard: string;
  via: "tool" | "scribe" | "typed" | "timeout" | "aborted" | "spoken";
  tool?: { name: ToolName; params: Record<string, unknown> };
  audioId?: string;
  askedAt: number;
  answeredAt?: number;
  sentAt: number;
  spokeAt?: number;
  closedAt: number;
  spokenBy?: "agent" | "fallback";
  spokenText?: string;
  heardSource?: "scribe" | "agent_asr" | "typed";
  command?: "off_record" | "not_now";
  abortReason?: "resumed" | "user" | "superseded" | "paused" | "disconnected" | "silent";
}

export type TurnEvent =
  | { type: "SEND"; at: number; options: TurnOptions; agentConnected?: boolean; audioId?: string }
  | { type: "SPEAK_START"; at: number; source?: "agent" | "fallback" }
  | { type: "SPEAK_END"; at: number }
  | { type: "HUMAN_PARTIAL"; at: number; text: string }
  | { type: "HUMAN_COMMIT"; at: number; text: string; source?: "scribe" | "agent_asr" }
  | { type: "TOOL"; at: number; name: ToolName; params: Record<string, unknown> }
  | { type: "TYPED"; at: number; text: string }
  | { type: "COMMAND"; at: number; command: "off_record" | "not_now" }
  | { type: "CANCEL"; at: number; reason?: TurnResult["abortReason"] }
  | { type: "TICK"; at: number };

export type TurnEffect =
  | { type: "OPEN_GATE" }
  | { type: "SQUELCH" }
  | { type: "SEND_TAG"; tag: string; text: string }
  | { type: "SEND_CONTEXT"; text: string }
  | { type: "FALLBACK_SPEAK"; text: string }
  | { type: "UNMUTE" }
  | { type: "MUTE" }
  | { type: "CLIP_START"; sessionId: string; audioId?: string }
  | { type: "CLIP_STOP"; upload: boolean; audioId?: string }
  | { type: "RESOLVE"; result: TurnResult };

export interface TurnClose {
  via: TurnResult["via"];
  heard: string;
  heardSource?: TurnResult["heardSource"];
  tool?: TurnResult["tool"];
  command?: TurnResult["command"];
  abortReason?: TurnResult["abortReason"];
  answeredAt?: number;
  startedAt: number;
}

export interface TurnState {
  phase: TurnPhase;
  options?: TurnOptions;
  sentAt?: number;
  spokeAt?: number;
  spokenBy?: "agent" | "fallback";
  speechEndCandidateAt?: number;
  fallbackRequestedAt?: number;
  askedAt?: number;
  audioId?: string;
  scribeText: string;
  agentAsrText: string;
  partial: string;
  lastPartialAt: number;
  lastHumanSpeechAt: number;
  lastAgentSpeechEnd: number;
  close?: TurnClose;
  ackStartedAt?: number;
  ackEndCandidateAt?: number;
  agentConnected?: boolean;
  waitingForSquelch?: boolean;
  squelchedSpeechStarted?: boolean;
  squelchSpeechEndedAt?: number;
  queuedAt?: number;
}

export const initialTurnState: TurnState = {
  phase: "idle",
  scribeText: "",
  agentAsrText: "",
  partial: "",
  lastPartialAt: Number.NEGATIVE_INFINITY,
  lastHumanSpeechAt: Number.NEGATIVE_INFINITY,
  lastAgentSpeechEnd: Number.NEGATIVE_INFINITY,
};

export interface GateStateInput {
  turnActive: boolean | TurnPhase;
  now: number;
  gateHoldUntil: number;
  micMuted: boolean;
  squelch: boolean;
}

export function gateState({ turnActive, now, gateHoldUntil, micMuted, squelch }: GateStateInput): boolean {
  if (squelch) return false;
  const active = typeof turnActive === "boolean" ? turnActive : turnActive !== "idle";
  return active || now < gateHoldUntil || !micMuted;
}

export interface TurnTransition {
  state: TurnState;
  effects: TurnEffect[];
}

const NOTE_CANCELLED = "[NOTE] The previous question was cancelled before it was heard. Do not refer to it.";
const EPSILON = 1e-9;

function append(current: string, next: string): string {
  const clean = next.trim();
  return clean ? [current, clean].filter(Boolean).join(" ") : current;
}

function spokenText(state: TurnState): string {
  return state.options?.spoken ?? state.options?.text ?? "";
}

function audibleFor(state: TurnState, at: number): number {
  return state.spokeAt === undefined ? 0 : Math.max(0, at - state.spokeAt);
}

function heard(state: TurnState): Pick<TurnClose, "heard" | "heardSource"> {
  if (state.scribeText) return { heard: state.scribeText, heardSource: "scribe" };
  if (state.agentAsrText) return { heard: state.agentAsrText, heardSource: "agent_asr" };
  return { heard: "" };
}

function resultFrom(state: TurnState, close: TurnClose, closedAt: number): TurnResult {
  const askedAt = state.askedAt ?? state.sentAt ?? closedAt;
  const spoke = state.spokeAt !== undefined && (state.askedAt !== undefined || audibleFor(state, closedAt) + EPSILON >= 1);
  return {
    spoke,
    heard: close.heard,
    via: close.via,
    ...(close.tool ? { tool: close.tool } : {}),
    ...(state.audioId && close.heard ? { audioId: state.audioId } : {}),
    askedAt,
    ...(close.answeredAt !== undefined ? { answeredAt: close.answeredAt } : {}),
    sentAt: state.sentAt ?? closedAt,
    ...(state.spokeAt !== undefined ? { spokeAt: state.spokeAt } : {}),
    closedAt,
    ...(state.spokenBy ? { spokenBy: state.spokenBy } : {}),
    ...(state.spokeAt !== undefined ? { spokenText: spokenText(state) } : {}),
    ...(close.heardSource ? { heardSource: close.heardSource } : {}),
    ...(close.command ? { command: close.command } : {}),
    ...(close.abortReason ? { abortReason: close.abortReason } : {}),
  };
}

function freshTurn(options: TurnOptions, at: number, audioId?: string): TurnState {
  return {
    ...initialTurnState,
    phase: "sending",
    options,
    sentAt: at,
    audioId,
  };
}

function immediateAbort(
  state: TurnState,
  at: number,
  reason: TurnResult["abortReason"],
  includeNote = true,
): TurnTransition {
  const close: TurnClose = { via: "aborted", heard: "", abortReason: reason, startedAt: at };
  const result = resultFrom(state, close, at);
  return {
    state: initialTurnState,
    effects: [
      { type: "SQUELCH" },
      { type: "MUTE" },
      ...(includeNote ? ([{ type: "SEND_CONTEXT", text: NOTE_CANCELLED }] satisfies TurnEffect[]) : []),
      { type: "RESOLVE", result },
    ],
  };
}

function enterClosing(state: TurnState, close: TurnClose): TurnTransition {
  return {
    state: { ...state, phase: "closing", close, speechEndCandidateAt: undefined },
    effects: [{ type: "MUTE" }],
  };
}

function finishSpeech(state: TurnState, at: number): TurnTransition {
  const askedAt = at;
  const base = { ...state, askedAt, speechEndCandidateAt: undefined, lastAgentSpeechEnd: at };
  if (state.options?.listen ?? false) {
    return {
      state: { ...base, phase: "listening" },
      effects: [
        { type: "UNMUTE" },
        ...(state.options?.recordClip
          ? ([{ type: "CLIP_START", sessionId: state.options.recordClip.sessionId, audioId: state.audioId }] satisfies TurnEffect[])
          : []),
      ],
    };
  }
  return enterClosing(base, { via: "spoken", heard: "", startedAt: at });
}

function closeListening(state: TurnState, at: number, via: TurnClose["via"], extra: Partial<TurnClose> = {}): TurnTransition {
  const captured = heard(state);
  return enterClosing(state, {
    via,
    ...captured,
    answeredAt: captured.heard ? at : undefined,
    startedAt: at,
    ...extra,
  });
}

function resolveClosing(state: TurnState, at: number): TurnTransition {
  const close = state.close!;
  const upload = Boolean(
    state.options?.recordClip &&
      close.heard &&
      (close.via === "tool" || close.via === "scribe" || close.via === "typed"),
  );
  return {
    state: initialTurnState,
    effects: [
      ...(state.options?.recordClip ? ([{ type: "CLIP_STOP", upload, audioId: state.audioId }] satisfies TurnEffect[]) : []),
      { type: "RESOLVE", result: resultFrom(state, close, at) },
    ],
  };
}

function send(state: TurnState, event: Extract<TurnEvent, { type: "SEND" }>): TurnTransition {
  const next = freshTurn(event.options, event.at, event.audioId);
  const sendEffects: TurnEffect[] = [
    { type: "OPEN_GATE" },
    { type: "MUTE" },
    ...(event.agentConnected === false
      ? ([{ type: "FALLBACK_SPEAK", text: event.options.spoken ?? event.options.text }] satisfies TurnEffect[])
      : ([{ type: "SEND_TAG", tag: event.options.tag, text: event.options.text }] satisfies TurnEffect[])),
  ];
  if (state.phase === "idle") {
    return {
      state:
        event.agentConnected === false
          ? { ...next, phase: "speaking", spokenBy: "fallback", fallbackRequestedAt: event.at }
          : next,
      effects: sendEffects,
    };
  }
  const superseded: TurnClose = {
    via: "aborted",
    heard: "",
    abortReason: "superseded",
    startedAt: event.at,
  };
  return {
    state: {
      ...next,
      sentAt: undefined,
      queuedAt: event.at,
      agentConnected: event.agentConnected !== false,
      waitingForSquelch: true,
      squelchedSpeechStarted: state.phase === "speaking",
    },
    effects: [
      { type: "RESOLVE", result: resultFrom(state, superseded, event.at) },
      { type: "SQUELCH" },
      { type: "MUTE" },
      { type: "SEND_CONTEXT", text: NOTE_CANCELLED },
    ],
  };
}

export function reduce(state: TurnState, event: TurnEvent): TurnTransition {
  if (event.type === "SEND") return send(state, event);
  if (state.phase === "idle") return { state, effects: [] };

  if (event.type === "HUMAN_PARTIAL") {
    const next = {
      ...state,
      partial: event.text.trim(),
      lastPartialAt: event.at,
      lastHumanSpeechAt: event.at,
    };
    const beforeQuestion = state.phase === "sending" || state.phase === "waiting_for_speech" || state.phase === "speaking";
    if (
      state.options?.abortOnHumanSpeech &&
      beforeQuestion &&
      (state.spokeAt === undefined || audibleFor(state, event.at) < 1)
    ) {
      return immediateAbort(next, event.at, "resumed");
    }
    return { state: next, effects: [] };
  }

  if (event.type === "HUMAN_COMMIT") {
    const source = event.source ?? "scribe";
    const next: TurnState = {
      ...state,
      scribeText: source === "scribe" ? append(state.scribeText, event.text) : state.scribeText,
      agentAsrText: source === "agent_asr" ? append(state.agentAsrText, event.text) : state.agentAsrText,
      partial: "",
      lastHumanSpeechAt: event.at,
    };
    if (state.phase === "closing" && state.close && state.close.via !== "aborted") {
      const captured = heard(next);
      next.close = {
        ...state.close,
        ...captured,
        answeredAt: captured.heard ? state.close.answeredAt ?? event.at : state.close.answeredAt,
      };
    }
    return {
      state: next,
      effects: [],
    };
  }

  if (event.type === "CANCEL") {
    const reason = event.reason ?? "user";
    if (state.phase === "listening") {
      return enterClosing(state, { via: "aborted", heard: "", abortReason: reason, startedAt: event.at });
    }
    if (state.phase === "closing") return { state, effects: [] };
    return immediateAbort(state, event.at, reason);
  }

  if (event.type === "COMMAND" && state.phase === "listening") {
    return enterClosing(state, { via: "aborted", heard: "", command: event.command, startedAt: event.at });
  }

  if (event.type === "TOOL") {
    const tool = { name: event.name, params: event.params };
    if (state.phase === "listening") return closeListening(state, event.at, "tool", { tool });
    if (state.phase === "closing" && state.close) {
      return { state: { ...state, close: { ...state.close, tool } }, effects: [] };
    }
    return { state, effects: [] };
  }

  if (event.type === "TYPED" && state.phase === "listening") {
    const text = event.text.trim();
    return enterClosing(state, {
      via: "typed",
      heard: text,
      ...(text ? { heardSource: "typed" as const, answeredAt: event.at } : {}),
      startedAt: event.at,
    });
  }

  if (event.type === "SPEAK_START") {
    if (state.waitingForSquelch) {
      return { state: { ...state, squelchedSpeechStarted: true, squelchSpeechEndedAt: undefined }, effects: [] };
    }
    if (state.phase === "closing") {
      return {
        state: { ...state, ackStartedAt: state.ackStartedAt ?? event.at, ackEndCandidateAt: undefined },
        effects: [],
      };
    }
    if (state.phase === "listening") {
      return { state: { ...state, lastAgentSpeechEnd: Number.POSITIVE_INFINITY }, effects: [] };
    }
    if (state.phase === "sending" || state.phase === "waiting_for_speech" || state.phase === "speaking") {
      return {
        state: {
          ...state,
          phase: "speaking",
          spokeAt: state.spokeAt ?? event.at,
          spokenBy: event.source ?? state.spokenBy ?? "agent",
          speechEndCandidateAt: undefined,
        },
        effects: [{ type: "OPEN_GATE" }],
      };
    }
  }

  if (event.type === "SPEAK_END") {
    if (state.waitingForSquelch) {
      return { state: { ...state, squelchSpeechEndedAt: event.at }, effects: [] };
    }
    if (state.phase === "speaking") {
      return { state: { ...state, speechEndCandidateAt: event.at }, effects: [] };
    }
    if (state.phase === "closing" && state.ackStartedAt !== undefined) {
      return { state: { ...state, ackEndCandidateAt: event.at }, effects: [] };
    }
    if (state.phase === "listening") {
      return { state: { ...state, lastAgentSpeechEnd: event.at }, effects: [] };
    }
  }

  if (event.type !== "TICK") return { state, effects: [] };

  if (state.waitingForSquelch) {
    const queuedAt = state.queuedAt ?? event.at;
    const quietWithoutStart = !state.squelchedSpeechStarted && event.at - queuedAt + EPSILON >= 2.5;
    const oldSpeechEnded = state.squelchSpeechEndedAt !== undefined;
    const hitCap = event.at - queuedAt + EPSILON >= 8;
    if (quietWithoutStart || oldSpeechEnded || hitCap) {
      if (state.agentConnected === false) {
        return {
          state: {
            ...state,
            phase: "speaking",
            sentAt: event.at,
            waitingForSquelch: false,
            fallbackRequestedAt: event.at,
            spokenBy: "fallback",
          },
          effects: [{ type: "OPEN_GATE" }, { type: "MUTE" }, { type: "FALLBACK_SPEAK", text: spokenText(state) }],
        };
      }
      return {
        state: { ...state, phase: "sending", sentAt: event.at, waitingForSquelch: false },
        effects: [
          { type: "OPEN_GATE" },
          { type: "MUTE" },
          { type: "SEND_TAG", tag: state.options!.tag, text: state.options!.text },
        ],
      };
    }
    return { state, effects: [] };
  }

  if (state.phase === "sending") return { state: { ...state, phase: "waiting_for_speech" }, effects: [] };

  if (state.phase === "waiting_for_speech") {
    const watchdogSecs = state.options?.watchdogSecs ?? 4;
    if (event.at - (state.sentAt ?? event.at) + EPSILON >= watchdogSecs) {
      return {
        state: {
          ...state,
          phase: "speaking",
          spokenBy: "fallback",
          fallbackRequestedAt: event.at,
        },
        effects: [{ type: "SQUELCH" }, { type: "FALLBACK_SPEAK", text: spokenText(state) }],
      };
    }
    return { state, effects: [] };
  }

  if (state.phase === "speaking") {
    if (state.fallbackRequestedAt !== undefined && state.spokeAt === undefined) {
      if (event.at - state.fallbackRequestedAt + EPSILON >= 1.5) return immediateAbort(state, event.at, "silent", false);
      return { state, effects: [] };
    }
    const words = spokenText(state).trim().split(/\s+/u).filter(Boolean).length;
    const speechCap = Math.min(80, 6 + 0.45 * words);
    const hitCap = state.spokeAt !== undefined && event.at - state.spokeAt + EPSILON >= speechCap;
    const heldFallingEdge =
      state.speechEndCandidateAt !== undefined && event.at - state.speechEndCandidateAt + EPSILON >= 0.6;
    if (hitCap || heldFallingEdge) return finishSpeech(state, event.at);
    return { state, effects: [] };
  }

  if (state.phase === "listening") {
    const askedAt = state.askedAt ?? state.sentAt ?? event.at;
    const silenceCloseSecs = state.options?.silenceCloseSecs ?? 2.5;
    const effectiveSilence = Number.isFinite(state.lastAgentSpeechEnd) && state.lastAgentSpeechEnd > askedAt ? 8 : silenceCloseSecs;
    const captured = heard(state);
    const silenceAnchor = Math.max(state.lastHumanSpeechAt, state.lastAgentSpeechEnd, askedAt);
    if (captured.heard && event.at - silenceAnchor + EPSILON >= effectiveSilence) {
      return closeListening(state, event.at, "scribe");
    }
    if (
      !captured.heard &&
      state.partial &&
      event.at - state.lastPartialAt + EPSILON >= silenceCloseSecs + 2
    ) {
      const withPartial = { ...state, scribeText: state.partial, partial: "" };
      return closeListening(withPartial, event.at, "scribe");
    }
    const maxSecs = state.options?.maxSecs ?? 60;
    if (event.at - askedAt + EPSILON >= maxSecs) {
      return closeListening(state, event.at, captured.heard ? "scribe" : "timeout");
    }
    const timeoutSecs = state.options?.timeoutSecs ?? 12;
    const freshPartial = Boolean(state.partial) && event.at - state.lastPartialAt < 3;
    const humanAnchor = Math.max(askedAt, state.lastHumanSpeechAt);
    if (!freshPartial && event.at - humanAnchor + EPSILON >= timeoutSecs) {
      return closeListening(state, event.at, captured.heard ? "scribe" : "timeout");
    }
    return { state, effects: [] };
  }

  if (state.phase === "closing" && state.close) {
    const closingFor = event.at - state.close.startedAt;
    const humanAnchor = Number.isFinite(state.lastHumanSpeechAt) ? state.lastHumanSpeechAt : state.close.startedAt;
    const humanQuiet = event.at - humanAnchor + EPSILON >= 1.5;
    const ackDone =
      state.ackEndCandidateAt !== undefined && event.at - state.ackEndCandidateAt + EPSILON >= 0.6;
    const ackMaxSecs = state.options?.ackMaxSecs ?? 8;
    const ackTimedOut = state.ackStartedAt !== undefined && event.at - state.ackStartedAt + EPSILON >= ackMaxSecs;
    const noAck = state.ackStartedAt === undefined && closingFor + EPSILON >= 2.5;
    if (closingFor + EPSILON >= 20 || (humanQuiet && (ackDone || ackTimedOut || noAck))) {
      return resolveClosing(state, event.at);
    }
  }

  return { state, effects: [] };
}

export const reduceTurn = reduce;
