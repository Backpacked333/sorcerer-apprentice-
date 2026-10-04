import { afterEach, expect, it, vi } from "vitest";
import { describeEvent, emptySession, type Frame, type QuestionWindow, type SessionLog } from "./events";
import { ERP_CHANNEL, postHello, postTelemetry, subscribeHello, subscribeTelemetry } from "./telemetry";

afterEach(() => vi.unstubAllGlobals());

it("renders save intent without implying a committed save and accepts optional contracts", () => {
  const frame: Frame = { id: "f", t: 1, url: "/frame.jpg", width: 1, height: 1, piiRegionsBlurred: 0 };
  const window: QuestionWindow = { id: "w", candidateId: "c", kind: "why", question: "Why?", openedAt: 0, spokeAt: 1, closedBy: "tool" };
  const session: SessionLog = { ...emptySession("s", "capture", "task", "expert"), frames: [frame], windows: [window], deferred: [{ kind: "why", question: "Why?", stepRef: "i:route" }], sample: true, ws: "local" };
  expect(session.frames[0].url).toBe("/frame.jpg");
  expect(describeEvent({ id: "e", t: 0, source: "dom", kind: "save_intent", invoice: "42", latencyMs: 2 })).toBe("invoice 42: save requested, not yet posted");
});

it("keeps hello and telemetry subscribers separate and closes channels", () => {
  const channels = new Set<Channel>();
  class Channel {
    onmessage?: (event: { data: unknown }) => void;
    constructor(readonly name: string) { channels.add(this); }
    postMessage(data: unknown) { for (const ch of channels) if (ch !== this && ch.name === this.name) ch.onmessage?.({ data }); }
    close() { channels.delete(this); }
  }
  vi.stubGlobal("window", {});
  vi.stubGlobal("BroadcastChannel", Channel);
  const events = vi.fn(), hellos = vi.fn();
  const stopEvents = subscribeTelemetry(events), stopHello = subscribeHello(hellos);
  postHello({ sessionId: "s", queues: ["expert"] });
  expect(events).not.toHaveBeenCalled();
  expect(hellos).toHaveBeenCalledWith({ type: "hello", sessionId: "s", queues: ["expert"], at: expect.any(Number) });
  postTelemetry({ kind: "invoice_opened", queue: "expert", sandboxSession: "s", reannounce: true });
  expect(events).toHaveBeenCalledWith({ kind: "invoice_opened", queue: "expert", sandboxSession: "s", reannounce: true, at: expect.any(Number) });
  expect(hellos).toHaveBeenCalledTimes(1);
  expect([...channels].map((ch) => ch.name)).toEqual([ERP_CHANNEL, ERP_CHANNEL]);
  stopEvents(); stopHello();
  expect(channels.size).toBe(0);
});
