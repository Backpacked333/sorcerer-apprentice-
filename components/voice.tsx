"use client";

/**
 * The voice layer. One API for the pages, two implementations underneath:
 *  - agent: an ElevenAgents conversation (mic muted until the governor opens a window) plus Scribe v2 Realtime
 *  - fallback: the browser's speechSynthesis and webkitSpeechRecognition, so the whole flow runs with no keys
 */
import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { ConversationProvider, useConversation, useConversationClientTool, useConversationControls, useConversationMode, useConversationStatus, useScribe, type ScribeCallbacks } from "@elevenlabs/react";
import { composedVoiceGateState, initialTurnState, type TurnEffect, type TurnEvent, type TurnOptions, type TurnPhase, type TurnResult, type TurnState } from "@/lib/voice-turn";
import { stopAndClearMediaStream, VoiceTurnAdapter } from "@/lib/voice-turn-adapter";
export type { TurnOptions, TurnPhase, TurnResult } from "@/lib/voice-turn";
import { AgentSpeechTimeline, type VoiceCommand } from "@/lib/voice-protocol";
import {
  AgentSpeechTracker,
  buildVoiceHubScribeOptions,
  cleanupVoiceHubProvider,
  createTurnHubSubscriber,
  routeAgentAsrMessage,
  routeWebSpeechResult,
  VoiceHubConnectionCoordinator,
  voiceHubConfigFingerprint,
  VoiceHubRouter,
  type VoiceHubEffectiveConfig,
  type VoiceHubSubscriber,
  type VoiceTranscriptMeta,
} from "@/lib/voice-hub";

export const TOOL_NAMES = ["log_answer", "mark_off_record", "confirm_teachback", "end_task", "flag_for_expert", "show_replay", "record_prediction", "record_mastery", "end_session"] as const;
export type ToolName = (typeof TOOL_NAMES)[number];
export type ToolHandler = (params: Record<string, unknown>) => string | void | Promise<string | void>;
export type ToolHandlers = Partial<Record<ToolName, ToolHandler>>;

export interface VoiceMessage {
  role: "user" | "agent";
  text: string;
  t: number; // epoch ms
}

export interface VoiceDebugEvent {
  at: number;
  src: "agent" | "scribe" | "turn" | "gate" | "tool";
  type: string;
  data?: unknown;
}

export interface VoiceConnectOptions {
  firstMessage?: string;
  prompt?: string;
  language?: string;
  dynamicVariables?: Record<string, string>;
  sessionStartMs?: number;
  keyterms?: string[];
}

export function buildAgentReconnectOptions(opts: VoiceConnectOptions = {}): VoiceConnectOptions {
  const { firstMessage: _firstMessage, ...rest } = opts;
  return rest;
}

export function shouldSuppressAgentSpeech({
  configuredMode,
  hasVoiceError,
  sessionRequested,
  status,
}: {
  configuredMode: VoiceApi["mode"];
  hasVoiceError: boolean;
  sessionRequested: boolean;
  status: string;
}): boolean {
  return configuredMode === "agent" && !hasVoiceError && sessionRequested && status !== "connected";
}

export function buildAgentSessionOptions(agentId: string, opts: VoiceConnectOptions = {}) {
  const agentOverrides = {
    ...(opts.firstMessage ? { firstMessage: opts.firstMessage } : {}),
    ...(opts.prompt ? { prompt: { prompt: opts.prompt } } : {}),
    ...(opts.language ? { language: opts.language as "en" } : {}),
  };
  return {
    agentId,
    connectionType: "webrtc" as const,
    dynamicVariables: {
      expert_name: "the expert",
      newhire_name: "the new hire",
      task: "the task on screen",
      ...opts.dynamicVariables,
    },
    ...(Object.keys(agentOverrides).length ? { overrides: { agent: agentOverrides } } : {}),
  };
}

export type ConnectionOutcome =
  | { kind: "connected" | "cancelled"; generation: number }
  | { kind: "degraded"; generation: number; reason: string };

export function createCancellationGuard(isCancelled: () => boolean) {
  return { run<T>(action: () => T): T | undefined { return isCancelled() ? undefined : action(); } };
}

export interface ConversationVolumeControl {
  setVolume(options: { volume: number }): void;
}

export function applyConversationGate(control: ConversationVolumeControl, open: boolean): boolean {
  try {
    control.setVolume({ volume: open ? 1 : 0 });
    return true;
  } catch {
    return false;
  }
}

export interface RemoteStreamAudio {
  nodeName?: string;
  volume: number;
  autoplay?: boolean;
  parentElement?: unknown;
  srcObject?: null | { getAudioTracks?: () => ArrayLike<{ kind?: string }> };
}

export interface MediaPlayTarget {
  play(this: RemoteStreamAudio): Promise<void>;
}

interface PlaybackGateEntry {
  readVolume: () => number;
  isTarget: (element: RemoteStreamAudio) => boolean;
}

interface PlaybackGateRegistry {
  originalPlay: MediaPlayTarget["play"];
  guardedPlay: MediaPlayTarget["play"];
  entries: Set<PlaybackGateEntry>;
}

const playbackGateRegistries = new WeakMap<object, PlaybackGateRegistry>();

export function isElevenLabsRemoteStreamAudio(element: RemoteStreamAudio): boolean {
  if (element.nodeName?.toUpperCase() !== "AUDIO" || element.autoplay !== true || element.parentElement != null) return false;
  const tracks = element.srcObject?.getAudioTracks?.();
  return Boolean(tracks && Array.from(tracks).some((track) => track.kind === undefined || track.kind === "audio"));
}

export function installElevenLabsPlaybackGate({
  playTarget,
  readVolume,
  isTarget = isElevenLabsRemoteStreamAudio,
}: {
  playTarget: MediaPlayTarget;
  readVolume: () => number;
  isTarget?: (element: RemoteStreamAudio) => boolean;
}): () => void {
  let registry = playbackGateRegistries.get(playTarget);
  if (!registry) {
    const originalPlay = playTarget.play;
    const entries = new Set<PlaybackGateEntry>();
    const guardedPlay = function (this: RemoteStreamAudio) {
      const volumes = Array.from(entries).flatMap((entry) => entry.isTarget(this) ? [entry.readVolume()] : []);
      if (volumes.length) this.volume = Math.min(...volumes);
      return originalPlay.call(this);
    };
    registry = { originalPlay, guardedPlay, entries };
    playbackGateRegistries.set(playTarget, registry);
    playTarget.play = guardedPlay;
  }
  const entry = { readVolume, isTarget };
  registry.entries.add(entry);

  return () => {
    const current = playbackGateRegistries.get(playTarget);
    if (!current) return;
    current.entries.delete(entry);
    if (current.entries.size > 0) return;
    if (playTarget.play === current.guardedPlay) playTarget.play = current.originalPlay;
    playbackGateRegistries.delete(playTarget);
  };
}

export interface SpeechAuthorizationSnapshot {
  pending: boolean;
  active: boolean;
  falling: boolean;
  timeoutSquelched: boolean;
  authorized: boolean;
  heartbeatAllowed: boolean;
}

