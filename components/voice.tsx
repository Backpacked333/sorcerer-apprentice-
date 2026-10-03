"use client";

/**
 * The voice layer. One API for the pages, two implementations underneath:
 *  - agent: an ElevenAgents conversation (mic muted until the governor opens a window) plus Scribe v2 Realtime
 *  - fallback: the browser's speechSynthesis and webkitSpeechRecognition, so the whole flow runs with no keys
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { CommitStrategy, ConversationProvider, useConversation, useConversationClientTool, useConversationControls, useConversationMode, useConversationStatus, useScribe } from "@elevenlabs/react";

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
}

export function buildAgentSessionOptions(agentId: string, opts: VoiceConnectOptions = {}) {
  const agentOverrides = {
    ...(opts.firstMessage !== undefined ? { firstMessage: opts.firstMessage } : {}),
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
  return { start, connected, mode, fail, cancel, activeGeneration: () => attempt?.generation };
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
}

const VoiceContext = createContext<VoiceApi | null>(null);
const VoiceDebugContext = createContext<((event: VoiceDebugEvent) => void) | undefined>(undefined);
const VoiceHealthContext = createContext<(reason?: string) => void>(() => {});

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
  const [sttError, setSttError] = useState<string>();
  const controls = useConversationControls();
  const conversationStatus = useConversationStatus();
  const conversationMode = useConversationMode();
  const firstMessages = useRef(new Map<number, string>());
  const establishedGeneration = useRef<number | undefined>(undefined);
  const outcomeHandler = useRef<(outcome: ConnectionOutcome) => void>(() => {});
  const lifecycle = useRef<ReturnType<typeof createConnectionLifecycle> | undefined>(undefined);
  if (!lifecycle.current) lifecycle.current = createConnectionLifecycle({
    onOutcome: (outcome) => outcomeHandler.current(outcome),
    endSession: controls.endSession,
  });
  const lastVadEventAt = useRef(0);
  const speakFallbackRef = useRef<(text: string) => Promise<void>>(async () => {});
  const emit = useCallback((src: VoiceDebugEvent["src"], type: string, data?: unknown) => {
    onDebugEvent?.({ at: Date.now(), src, type, ...(data === undefined ? {} : { data }) });
  }, [onDebugEvent]);
  const activateFallback = useCallback((reason: string, generation?: number) => {
    if (generation !== undefined && establishedGeneration.current !== generation) return;
    establishedGeneration.current = undefined;
    setVoiceError(reason);
    setFallbackConnected(true);
    emit("agent", "degraded", { reason });
  }, [emit]);

  useEffect(() => {
    outcomeHandler.current = (outcome) => {
      const firstMessage = firstMessages.current.get(outcome.generation);
      firstMessages.current.delete(outcome.generation);
      if (outcome.kind === "connected") {
        establishedGeneration.current = outcome.generation;
        window.speechSynthesis?.cancel();
        setFallbackConnected(false);
        setVoiceError(undefined);
      } else if (outcome.kind === "degraded") {
        activateFallback(outcome.reason);
        if (firstMessage) void speakFallbackRef.current(firstMessage);
      } else {
        setFallbackConnected(false);
      }
      emit("agent", `connect_${outcome.kind}`, outcome);
    };
  }, [activateFallback, emit]);

  useConversation({
    micMuted,
    onConnect: (data) => emit("agent", "connect", data),
    onDisconnect: (details) => emit("agent", "disconnect", details),
    onError: (message, context) => emit("agent", "error", { message, context }),
    onStatusChange: (data) => emit("agent", "status", data),
    onModeChange: (data) => emit("agent", "mode", data),
    onMessage: (m) => {
      setMessages((xs) => [...xs, { role: m.role === "agent" ? "agent" : "user", text: m.message, t: Date.now() }]);
      emit("agent", "message", m);
    },
    onDebug: (data) => emit("agent", "debug", data),
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

  // register every client tool once; handlers are looked up at call time so pages can swap them freely
  const handle = (name: ToolName) => async (params: Record<string, unknown>) => {
    emit("tool", "dispatch", { name, params });
    const fn = tools.current[name];
    if (!fn) return `no handler for ${name}`;
    const out = await fn(params ?? {});
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

  const speakFallback = useCallback((text: string) => new Promise<void>((resolve) => {
    setMessages((xs) => [...xs, { role: "agent", text, t: Date.now() }]);
    // text-only fallback when the browser cannot speak: pretend to talk for as long as the words would take
    const simulate = () => {
      setFallbackSpeaking(true);
      window.setTimeout(() => {
        setFallbackSpeaking(false);
        resolve();
      }, Math.min(12000, 600 + text.split(/\s+/).length * 330));
    };
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return simulate();
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    const voice = window.speechSynthesis.getVoices().find((v) => /en-(GB|US)/i.test(v.lang) && /female|samantha|karen|google uk english female|serena/i.test(v.name)) ?? window.speechSynthesis.getVoices().find((v) => /^en/i.test(v.lang));
    if (voice) u.voice = voice;
    u.rate = 0.98;
    let started = false;
    u.onstart = () => {
      started = true;
      setFallbackSpeaking(true);
    };
    u.onend = () => {
      setFallbackSpeaking(false);
      resolve();
    };
    u.onerror = () => {
      setFallbackSpeaking(false);
      resolve();
    };
    window.speechSynthesis.speak(u);
    window.setTimeout(() => {
      if (!started) {
        window.speechSynthesis.cancel();
        simulate();
      }
    }, 1500);
  }), []);
  speakFallbackRef.current = speakFallback;

  const connect = useCallback<VoiceApi["connect"]>(
    async (opts) => {
      if (configuredMode === "fallback") {
        setFallbackConnected(true);
        setVoiceError(undefined);
        if (opts?.firstMessage) await speakFallback(opts.firstMessage);
        return;
      }
      if (conversationStatus.status === "connected") return;
      setVoiceError(undefined);
      const attempt = lifecycle.current!.start(Boolean(opts?.firstMessage));
      if (attempt.isNew) {
        if (opts?.firstMessage !== undefined) firstMessages.current.set(attempt.generation, opts.firstMessage);
        const fail = (reason: string) => {
          if (!lifecycle.current!.fail(attempt.generation, reason)) {
            controls.endSession();
            activateFallback(reason, attempt.generation);
          }
        };
        try {
          const inputDeviceId = localStorage.getItem("tacit.micDeviceId") || undefined;
          controls.startSession({
            ...buildAgentSessionOptions(agentId!, opts),
            ...(inputDeviceId ? { inputDeviceId } : {}),
            onConnect: () => lifecycle.current!.connected(attempt.generation),
            onModeChange: ({ mode }) => lifecycle.current!.mode(attempt.generation, mode),
            onError: (message) => fail(message),
            onDisconnect: (details) => fail(`Agent disconnected (${details.reason}).`),
          });
        } catch (error) {
          fail(error instanceof Error ? error.message : String(error));
        }
      }
      await attempt.promise;
    },
    [activateFallback, agentId, configuredMode, controls, conversationStatus.status, speakFallback],
  );

  const disconnect = useCallback(() => {
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
  }, [configuredMode, controls]);

  const say = useCallback<VoiceApi["say"]>(
    (tag, text, spoken) => {
      if (configuredMode === "fallback" || voiceError || conversationStatus.status !== "connected") {
        void speakFallback(spoken ?? text);
        return;
      }
      setMessages((xs) => [...xs, { role: "user", text: `[${tag}] ${text}`, t: Date.now() }]);
      try {
        controls.sendUserMessage(`[${tag}] ${text}`);
      } catch (error) {
        controls.endSession();
        activateFallback(error instanceof Error ? error.message : String(error), establishedGeneration.current);
        void speakFallback(spoken ?? text);
      }
    },
    [activateFallback, configuredMode, controls, conversationStatus.status, voiceError, speakFallback],
  );

  const setMicMuted = useCallback(
    (m: boolean) => {
      setMicMutedState(m);
    },
    [],
  );

  const sendContext = useCallback(
    (text: string) => {
      if (configuredMode === "agent" && !voiceError && conversationStatus.status === "connected") {
        try {
          controls.sendContextualUpdate(text);
        } catch (error) {
          controls.endSession();
          activateFallback(error instanceof Error ? error.message : String(error), establishedGeneration.current);
        }
      }
    },
    [activateFallback, configuredMode, controls, conversationStatus.status, voiceError],
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

  const api = useMemo<VoiceApi>(
    () => ({
      mode,
      connected: mode === "fallback" ? fallbackConnected : conversationStatus.status === "connected",
      status: mode === "fallback" ? (fallbackConnected ? "fallback: browser speech" : "fallback: off") : conversationStatus.message ? `error: ${conversationStatus.message}` : conversationStatus.status,
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
    }),
    [mode, fallbackConnected, conversationStatus.status, conversationStatus.message, conversationMode.isSpeaking, fallbackSpeaking, micMuted, messages, degraded, lastError, connect, disconnect, getId, say, setMicMuted, sendContext],
  );

  return <VoiceHealthContext.Provider value={setSttError}><VoiceDebugContext.Provider value={onDebugEvent}><VoiceContext.Provider value={api}>{children}</VoiceContext.Provider></VoiceDebugContext.Provider></VoiceHealthContext.Provider>;
}

// ---------- Transcription: Scribe v2 Realtime, or the browser's recognizer when there is no key ----------

export interface TranscriberOptions {
  enabled: boolean;
  onPartial: (text: string) => void;
  onCommitted: (text: string, startSecs?: number, endSecs?: number) => void;
  language?: string;
}

export function useTranscriber(opts: TranscriberOptions) {
  const debug = useContext(VoiceDebugContext);
  const reportHealth = useContext(VoiceHealthContext);
  const [engine, setEngine] = useState<"scribe" | "webspeech" | "none">("none");
  const [connected, setConnected] = useState(false);
  const optsRef = useRef(opts);
  optsRef.current = opts;
  const recognizer = useRef<SpeechRecognitionLike | null>(null);

  const scribe = useScribe({
    modelId: "scribe_v2_realtime",
    commitStrategy: CommitStrategy.VAD,
    vadSilenceThresholdSecs: 1.0,
    includeTimestamps: true,
    languageCode: opts.language,
    onPartialTranscript: (d) => {
      debug?.({ at: Date.now(), src: "scribe", type: "partial", data: d });
      optsRef.current.onPartial(d.text);
    },
    onCommittedTranscriptWithTimestamps: (d) => {
      debug?.({ at: Date.now(), src: "scribe", type: "commit", data: d });
      const words = d.words?.filter((w) => w.type !== "spacing") ?? [];
      optsRef.current.onCommitted(d.text, words[0]?.start, words[words.length - 1]?.end);
    },
    onConnect: () => {
      setConnected(true);
      reportHealth(undefined);
      debug?.({ at: Date.now(), src: "scribe", type: "connect" });
    },
    onDisconnect: () => {
      setConnected(false);
      if (optsRef.current.enabled) reportHealth("Scribe disconnected; using browser transcription if available.");
      debug?.({ at: Date.now(), src: "scribe", type: "disconnect" });
    },
    onError: (error) => {
      const reason = error instanceof Error ? error.message : String(error);
      reportHealth(`Scribe error: ${reason}`);
      debug?.({ at: Date.now(), src: "scribe", type: "error", data: reason });
    },
  });

  useEffect(() => {
    if (!opts.enabled) {
      reportHealth(undefined);
      return;
    }
    let cancelled = false;
    (async () => {
      let scribeReason = "Scribe token unavailable";
      try {
        const res = await fetch("/api/scribe-token");
        const body = res.ok ? await res.json() as { token?: string | null; reason?: string } : { token: null, reason: `token endpoint returned ${res.status}` };
        const { token } = body;
        scribeReason = body.reason ?? scribeReason;
        if (token) {
          if (cancelled) return;
          const deviceId = localStorage.getItem("tacit.micDeviceId") || undefined;
          await scribe.connect({ token, microphone: { ...(deviceId ? { deviceId: { exact: deviceId } } : {}), echoCancellation: true, noiseSuppression: true } });
          setEngine("scribe");
          return;
        }
      } catch (error) {
        scribeReason = error instanceof Error ? error.message : String(error);
        /* fall through to the browser recognizer */
      }
      const Ctor = (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionLike; SpeechRecognition?: new () => SpeechRecognitionLike }).webkitSpeechRecognition ?? (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike }).SpeechRecognition;
      if (!Ctor) {
        setEngine("none");
        reportHealth(`Speech transcription unavailable: ${scribeReason}`);
        return;
      }
      const r = new Ctor();
      r.continuous = true;
      r.interimResults = true;
      r.lang = opts.language ?? "en-US";
      r.onresult = (ev) => {
        for (let i = ev.resultIndex; i < ev.results.length; i++) {
          const res = ev.results[i];
          const text = res[0].transcript.trim();
          if (!text) continue;
          if (res.isFinal) {
            debug?.({ at: Date.now(), src: "scribe", type: "commit", data: { text, engine: "webspeech" } });
            optsRef.current.onCommitted(text);
          } else {
            debug?.({ at: Date.now(), src: "scribe", type: "partial", data: { text, engine: "webspeech" } });
            optsRef.current.onPartial(text);
          }
        }
      };
      r.onend = () => {
        if (!cancelled && recognizer.current === r) {
          try {
            r.start();
          } catch {
            /* already started */
          }
        }
      };
      r.onerror = () => reportHealth("Browser transcription error.");
      recognizer.current = r;
      try {
        r.start();
        setEngine("webspeech");
        setConnected(true);
        reportHealth(`Scribe unavailable; browser transcription active (${scribeReason}).`);
      } catch {
        setEngine("none");
        reportHealth(`Speech transcription unavailable: ${scribeReason}`);
      }
    })();
    return () => {
      cancelled = true;
      if (recognizer.current) {
        const r = recognizer.current;
        recognizer.current = null;
        r.onend = null;
        try {
          r.stop();
        } catch {
          /* ignore */
        }
      }
      scribe.disconnect();
      setConnected(false);
      reportHealth(undefined);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts.enabled]);

  return { engine, connected: engine === "scribe" ? scribe.isConnected : connected, partial: scribe.partialTranscript };
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
