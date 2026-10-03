import { describe, expect, it, vi } from "vitest";

import { AgentSpeechTimeline } from "./voice-protocol";
import { buildVoiceHubScribeOptions, VoiceHubRouter, nextVoiceHubConnectionAction, type VoiceHubSubscriber } from "./voice-hub";

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
