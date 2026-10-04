"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { captureAnswerToolRejection, captureEvidenceIsOffRecord, CaptureLoop, captureToolStepRef, redactCaptureRange, shouldPersistAgentSpokenText, turnCommitEvidenceEligible, windowOutcome, type LoopAction, type LoopSignals } from "@/lib/capture-loop";
import { CandidateQueue, buildCandidates, extractThresholds, newContext, observe } from "@/lib/curiosity";
import { describeEvent, emptySession, type Frame, type ScreenEvent, type SessionLog } from "@/lib/events";
import { aboutFor, captureApp, changeText, evidenceFor, eyebrowFor, type CaptureAppId, type Evidence } from "@/lib/ui/capture-copy";
import { COST_CENTERS } from "@/lib/erp-model";
import { Governor, type Decision, type GovernorConfig } from "@/lib/governor";
import { computeMetrics } from "@/lib/metrics";
import { buildMemory, MemoryFlight, ReasoningWire, validateProposal } from "@/lib/memory";
import { PreparedQuestions } from "@/lib/prepared-question";
import { recordTypedAnswer } from "@/lib/capture-answer";
import { redactText } from "@/lib/redact";
import { createSessionSync } from "@/lib/session-sync";
import { buildAsk, keytermsFrom } from "@/lib/voice-protocol";
import type { TurnResult } from "@/lib/voice-turn";
import { useScreenPipeline, type EventSource } from "./useScreenPipeline";
import { VoiceProvider, useTranscriber, useVoice, type ToolHandlers } from "./voice";
import { CaptureView } from "./views/CaptureView";
import type { CaptureVM, UnderstoodItem } from "./views/capture.vm";