export function createSpeechAuthorizationLatch({
  fallingEdgeMs = 600,
  speechStartWatchdogMs = 8_000,
  schedule = (callback, ms) => globalThis.setTimeout(callback, ms),
  cancelTimer = (timer) => globalThis.clearTimeout(timer),
  onChange = () => {},
  onDefinitiveEnd = () => {},
  onPendingTimeout = () => {},
}: {
  fallingEdgeMs?: number;
  speechStartWatchdogMs?: number;
  schedule?: (callback: () => void, ms: number) => ReturnType<typeof globalThis.setTimeout>;
  cancelTimer?: (timer: ReturnType<typeof globalThis.setTimeout>) => void;
  onChange?: () => void;
  onDefinitiveEnd?: () => void;
  onPendingTimeout?: () => void;
} = {}) {
  let pending = false;
  let active = false;
  let speaking = false;
  let timeoutSquelched = false;
  let fallingTimer: ReturnType<typeof globalThis.setTimeout> | undefined;
  let pendingTimer: ReturnType<typeof globalThis.setTimeout> | undefined;
  const changed = () => onChange();
  const cancelFalling = () => {
    if (fallingTimer === undefined) return;
    cancelTimer(fallingTimer);
    fallingTimer = undefined;
  };
  const cancelPending = () => {
    if (pendingTimer === undefined) return;
    cancelTimer(pendingTimer);
    pendingTimer = undefined;
  };
  const finishAfterFallingEdge = () => {
    if (fallingTimer !== undefined || (!active && !pending)) return;
    if (pending) {
      cancelPending();
      pending = false;
      active = true;
    }
    fallingTimer = schedule(() => {
      fallingTimer = undefined;
      active = false;
      changed();
      onDefinitiveEnd();
    }, fallingEdgeMs);
    changed();
  };
  return {
    authorize() {
      cancelFalling();
      timeoutSquelched = false;
      pending = true;
      active = false;
      speaking = false;
      cancelPending();
      pendingTimer = schedule(() => {
        pendingTimer = undefined;
        if (!pending) return;
        pending = false;
        timeoutSquelched = true;
        changed();
        onPendingTimeout();
      }, speechStartWatchdogMs);
      changed();
    },
    onMode(mode: "speaking" | "listening") {
      const rising = mode === "speaking" && !speaking;
      if (mode === "speaking") {
        cancelPending();
        cancelFalling();
        speaking = true;
        if (pending) {
          pending = false;
          active = true;
        }
        changed();
        return { rising };
      }
      const wasSpeaking = speaking;
      speaking = false;
      if (active && wasSpeaking) finishAfterFallingEdge();
      return { rising: false };
    },
    finish: finishAfterFallingEdge,
    cancel() {
      cancelFalling();
      cancelPending();
      pending = false;
      active = false;
      speaking = false;
      timeoutSquelched = false;
      changed();
    },
    snapshot(): SpeechAuthorizationSnapshot {
      const falling = fallingTimer !== undefined;
      const authorized = pending || active || falling;
      return { pending, active, falling, timeoutSquelched, authorized, heartbeatAllowed: !authorized };
    },
  };
}

export function startTaggedTurn(
  legacyAuthorization: Pick<ReturnType<typeof createSpeechAuthorizationLatch>, "cancel">,
  adapter: VoiceTurnAdapter,
  options: TurnOptions,
): Promise<TurnResult> {
  legacyAuthorization.cancel();
  return adapter.turn(options);
}

export function createConnectionLifecycle({
  onOutcome,
  endSession,
  schedule = (fn, ms) => globalThis.setTimeout(fn, ms) as unknown as number,
  cancelTimer = (timer) => globalThis.clearTimeout(timer),
}: {
  onOutcome: (outcome: ConnectionOutcome) => void;
  endSession: () => void;
  schedule?: (fn: () => void, ms: number) => number;
  cancelTimer?: (timer: number) => void;
}) {
  let nextGeneration = 0;
  let attempt: { generation: number; waitForFirstMessage: boolean; connected: boolean; sawSpeaking: boolean; timer: number; promise: Promise<ConnectionOutcome>; resolve: (outcome: ConnectionOutcome) => void } | undefined;

  const settle = (generation: number, outcome: ConnectionOutcome, end: boolean) => {
    if (!attempt || attempt.generation !== generation) return false;
    cancelTimer(attempt.timer);
    const resolve = attempt.resolve;
    attempt = undefined;
    if (end) endSession();
    onOutcome(outcome);
    resolve(outcome);
    return true;
  };
  const start = (waitForFirstMessage: boolean) => {
    if (attempt) return { generation: attempt.generation, promise: attempt.promise, isNew: false };
    const generation = ++nextGeneration;
    let resolve!: (outcome: ConnectionOutcome) => void;
    const promise = new Promise<ConnectionOutcome>((done) => { resolve = done; });
    const timer = schedule(() => settle(generation, { kind: "degraded", generation, reason: "Agent connection timed out after 20 seconds." }, true), 20_000);
    attempt = { generation, waitForFirstMessage, connected: false, sawSpeaking: false, timer, promise, resolve };
    return { generation, promise, isNew: true };
  };
  const connected = (generation: number) => {
    if (!attempt || attempt.generation !== generation) return false;
    attempt.connected = true;
    cancelTimer(attempt.timer);
    if (!attempt.waitForFirstMessage) return settle(generation, { kind: "connected", generation }, false);
    attempt.timer = schedule(() => settle(generation, { kind: "connected", generation }, false), 15_000);
    return true;
  };
  const mode = (generation: number, value: "speaking" | "listening") => {
    if (!attempt || attempt.generation !== generation || !attempt.connected || !attempt.waitForFirstMessage) return false;
    if (value === "speaking") attempt.sawSpeaking = true;
    else if (attempt.sawSpeaking) return settle(generation, { kind: "connected", generation }, false);
    return true;
  };
  const fail = (generation: number, reason: string) => settle(generation, { kind: "degraded", generation, reason }, true);
  const cancel = (generation: number) => settle(generation, { kind: "cancelled", generation }, true);
  return { start, connected, mode, fail, cancel, activeGeneration: () => attempt?.generation, activeAttempt: () => attempt ? { generation: attempt.generation, promise: attempt.promise } : undefined };
}

export type AgentReconnectDecision =
  | { action: "stop" }
  | { action: "retry"; attempt: number; delayMs: number }
  | { action: "exhausted"; attempt: number };

export function createAgentReconnectPolicy({
  delaysMs = [750, 1_500],
  stableAfterMs = 10_000,
  schedule = (callback, delayMs) => globalThis.setTimeout(callback, delayMs),
  cancelTimer = (timer) => globalThis.clearTimeout(timer as ReturnType<typeof globalThis.setTimeout>),
}: {
  delaysMs?: number[];
  stableAfterMs?: number;
  schedule?: (callback: () => void, delayMs: number) => unknown;
  cancelTimer?: (timer: unknown) => void;
} = {}) {
  let attempts = 0;
  let retryTimer: unknown;
  let stableTimer: unknown;
  const cancelRetry = () => {
    if (retryTimer === undefined) return;
    cancelTimer(retryTimer);
    retryTimer = undefined;
  };
  const cancelStableReset = () => {
    if (stableTimer === undefined) return;
    cancelTimer(stableTimer);
    stableTimer = undefined;
  };
  return {
    handleDisconnect({ reason, requested, current, retry }: { reason: string; requested: boolean; current: boolean; retry: () => void }): AgentReconnectDecision {
      if (reason !== "error" || !requested || !current) return { action: "stop" };
      cancelRetry();
      cancelStableReset();
      if (attempts >= delaysMs.length) return { action: "exhausted", attempt: attempts };
      const attempt = ++attempts;
      const delayMs = delaysMs[attempt - 1];
      retryTimer = schedule(() => {
        retryTimer = undefined;
        retry();
      }, delayMs);
      return { action: "retry", attempt, delayMs };
    },
    connected() {
      cancelRetry();
      cancelStableReset();
      stableTimer = schedule(() => {
        stableTimer = undefined;
        attempts = 0;
      }, stableAfterMs);
    },
    cancel() {
      cancelRetry();
      cancelStableReset();
      attempts = 0;
    },
  };
}

export interface VoiceApi {
  mode: "agent" | "fallback";
  connected: boolean;
  status: string;
  isSpeaking: boolean;
  micMuted: boolean;
  messages: VoiceMessage[];
  degraded: boolean;
  lastError?: string;
  connect: (opts?: VoiceConnectOptions) => Promise<void>;
  disconnect: () => void;
  getId: () => string | undefined;
  /** Tagged message to the agent ([ASK], [DEBRIEF], [TEACHBACK], [INTERVENE] ...). In fallback mode the text is spoken aloud. */
  say: (tag: string, text: string, spoken?: string) => void;
  setMicMuted: (muted: boolean) => void;
  sendContext: (text: string) => void;
  gateOpen: boolean;
  noteUserActivity: () => void;
  turn: (opts: TurnOptions) => Promise<TurnResult>;
  cancelTurn: (reason?: TurnResult["abortReason"]) => void;
  submitTyped: (text: string) => void;
  setSessionStart: (epochMs: number) => void;
  lastHumanSpeechAt: () => number;
  turnPhase: TurnPhase;
  partial: string;
  stt: { engine: "scribe" | "webspeech" | "none"; connected: boolean };
}

