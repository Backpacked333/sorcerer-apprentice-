import { describe, expect, it } from "vitest";
import { DEMO_GOVERNOR, Governor, type Signals } from "./governor";

const quiet = (now: number, extra: Partial<Signals> = {}): Signals => ({
  now,
  lastSpeechAt: now - 20,
  lastScreenChangeAt: now - 20,
  lastTypingAt: now - 20,
  lastBoundaryAt: Number.NEGATIVE_INFINITY,
  lastInvoiceOpenedAt: Number.NEGATIVE_INFINITY,
  agentSpeaking: false,
  ...extra,
});

describe("demo governor", () => {
  it("uses the demo cadence without changing the legacy defaults", () => {
    expect(DEMO_GOVERNOR.cooldownSecs).toBe(20);
    expect(DEMO_GOVERNOR.warmupSecs).toBe(8);
    expect(DEMO_GOVERNOR.readingSecs).toBe(5);
  });

  it("chains during cooldown but never while typing or after budget is spent", () => {
    const governor = new Governor({ ...DEMO_GOVERNOR, maxPer10Min: 1 });
    governor.open("why", 20);
    governor.markAsked(21);
    governor.close(27);

    expect(governor.canChain(quiet(28.3))).toBe(false);

    const available = new Governor(DEMO_GOVERNOR);
    available.open("why", 20);
    available.markAsked(21);
    available.close(27);
    expect(available.canChain(quiet(28.3))).toBe(true);
    expect(available.canChain(quiet(28.3, { lastTypingAt: 28 }))).toBe(false);
  });

  it("refunds a spoken question and applies the short abort cooldown", () => {
    const governor = new Governor(DEMO_GOVERNOR);
    governor.open("why", 20);
    governor.markAsked(21);
    governor.closeWith(27, { refund: true, cooldownSecs: 8 });

    expect(governor.questionsAsked).toBe(0);
    expect(governor.canOpen(quiet(34), 0.9)).toBe(false);
    expect(governor.canOpen(quiet(35), 0.9)).toBe(true);
  });

  it("fails closed when the transcriber is unhealthy", () => {
    const governor = new Governor({ ...DEMO_GOVERNOR, warmupSecs: 0 });
    const decision = governor.evaluate(quiet(20, { transcriberHealthy: false }));
    expect(decision.lights.silence).toBe(false);
    expect(decision.interruptible).toBe(false);
  });
});
