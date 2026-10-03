import { describe, expect, it, vi } from "vitest";

import {
  applyConversationGate,
  createSpeechAuthorizationLatch,
  installAudioAttachmentGate,
  type AudioAttachmentNode,
  type AudioAttachmentRoot,
} from "@/components/voice";
import { evaluateSilenceSoak } from "@/app/voice-check/VoiceCheck";

function audio(volume = 1): AudioAttachmentNode & { volume: number } {
  return { nodeName: "AUDIO", volume };
}

describe("audio attachment gate", () => {
  it("sets the closed-gate volume before a fake adapter can play its first frame", () => {
    let firstFrameVolume = -1;
    const root: AudioAttachmentRoot = {
      appendChild(node) {
        firstFrameVolume = (node as { volume: number }).volume;
        return node;
      },
      querySelectorAll: () => [],
    };
    const stop = installAudioAttachmentGate({ root, readVolume: () => 0 });

    const fakeAdapter = { attach: () => root.appendChild(audio()) };
    fakeAdapter.attach();

    expect(firstFrameVolume).toBe(0);
    stop();
  });

  it("uses the current open-gate volume and guards nested audio added by another DOM API", () => {
    let observerCallback: ((records: ArrayLike<{ addedNodes: ArrayLike<AudioAttachmentNode> }>) => void) | undefined;
    let open = true;
    const root: AudioAttachmentRoot = {
      appendChild: (node) => node,
      querySelectorAll: () => [],
    };
    const stop = installAudioAttachmentGate({
      root,
      readVolume: () => open ? 1 : 0,
      createObserver: (callback) => {
        observerCallback = callback;
        return { observe: vi.fn(), disconnect: vi.fn() };
      },
    });
    const direct = audio();
    root.appendChild(direct);
    expect(direct.volume).toBe(1);

    open = false;
    const nested = audio();
    observerCallback?.([{ addedNodes: [{ nodeName: "DIV", querySelectorAll: () => [nested] }] }]);
    expect(nested.volume).toBe(0);
    stop();
  });
});

describe("speech authorization latch", () => {
  it("keeps pending authorization and heartbeat suppression until speech actually begins", () => {
    vi.useFakeTimers();
    const latch = createSpeechAuthorizationLatch();
    latch.authorize();
    vi.advanceTimersByTime(60_000);
    expect(latch.snapshot()).toMatchObject({ pending: true, active: false, authorized: true, heartbeatAllowed: false });
    latch.onMode("listening");
    expect(latch.snapshot().authorized).toBe(true);
    vi.useRealTimers();
  });

  it("debounces a falling edge for 600 ms and survives speaking-mode flicker", () => {
    vi.useFakeTimers();
    const ended = vi.fn();
    const latch = createSpeechAuthorizationLatch({ onDefinitiveEnd: ended });
    latch.authorize();
    latch.onMode("speaking");
    expect(latch.snapshot()).toMatchObject({ pending: false, active: true, authorized: true });
    latch.onMode("listening");
    vi.advanceTimersByTime(599);
    expect(latch.snapshot()).toMatchObject({ authorized: true, heartbeatAllowed: false });
    latch.onMode("speaking");
    vi.advanceTimersByTime(1_000);
    expect(latch.snapshot().active).toBe(true);
    expect(ended).not.toHaveBeenCalled();
    latch.onMode("listening");
    vi.advanceTimersByTime(600);
    expect(latch.snapshot()).toMatchObject({ active: false, authorized: false, heartbeatAllowed: true });
    expect(ended).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});

describe("conversation volume control", () => {
  it("applies closed volume synchronously", () => {
    const volumes: number[] = [];
    const applied = applyConversationGate({ setVolume: ({ volume }) => volumes.push(volume) }, false);
    expect(applied).toBe(true);
    expect(volumes).toEqual([0]);
  });
});

describe("silence soak evaluation", () => {
  const startedAt = 1_000;
  const heartbeat = (at: number) => ({ at, src: "gate" as const, type: "heartbeat" });

  it("passes only from post-snapshot events with enough heartbeats and no audible unsolicited speech", () => {
    const before = { at: 999, src: "gate" as const, type: "audible_unsolicited" };
    const events = [before, ...Array.from({ length: 15 }, (_, index) => heartbeat(startedAt + index + 1))];
    expect(evaluateSilenceSoak({ events, startedAt, connected: true, gateOpen: false })).toMatchObject({
      automatedPass: true,
      heartbeats: 15,
      audibleUnsolicited: 0,
      disconnected: false,
    });
  });

  it("fails on an audible edge or disconnect and preserves gated-utterance diagnostics", () => {
    const events = [
      ...Array.from({ length: 15 }, (_, index) => heartbeat(startedAt + index + 1)),
      { at: 1_100, src: "gate" as const, type: "gated_utterance" },
      { at: 1_200, src: "gate" as const, type: "audible_unsolicited" },
      { at: 1_300, src: "agent" as const, type: "disconnect" },
    ];
    expect(evaluateSilenceSoak({ events, startedAt, connected: false, gateOpen: false })).toMatchObject({
      automatedPass: false,
      gatedUtterances: 1,
      audibleUnsolicited: 1,
      disconnected: true,
    });
  });
});