const OFF_RECORD = /\b(off the record|scratch that|don'?t keep that|do not keep that|strike that)\b/i;

type CaptureGovernorConfig = Partial<GovernorConfig> & { graceSecs?: number };
type OpenAction = Extract<LoopAction, { type: "open" }>;

export function CaptureClient(props: { agentId?: string; source: EventSource; governor: CaptureGovernorConfig; app?: CaptureAppId; share0?: boolean }) {
  const tools = useRef<ToolHandlers>({});
  return (
    <VoiceProvider agentId={props.agentId} tools={tools}>
      <Capture {...props} tools={tools} />
    </VoiceProvider>
  );
}

function Capture({ source: envSource, governor: govConfig, tools, app: appId, share0 = false }: { agentId?: string; source: EventSource; governor: CaptureGovernorConfig; tools: React.MutableRefObject<ToolHandlers>; app?: CaptureAppId; share0?: boolean }) {
  const router = useRouter();
  const voice = useVoice();
  const app = useMemo(() => captureApp(appId), [appId]);
  // The claims workbench posts no telemetry: vision only, so an open ERP tab can never leak dom events into it.
  const source: EventSource = app.telemetry ? envSource : "vision";
  const [expertName, setExpertName] = useState("");
  const [task, setTask] = useState(app.task);
  const [started, setStarted] = useState(false);
  const [tick, setTick] = useState(0);
  const [decision, setDecision] = useState<Decision>();
  const [partial, setPartial] = useState("");
  const [holding, setHolding] = useState(false);
  const [synced, setSynced] = useState<number | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [consented, setConsented] = useState(false);
  const [noisy, setNoisy] = useState(false);
  // ---- companion redesign (presentation state only)
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [endingUi, setEndingUi] = useState(false);
  const [visionKey, setVisionKey] = useState<boolean | null>(null);
  const [lastNotice, setLastNotice] = useState<CaptureVM["lastNotice"]>();
  const [lastStrike, setLastStrike] = useState<CaptureVM["lastStrike"]>();
  const [lastDeferred, setLastDeferred] = useState<CaptureVM["lastDeferred"]>();
  const startingRef = useRef(false);
  /** per window: quiet before it opened and where the change came from */
  const windowMeta = useRef(new Map<string, { pauseSecs?: number; evidence?: Evidence }>());

  const log = useRef<SessionLog>(emptySession("pending", "capture", task, expertName));
  const governor = useRef(new Governor(govConfig));
  const queue = useRef(new CandidateQueue(90, govConfig.graceSecs ?? 18));
  const loop = useRef(new CaptureLoop(governor.current, queue.current, { graceSecs: govConfig.graceSecs, maxChained: govConfig.maxChained }));
  const ctx = useRef(newContext());
  ctx.current.valueLabels ??= Object.fromEntries(COST_CENTERS.map(({ code, label }) => [code, label]));
  const entitiesRedacted = useRef(0);
  const dirty = useRef(false);
  const sync = useRef<ReturnType<typeof createSessionSync> | null>(null);
  const recordingConsentEpoch = useRef(0);
  const holdingRef = useRef(false);
  const voiceRef = useRef(voice);
  const activeTurn = useRef<Promise<TurnResult> | null>(null);
  const activeWindowId = useRef<string | undefined>(undefined);
  const activeHeard = useRef("");
  const activeForced = useRef(false);
  const struckWindowIds = useRef(new Set<string>());
  const deferredSignature = useRef("");
  const syncPromise = useRef<Promise<void> | null>(null);
  const ending = useRef(false);
  const reasoning = useRef(new MemoryFlight());
  const prepared = useRef(new PreparedQuestions());
  const reasoningOff = useRef(false);
  const expertSpeech = useRef<Array<{ at: number; words: number }>>([]);
  const quietSamples = useRef<Array<{ at: number; quiet: boolean }>>([]);
  const pipelineRef = useRef<ReturnType<typeof useScreenPipeline> | null>(null);
  const strikeRef = useRef<(fromSecs?: number, toSecs?: number) => void>(() => {});
  const endTaskRef = useRef<() => Promise<void>>(async () => {});
  voiceRef.current = voice;
  holdingRef.current = holding;

  const rerender = useCallback(() => setTick((value) => value + 1), []);
  const nowSecs = useCallback(() => Math.max(0, (Date.now() - log.current.startedAt) / 1000), []);
  const invalidateReasoning = useCallback(() => {
    reasoning.current.invalidate();
    prepared.current.clear();
  }, []);
  const readMemory = useCallback(() => buildMemory(log.current, queue.current.items), []);

  const onEvent = useCallback((event: ScreenEvent, frame?: Frame) => {
    const session = log.current;
    if (captureEvidenceIsOffRecord(session.offRecord, event.t)) return;
    session.events.push(event);
    if (frame) session.frames.push(frame);
    if (event.kind !== "typing") {
      const candidates = buildCandidates(event, ctx.current, event.t);
      observe(event, ctx.current);
      queue.current.add(candidates);
      if (candidates.some((candidate) => candidate.status === "queued") && event.to !== undefined) {
        setLastNotice({ eventId: event.id, text: changeText(event), field: event.field ?? (event.kind === "status_changed" ? "status" : event.kind === "route_changed" ? "route" : undefined), at: Date.now(), queued: true });
      }
      voiceRef.current.sendContext(`[SCREEN t=${event.t.toFixed(0)}s] ${describeEvent(event)}`);
    }
    dirty.current = true;
    rerender();
  }, [rerender]);

  const pipeline = useScreenPipeline({ sessionStart: log.current.startedAt, source, onEvent });
  pipelineRef.current = pipeline;

  const pushTranscript = useCallback((text: string, speaker: "expert" | "agent", start?: number, end?: number) => {
    if (captureEvidenceIsOffRecord(log.current.offRecord, start ?? nowSecs(), end)) return;
    const clean = speaker === "expert" ? redactText(text) : { text: text.trim(), entities: [] };
    if (!clean.text) return;
    entitiesRedacted.current += clean.entities.length;
    const session = log.current;
    session.transcript.push({
      id: `tr_${session.transcript.length}`,
      t: start ?? nowSecs(),
      ...(end === undefined ? {} : { tEnd: end }),
      text: clean.text,
      speaker,
      final: true,
      redacted: clean.entities.length > 0,
    });
  }, [nowSecs]);

  const transcriber = useTranscriber({
    enabled: started,
    onPartial: (text) => {
      if (!holdingRef.current) setPartial(text);
    },
    onCommitted: (text, start, end) => {
      if (holdingRef.current) return;
      setPartial("");
      const at = start ?? nowSecs();
      if (captureEvidenceIsOffRecord(log.current.offRecord, at, end)) return;
      const committedAt = end ?? at;
      const activeWindow = activeWindowId.current
        ? log.current.windows.find((window) => window.id === activeWindowId.current)
        : undefined;
      if (!turnCommitEvidenceEligible(activeWindow, committedAt)) return;
      const clean = redactText(text).text;
      if (activeWindow) {
        // The turn reducer remains authoritative; persist only the answer it ultimately accepts.
        activeHeard.current = [activeHeard.current, text].filter(Boolean).join(" ");
        return;
      }
      pushTranscript(text, "expert", at, end);
      expertSpeech.current.push({ at: committedAt, words: clean.split(/\s+/u).filter(Boolean).length });
      queue.current.fillNarration(clean, at, pipelineRef.current?.currentState.current.invoice);
      for (const threshold of extractThresholds(clean)) if (!ctx.current.knownThresholds.includes(threshold)) ctx.current.knownThresholds.push(threshold);
      if (OFF_RECORD.test(text)) strikeRef.current();
      dirty.current = true;
      rerender();
    },
    onAgentEcho: (text, start, end) => {
      pushTranscript(text, "agent", start, end);
      dirty.current = true;
      rerender();
    },
    onCommand: (command) => {
      if (command === "off_record") strikeRef.current();
      else if (command === "not_now") voiceRef.current.cancelTurn("user");
    },
  });

  const readSignals = useCallback((): LoopSignals => {
    const currentPipeline = pipelineRef.current;
    const pipelineSignals = currentPipeline?.signals.current;
    const currentVoice = voiceRef.current;
    const sttHealthy = currentVoice.stt.connected || currentVoice.mode === "fallback";
    return {
      now: nowSecs(),
      currentInvoice: currentPipeline?.currentState.current.invoice,
      lastSpeechAt: currentVoice.lastHumanSpeechAt(),
      lastScreenChangeAt: pipelineSignals?.lastScreenChangeAt ?? Number.NEGATIVE_INFINITY,
      lastTypingAt: pipelineSignals?.lastTypingAt ?? Number.NEGATIVE_INFINITY,
      lastBoundaryAt: pipelineSignals?.lastBoundaryAt ?? Number.NEGATIVE_INFINITY,
      lastInvoiceOpenedAt: pipelineSignals?.lastInvoiceOpenedAt ?? Number.NEGATIVE_INFINITY,
      agentSpeaking: currentVoice.isSpeaking,
      transcriberHealthy: sttHealthy,
      sttHealthy,
      paused: holdingRef.current,
    };
  }, [nowSecs]);

  const redactRange = useCallback((fromSecs?: number, toSecs?: number) => {
    invalidateReasoning();
    recordingConsentEpoch.current += 1;
    const session = log.current;
    const now = nowSecs();
    const currentWindow = governor.current.window;
    const from = fromSecs ?? (currentWindow ? currentWindow.openedAt : Math.max(0, now - 30));
    const to = toSecs ?? now;
    redactCaptureRange(session, loop.current, ctx.current, from, to);
    activeHeard.current = "";
    setPartial("");
    pipelineRef.current?.bumpEpoch();
    setLastStrike({ at: Date.now(), from, to });
    dirty.current = true;
    rerender();
  }, [invalidateReasoning, nowSecs, rerender]);

  const strike = useCallback((fromSecs?: number, toSecs?: number) => {
    const id = activeWindowId.current;
    if (id) struckWindowIds.current.add(id);
    redactRange(fromSecs, toSecs);
    if (id) voiceRef.current.cancelTurn("user");
  }, [redactRange]);
  strikeRef.current = strike;

  const updateDeferred = useCallback(() => {
    const next = loop.current.deferred();
    const signature = JSON.stringify(next);
    log.current.deferred = next;
    if (signature === deferredSignature.current) return;
    deferredSignature.current = signature;
    dirty.current = true;
  }, []);

  const applyTurnResult = useCallback((action: OpenAction, windowId: string, result: TurnResult) => {
    const session = log.current;
    const questionWindow = session.windows.find((window) => window.id === windowId);
    const wasStruck = struckWindowIds.current.delete(windowId);
    const effectiveResult = wasStruck ? { ...result, via: "aborted" as const, command: "off_record" as const } : result;
    const mapped = windowOutcome(effectiveResult);
    if (questionWindow) questionWindow.askedAt ??= result.askedAt;

    if (result.spokenText && shouldPersistAgentSpokenText(mapped)) pushTranscript(result.spokenText, "agent", result.spokeAt ?? result.sentAt, result.askedAt);
    if (mapped.outcome === "answered" && mapped.answerText?.trim()) {
      const answerAt = result.answeredAt ?? result.closedAt;
      const answerStart = result.answerStartedAt ?? answerAt;
      if (result.via === "typed") {
        const redacted = recordTypedAnswer(session, windowId, result.heard, answerAt);
        entitiesRedacted.current += redacted ?? 0;
        mapped.answerText = questionWindow?.answerText ?? "";
        mapped.answerAudioId = undefined;
      } else {
        pushTranscript(result.heard, "expert", answerStart, answerAt);
      }
      expertSpeech.current.push({ at: answerAt, words: mapped.answerText.split(/\s+/u).filter(Boolean).length });
      for (const threshold of extractThresholds(mapped.answerText)) if (!ctx.current.knownThresholds.includes(threshold)) ctx.current.knownThresholds.push(threshold);
    }
    if (mapped.outcome === "remove") {
      session.windows = session.windows.filter((window) => window.id !== windowId);
    } else if (questionWindow) {
      questionWindow.spokeAt ??= result.spokeAt;
      questionWindow.closedAt = result.closedAt;
      questionWindow.outcome = mapped.outcome;
      questionWindow.closedBy = mapped.closedBy;
      questionWindow.answerText = mapped.answerText ?? "";
      questionWindow.logged = mapped.logged;
      questionWindow.answerAudioId = mapped.answerAudioId;
      if (mapped.outcome === "answered") {
        questionWindow.answeredAt = result.answeredAt ?? result.closedAt;
      }
    }

    loop.current.applyOutcome(action.candidate, mapped, result.closedAt);
    if (mapped.strike && !wasStruck) redactRange(questionWindow?.openedAt, result.closedAt);
    updateDeferred();
    dirty.current = true;
    rerender();
  }, [pushTranscript, redactRange, rerender, updateDeferred]);

  const runWindow = useCallback(async (action: OpenAction) => {
    if (ending.current || !loop.current.isFresh(action, readSignals())) return;
    const ready = prepared.current.get(readMemory(), action.candidate.id);
    const openedAt = nowSecs();
    const openWindow = loop.current.opened(action.candidate, openedAt);
    const question = ready ?? (action.retro ? action.candidate.questionRetro : action.candidate.question);
    const session = log.current;
    session.windows.push({ id: openWindow.id, candidateId: action.candidate.id, kind: action.candidate.kind, question, stepRef: action.candidate.stepRef, openedAt });
    const openSignals = readSignals();
    const lastActivity = Math.max(openSignals.lastSpeechAt, openSignals.lastScreenChangeAt, openSignals.lastTypingAt);
    windowMeta.current.set(openWindow.id, {
      pauseSecs: Number.isFinite(lastActivity) ? Math.max(0, openedAt - lastActivity) : undefined,
      evidence: evidenceFor(session.events.find((event) => event.id === action.candidate.eventId)),
    });
    activeWindowId.current = openWindow.id;
    activeHeard.current = "";
    activeForced.current = action.forced;
    dirty.current = true;
    rerender();

    const lastExpertSentence = [...session.transcript].reverse().find((segment) => segment.speaker === "expert" && !segment.redacted)?.text;
    const payload = buildAsk({ ...action.candidate, question, questionRetro: question, stepRef: captureToolStepRef(action.candidate.stepRef, openWindow.id) }, {
      events: session.events.filter((event) => !event.redacted && event.kind !== "typing").slice(-3),
      labels: COST_CENTERS,
      lastExpertSentence,
      retro: action.retro,
      followup: action.followup,
      phrase: ready ? "exact" : "natural",
    });
    const turnPromise = voiceRef.current.turn({
      tag: "ASK",
      text: payload,
      spoken: question,
      listen: true,
      timeoutSecs: governor.current.config.windowTimeoutSecs,
      maxSecs: 60,
      recordClip: {
        sessionId: session.id,
        consentEpoch: () => recordingConsentEpoch.current,
        onError: () => setSyncError("Could not save or discard the answer audio."),
      },
      abortOnHumanSpeech: true,
      onPhase: (phase, at) => {
        if (activeWindowId.current !== openWindow.id) return;
        const liveWindow = log.current.windows.find((window) => window.id === openWindow.id);
        if (!liveWindow) return;
        if (phase === "speaking") liveWindow.spokeAt ??= at;
        if (phase === "listening") {
          liveWindow.askedAt ??= at;
          if (governor.current.window?.id === openWindow.id && governor.current.window.phase === "asking") governor.current.markAsked(at);
        }
        rerender();
      },
    });
    activeTurn.current = turnPromise;
    try {
      applyTurnResult(action, openWindow.id, await turnPromise);
    } catch {
      const closedAt = nowSecs();
      applyTurnResult(action, openWindow.id, {
        spoke: false,
        heard: "",
        via: "aborted",
        abortReason: "disconnected",
        sentAt: openedAt,
        askedAt: openedAt,
        closedAt,
      });
    } finally {
      if (activeTurn.current === turnPromise) activeTurn.current = null;
      if (activeWindowId.current === openWindow.id) {
        activeWindowId.current = undefined;
        activeHeard.current = "";
        activeForced.current = false;
      }
      rerender();
    }
  }, [applyTurnResult, nowSecs, readMemory, readSignals, rerender]);

  const endTask = useCallback(async () => {
    if (ending.current) return;
    ending.current = true;
    invalidateReasoning();
    setEndingUi(true);
    const session = log.current;
    if (activeTurn.current) {
      if (activeHeard.current.trim()) voiceRef.current.finishAnswer();
      else voiceRef.current.cancelTurn("user");
      await activeTurn.current.catch(() => undefined);
      const lastWindow = session.windows.at(-1);
      if (lastWindow?.outcome === "aborted" && !lastWindow.answerText) {
        lastWindow.outcome = "timeout";
        lastWindow.closedBy = "timeout";
        const candidate = queue.current.items.find((item) => item.id === lastWindow.candidateId);
        if (candidate) {
          candidate.status = "debrief";
          candidate.userDeferred = undefined;
        }
      }
    }
    session.endedAt = Date.now();
    queue.current.drainToDebrief();
    updateDeferred();
    const currentPipeline = pipelineRef.current;
    session.metrics = { ...computeMetrics(session), framesSeen: currentPipeline?.framesSeen ?? 0, entitiesRedacted: entitiesRedacted.current + (currentPipeline?.piiBlurred ?? 0) } as unknown as Record<string, number>;
    await syncPromise.current?.catch(() => undefined);
    try {
      if (!sync.current) throw new Error("capture sync not initialized");
      await sync.current.sync(session);
      setSyncError(null);
    } catch {
      ending.current = false;
      setEndingUi(false);
      dirty.current = true;
      setSyncError("Could not save this capture. Try again.");
      return;
    }
    dirty.current = false;
    voiceRef.current.disconnect();
    currentPipeline?.stop();
    router.push(`/map/${session.id}`);
  }, [invalidateReasoning, router, updateDeferred]);
  endTaskRef.current = endTask;

  tools.current = {
    log_answer: (params) => {
      const active = governor.current.window && log.current.windows.find((window) => window.id === governor.current.window!.id);
      return captureAnswerToolRejection(active ?? undefined, params.stepRef) ?? "logged";
    },
    mark_off_record: (params) => {
      const seconds = typeof params.seconds === "number" ? params.seconds : undefined;
      strike(seconds === undefined ? undefined : Math.max(0, nowSecs() - seconds));
      return "struck from the record";
    },
    end_task: () => {
      queueMicrotask(() => void endTaskRef.current());
      return "ending";
    },
  };

  useEffect(() => {
    if (!started) return;
    const interval = window.setInterval(() => {
      if (ending.current) return;
      const signals = readSignals();
      const currentDecision = governor.current.evaluate(signals);
      setDecision(currentDecision);
      quietSamples.current.push({ at: signals.now, quiet: currentDecision.lights.silence });
      quietSamples.current = quietSamples.current.filter((sample) => signals.now - sample.at <= 60);
      expertSpeech.current = expertSpeech.current.filter((sample) => signals.now - sample.at <= 60);
      const samples = quietSamples.current;
      const redRatio = samples.length ? samples.filter((sample) => !sample.quiet).length / samples.length : 0;
      const humanWords = expertSpeech.current.reduce((sum, sample) => sum + sample.words, 0);
      setNoisy(samples.length >= 20 && redRatio > 0.8 && humanWords < 12);

      const active = governor.current.window;
      if (active) {
        const phase = voiceRef.current.turnPhase;
        const resumedBeforeListening = phase === "sending" || phase === "waiting_for_speech";
        if (resumedBeforeListening && (signals.lastTypingAt > active.openedAt || signals.lastScreenChangeAt > active.openedAt)) voiceRef.current.cancelTurn("resumed");
        rerender();
        return;
      }
      const action = loop.current.next(signals, prepared.current.preferred(readMemory()));
      updateDeferred();
      if (action.type === "open") void runWindow(action);
    }, 500);
    return () => {
      window.clearInterval(interval);
      if (activeTurn.current) voiceRef.current.cancelTurn("disconnected");
    };
    // The loop reads live refs; restarting it on render would make cadence nondeterministic.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started]);

  useEffect(() => {
    if (!started) return;
    const interval = window.setInterval(() => {
      if (holdingRef.current || ending.current || reasoningOff.current || governor.current.window) return;
      if (!readMemory().questions.length) return;
      void reasoning.current.run(readMemory, async (memory, signal) => {
        const response = await fetch("/api/reason", {
          method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(memory), signal,
        });
        if (!response.ok) throw new Error("reasoning unavailable");
        const result = await response.json();
        if (result.mode === "off") return { mode: "off", questions: [] };
        const proposal = ReasoningWire.parse({ questions: result.questions, relationships: [] });
        return { mode: result.mode, questions: validateProposal(memory, proposal).questions };
      }, (result) => {
        if (result.mode === "off") reasoningOff.current = true;
        if (result.mode === "live") prepared.current.set(readMemory(), result.questions);
      }).catch(() => {});
    }, 5000);
    return () => { window.clearInterval(interval); invalidateReasoning(); };
  }, [invalidateReasoning, readMemory, started]);

  useEffect(() => {
    if (!started) return;
    let syncing = false;
    const interval = window.setInterval(async () => {
      if (ending.current) return;
      const session = log.current;
      updateDeferred();
      if (!dirty.current || syncing || syncPromise.current) return;
      syncing = true;
      dirty.current = false;
      const currentPipeline = pipelineRef.current;
      session.metrics = { framesSeen: currentPipeline?.framesSeen ?? 0, entitiesRedacted: entitiesRedacted.current + (currentPipeline?.piiBlurred ?? 0) };
      const request = (sync.current?.sync(session) ?? Promise.reject(new Error("capture sync not initialized")))
        .then(() => {
          setSynced(Date.now());
          setSyncError(null);
        })
        .catch(() => {
          dirty.current = true;
          setSyncError("Could not save this capture.");
        });
      syncPromise.current = request;
      await request;
      if (syncPromise.current === request) syncPromise.current = null;
      syncing = false;
    }, 5000);
    return () => window.clearInterval(interval);
  }, [started]);

  /** Called synchronously inside the click: the screen share prompt needs the user activation. */
  const start = async (opts?: { mode?: "tab" | "workspace" }) => {
    if (!consented || startingRef.current || started) return;
    startingRef.current = true;
    setStarting(true);
    setStartError(null);
    setSyncError(null);
    // The share prompt first, synchronously inside the click, in parallel with the session POST.
    const share = share0 ? null : pipeline.start({ mode: opts?.mode ?? "tab", app: app.id, ...(app.id === "erp" ? { queue: "expert" } : {}) }).catch(() => undefined);
    let session: SessionLog;
    try {
      const response = await fetch("/api/sessions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ mode: "capture", task, expertName: expertName.trim() || "Expert" }) });
      if (!response.ok) throw new Error("session creation failed");
      ({ session } = await response.json());
      if (!session?.id) throw new Error("session creation failed");
    } catch {
      pipeline.stop();
      startingRef.current = false;
      setStarting(false);
      setStartError("Could not create a capture session.");
      return;
    }
    log.current = session;
    sync.current = createSessionSync(session.id);
    log.current.startedAt = Date.now();
    deferredSignature.current = "";
    ending.current = false;
    voiceRef.current.setSessionStart(log.current.startedAt);
    pipeline.signals.current = { lastScreenChangeAt: -Infinity, lastTypingAt: -Infinity, lastBoundaryAt: -Infinity, lastInvoiceOpenedAt: -Infinity, activity: "still" };
    setStarted(true);
    await share;
    await voiceRef.current.connect({
      firstMessage: "",
      sessionStartMs: log.current.startedAt,
      dynamicVariables: { expert_name: expertName.trim() || "Expert", task },
      keyterms: keytermsFrom([], COST_CENTERS),
    });
    setStarting(false);
  };

  useEffect(() => {
    let live = true;
    fetch("/api/health")
      .then((response) => (response.ok ? response.json() : null))
      .then((health: { keys?: { gateway?: boolean } } | null) => {
        if (live && health?.keys) setVisionKey(Boolean(health.keys.gateway));
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  const setCaptureHolding = useCallback((paused: boolean) => {
    if (paused) invalidateReasoning();
    holdingRef.current = paused;
    setHolding(paused);
    pipelineRef.current?.setPaused(paused);
    if (paused && activeTurn.current) voiceRef.current.cancelTurn("paused");
  }, [invalidateReasoning]);

  const session = log.current;
  const governorWindow = governor.current.window;
  const openWindow = governorWindow ? session.windows.find((window) => window.id === governorWindow.id) : undefined;
  const queued = queue.current.items.filter((candidate) => candidate.status === "queued").sort((left, right) => right.value - left.value);
  const struckSeconds = session.offRecord.reduce((sum, range) => sum + (range.to - range.from), 0);
  const events = useMemo(() => session.events.filter((event) => event.kind !== "typing").slice(-14).reverse(), [session.events, tick]); // eslint-disable-line react-hooks/exhaustive-deps
  const crop = pipeline as Partial<Pick<CaptureVM["pipeline"], "setCropTarget" | "surface" | "setOccluders" | "selfCapture" | "degraded" | "lastSentUrl" | "piiMode">>;
  // Struck narration never resurfaces on screen; `at`/`about` are presentation extras for the companion.
  const reasons = loop.current.reasonHeard
    .filter((reason) => !session.offRecord.some((range) => reason.t >= range.from && reason.t <= range.to))
    .map((reason) => {
      const candidate = queue.current.items.find((item) => item.stepRef === reason.stepRef && item.heardAt === reason.t);
      return { ...reason, at: session.startedAt + reason.t * 1000, about: aboutFor(reason.stepRef, candidate?.field) };
    });
  const openMeta = openWindow ? windowMeta.current.get(openWindow.id) : undefined;
  const understood: UnderstoodItem[] = session.windows
    .filter((window) => window.outcome === "answered")
    .map((window) => {
      const candidate = queue.current.items.find((item) => item.id === window.candidateId);
      const reason = window.logged?.reason?.trim();
      const literal = window.answerText && window.answerText !== reason ? window.answerText : undefined;
      return {
        windowId: window.id,
        kind: window.logged?.guardrail || candidate?.guardrail ? ("guardrail" as const) : ("reason" as const),
        text: reason || literal || "",
        isQuote: !reason && Boolean(literal),
        at: session.startedAt + (window.closedAt ?? window.answeredAt ?? window.openedAt) * 1000,
        question: window.question,
        answerText: literal,
        eyebrow: eyebrowFor(window.kind, aboutFor(window.stepRef, candidate?.field)),
        stepRef: window.stepRef ?? "",
      };
    })
    .filter((item) => item.text);
  const governorConfig = governor.current.config;

  const vm: CaptureVM = {
    started,
    expertName,
    task,
    consented,
    setExpertName,
    setTask,
    setConsented,
    start,
    endTask,
    sessionId: session.id,
    source,
    voice: { mode: voice.mode, connected: voice.connected, status: voice.status, isSpeaking: voice.isSpeaking, degraded: voice.degraded, lastError: voice.lastError },
    turnPhase: voice.turnPhase,
    gateOpen: voice.gateOpen,
    sttEngine: transcriber.engine,
    stt: { engine: transcriber.engine, connected: transcriber.connected },
    pipeline: {
      videoRef: pipeline.videoRef,
      sharing: pipeline.sharing,
      start: pipeline.start,
      activity: pipeline.activity,
      framesSeen: pipeline.framesSeen,
      framesSent: pipeline.framesSent,
      dropped: pipeline.dropped,
      visionLatency: pipeline.visionLatency,
      visionError: pipeline.visionError,
      masks: pipeline.masks,
      addMask: pipeline.addMask,
      clearMasks: pipeline.clearMasks,
      paused: pipeline.paused,
      ...(typeof crop.setCropTarget === "function" ? { setCropTarget: crop.setCropTarget, surface: crop.surface } : {}),
      ...(typeof crop.setOccluders === "function" ? { setOccluders: crop.setOccluders } : {}),
      selfCapture: crop.selfCapture,
      degraded: crop.degraded,
      lastSentUrl: crop.lastSentUrl,
      piiMode: crop.piiMode,
    },
    decision,
    questionsLast10Min: governor.current.questionsInLast10Min(nowSecs()),
    budget: governor.current.config.maxPer10Min,
    openWindow: openWindow && governorWindow
      ? {
          ...openWindow,
          phase: voice.turnPhase === "listening" || voice.turnPhase === "closing" ? "answering" : "asking",
          pauseSecs: openMeta?.pauseSecs,
          evidence: openMeta?.evidence,
          about: aboutFor(openWindow.stepRef, queue.current.items.find((candidate) => candidate.id === openWindow.candidateId)?.field),
        }
      : undefined,
    partial: voice.partial || partial,
    queued,
    askedCount: queue.current.askedCount,
    guardrailAsked: queue.current.guardrailAsked,
    toDebrief: loop.current.deferred().length,
    deferred: loop.current.deferred(),
    deferredCount: loop.current.deferred().length,
    events,
    candidateFor: (eventId) => queue.current.items.find((candidate) => candidate.eventId === eventId && candidate.kind === "why") ?? queue.current.items.find((candidate) => candidate.eventId === eventId),
    transcript: session.transcript,
    ledger: { framesSeen: pipeline.framesSeen, framesKept: session.frames.length, entitiesRedacted: entitiesRedacted.current + pipeline.piiBlurred, secondsStruck: struckSeconds },
    strike: () => strike(),
    notNow: () => {
      if (activeTurn.current) setLastDeferred({ at: Date.now() });
      voiceRef.current.cancelTurn("user");
    },
    holding,
    setHolding: setCaptureHolding,
    submitTypedAnswer: (text) => voiceRef.current.submitTyped(text),
    synced,
    syncError,
    reasonHeard: reasons.at(-1)?.quote,
    reasonHeardItems: reasons,
    noisy,
    chainedCount: loop.current.chainedCount,
    forced: activeForced.current,
    app,
    share0,
    startedAt: started ? session.startedAt : null,
    starting,
    startError,
    ending: endingUi,
    understood,
    lastNotice,
    lastStrike,
    lastDeferred,
    governorThresholds: { silenceSecs: governorConfig.silenceSecs, stillSecs: governorConfig.stillSecs, typingQuietSecs: governorConfig.typingQuietSecs },
    visionKey,
  };
  return <CaptureView vm={vm} />;
}
