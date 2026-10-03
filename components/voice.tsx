"use client";

/**
 * The voice layer. One API for the pages, two implementations underneath:
 *  - agent: an ElevenAgents conversation (mic muted until the governor opens a window) plus Scribe v2 Realtime
 *  - fallback: the browser's speechSynthesis and webkitSpeechRecognition, so the whole flow runs with no keys
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { CommitStrategy, ConversationProvider, useConversation, useConversationClientTool, useScribe } from "@elevenlabs/react";

export const TOOL_NAMES = ["log_answer", "mark_off_record", "confirm_teachback", "end_task", "flag_for_expert", "show_replay", "record_prediction", "record_mastery", "end_session"] as const;
export type ToolName = (typeof TOOL_NAMES)[number];
export type ToolHandler = (params: Record<string, unknown>) => string | void | Promise<string | void>;
export type ToolHandlers = Partial<Record<ToolName, ToolHandler>>;

export interface VoiceMessage {
  role: "user" | "agent";
  text: string;
  t: number; // epoch ms
}

export interface VoiceApi {
  mode: "agent" | "fallback";
  connected: boolean;
  status: string;
  isSpeaking: boolean;
  micMuted: boolean;
  messages: VoiceMessage[];
  connect: (opts?: { firstMessage?: string; prompt?: string; language?: string }) => Promise<void>;
  disconnect: () => void;
  /** Tagged message to the agent ([ASK], [DEBRIEF], [TEACHBACK], [INTERVENE] ...). In fallback mode the text is spoken aloud. */
  say: (tag: string, text: string, spoken?: string) => void;
  setMicMuted: (muted: boolean) => void;
  sendContext: (text: string) => void;
}

const VoiceContext = createContext<VoiceApi | null>(null);

export function useVoice(): VoiceApi {
  const v = useContext(VoiceContext);
  if (!v) throw new Error("useVoice must be used inside VoiceProvider");
  return v;
}

export function VoiceProvider({ agentId, tools, children }: { agentId?: string; tools: React.MutableRefObject<ToolHandlers>; children: ReactNode }) {
  return (
    <ConversationProvider>
      <VoiceInner agentId={agentId} tools={tools}>
        {children}
      </VoiceInner>
    </ConversationProvider>
  );
}

function VoiceInner({ agentId, tools, children }: { agentId?: string; tools: React.MutableRefObject<ToolHandlers>; children: ReactNode }) {
  const mode: VoiceApi["mode"] = agentId ? "agent" : "fallback";
  const [micMuted, setMicMutedState] = useState(true);
  const [messages, setMessages] = useState<VoiceMessage[]>([]);
  const [fallbackSpeaking, setFallbackSpeaking] = useState(false);
  const [fallbackConnected, setFallbackConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const conversation = useConversation({
    micMuted,
    onMessage: (m) => setMessages((xs) => [...xs, { role: m.role === "agent" ? "agent" : "user", text: m.message, t: Date.now() }]),
    onError: (message) => setError(message),
  });

  // register every client tool once; handlers are looked up at call time so pages can swap them freely
  const handle = (name: ToolName) => async (params: Record<string, unknown>) => {
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

  const speakFallback = useCallback((text: string) => {
    setMessages((xs) => [...xs, { role: "agent", text, t: Date.now() }]);
    // text-only fallback when the browser cannot speak: pretend to talk for as long as the words would take
    const simulate = () => {
      setFallbackSpeaking(true);
      window.setTimeout(() => setFallbackSpeaking(false), Math.min(12000, 600 + text.split(/\s+/).length * 330));
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
    u.onend = () => setFallbackSpeaking(false);
    u.onerror = () => setFallbackSpeaking(false);
    window.speechSynthesis.speak(u);
    window.setTimeout(() => {
      if (!started) {
        window.speechSynthesis.cancel();
        simulate();
      }
    }, 1500);
  }, []);

  const connect = useCallback<VoiceApi["connect"]>(
    async (opts) => {
      if (mode === "fallback") {
        setFallbackConnected(true);
        if (opts?.firstMessage) speakFallback(opts.firstMessage);
        return;
      }
      conversation.startSession({
        agentId: agentId!,
        connectionType: "webrtc",
        overrides: opts ? { agent: { ...(opts.firstMessage !== undefined ? { firstMessage: opts.firstMessage } : {}), ...(opts.prompt ? { prompt: { prompt: opts.prompt } } : {}), ...(opts.language ? { language: opts.language as "en" } : {}) } } : undefined,
      });
    },
    [agentId, conversation, mode, speakFallback],
  );

  const disconnect = useCallback(() => {
    if (mode === "fallback") {
      window.speechSynthesis?.cancel();
      setFallbackConnected(false);
      return;
    }
    conversation.endSession();
  }, [conversation, mode]);

  const say = useCallback<VoiceApi["say"]>(
    (tag, text, spoken) => {
      if (mode === "fallback") {
        speakFallback(spoken ?? text);
        return;
      }
      setMessages((xs) => [...xs, { role: "user", text: `[${tag}] ${text}`, t: Date.now() }]);
      conversation.sendUserMessage(`[${tag}] ${text}`);
    },
    [conversation, mode, speakFallback],
  );

  const setMicMuted = useCallback(
    (m: boolean) => {
      setMicMutedState(m);
      if (mode === "agent") conversation.setMuted(m);
    },
    [conversation, mode],
  );

  const sendContext = useCallback(
    (text: string) => {
      if (mode === "agent" && conversation.status === "connected") conversation.sendContextualUpdate(text);
    },
    [conversation, mode],
  );

  const api = useMemo<VoiceApi>(
    () => ({
      mode,
      connected: mode === "fallback" ? fallbackConnected : conversation.status === "connected",
      status: mode === "fallback" ? (fallbackConnected ? "fallback: browser speech" : "fallback: off") : error ? `error: ${error}` : conversation.status,
      isSpeaking: mode === "fallback" ? fallbackSpeaking : conversation.isSpeaking,
      micMuted,
      messages,
      connect,
      disconnect,
      say,
      setMicMuted,
      sendContext,
    }),
    [mode, fallbackConnected, conversation.status, conversation.isSpeaking, error, fallbackSpeaking, micMuted, messages, connect, disconnect, say, setMicMuted, sendContext],
  );

  return <VoiceContext.Provider value={api}>{children}</VoiceContext.Provider>;
}

// ---------- Transcription: Scribe v2 Realtime, or the browser's recognizer when there is no key ----------

export interface TranscriberOptions {
  enabled: boolean;
  onPartial: (text: string) => void;
  onCommitted: (text: string, startSecs?: number, endSecs?: number) => void;
  language?: string;
}

export function useTranscriber(opts: TranscriberOptions) {
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
    onPartialTranscript: (d) => optsRef.current.onPartial(d.text),
    onCommittedTranscriptWithTimestamps: (d) => {
      const words = d.words?.filter((w) => w.type !== "spacing") ?? [];
      optsRef.current.onCommitted(d.text, words[0]?.start, words[words.length - 1]?.end);
    },
    onConnect: () => setConnected(true),
    onDisconnect: () => setConnected(false),
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
          await scribe.connect({ token, microphone: { echoCancellation: true, noiseSuppression: true } });
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
