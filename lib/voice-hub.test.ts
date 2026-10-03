import { describe, expect, it, vi } from "vitest";

import { AgentSpeechTimeline } from "./voice-protocol";
import {
  AgentSpeechTracker,
  buildVoiceHubScribeOptions,
  cleanupVoiceHubProvider,
  VoiceHubConnectionCoordinator,
  voiceHubConfigFingerprint,
  VoiceHubRouter,
  nextVoiceHubConnectionAction,
  type VoiceHubSubscriber,
} from "./voice-hub";

function subscriber(overrides: Partial<VoiceHubSubscriber> = {}): VoiceHubSubscriber {
  return {
    enabled: true,
    onPartial: () => {},
    onCommitted: () => {},
    ...overrides,
  };
}

describe("VoiceHubRouter app clock", () => {
  it("uses first and last changed partials for session-relative commit times", () => {
    const committed = vi.fn();
    const hub = new VoiceHubRouter({ timeline: new AgentSpeechTimeline() });
    hub.subscribe("capture", () => subscriber({ onCommitted: committed }));
    hub.setSessionStart(100_000);

    hub.partial("hello", 101_000);
    hub.partial("hello", 101_200);
    hub.partial("hello there", 101_400);
    hub.commit("hello there", 102_500);

    expect(committed).toHaveBeenCalledWith("hello there", 1, 1.4, {
      startedAtMs: 101_000,
      endedAtMs: 101_400,
      speaker: "human",
    });
  });

  it("uses commit minus one second when no partial arrived and omits relative times until the session clock is known", () => {
    const committed = vi.fn();
    const hub = new VoiceHubRouter({ timeline: new AgentSpeechTimeline() });
    hub.subscribe("map", () => subscriber({ onCommitted: committed }));

    hub.commit("direct commit", 205_000);

    expect(committed).toHaveBeenCalledWith("direct commit", undefined, undefined, {
      startedAtMs: 204_000,
      endedAtMs: 204_000,
      speaker: "human",
    });
  });

  it("drops partial timing when the application session clock changes", () => {
    const committed = vi.fn();
    const hub = new VoiceHubRouter({ timeline: new AgentSpeechTimeline() });
    hub.subscribe("capture", () => subscriber({ onCommitted: committed }));
    hub.setSessionStart(100_000);
    hub.partial("old session partial", 101_000);

    hub.setSessionStart(200_000);
    hub.commit("new session commit", 202_000);

    expect(committed).toHaveBeenCalledWith("new session commit", 1, 1, {
      startedAtMs: 201_000,
      endedAtMs: 201_000,
      speaker: "human",
    });
  });

  it("clears an unclocked pending segment when the session clock is cleared", () => {
    const committed = vi.fn();
    const hub = new VoiceHubRouter({ timeline: new AgentSpeechTimeline() });
    hub.subscribe("capture", () => subscriber({ onCommitted: committed }));
    hub.partial("stale partial", 1_000);

    hub.setSessionStart(undefined);
    hub.commit("fresh commit", 5_000);

    expect(committed.mock.calls[0][3]).toMatchObject({ startedAtMs: 4_000, endedAtMs: 4_000 });
  });

  it("clamps pre-session segment times to an ordered non-negative range", () => {
    const committed = vi.fn();
    const hub = new VoiceHubRouter({ timeline: new AgentSpeechTimeline() });
    hub.subscribe("capture", () => subscriber({ onCommitted: committed }));
    hub.setSessionStart(100_000);

    hub.partial("early", 98_000);
    hub.commit("early speech", 99_000);

    expect(committed.mock.calls[0].slice(1, 3)).toEqual([0, 0]);
  });
});

