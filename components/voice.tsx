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
  const [degraded, setDegraded] = useState(false);
  const [lastError, setLastError] = useState<string>();
  const controls = useConversationControls();
  const conversationStatus = useConversationStatus();
  const conversationMode = useConversationMode();
  const connectAttempt = useRef<{
    resolve: () => void;
    firstMessage?: string;
    connected: boolean;
    sawSpeaking: boolean;
    timer: number;
  } | undefined>(undefined);
  const explicitDisconnect = useRef(false);
  const lastVadEventAt = useRef(0);
  const emit = useCallback((src: VoiceDebugEvent["src"], type: string, data?: unknown) => {
    onDebugEvent?.({ at: Date.now(), src, type, ...(data === undefined ? {} : { data }) });
  }, [onDebugEvent]);
  const finishConnect = useCallback(() => {
    const attempt = connectAttempt.current;
    if (!attempt) return;
    window.clearTimeout(attempt.timer);
    connectAttempt.current = undefined;
    attempt.resolve();
  }, []);
  const degradeConnect = useCallback((reason: string) => {
    setDegraded(true);
    setLastError(reason);
    setFallbackConnected(true);
    emit("agent", "degraded", { reason });
    const firstMessage = connectAttempt.current?.firstMessage;
    finishConnect();
    if (firstMessage) void speakFallbackRef.current(firstMessage);
  }, [emit, finishConnect]);
  const speakFallbackRef = useRef<(text: string) => Promise<void>>(async () => {});

  useConversation({
    micMuted,
    onConnect: (data) => {
      window.speechSynthesis?.cancel();
      setFallbackConnected(false);
      setDegraded(false);
      setLastError(undefined);
      emit("agent", "connect", data);
      const attempt = connectAttempt.current;
      if (!attempt) return;
      attempt.connected = true;
      window.clearTimeout(attempt.timer);
      if (!attempt.firstMessage) return finishConnect();
      attempt.timer = window.setTimeout(finishConnect, 15_000);
    },
    onDisconnect: (details) => {
      emit("agent", "disconnect", details);
      const wasExplicit = explicitDisconnect.current;
      explicitDisconnect.current = false;
      if (connectAttempt.current && !wasExplicit) return degradeConnect(`Agent disconnected before it was ready (${details.reason}).`);
      if (connectAttempt.current) finishConnect();
      if (!wasExplicit && details.reason !== "user") {
        setDegraded(true);
        setLastError(`Agent disconnected (${details.reason}).`);
        setFallbackConnected(true);
      }
    },
    onError: (message, context) => {
      emit("agent", "error", { message, context });
      if (connectAttempt.current) degradeConnect(message);
      else {
        setDegraded(true);
        setLastError(message);
      }
    },
    onStatusChange: (data) => emit("agent", "status", data),
    onModeChange: (data) => {
      emit("agent", "mode", data);
      const attempt = connectAttempt.current;
      if (!attempt?.firstMessage) return;
      if (data.mode === "speaking") attempt.sawSpeaking = true;
      else if (attempt.connected && attempt.sawSpeaking) finishConnect();
    },
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
        setLastError(undefined);
        if (opts?.firstMessage) await speakFallback(opts.firstMessage);
        return;
      }
      if (conversationStatus.status === "connected") return;
      if (connectAttempt.current) return new Promise<void>((resolve) => {
        const priorResolve = connectAttempt.current!.resolve;
        connectAttempt.current!.resolve = () => {
          priorResolve();
          resolve();
        };
      });
      setDegraded(false);
      setLastError(undefined);
      explicitDisconnect.current = false;
      return new Promise<void>((resolve) => {
        connectAttempt.current = {
          resolve,
          firstMessage: opts?.firstMessage || undefined,
          connected: false,
          sawSpeaking: false,
          timer: window.setTimeout(() => degradeConnect("Agent connection timed out after 20 seconds."), 20_000),
        };
        try {
          const inputDeviceId = localStorage.getItem("tacit.micDeviceId") || undefined;
          controls.startSession({ ...buildAgentSessionOptions(agentId!, opts), ...(inputDeviceId ? { inputDeviceId } : {}) });
        } catch (error) {
          degradeConnect(error instanceof Error ? error.message : String(error));
        }
      });
    },
    [agentId, configuredMode, controls, conversationStatus.status, degradeConnect, speakFallback],
  );

  const disconnect = useCallback(() => {
    if (configuredMode === "fallback") {
      window.speechSynthesis?.cancel();
      setFallbackConnected(false);
      return;
    }
    explicitDisconnect.current = true;
    window.speechSynthesis?.cancel();
    setFallbackConnected(false);
    controls.endSession();
  }, [configuredMode, controls]);

  const say = useCallback<VoiceApi["say"]>(
    (tag, text, spoken) => {
      if (configuredMode === "fallback" || degraded || conversationStatus.status !== "connected") {
        void speakFallback(spoken ?? text);
        return;
      }
      setMessages((xs) => [...xs, { role: "user", text: `[${tag}] ${text}`, t: Date.now() }]);
      try {
        controls.sendUserMessage(`[${tag}] ${text}`);
      } catch (error) {
        degradeConnect(error instanceof Error ? error.message : String(error));
        void speakFallback(spoken ?? text);
      }
    },
    [configuredMode, controls, conversationStatus.status, degradeConnect, degraded, speakFallback],
  );

  const setMicMuted = useCallback(
    (m: boolean) => {
      setMicMutedState(m);
    },
    [],
  );

  const sendContext = useCallback(
    (text: string) => {
      if (configuredMode === "agent" && !degraded && conversationStatus.status === "connected") {
        try {
          controls.sendContextualUpdate(text);
        } catch (error) {
          setDegraded(true);
          setLastError(error instanceof Error ? error.message : String(error));
        }
      }
    },
    [configuredMode, controls, conversationStatus.status, degraded],
  );

  const getId = useCallback(() => {
    if (configuredMode !== "agent") return undefined;
    try {
      return controls.getId();
    } catch {
      return undefined;
    }
  }, [configuredMode, controls]);

  useEffect(() => () => {
    if (connectAttempt.current) window.clearTimeout(connectAttempt.current.timer);
  }, []);

  const mode: VoiceApi["mode"] = configuredMode === "agent" && !degraded ? "agent" : "fallback";

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

  return <VoiceDebugContext.Provider value={onDebugEvent}><VoiceContext.Provider value={api}>{children}</VoiceContext.Provider></VoiceDebugContext.Provider>;
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
      debug?.({ at: Date.now(), src: "scribe", type: "connect" });
    },
    onDisconnect: () => {
      setConnected(false);
      debug?.({ at: Date.now(), src: "scribe", type: "disconnect" });
    },
    onError: (error) => debug?.({ at: Date.now(), src: "scribe", type: "error", data: error instanceof Error ? error.message : String(error) }),
  });

  useEffect(() => {
    if (!opts.enabled) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/scribe-token");
        const { token } = res.ok ? await res.json() : { token: null };
        if (token) {
          if (cancelled) return;
          const deviceId = localStorage.getItem("tacit.micDeviceId") || undefined;
          await scribe.connect({ token, microphone: { ...(deviceId ? { deviceId: { exact: deviceId } } : {}), echoCancellation: true, noiseSuppression: true } });
          setEngine("scribe");
          return;
        }
      } catch {
        /* fall through to the browser recognizer */
      }
      const Ctor = (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionLike; SpeechRecognition?: new () => SpeechRecognitionLike }).webkitSpeechRecognition ?? (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike }).SpeechRecognition;
      if (!Ctor) {
        setEngine("none");
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
          if (res.isFinal) optsRef.current.onCommitted(text);
          else optsRef.current.onPartial(text);
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
      r.onerror = () => {};
      recognizer.current = r;
      try {
        r.start();
        setEngine("webspeech");
        setConnected(true);
      } catch {
        setEngine("none");
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
