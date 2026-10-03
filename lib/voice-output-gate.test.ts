import { describe, expect, it, vi } from "vitest";

import {
  applyConversationGate,
  createSpeechAuthorizationLatch,
  installElevenLabsPlaybackGate,
  isElevenLabsRemoteStreamAudio,
  type RemoteStreamAudio,
} from "@/components/voice";
import { evaluateSilenceSoak } from "@/app/voice-check/VoiceCheck";

function remoteAudio(volume = 1): RemoteStreamAudio {
  return {
    nodeName: "AUDIO",
    volume,
    autoplay: true,
    parentElement: null,
    srcObject: { getAudioTracks: () => [{ kind: "audio" }] },
  };
}

describe("ElevenLabs playback gate", () => {
  it("sets volume before play in the installed LiveKit attach then ElevenLabs append order", async () => {
    let volumeAtPlay = -1;
    let volumeAtAppend = -1;
    const playTarget = {
      play(this: RemoteStreamAudio) {
        volumeAtPlay = this.volume;
        return Promise.resolve();
      },
    };
    const stop = installElevenLabsPlaybackGate({ playTarget, readVolume: () => 0 });
    const root = { appendChild(element: RemoteStreamAudio) { volumeAtAppend = element.volume; } };
    const fakeInstalledAdapter = {
      attachRemoteTrack() {
        const element = remoteAudio();
        void playTarget.play.call(element); // livekit-client Track.attach()
        root.appendChild(element); // @elevenlabs/client WebAudioAdapter
      },
    };
    fakeInstalledAdapter.attachRemoteTrack();
    expect({ volumeAtPlay, volumeAtAppend }).toEqual({ volumeAtPlay: 0, volumeAtAppend: 0 });
    stop();
  });

  it("never changes unrelated product audio", () => {
    const volumes: number[] = [];
    const playTarget = { play(this: RemoteStreamAudio) { volumes.push(this.volume); return Promise.resolve(); } };
    const stop = installElevenLabsPlaybackGate({ playTarget, readVolume: () => 0 });
    const clip = { nodeName: "AUDIO", volume: 1, autoplay: true, parentElement: null, srcObject: null };
    void playTarget.play.call(clip);
    expect(isElevenLabsRemoteStreamAudio(clip)).toBe(false);
    expect(volumes).toEqual([1]);
    stop();
  });

  it("is reference-counted and survives two installers cleaning up out of order", () => {
    const volumes: number[] = [];
    const originalPlay = function (this: RemoteStreamAudio) { volumes.push(this.volume); return Promise.resolve(); };
    const playTarget = { play: originalPlay };
    const stopClosed = installElevenLabsPlaybackGate({ playTarget, readVolume: () => 0 });
    const wrappedPlay = playTarget.play;
    const stopOpen = installElevenLabsPlaybackGate({ playTarget, readVolume: () => 1 });
    expect(playTarget.play).toBe(wrappedPlay);
    stopClosed();
    expect(playTarget.play).toBe(wrappedPlay);
    void playTarget.play.call(remoteAudio());
    expect(volumes).toEqual([1]);
    stopOpen();
    expect(playTarget.play).toBe(originalPlay);
  });

  it("keeps the remaining closed installer when the newer installer cleans up first", () => {
    const volumes: number[] = [];
    const originalPlay = function (this: RemoteStreamAudio) { volumes.push(this.volume); return Promise.resolve(); };
    const playTarget = { play: originalPlay };
    const stopClosed = installElevenLabsPlaybackGate({ playTarget, readVolume: () => 0 });
    const stopOpen = installElevenLabsPlaybackGate({ playTarget, readVolume: () => 1 });
    stopOpen();
    void playTarget.play.call(remoteAudio());
    expect(volumes).toEqual([0]);
    stopClosed();
    expect(playTarget.play).toBe(originalPlay);
  });
});

describe("speech authorization latch", () => {
  it("times out pending authorization after eight seconds and resumes heartbeat", () => {
    vi.useFakeTimers();
    const timedOut = vi.fn();
    const latch = createSpeechAuthorizationLatch({ onPendingTimeout: timedOut });
    latch.authorize();
    vi.advanceTimersByTime(7_999);
    expect(latch.snapshot()).toMatchObject({ pending: true, active: false, authorized: true, heartbeatAllowed: false });
    vi.advanceTimersByTime(1);
    expect(latch.snapshot()).toMatchObject({ pending: false, active: false, authorized: false, heartbeatAllowed: true });
    expect(timedOut).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("cancels the watchdog on the first speaking edge and never times out active speech", () => {
    vi.useFakeTimers();
    const timedOut = vi.fn();
    const latch = createSpeechAuthorizationLatch({ onPendingTimeout: timedOut });
    latch.authorize();
    vi.advanceTimersByTime(7_999);
    latch.onMode("speaking");
    vi.advanceTimersByTime(10_000);
    expect(latch.snapshot()).toMatchObject({ pending: false, active: true, authorized: true, heartbeatAllowed: false });
    expect(timedOut).not.toHaveBeenCalled();
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