describe("VoiceHubRouter attribution", () => {
  it("holds incremental prompt prefixes as agent echo before the full echo arrives", () => {
    const partial = vi.fn();
    const activity = vi.fn();
    const timeline = new AgentSpeechTimeline([{ start: 10, end: 12, text: "What made you choose this option?" }]);
    const hub = new VoiceHubRouter({ timeline, onHumanActivity: activity });
    hub.subscribe("capture", () => subscriber({ onPartial: partial }));

    hub.partial("What made", 10_300);
    hub.partial("What made you choose", 10_700);
    hub.partial("What made you choose this option", 11_200);

    expect(partial).not.toHaveBeenCalled();
    expect(activity).not.toHaveBeenCalled();
  });

  it("routes exact and late echo only to onAgentEcho without human activity", () => {
    const human = vi.fn();
    const echo = vi.fn();
    const activity = vi.fn();
    const timeline = new AgentSpeechTimeline([{ start: 10, end: 12, text: "What made you choose this option?" }]);
    const hub = new VoiceHubRouter({ timeline, onHumanActivity: activity });
    hub.subscribe("capture", () => subscriber({ onCommitted: human, onAgentEcho: echo }));

    hub.partial("What made you choose this option", 11_000);
    hub.commit("What made you choose this option", 12_100);
    hub.commit("What made you choose this option", 15_500);

    expect(human).not.toHaveBeenCalled();
    expect(activity).not.toHaveBeenCalled();
    expect(echo).toHaveBeenCalledTimes(2);
    expect(echo.mock.calls[0][3]).toMatchObject({ speaker: "agent" });
  });

  it("strips a leading echo, keeps at least two human words, and treats a headphone barge-in as human", () => {
    const partial = vi.fn();
    const committed = vi.fn();
    const activity = vi.fn();
    const timeline = new AgentSpeechTimeline([{ start: 20, end: 23, text: "When would you stop and ask someone?" }]);
    const hub = new VoiceHubRouter({ timeline, onHumanActivity: activity });
    hub.subscribe("teach", () => subscriber({ onPartial: partial, onCommitted: committed }));

    hub.partial("When would you stop and ask someone because policy applies", 22_000);
    hub.commit("When would you stop and ask someone because policy applies", 23_200);
    hub.partial("I would check with my team lead", 22_500);
    hub.commit("I would check with my team lead", 23_300);

    expect(partial).toHaveBeenNthCalledWith(1, "because policy applies");
    expect(committed.mock.calls.map((call) => call[0])).toEqual(["because policy applies", "I would check with my team lead"]);
    expect(activity).toHaveBeenCalled();
  });

  it("routes a human partial command and never promotes a one-word mixed suffix", () => {
    const partial = vi.fn();
    const command = vi.fn();
    const timeline = new AgentSpeechTimeline([{ start: 30, end: 32, text: "Would that apply every time?" }]);
    const hub = new VoiceHubRouter({ timeline });
    hub.subscribe("capture", () => subscriber({ onPartial: partial, onCommand: command }));

    hub.partial("Would that apply every time yes", 31_500);
    hub.partial("scratch that", 34_000);

    expect(partial).toHaveBeenCalledTimes(1);
    expect(partial).toHaveBeenCalledWith("scratch that");
    expect(command).toHaveBeenCalledWith("off_record", "scratch that", expect.objectContaining({ speaker: "human" }));
  });
});