const VoiceContext = createContext<VoiceApi | null>(null);
const VoiceDebugContext = createContext<((event: VoiceDebugEvent) => void) | undefined>(undefined);

interface TranscriberHubValue {
  engine: "scribe" | "webspeech" | "none";
  connected: boolean;
  partial: string;
  subscribe: (id: string, read: () => VoiceHubSubscriber) => () => void;
  refresh: () => void;
}

const TranscriberHubContext = createContext<TranscriberHubValue | null>(null);

export function useVoice(): VoiceApi {
  const v = useContext(VoiceContext);
  if (!v) throw new Error("useVoice must be used inside VoiceProvider");
  return v;
}

export function VoiceProvider({
  agentId,
  tools,
  onDebugEvent,
  children,
}: {
  agentId?: string;
  tools: React.MutableRefObject<ToolHandlers>;
  onDebugEvent?: (event: VoiceDebugEvent) => void;
  children: ReactNode;
}) {
  return (
    <ConversationProvider>
      <VoiceInner agentId={agentId} tools={tools} onDebugEvent={onDebugEvent}>
        {children}
      </VoiceInner>
    </ConversationProvider>
  );
}

function VoiceInner({ agentId, tools, onDebugEvent, children }: { agentId?: string; tools: React.MutableRefObject<ToolHandlers>; onDebugEvent?: (event: VoiceDebugEvent) => void; children: ReactNode }) {
  const configuredMode: VoiceApi["mode"] = agentId ? "agent" : "fallback";
  const [micMuted, setMicMutedState] = useState(true);
  const [messages, setMessages] = useState<VoiceMessage[]>([]);
  const [fallbackSpeaking, setFallbackSpeaking] = useState(false);
  const [fallbackConnected, setFallbackConnected] = useState(false);
  const [voiceError, setVoiceError] = useState<string>();
  const [agentReconnecting, setAgentReconnecting] = useState(false);
  const [sttError, setSttError] = useState<string>();
  const [sessionRequested, setSessionRequested] = useState(false);
  const [, setTranscriberRevision] = useState(0);
  const [, setReconcileRevision] = useState(0);
  const [transcriberState, setTranscriberState] = useState<{ engine: "scribe" | "webspeech" | "none"; connected: boolean; partial: string }>({ engine: "none", connected: false, partial: "" });
  const [gateHoldUntil, setGateHoldUntil] = useState(0);
  const [turnState, setTurnState] = useState<TurnState>(initialTurnState);
  const [, setGateRevision] = useState(0);
  const controls = useConversationControls();
  const conversationStatus = useConversationStatus();
  const conversationMode = useConversationMode();
  const transportStatusRef = useRef<string>(conversationStatus.status);
  const micMutedRef = useRef(true);
  const gateHoldUntilRef = useRef(0);
  const sessionStartRef = useRef<number | undefined>(undefined);
  const sessionRequestedRef = useRef(false);
  const lastHumanSpeechAtRef = useRef(Number.NEGATIVE_INFINITY);
  const turnDispatchRef = useRef<(event: TurnEvent) => void>(() => {});
  const turnEffectRef = useRef<(effect: TurnEffect, generation: number) => void | Promise<void>>(() => {});
  const turnConnectedRef = useRef(false);
  const nowTurnRef = useRef(() => Date.now() / 1_000);
  const turnAdapterRef = useRef<VoiceTurnAdapter | undefined>(undefined);
  const turnCleanupRef = useRef<() => void>(() => {});
  const degradedAgentFallbackRef = useRef(false);
  const reconnectingRef = useRef(false);
  const clipRecorderRef = useRef<MediaRecorder | null>(null);
  const clipStreamRef = useRef<MediaStream | null>(null);
  const clipChunksRef = useRef<Blob[]>([]);
  const clipSessionRef = useRef<string | undefined>(undefined);
  const gateChangedRef = useRef<() => void>(() => {});
  const authorizationTimeoutRef = useRef<() => void>(() => {});
  const definitiveSpeechEndRef = useRef<() => void>(() => {});
  const noteUserActivityRef = useRef<() => void>(() => {});
  const humanActivityRef = useRef<() => void>(() => {});
  const timelineRef = useRef<AgentSpeechTimeline | undefined>(undefined);
  if (!timelineRef.current) timelineRef.current = new AgentSpeechTimeline();
  const speechTrackerRef = useRef<AgentSpeechTracker | undefined>(undefined);
  if (!speechTrackerRef.current) speechTrackerRef.current = new AgentSpeechTracker(timelineRef.current);
  const hubRef = useRef<VoiceHubRouter | undefined>(undefined);
  if (!hubRef.current) hubRef.current = new VoiceHubRouter({ timeline: timelineRef.current, onHumanActivity: () => humanActivityRef.current() });
  const expectedSpeechTextRef = useRef("");
  const scribeKeytermsRef = useRef<string[] | undefined>(undefined);
  const recognizer = useRef<SpeechRecognitionLike | null>(null);
  const transcriberDemandRef = useRef(false);
  const coordinatorRef = useRef<VoiceHubConnectionCoordinator | undefined>(undefined);
  if (!coordinatorRef.current) coordinatorRef.current = new VoiceHubConnectionCoordinator();
  const mountedRef = useRef(true);
  const effectiveConfigFingerprintRef = useRef("");
  const emitRef = useRef<(src: VoiceDebugEvent["src"], type: string, data?: unknown) => void>(() => {});
  const fatalScribeRef = useRef<(reason: string) => void>(() => {});
  const scribeDisconnectRef = useRef<() => void>(() => {});
  const reconcileRef = useRef<() => void>(() => {});
  sessionRequestedRef.current = sessionRequested;
  if (!turnAdapterRef.current) turnAdapterRef.current = new VoiceTurnAdapter({
    now: () => nowTurnRef.current(),
    agentConnected: () => turnConnectedRef.current,
    applyEffect: (effect, generation) => turnEffectRef.current(effect, generation),
    onState: (state) => { if (mountedRef.current) setTurnState(state); },
    onPhase: (phase) => {
      if (mountedRef.current) setTranscriberRevision((revision) => revision + 1);
      emitRef.current("turn", "phase", { phase });
    },
    onError: (error) => emitRef.current("turn", "effect_error", error instanceof Error ? error.message : String(error)),
  });
  turnDispatchRef.current = (event) => turnAdapterRef.current!.dispatch(event);
  const authorization = useRef<ReturnType<typeof createSpeechAuthorizationLatch> | undefined>(undefined);
  if (!authorization.current) authorization.current = createSpeechAuthorizationLatch({
    onChange: () => gateChangedRef.current(),
    onPendingTimeout: () => authorizationTimeoutRef.current(),
    onDefinitiveEnd: () => definitiveSpeechEndRef.current(),
  });
  const lastUserActivityAtRef = useRef(0);
  const firstMessages = useRef(new Map<number, string>());
  const establishedGeneration = useRef<number | undefined>(undefined);
  const outcomeHandler = useRef<(outcome: ConnectionOutcome) => void>(() => {});
  const lifecycle = useRef<ReturnType<typeof createConnectionLifecycle> | undefined>(undefined);
  if (!lifecycle.current) lifecycle.current = createConnectionLifecycle({
    onOutcome: (outcome) => outcomeHandler.current(outcome),
    endSession: controls.endSession,
  });
  const reconnectPolicy = useRef<ReturnType<typeof createAgentReconnectPolicy> | undefined>(undefined);
  if (!reconnectPolicy.current) reconnectPolicy.current = createAgentReconnectPolicy();
  const connectAgentRef = useRef<(opts: VoiceConnectOptions | undefined, reconnecting: boolean) => Promise<void>>(async () => {});
  const lastVadEventAt = useRef(0);
  const speakFallbackRef = useRef<(text: string, lifecycle?: { onStart?: () => void; onEnd?: () => void; isCancelled?: () => boolean }) => Promise<void>>(async () => {});
  const emit = useCallback((src: VoiceDebugEvent["src"], type: string, data?: unknown) => {
    onDebugEvent?.({ at: Date.now(), src, type, ...(data === undefined ? {} : { data }) });
  }, [onDebugEvent]);
  emitRef.current = emit;
  const extendGateHold = useCallback((until: number) => {
    if (until <= gateHoldUntilRef.current) return;
    gateHoldUntilRef.current = until;
    setGateHoldUntil(until);
  }, []);
  const authorizeSpeech = useCallback((text: string) => {
    const words = text.trim().split(/\s+/).filter(Boolean).length;
    const until = Date.now() + (2 + 0.45 * words) * 1000;
    expectedSpeechTextRef.current = text;
    turnAdapterRef.current!.authorizeLegacy();
    authorization.current!.authorize();
    extendGateHold(until);
  }, [extendGateHold]);
  const gateIsOpenAt = useCallback((now: number) => composedVoiceGateState({
    turnPhase: turnAdapterRef.current!.snapshot().phase,
    legacyAuthorized: authorization.current!.snapshot().authorized,
    now,
    gateHoldUntil: gateHoldUntilRef.current,
    micMuted: micMutedRef.current,
    squelch: turnAdapterRef.current!.isSquelched() || authorization.current!.snapshot().timeoutSquelched,
  }), []);
  const reassertGate = useCallback((now = Date.now()) => {
    applyConversationGate(controls, gateIsOpenAt(now));
  }, [controls, gateIsOpenAt]);
  useEffect(() => {
    gateChangedRef.current = () => {
      if (!authorization.current!.snapshot().authorized) {
        gateHoldUntilRef.current = 0;
        setGateHoldUntil(0);
      }
      setGateRevision((revision) => revision + 1);
      reassertGate();
    };
    return () => { gateChangedRef.current = () => {}; };
  }, [reassertGate]);
  const handleAgentMode = useCallback((data: { mode: "speaking" | "listening" }) => {
    const now = Date.now();
    const authorizedBefore = authorization.current!.snapshot().authorized;
    const { rising } = authorization.current!.onMode(data.mode);
    speechTrackerRef.current!.onMode(data.mode, now / 1_000, expectedSpeechTextRef.current);
    const at = nowTurnRef.current();
    const turnSnapshot = turnAdapterRef.current!.snapshot();
    const lateAgentWhileFallback = turnAdapterRef.current!.isSquelched() && turnSnapshot.spokenBy === "fallback";
    if (!lateAgentWhileFallback) turnDispatchRef.current(data.mode === "speaking" ? { type: "SPEAK_START", at, source: "agent" } : { type: "SPEAK_END", at });
    const authorized = authorizedBefore || authorization.current!.snapshot().authorized;
    emit("agent", "mode", data);
    reassertGate(now);
    if (rising) {
      const open = gateIsOpenAt(now);
      if (!open) emit("gate", "gated_utterance");
      else if (!authorized) emit("gate", "audible_unsolicited");
    }
  }, [emit, gateIsOpenAt, reassertGate]);
  const noteUserActivity = useCallback(() => {
    if (conversationStatus.status !== "connected") return;
    const now = Date.now();
    if (now - lastUserActivityAtRef.current < 1_000) return;
    try {
      controls.sendUserActivity();
      lastUserActivityAtRef.current = now;
      emit("gate", "heartbeat");
    } catch {
      // A disconnect can race a heartbeat; the next connected interval resumes it.
    }
  }, [controls, conversationStatus.status, emit]);
  useEffect(() => {
    noteUserActivityRef.current = noteUserActivity;
    humanActivityRef.current = noteUserActivity;
    authorizationTimeoutRef.current = () => {
      emit("gate", "authorization_timeout", { watchdogMs: 8_000 });
      noteUserActivityRef.current();
    };
    definitiveSpeechEndRef.current = () => {
      expectedSpeechTextRef.current = "";
    };
    return () => {
      noteUserActivityRef.current = () => {};
      humanActivityRef.current = () => {};
      authorizationTimeoutRef.current = () => {};
      definitiveSpeechEndRef.current = () => {};
    };
  }, [emit, noteUserActivity]);
  const activateFallback = useCallback((reason: string, generation?: number) => {
    if (generation !== undefined && establishedGeneration.current !== generation) return;
    establishedGeneration.current = undefined;
    reconnectingRef.current = false;
    setAgentReconnecting(false);
    setVoiceError(reason);
    setFallbackConnected(true);
    emit("agent", "degraded", { reason });
  }, [emit]);

  useEffect(() => {
    outcomeHandler.current = (outcome) => {
      const firstMessage = firstMessages.current.get(outcome.generation);
      firstMessages.current.delete(outcome.generation);
      if (outcome.kind === "connected") {
        reconnectPolicy.current!.connected();
        establishedGeneration.current = outcome.generation;
        reconnectingRef.current = false;
        setAgentReconnecting(false);
        window.speechSynthesis?.cancel();
        setFallbackConnected(false);
        setVoiceError(undefined);
      } else if (outcome.kind === "degraded") {
        activateFallback(outcome.reason);
        if (firstMessage) {
          authorizeSpeech(firstMessage);
          void speakFallbackRef.current(firstMessage).finally(() => authorization.current!.finish());
        }
      } else {
        setFallbackConnected(false);
      }
      emit("agent", `connect_${outcome.kind}`, outcome);
    };
  }, [activateFallback, authorizeSpeech, emit]);

  useConversation({
    micMuted,
    onConnect: (data) => {
      emit("agent", "connect", data);
      reassertGate();
    },
    onDisconnect: (details) => {
      speechTrackerRef.current!.close(Date.now() / 1_000);
      definitiveSpeechEndRef.current();
      authorization.current!.cancel();
      gateHoldUntilRef.current = 0;
      setGateHoldUntil(0);
      applyConversationGate(controls, false);
      if (!degradedAgentFallbackRef.current) turnAdapterRef.current!.disconnect();
      stopAndClearMediaStream(clipStreamRef);
      emit("agent", "disconnect", details);
    },
    onError: (message, context) => emit("agent", "error", { message, context }),
    onStatusChange: (data) => {
      transportStatusRef.current = data.status;
      turnConnectedRef.current = configuredMode === "agent" && !voiceError && data.status === "connected";
      emit("agent", "status", data);
    },
    onModeChange: handleAgentMode,
    onMessage: (m) => {
      if (m.role === "agent") {
        expectedSpeechTextRef.current = m.message;
        speechTrackerRef.current!.refine(m.message);
      }
      if (m.role === "user" && !m.message.trimStart().startsWith("[")) {
        const routed = routeAgentAsrMessage({ text: m.message, atMs: Date.now(), timeline: timelineRef.current!, sessionStartMs: sessionStartRef.current });
        if (routed.human) {
          lastHumanSpeechAtRef.current = Math.max(lastHumanSpeechAtRef.current, routed.at);
          if (turnAdapterRef.current!.snapshot().phase !== "idle") turnDispatchRef.current({ type: "HUMAN_COMMIT", at: routed.at, text: routed.text, source: "agent_asr" });
        }
      }
      setMessages((xs) => [...xs, { role: m.role === "agent" ? "agent" : "user", text: m.message, t: Date.now() }]);
      emit("agent", "message", m);
    },
    onDebug: (data) => {
      emit("agent", "debug", data);
      if (typeof data === "object" && data !== null && "type" in data && data.type === "audio_element_ready") reassertGate();
    },
    onIncomingEvent: (data) => emit("agent", "incoming", data),
    onOutgoingEvent: (data) => emit("agent", "outgoing", data),
    onAgentToolRequest: (data) => emit("agent", "tool_request", data),
    onAgentToolResponse: (data) => emit("agent", "tool_response", data),
    onUnhandledClientToolCall: (data) => emit("agent", "unhandled_client_tool", data),
    onInterruption: (data) => emit("agent", "interruption", data),
    onVadScore: (data) => {
      const now = Date.now();
      if (now - lastVadEventAt.current >= 500) {
        lastVadEventAt.current = now;
        emit("agent", "vad", data);
      }
    },
  });

  const subscribeTranscriber = useCallback((id: string, read: () => VoiceHubSubscriber) => {
    const unsubscribe = hubRef.current!.subscribe(id, read);
    setTranscriberRevision((revision) => revision + 1);
    return () => {
      unsubscribe();
      setTranscriberRevision((revision) => revision + 1);
    };
  }, []);
  useEffect(() => hubRef.current!.subscribe("__voice_turn__", () => createTurnHubSubscriber({
    sessionActive: sessionRequestedRef.current,
    turnActive: turnAdapterRef.current!.snapshot().phase !== "idle",
    now: () => nowTurnRef.current(),
    dispatch: (event) => turnDispatchRef.current(event),
    noteHumanSpeech: (at) => { lastHumanSpeechAtRef.current = Math.max(lastHumanSpeechAtRef.current, at); },
  })), []);
  const refreshTranscribers = useCallback(() => setTranscriberRevision((revision) => revision + 1), []);
  const sttForcedOff = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("stt") === "off";
  const transcriberDemanded = hubRef.current.shouldConnect({ sessionActive: sessionRequested, forcedOff: sttForcedOff });
  transcriberDemandRef.current = transcriberDemanded;
  const deviceId = typeof window !== "undefined" ? localStorage.getItem("tacit.micDeviceId") || undefined : undefined;
  const effectiveConfigFingerprint = voiceHubConfigFingerprint({
    language: hubRef.current.preferredLanguage(),
    deviceId,
    keyterms: scribeKeytermsRef.current ?? [],
    filterBackgroundAudio: process.env.NEXT_PUBLIC_SCRIBE_FILTER_BG !== "0",
  });
  const effectiveConfig = useMemo<VoiceHubEffectiveConfig>(() => ({
    language: hubRef.current!.preferredLanguage(),
    deviceId,
    keyterms: [...(scribeKeytermsRef.current ?? [])],
    filterBackgroundAudio: process.env.NEXT_PUBLIC_SCRIBE_FILTER_BG !== "0",
  }), [deviceId, effectiveConfigFingerprint]);
  effectiveConfigFingerprintRef.current = effectiveConfigFingerprint;
  const reconcile = useCallback(() => setReconcileRevision((revision) => revision + 1), []);
  reconcileRef.current = reconcile;

  const scribeCallbacks = useMemo<ScribeCallbacks>(() => {
    const fatal = (reason: string) => fatalScribeRef.current(reason);
    return {
      onPartialTranscript: ({ text }) => {
        if (!mountedRef.current) return;
        const routed = hubRef.current!.partial(text, Date.now());
        emitRef.current("scribe", "partial", { text, attribution: routed.human ? "human" : "agent" });
        if (routed.changed) setTranscriberState((state) => ({ ...state, partial: routed.text }));
      },
      onCommittedTranscript: ({ text }) => {
        if (!mountedRef.current) return;
        const routed = hubRef.current!.commit(text, Date.now());
        setTranscriberState((state) => ({ ...state, partial: "" }));
        emitRef.current("scribe", "commit", { text, speaker: routed.speaker, humanText: routed.text, command: routed.command });
      },
      onSessionStarted: () => {
        if (!mountedRef.current) return;
        setTranscriberState({ engine: "scribe", connected: true, partial: "" });
        setSttError(undefined);
        emitRef.current("scribe", "connect");
      },
      onDisconnect: () => {
        const controlled = coordinatorRef.current!.consumeControlledClose();
        if (!mountedRef.current) return;
        setTranscriberState({ engine: "none", connected: false, partial: "" });
        emitRef.current("scribe", "disconnect");
        if (!controlled && transcriberDemandRef.current) fatal("Scribe disconnected.");
        reconcileRef.current();
      },
      onError: (error) => fatal(error instanceof Error ? error.message : "Scribe connection error"),
      onAuthError: ({ error }) => fatal(error),
      onQuotaExceededError: ({ error }) => fatal(error),
      onCommitThrottledError: ({ error }) => fatal(error),
      onTranscriberError: ({ error }) => fatal(error),
      onUnacceptedTermsError: ({ error }) => fatal(error),
      onRateLimitedError: ({ error }) => fatal(error),
      onInputError: ({ error }) => fatal(error),
      onQueueOverflowError: ({ error }) => fatal(error),
      onResourceExhaustedError: ({ error }) => fatal(error),
      onSessionTimeLimitExceededError: ({ error }) => fatal(error),
      onChunkSizeExceededError: ({ error }) => fatal(error),
      onInsufficientAudioActivityError: ({ error }) => fatal(error),
    };
  }, []);
  // Declared before useScribe so provider-unmount cleanup disables demand before the SDK's own effect closes its connection.
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      cleanupVoiceHubProvider({
        disableDemand: () => {
          mountedRef.current = false;
          transcriberDemandRef.current = false;
          coordinatorRef.current!.update({ demanded: false, configFingerprint: effectiveConfigFingerprintRef.current });
        },
        recognizer: recognizer.current,
        clearRecognizer: () => { recognizer.current = null; },
        disconnectScribe: () => scribeDisconnectRef.current(),
      });
      turnCleanupRef.current();
      reconnectPolicy.current!.cancel();
    };
  }, []);
  const scribe = useScribe(scribeCallbacks);
  const scribeStatus = scribe.status;
  const scribeConnect = scribe.connect;
  const scribeDisconnect = scribe.disconnect;
  scribeDisconnectRef.current = scribeDisconnect;

  const stopBrowserRecognizer = useCallback(() => {
    const current = recognizer.current;
    if (!current) return;
    current.onend = null;
    recognizer.current = null;
    try { current.stop(); } catch { /* it may already be stopped */ }
  }, []);

  fatalScribeRef.current = (reason) => {
    if (!coordinatorRef.current!.latchFatal()) return;
    setTranscriberState({ engine: "none", connected: false, partial: "" });
    setSttError(`Transcription offline: ${reason}`);
    emitRef.current("scribe", "fatal", reason);
    scribeDisconnectRef.current();
    reconcileRef.current();
  };

  useEffect(() => {
    const transition = coordinatorRef.current!.update({ demanded: transcriberDemanded, configFingerprint: effectiveConfigFingerprint });
    transcriberDemandRef.current = transcriberDemanded;
    if (transition.stopResources) {
      stopBrowserRecognizer();
      if (scribeStatus !== "disconnected") {
        if (scribeStatus !== "error") coordinatorRef.current!.expectControlledClose();
        scribeDisconnect();
      }
      setTranscriberState({ engine: "none", connected: false, partial: "" });
    }
    if (!transcriberDemanded) setSttError(undefined);
    if (transition.needsReconcile) reconcile();
  }, [effectiveConfigFingerprint, reconcile, scribeDisconnect, scribeStatus, stopBrowserRecognizer, transcriberDemanded]);

  useEffect(() => {
    if (!transcriberDemanded) return;
    let observedDeviceId = deviceId;
    const timer = window.setInterval(() => {
      const currentDeviceId = localStorage.getItem("tacit.micDeviceId") || undefined;
      if (currentDeviceId === observedDeviceId) return;
      observedDeviceId = currentDeviceId;
      setTranscriberRevision((revision) => revision + 1);
    }, 500);
    return () => window.clearInterval(timer);
  }, [deviceId, transcriberDemanded]);

  useEffect(() => {
    if (!transcriberDemanded) return;
    const coordinator = coordinatorRef.current!;
    if (coordinator.snapshot().fatalLatched) {
      if (!coordinator.beginFallback()) return;
      const Ctor = (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionLike; SpeechRecognition?: new () => SpeechRecognitionLike }).webkitSpeechRecognition
        ?? (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike }).SpeechRecognition;
      if (!Ctor) {
        setTranscriberState({ engine: "none", connected: false, partial: "" });
        return;
      }
      const browser = new Ctor();
      browser.continuous = true;
      browser.interimResults = true;
      browser.lang = effectiveConfig.language === "de" ? "de-DE" : effectiveConfig.language === "en" ? "en-US" : effectiveConfig.language ?? "en-US";
      browser.onresult = (event) => {
        for (let index = event.resultIndex; index < event.results.length; index += 1) {
          const result = event.results[index];
          const text = result[0].transcript.trim();
          if (!text) continue;
          if (result.isFinal) {
            const { routed } = routeWebSpeechResult(hubRef.current!, { text, isFinal: true, atMs: Date.now() });
            setTranscriberState((state) => ({ ...state, partial: "" }));
            emitRef.current("scribe", "commit", { text, engine: "webspeech", speaker: routed.speaker, humanText: routed.text, command: routed.command });
          } else {
            const { routed } = routeWebSpeechResult(hubRef.current!, { text, isFinal: false, atMs: Date.now() });
            if (routed.changed) setTranscriberState((state) => ({ ...state, partial: routed.text }));
            emitRef.current("scribe", "partial", { text, engine: "webspeech", attribution: routed.human ? "human" : "agent" });
          }
        }
      };
      browser.onend = () => {
        if (!transcriberDemandRef.current || recognizer.current !== browser) return;
        try { browser.start(); } catch { /* already started */ }
      };
      browser.onerror = () => setSttError("Browser transcription error.");
      try {
        browser.start();
        recognizer.current = browser;
        setTranscriberState({ engine: "webspeech", connected: true, partial: "" });
      } catch {
        setTranscriberState({ engine: "none", connected: false, partial: "" });
      }
      return;
    }
    if (transcriberState.engine !== "none" || (scribeStatus !== "disconnected" && scribeStatus !== "error")) return;
    if (scribeStatus === "error") {
      fatalScribeRef.current("Scribe connection error");
      return;
    }
    const attempt = coordinator.beginTokenAttempt();
    if (!attempt) return;
    const attemptConfig = { ...effectiveConfig, keyterms: [...(effectiveConfig.keyterms ?? [])] };
    void (async () => {
      let scribeReason = "Scribe token unavailable";
      let shouldFallback = false;
      try {
        const response = await fetch("/api/scribe-token", { cache: "no-store" });
        const body = response.ok ? await response.json() as { token?: string | null; reason?: string } : { token: null, reason: `token endpoint returned ${response.status}` };
        scribeReason = body.reason ?? scribeReason;
        if (!coordinator.isCurrent(attempt.generation)) return;
        if (body.token) {
          await scribeConnect(buildVoiceHubScribeOptions({
            token: body.token,
            ...attemptConfig,
          }));
          coordinator.replacementInstalled(attempt.generation);
          return;
        }
        shouldFallback = true;
      } catch (error) {
        scribeReason = error instanceof Error ? error.message : String(error);
        shouldFallback = true;
      } finally {
        if (shouldFallback && coordinator.isCurrent(attempt.generation) && coordinator.latchFatal()) {
          setSttError(`Scribe unavailable; browser transcription requested (${scribeReason}).`);
          emitRef.current("scribe", "fallback", scribeReason);
        }
        if (coordinator.settle(attempt.generation) && mountedRef.current) reconcileRef.current();
      }
    })();
  }, [effectiveConfig, effectiveConfigFingerprint, scribeConnect, scribeStatus, transcriberDemanded, transcriberState.engine]);

  useEffect(() => {
    if (configuredMode !== "agent" || typeof HTMLMediaElement === "undefined") return;
    return installElevenLabsPlaybackGate({
      playTarget: HTMLMediaElement.prototype as unknown as MediaPlayTarget,
      readVolume: () => gateIsOpenAt(Date.now()) ? 1 : 0,
    });
  }, [configuredMode, gateIsOpenAt]);

  useEffect(() => {
    if (conversationStatus.status !== "connected") return;
    reassertGate();
    const timer = window.setInterval(() => {
      const now = Date.now();
      if (authorization.current!.snapshot().heartbeatAllowed && gateHoldUntilRef.current > 0 && now >= gateHoldUntilRef.current) {
        gateHoldUntilRef.current = 0;
        setGateHoldUntil(0);
      }
      reassertGate(now);
    }, 500);
    return () => window.clearInterval(timer);
  }, [conversationStatus.status, reassertGate]);

  useEffect(() => {
    if (conversationStatus.status !== "connected") return;
    const timer = window.setInterval(() => {
      if (authorization.current!.snapshot().heartbeatAllowed && turnAdapterRef.current!.snapshot().phase === "idle") noteUserActivity();
    }, 10_000);
    return () => window.clearInterval(timer);
  }, [conversationStatus.status, noteUserActivity]);

  // register every client tool once; handlers are looked up at call time so pages can swap them freely
  const handle = (name: ToolName) => async (params: Record<string, unknown>) => {
    emit("tool", "dispatch", { name, params });
    const fn = tools.current[name];
    const activeTurn = turnAdapterRef.current!.snapshot().phase !== "idle";
    const turnGeneration = turnAdapterRef.current!.currentGeneration();
    if (!fn && !activeTurn) return `no handler for ${name}`;
    let out: string | void;
    try { out = await fn?.(params ?? {}); }
    finally { turnAdapterRef.current!.dispatchForGeneration(turnGeneration, { type: "TOOL", at: nowTurnRef.current(), name, params: params ?? {} }); }
    return out ?? "ok";
  };
  useConversationClientTool("log_answer", handle("log_answer"));
  useConversationClientTool("mark_off_record", handle("mark_off_record"));
  useConversationClientTool("confirm_teachback", handle("confirm_teachback"));
  useConversationClientTool("end_task", handle("end_task"));
  useConversationClientTool("flag_for_expert", handle("flag_for_expert"));
  useConversationClientTool("show_replay", handle("show_replay"));
  useConversationClientTool("record_prediction", handle("record_prediction"));
  useConversationClientTool("record_mastery", handle("record_mastery"));
  useConversationClientTool("end_session", handle("end_session"));

  const speakFallback = useCallback((text: string, lifecycle?: { onStart?: () => void; onEnd?: () => void; isCancelled?: () => boolean }) => new Promise<void>((resolve) => {
    setMessages((xs) => [...xs, { role: "agent", text, t: Date.now() }]);
    let intervalId: string | undefined;
    let started = false;
    let finished = false;
    const start = () => {
      if (started || finished || lifecycle?.isCancelled?.()) return;
      started = true;
      intervalId = timelineRef.current!.start(Date.now() / 1_000, text, "fallback");
      setFallbackSpeaking(true);
      lifecycle?.onStart?.();
    };
    const finish = () => {
      if (finished) return;
      finished = true;
      if (intervalId) timelineRef.current!.end(Date.now() / 1_000, intervalId);
      setFallbackSpeaking(false);
      if (started) lifecycle?.onEnd?.();
      resolve();
    };
    // text-only fallback when the browser cannot speak: pretend to talk for as long as the words would take
    const simulate = () => {
      if (finished) return;
      if (lifecycle?.isCancelled?.()) return finish();
      start();
      window.setTimeout(finish, Math.min(12000, 600 + text.split(/\s+/).length * 330));
    };
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return simulate();
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    const voice = window.speechSynthesis.getVoices().find((v) => /en-(GB|US)/i.test(v.lang) && /female|samantha|karen|google uk english female|serena/i.test(v.name)) ?? window.speechSynthesis.getVoices().find((v) => /^en/i.test(v.lang));
    if (voice) u.voice = voice;
    u.rate = 0.98;
    u.onstart = start;
    u.onend = finish;
    u.onerror = finish;
    window.speechSynthesis.speak(u);
    window.setTimeout(() => {
      if (!started && !finished) {
        window.speechSynthesis.cancel();
        simulate();
      }
    }, 1500);
  }), []);
  speakFallbackRef.current = speakFallback;

  const nowTurn = useCallback(() => sessionStartRef.current === undefined ? Date.now() / 1_000 : Math.max(0, (Date.now() - sessionStartRef.current) / 1_000), []);
  nowTurnRef.current = nowTurn;
  turnConnectedRef.current = configuredMode === "agent" && !voiceError && transportStatusRef.current === "connected";
  const stopClip = useCallback(async (upload: boolean, audioId?: string) => {
    const recorder = clipRecorderRef.current;
    clipRecorderRef.current = null;
    if (!recorder) return;
    if (recorder.state !== "inactive") await new Promise<void>((resolve) => { recorder.onstop = () => resolve(); recorder.stop(); });
    const sessionId = clipSessionRef.current;
    clipSessionRef.current = undefined;
    if (!upload || !audioId || !sessionId) return;
    const blob = new Blob(clipChunksRef.current, { type: "audio/webm" });
    if (blob.size < 2_000) return;
    const form = new FormData();
    form.append("audioId", audioId);
    form.append("file", blob, `${audioId}.webm`);
    await fetch(`/api/sessions/${sessionId}/clips`, { method: "POST", body: form }).catch(() => undefined);
  }, []);
  turnCleanupRef.current = () => {
    turnAdapterRef.current!.disconnect();
    void stopClip(false);
    stopAndClearMediaStream(clipStreamRef);
  };

  const runTurnEffect = useCallback(async (effect: TurnEffect, generation: number) => {
      emitRef.current("turn", effect.type.toLowerCase(), effect);
      if (effect.type === "OPEN_GATE") reassertGate();
      else if (effect.type === "SQUELCH") {
        window.speechSynthesis?.cancel();
        applyConversationGate(controls, false);
      }
      else if (effect.type === "MUTE" || effect.type === "UNMUTE") {
        const muted = effect.type === "MUTE";
        micMutedRef.current = muted;
        setMicMutedState(muted);
        reassertGate();
      } else if (effect.type === "SEND_TAG") {
        setMessages((items) => [...items, { role: "user", text: `[${effect.tag}] ${effect.text}`, t: Date.now() }]);
        try { controls.sendUserMessage(`[${effect.tag}] ${effect.text}`); }
        catch { turnAdapterRef.current!.dispatchForGeneration(generation, { type: "TICK", at: nowTurn() + (turnAdapterRef.current!.snapshot().options?.watchdogSecs ?? 4) }); }
      } else if (effect.type === "SEND_CONTEXT") {
        try { controls.sendContextualUpdate(effect.text); } catch { /* disconnected */ }
      } else if (effect.type === "FALLBACK_SPEAK") {
        if (configuredMode === "agent") {
          degradedAgentFallbackRef.current = true;
          setVoiceError("Agent stayed silent; browser speech fallback is active.");
          setFallbackConnected(true);
          try { controls.endSession(); } catch { /* the SDK may already be disconnected */ }
        }
        void speakFallbackRef.current(effect.text, {
          isCancelled: () => generation !== turnAdapterRef.current!.currentGeneration() || turnAdapterRef.current!.snapshot().phase === "idle" || Boolean(turnAdapterRef.current!.snapshot().waitingForSquelch),
          onStart: () => { turnAdapterRef.current!.dispatchForGeneration(generation, { type: "SPEAK_START", at: nowTurn(), source: "fallback" }); },
          onEnd: () => { turnAdapterRef.current!.dispatchForGeneration(generation, { type: "SPEAK_END", at: nowTurn() }); },
        });
      } else if (effect.type === "CLIP_START") {
        try {
          let stream = clipStreamRef.current;
          if (!stream) {
            const acquired = await navigator.mediaDevices.getUserMedia({ audio: localStorage.getItem("tacit.micDeviceId") ? { deviceId: { exact: localStorage.getItem("tacit.micDeviceId")! } } : true });
            if (generation !== turnAdapterRef.current!.currentGeneration() || turnAdapterRef.current!.snapshot().phase !== "listening") {
              acquired.getTracks().forEach((track) => track.stop());
              return;
            }
            stream = acquired;
            clipStreamRef.current = acquired;
          }
          if (generation !== turnAdapterRef.current!.currentGeneration() || turnAdapterRef.current!.snapshot().phase !== "listening") return;
          clipChunksRef.current = [];
          clipSessionRef.current = effect.sessionId;
          const recorder = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "audio/webm" });
          recorder.ondataavailable = (event) => { if (event.data.size) clipChunksRef.current.push(event.data); };
          recorder.start(250);
          clipRecorderRef.current = recorder;
        } catch { clipRecorderRef.current = null; }
      } else if (effect.type === "CLIP_STOP") await stopClip(effect.upload, effect.audioId);
      else if (effect.type === "RESOLVE") reassertGate();
  }, [configuredMode, controls, nowTurn, reassertGate, stopClip]);
  turnEffectRef.current = runTurnEffect;

  useEffect(() => {
    if (turnState.phase === "idle") return;
    const timer = window.setInterval(() => turnAdapterRef.current!.tick(), 100);
    return () => window.clearInterval(timer);
  }, [nowTurn, turnState.phase]);

  const turn = useCallback<VoiceApi["turn"]>((opts) => {
    return startTaggedTurn(authorization.current!, turnAdapterRef.current!, opts);
  }, []);
  const cancelTurn = useCallback<VoiceApi["cancelTurn"]>((reason) => turnAdapterRef.current!.cancel(reason), []);
  const submitTyped = useCallback<VoiceApi["submitTyped"]>((text) => turnAdapterRef.current!.submitTyped(text), []);
  const setSessionStart = useCallback((epochMs: number) => {
    sessionStartRef.current = epochMs;
    lastHumanSpeechAtRef.current = Number.NEGATIVE_INFINITY;
    hubRef.current!.setSessionStart(epochMs);
  }, []);

  const connectAgent = useCallback(
    async (opts: VoiceConnectOptions | undefined, reconnecting: boolean) => {
      degradedAgentFallbackRef.current = false;
      if (!reconnecting) {
        reconnectPolicy.current!.cancel();
        lastHumanSpeechAtRef.current = Number.NEGATIVE_INFINITY;
        hubRef.current!.setSessionStart(opts?.sessionStartMs);
        sessionStartRef.current = opts?.sessionStartMs;
        scribeKeytermsRef.current = opts?.keyterms;
        setTranscriberRevision((revision) => revision + 1);
        sessionRequestedRef.current = true;
        setSessionRequested(true);
      }
      if (configuredMode === "fallback") {
        setFallbackConnected(true);
        setVoiceError(undefined);
        if (opts?.firstMessage) {
          authorizeSpeech(opts.firstMessage);
          await speakFallback(opts.firstMessage);
          authorization.current!.finish();
        }
        return;
      }
      const active = lifecycle.current!.activeAttempt();
      if (active) {
        await active.promise;
        return;
      }
      if (transportStatusRef.current === "connected") return;
      setVoiceError(undefined);
      const attempt = lifecycle.current!.start(Boolean(opts?.firstMessage));
      if (attempt.isNew) {
        if (opts?.firstMessage !== undefined) firstMessages.current.set(attempt.generation, opts.firstMessage);
        if (opts?.firstMessage) authorizeSpeech(opts.firstMessage);
        const fail = (reason: string) => {
          if (!lifecycle.current!.fail(attempt.generation, reason)) {
            controls.endSession();
            activateFallback(reason, attempt.generation);
          }
        };
        let retryScheduledForAttempt = false;
        const recover = (reason: string) => {
          if (retryScheduledForAttempt) return true;
          const decision = reconnectPolicy.current!.handleDisconnect({
            reason: "error",
            requested: sessionRequestedRef.current,
            current: reconnectingRef.current || establishedGeneration.current === attempt.generation,
            retry: () => {
              emit("agent", "reconnect_attempt", { previousGeneration: attempt.generation });
              void connectAgentRef.current(buildAgentReconnectOptions(opts), true);
            },
          });
          if (decision.action === "retry") {
            retryScheduledForAttempt = true;
            establishedGeneration.current = undefined;
            reconnectingRef.current = true;
            setAgentReconnecting(true);
            emit("agent", "reconnect_scheduled", { ...decision, reason });
            const pendingGeneration = lifecycle.current!.activeGeneration();
            if (pendingGeneration === attempt.generation) lifecycle.current!.cancel(attempt.generation);
            return true;
          }
          if (decision.action === "exhausted") {
            fail(`${reason}; reconnect attempts exhausted.`);
            return true;
          }
          return false;
        };
        try {
          const inputDeviceId = localStorage.getItem("tacit.micDeviceId") || undefined;
          controls.startSession({
            ...buildAgentSessionOptions(agentId!, opts),
            ...(inputDeviceId ? { inputDeviceId } : {}),
            onConnect: () => {
              if (opts?.firstMessage) {
                authorizeSpeech(opts.firstMessage);
                reassertGate();
              }
              lifecycle.current!.connected(attempt.generation);
            },
            onModeChange: ({ mode }) => lifecycle.current!.mode(attempt.generation, mode),
            onError: (message) => {
              if (!reconnectingRef.current || !recover(message)) fail(message);
            },
            onDisconnect: (details) => {
              if (retryScheduledForAttempt) return;
              const reason = `Agent disconnected (${details.reason})`;
              if (details.reason === "error" && recover(reason)) return;
              fail(`${reason}.`);
            },
          });
        } catch (error) {
          const reason = error instanceof Error ? error.message : String(error);
          if (!reconnectingRef.current || !recover(reason)) fail(reason);
        }
      }
      await attempt.promise;
    },
    [activateFallback, agentId, authorizeSpeech, configuredMode, controls, reassertGate, speakFallback],
  );
  connectAgentRef.current = connectAgent;
  const connect = useCallback<VoiceApi["connect"]>((opts) => connectAgent(opts, false), [connectAgent]);

  const disconnect = useCallback(() => {
    reconnectPolicy.current!.cancel();
    reconnectingRef.current = false;
    setAgentReconnecting(false);
    turnAdapterRef.current!.disconnect();
    degradedAgentFallbackRef.current = false;
    void stopClip(false);
    stopAndClearMediaStream(clipStreamRef);
    sessionRequestedRef.current = false;
    setSessionRequested(false);
    hubRef.current!.setSessionStart(undefined);
    scribeKeytermsRef.current = undefined;
    setTranscriberRevision((revision) => revision + 1);
    speechTrackerRef.current!.close(Date.now() / 1_000);
    definitiveSpeechEndRef.current();
    authorization.current!.cancel();
    gateHoldUntilRef.current = 0;
    setGateHoldUntil(0);
    applyConversationGate(controls, false);
    if (configuredMode === "fallback") {
      window.speechSynthesis?.cancel();
      setFallbackConnected(false);
      return;
    }
    window.speechSynthesis?.cancel();
    setFallbackConnected(false);
    setVoiceError(undefined);
    const pending = lifecycle.current!.activeGeneration();
    if (pending !== undefined) lifecycle.current!.cancel(pending);
    else {
      establishedGeneration.current = undefined;
      controls.endSession();
    }
  }, [configuredMode, controls, stopClip]);

  const say = useCallback<VoiceApi["say"]>(
    (tag, text, spoken) => {
      const line = spoken ?? text;
      if (shouldSuppressAgentSpeech({
        configuredMode,
        hasVoiceError: Boolean(voiceError),
        sessionRequested: sessionRequestedRef.current,
        status: transportStatusRef.current,
      })) {
        emit("agent", "message_suppressed_reconnecting", { tag, reconnecting: reconnectingRef.current });
        return;
      }
      authorizeSpeech(line);
      reassertGate();
      if (configuredMode === "fallback" || voiceError || transportStatusRef.current !== "connected") {
        void speakFallback(line).finally(() => authorization.current!.finish());
        return;
      }
      setMessages((xs) => [...xs, { role: "user", text: `[${tag}] ${text}`, t: Date.now() }]);
      try {
        controls.sendUserMessage(`[${tag}] ${text}`);
      } catch (error) {
        controls.endSession();
        activateFallback(error instanceof Error ? error.message : String(error), establishedGeneration.current);
        void speakFallback(line).finally(() => authorization.current!.finish());
      }
    },
    [activateFallback, authorizeSpeech, configuredMode, controls, emit, reassertGate, voiceError, speakFallback],
  );

  const setMicMuted = useCallback(
    (m: boolean) => {
      micMutedRef.current = m;
      setMicMutedState(m);
      reassertGate();
    },
    [controls, reassertGate],
  );

  const sendContext = useCallback(
    (text: string) => {
      if (configuredMode === "agent" && !voiceError && transportStatusRef.current === "connected") {
        try {
          controls.sendContextualUpdate(text);
        } catch (error) {
          controls.endSession();
          activateFallback(error instanceof Error ? error.message : String(error), establishedGeneration.current);
        }
      }
    },
    [activateFallback, configuredMode, controls, voiceError],
  );

  const getId = useCallback(() => {
    if (configuredMode !== "agent") return undefined;
    try {
      return controls.getId();
    } catch {
      return undefined;
    }
  }, [configuredMode, controls]);

  const mode: VoiceApi["mode"] = configuredMode === "agent" && !voiceError ? "agent" : "fallback";
  const degraded = Boolean(voiceError || sttError);
  const lastError = voiceError ?? sttError;
  const gateOpen = composedVoiceGateState({
    turnPhase: turnState.phase,
    legacyAuthorized: authorization.current.snapshot().authorized,
    now: Date.now(),
    gateHoldUntil,
    micMuted,
    squelch: turnAdapterRef.current!.isSquelched() || authorization.current.snapshot().timeoutSquelched,
  });

  useEffect(() => {
    reassertGate();
    emit("gate", "state", { open: gateOpen });
  }, [emit, gateOpen, reassertGate]);

  const api = useMemo<VoiceApi>(
    () => ({
      mode,
      connected: mode === "fallback" ? fallbackConnected : conversationStatus.status === "connected",
      status: mode === "fallback" ? (fallbackConnected ? "fallback: browser speech" : "fallback: off") : agentReconnecting ? "reconnecting: ElevenAgents" : conversationStatus.message ? `error: ${conversationStatus.message}` : conversationStatus.status,
      isSpeaking: mode === "fallback" ? fallbackSpeaking : conversationMode.isSpeaking,
      micMuted,
      messages,
      degraded,
      lastError,
      connect,
      disconnect,
      getId,
      say,
      setMicMuted,
      sendContext,
      gateOpen,
      noteUserActivity,
      turn,
      cancelTurn,
      submitTyped,
      setSessionStart,
      lastHumanSpeechAt: () => lastHumanSpeechAtRef.current,
      turnPhase: turnState.phase,
      partial: turnState.partial,
      stt: { engine: transcriberState.engine, connected: transcriberState.connected },
    }),
    [mode, fallbackConnected, agentReconnecting, conversationStatus.status, conversationStatus.message, conversationMode.isSpeaking, fallbackSpeaking, micMuted, messages, degraded, lastError, connect, disconnect, getId, say, setMicMuted, sendContext, gateOpen, noteUserActivity, turn, cancelTurn, submitTyped, setSessionStart, turnState.phase, turnState.partial, transcriberState.engine, transcriberState.connected],
  );
  const transcriberHub = useMemo<TranscriberHubValue>(() => ({
    ...transcriberState,
    subscribe: subscribeTranscriber,
    refresh: refreshTranscribers,
  }), [refreshTranscribers, subscribeTranscriber, transcriberState]);

  return <TranscriberHubContext.Provider value={transcriberHub}><VoiceDebugContext.Provider value={onDebugEvent}><VoiceContext.Provider value={api}>{children}</VoiceContext.Provider></VoiceDebugContext.Provider></TranscriberHubContext.Provider>;
}

// ---------- Transcription: Scribe v2 Realtime, or the browser's recognizer when there is no key ----------

export interface TranscriberOptions {
  enabled: boolean;
  onPartial: (text: string) => void;
  onCommitted: (text: string, startSecs?: number, endSecs?: number, meta?: VoiceTranscriptMeta) => void;
  onAgentEcho?: (text: string, startSecs?: number, endSecs?: number, meta?: VoiceTranscriptMeta) => void;
  onCommand?: (command: VoiceCommand, text: string, meta: VoiceTranscriptMeta) => void;
  language?: string;
}

export function useTranscriber(opts: TranscriberOptions) {
  const hub = useContext(TranscriberHubContext);
  if (!hub) throw new Error("useTranscriber must be used inside VoiceProvider");
  const { subscribe, refresh } = hub;
  const id = useId();
  const optsRef = useRef(opts);
  optsRef.current = opts;

  useEffect(() => {
    return subscribe(id, () => optsRef.current);
  }, [id, subscribe]);
  useEffect(() => refresh(), [refresh, opts.enabled, opts.language]);

  return { engine: hub.engine, connected: hub.connected, partial: hub.partial };
}

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((ev: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((ev: unknown) => void) | null;
  start(): void;
  stop(): void;
}