describe("VoiceHubRouter connection demand", () => {
  it("counts enabled subscribers, ignores disabled ones, and keeps one connect in flight", () => {
    const first = { current: subscriber() };
    const disabled = { current: subscriber({ enabled: false }) };
    const hub = new VoiceHubRouter({ timeline: new AgentSpeechTimeline() });
    hub.subscribe("first", () => first.current);
    hub.subscribe("disabled", () => disabled.current);

    expect(hub.enabledSubscriberCount()).toBe(1);
    expect(hub.shouldConnect({ sessionActive: false, forcedOff: false })).toBe(true);
    expect(nextVoiceHubConnectionAction({ demanded: true, status: "disconnected" })).toBe("connect");
    expect(nextVoiceHubConnectionAction({ demanded: true, status: "connecting" })).toBe("none");
    expect(nextVoiceHubConnectionAction({ demanded: true, status: "connected" })).toBe("none");
  });

  it("connects for an agent session without subscribers and stt=off wins", () => {
    const hub = new VoiceHubRouter({ timeline: new AgentSpeechTimeline() });

    expect(hub.shouldConnect({ sessionActive: true, forcedOff: false })).toBe(true);
    expect(hub.shouldConnect({ sessionActive: true, forcedOff: true })).toBe(false);
    expect(nextVoiceHubConnectionAction({ demanded: false, status: "connected" })).toBe("disconnect");
  });

  it("builds the timestamp-free Scribe VAD microphone profile", () => {
    expect(buildVoiceHubScribeOptions({
      token: "single-use",
      deviceId: "preferred-mic",
      language: "de",
      keyterms: ["Acme", "capex"],
      filterBackgroundAudio: true,
    })).toEqual({
      token: "single-use",
      modelId: "scribe_v2_realtime",
      commitStrategy: "vad",
      vadSilenceThresholdSecs: 1,
      filterBackgroundAudio: true,
      languageCode: "de",
      keyterms: ["Acme", "capex"],
      microphone: {
        deviceId: { exact: "preferred-mic" },
        echoCancellation: true,
        noiseSuppression: true,
      },
    });
  });
});

describe("VoiceHubConnectionCoordinator", () => {
  it("keeps one deferred token attempt through ordinary reconcile passes and reconciles after settle", async () => {
    const coordinator = new VoiceHubConnectionCoordinator();
    coordinator.update({ demanded: true, configFingerprint: "config-a" });
    const first = coordinator.beginTokenAttempt();
    expect(first).toEqual({ generation: 1, configFingerprint: "config-a" });
    let releaseToken!: () => void;
    const deferredToken = new Promise<void>((resolve) => { releaseToken = resolve; });
    let tokenCalls = 1;
    let connections = 0;
    let engine = "none";
    const attempt = (async () => {
      await deferredToken;
      if (coordinator.isCurrent(first!.generation)) {
        connections += 1;
        engine = "scribe";
      }
      return coordinator.settle(first!.generation);
    })();

    expect(coordinator.update({ demanded: true, configFingerprint: "config-a" }).stopResources).toBe(false);
    if (coordinator.beginTokenAttempt()) tokenCalls += 1;
    expect(tokenCalls).toBe(1);

    releaseToken();
    expect(await attempt).toBe(true);
    expect({ tokenCalls, connections, engine }).toEqual({ tokenCalls: 1, connections: 1, engine: "scribe" });
    expect(coordinator.snapshot()).toMatchObject({ demanded: true, inFlight: false, fatalLatched: false });
  });

  it("allows one token attempt per fatal demand window and resets only after demand turns off", () => {
    const coordinator = new VoiceHubConnectionCoordinator();
    coordinator.update({ demanded: true, configFingerprint: "config-a" });
    const first = coordinator.beginTokenAttempt()!;
    coordinator.settle(first.generation);
    expect(coordinator.latchFatal()).toBe(true);
    expect(coordinator.beginFallback()).toBe(true);
    expect(coordinator.beginFallback()).toBe(false);
    expect(coordinator.beginTokenAttempt()).toBeUndefined();

    coordinator.update({ demanded: false, configFingerprint: "config-a" });
    coordinator.update({ demanded: true, configFingerprint: "config-a" });
    expect(coordinator.beginTokenAttempt()).toEqual({ generation: 2, configFingerprint: "config-a" });
  });

  it("rejects a deferred token from a demand window that stopped and restarted", () => {
    const coordinator = new VoiceHubConnectionCoordinator();
    coordinator.update({ demanded: true, configFingerprint: "config-a" });
    const stale = coordinator.beginTokenAttempt()!;

    coordinator.update({ demanded: false, configFingerprint: "config-a" });
    coordinator.update({ demanded: true, configFingerprint: "config-a" });

    expect(coordinator.isCurrent(stale.generation)).toBe(false);
    coordinator.settle(stale.generation);
    expect(coordinator.beginTokenAttempt()).toEqual({ generation: 2, configFingerprint: "config-a" });
  });

  it("invalidates stale work and requests one controlled reconnect for an effective config change", () => {
    const coordinator = new VoiceHubConnectionCoordinator();
    coordinator.update({ demanded: true, configFingerprint: "config-a" });
    const first = coordinator.beginTokenAttempt()!;
    expect(coordinator.settle(first.generation)).toBe(true);

    expect(coordinator.update({ demanded: true, configFingerprint: "config-b" }).stopResources).toBe(true);
    expect(coordinator.update({ demanded: true, configFingerprint: "config-b" }).stopResources).toBe(false);
    expect(coordinator.beginTokenAttempt()).toEqual({ generation: 2, configFingerprint: "config-b" });
  });

  it("does not let a suppressed old CLOSE mask an unexpected replacement CLOSE", () => {
    const coordinator = new VoiceHubConnectionCoordinator();
    coordinator.update({ demanded: true, configFingerprint: "config-a" });
    const original = coordinator.beginTokenAttempt()!;
    coordinator.settle(original.generation);

    coordinator.update({ demanded: true, configFingerprint: "config-b" });
    coordinator.expectControlledClose();
    const replacement = coordinator.beginTokenAttempt()!;
    // Installed SDK suppresses the old CLOSE because the replacement is now current.
    coordinator.replacementInstalled(replacement.generation);
    coordinator.settle(replacement.generation);

    expect(coordinator.consumeControlledClose()).toBe(false);
    expect(coordinator.latchFatal()).toBe(true);
    expect(coordinator.snapshot().fatalLatched).toBe(true);
  });

  it("fingerprints every effective Scribe and WebSpeech option including empty keyterms", () => {
    const base = { language: "en", deviceId: "mic-1", keyterms: ["Acme"], filterBackgroundAudio: true };
    expect(voiceHubConfigFingerprint(base)).not.toBe(voiceHubConfigFingerprint({ ...base, language: "de" }));
    expect(voiceHubConfigFingerprint(base)).not.toBe(voiceHubConfigFingerprint({ ...base, deviceId: "mic-2" }));
    expect(voiceHubConfigFingerprint(base)).not.toBe(voiceHubConfigFingerprint({ ...base, keyterms: [] }));
    expect(voiceHubConfigFingerprint(base)).not.toBe(voiceHubConfigFingerprint({ ...base, filterBackgroundAudio: false }));
    expect(voiceHubConfigFingerprint({ ...base, keyterms: [] })).toBe(voiceHubConfigFingerprint({ ...base, keyterms: [] }));
  });
});

describe("voice hub resource lifecycle", () => {
  it("disables demand before stopping WebSpeech and prevents its captured onend from restarting", () => {
    const events: string[] = [];
    let demanded = true;
    let restarts = 0;
    const recognizer = {
      onend: () => { if (demanded) restarts += 1; },
      stop: () => { events.push("stop"); },
    };
    const capturedOnEnd = recognizer.onend;

    cleanupVoiceHubProvider({
      disableDemand: () => { demanded = false; events.push("demand-off"); },
      recognizer,
      clearRecognizer: () => events.push("clear-ref"),
      disconnectScribe: () => events.push("disconnect-scribe"),
    });
    capturedOnEnd();

    expect(events).toEqual(["demand-off", "clear-ref", "stop", "disconnect-scribe"]);
    expect(recognizer.onend).toBeNull();
    expect(restarts).toBe(0);
  });
});

describe("AgentSpeechTracker", () => {
  it("debounces and closes gated unsolicited speech without authorization state", () => {
    vi.useFakeTimers();
    const timeline = new AgentSpeechTimeline();
    const tracker = new AgentSpeechTracker(timeline);

    tracker.onMode("speaking", 10, "Unsolicited output");
    tracker.onMode("listening", 12, "Unsolicited output");
    vi.advanceTimersByTime(599);
    expect(timeline.all()[0].end).toBeUndefined();
    vi.advanceTimersByTime(1);
    expect(timeline.all()[0].end).toBe(12);
    vi.useRealTimers();
  });
});
