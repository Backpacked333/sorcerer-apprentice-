import { describe, expect, it } from "vitest";
import { buildCandidates, newContext, templates } from "@/lib/curiosity";
import type { ScreenEvent } from "@/lib/events";
import {
  VISION_OFF_NO_KEY,
  VISION_OFF_NO_SHARE,
  VISION_ONLY_BADGE,
  aboutFor,
  askSub,
  budgetText,
  captureApp,
  cardState,
  erpTargetFor,
  evidenceFor,
  eyebrowFor,
  healthItems,
  rolePart,
  visionOnlyNote,
  type CardInput,
} from "./capture-copy";

const T0 = 1_000_000;
const base: CardInput = {
  started: true,
  now: T0,
  presence: "quiet",
  decision: { state: "listening", lights: { notTyping: true, notReading: true }, reasons: [] },
  watching: true,
  queued: 0,
  holding: false,
  noun: "invoice",
};

describe("captureApp", () => {
  it("erp has telemetry, claims is vision-only with an honest badge", () => {
    expect(captureApp(undefined)).toMatchObject({ id: "erp", src: "/erp?queue=expert", telemetry: true });
    const c = captureApp("claims");
    expect(c).toMatchObject({ id: "claims", src: "/claims", telemetry: false, badge: VISION_ONLY_BADGE });
  });
  it("keyless / no-share notes only for the vision-only app", () => {
    const erp = captureApp("erp");
    const claims = captureApp("claims");
    expect(visionOnlyNote({ app: erp, visionKey: false, sharing: false, started: true })).toBeNull();
    expect(visionOnlyNote({ app: claims, visionKey: false, sharing: false, started: false })).toBe(VISION_OFF_NO_KEY);
    expect(visionOnlyNote({ app: claims, visionKey: true, sharing: false, started: true })).toBe(VISION_OFF_NO_SHARE);
    expect(visionOnlyNote({ app: claims, visionKey: true, sharing: true, started: true })).toBeNull();
  });
  it("role copy is gender-neutral and app-specific", () => {
    expect(rolePart(captureApp("claims"), "")).toMatch(/Work the claims/);
    expect(rolePart(captureApp("erp"), "Ada")).toMatch(/^You are Ada/);
    expect(rolePart(captureApp("erp"), "")).not.toMatch(/\b(her|she)\b/i);
  });
});

describe("question window copy", () => {
  it("eyebrow is KIND · FIELD", () => {
    expect(eyebrowFor("why", "cost center")).toBe("WHY · COST CENTER");
    expect(eyebrowFor("counterfactual", null)).toBe("WHAT IF");
    expect(aboutFor("4471:costCenter")).toBe("cost center");
    expect(aboutFor("4473:status")).toBe("status");
    expect(aboutFor("4471:invoice_opened")).toBeNull();
  });
  it("only vision events say seen on screen", () => {
    expect(evidenceFor({ source: "dom" })).toBe("reported by the ERP");
    expect(evidenceFor({ source: "vision" })).toBe("seen on screen");
    expect(evidenceFor({ source: "vision", alsoSeenBy: "dom" })).toBe("seen on screen, confirmed by the ERP");
    expect(askSub(1.62, "reported by the ERP")).toBe("You paused 1.6 s · reported by the ERP");
    expect(askSub(undefined, undefined)).toBe("");
  });
  it("budget comes from the config, never a constant", () => {
    expect(budgetText(1, 5)).toBe("asked 1 · ≤5 per 10 min");
    expect(budgetText(0, 3)).toBe("asked 0 · ≤3 per 10 min");
  });
  it("maps fields to ERP target hooks", () => {
    expect(erpTargetFor("costCenter")).toBe("cc");
    expect(erpTargetFor("hasAssetNumber")).toBe("asset");
    expect(erpTargetFor(undefined)).toBeNull();
  });
});

describe("health chips", () => {
  const h = { started: true, app: captureApp("erp"), voice: { mode: "fallback" as const, connected: false }, sttEngine: "none" as const, sharing: false, dropped: 0, queued: 0 };
  it("keyless ERP says telemetry only, never seeing", () => {
    const labels = healthItems(h).map((x) => x.label);
    expect(labels).toEqual(["Browser voice (fallback)", "No transcript", "ERP telemetry only"]);
  });
  it("claims without a share says no screen", () => {
    expect(healthItems({ ...h, app: captureApp("claims") }).map((x) => x.label)).toContain("No screen");
  });
  it("wrong surface is reported honestly", () => {
    expect(healthItems({ ...h, sharing: true, degraded: "wrong_surface" }).map((x) => x.label)).toContain("Wrong surface — no frames sent");
  });
  it("a shared screen with source dom never claims vision is seeing", () => {
    const labels = healthItems({ ...h, sharing: true, source: "dom" }).map((x) => x.label);
    expect(labels).toContain("Screen shared · ERP telemetry only");
    expect(labels.some((l) => l.startsWith("Seeing"))).toBe(false);
    expect(healthItems({ ...h, sharing: true, source: "both" }).map((x) => x.label)).toContain("Seeing the ERP");
  });
  it("is empty before start", () => {
    expect(healthItems({ ...h, started: false })).toEqual([]);
  });
});

describe("cardState: moods only from real state", () => {
  it("prestart", () => {
    expect(cardState({ ...base, started: false }).mode).toBe("prestart");
  });
  it("quiet when nothing happens", () => {
    const s = cardState(base);
    expect(s).toMatchObject({ mode: "capsule", mood: "quiet" });
  });
  it("typing and reading from the governor lights", () => {
    expect(cardState({ ...base, decision: { state: "listening", lights: { notTyping: false, notReading: true } } }).mood).toBe("typing");
    expect(cardState({ ...base, decision: { state: "listening", lights: { notTyping: true, notReading: false } } }).mood).toBe("reading");
  });
  it("pausing only while the governor waits with a queued question", () => {
    const d = { state: "waiting" as const, lights: { notTyping: true, notReading: true }, reasons: ["cooldown"] };
    expect(cardState({ ...base, decision: d, queued: 0 }).mood).toBe("quiet");
    const s = cardState({ ...base, decision: d, queued: 1 });
    expect(s.mood).toBe("pausing");
    expect(s.sub).toBe("Waiting — cooldown");
  });
  it("ask mode while a window is open", () => {
    expect(cardState({ ...base, presence: "asking", window: { phase: "asking" } })).toMatchObject({ mode: "ask", mood: "asking" });
    expect(cardState({ ...base, presence: "listening", window: { phase: "answering" } })).toMatchObject({ mode: "ask", mood: "listening" });
  });
  it("understood lingers for 3.4 s after the answer, then capsule", () => {
    expect(cardState({ ...base, lastUnderstoodAt: T0 - 1000 })).toMatchObject({ mode: "ask", mood: "understood", understoodLinger: true });
    expect(cardState({ ...base, lastUnderstoodAt: T0 - 5000 })).toMatchObject({ mode: "capsule", mood: "quiet" });
  });
  it("notice only when the change queued a question", () => {
    expect(cardState({ ...base, lastNotice: { at: T0 - 500, text: "4711 → 0400", queued: true } })).toMatchObject({ mood: "notice", title: "Noticed: 4711 → 0400" });
    expect(cardState({ ...base, lastNotice: { at: T0 - 500, text: "a → b", queued: false } }).mood).toBe("quiet");
  });
  it("heard from a real narration fill", () => {
    expect(cardState({ ...base, lastHeard: { at: T0 - 100, about: "cost center" } })).toMatchObject({ mood: "heard", title: "Reason heard — not asking" });
  });
  it("paused and struck are off the record", () => {
    expect(cardState({ ...base, holding: true, presence: "off-record" })).toMatchObject({ mood: "off", title: "Paused", mode: "capsule" });
    expect(cardState({ ...base, presence: "off-record", lastStrikeAt: T0 - 100 })).toMatchObject({ mood: "off", struck: true, title: "Struck from the record" });
  });
  it("not watching is said plainly", () => {
    expect(cardState({ ...base, watching: false }).title).toBe("Not watching");
  });
  it("no time-based state before mount (now null)", () => {
    expect(cardState({ ...base, now: null, lastUnderstoodAt: T0 }).mood).toBe("quiet");
  });
});

describe("curiosity: claim events use claim wording, invoices unchanged", () => {
  const claim: ScreenEvent = { id: "e1", t: 10, source: "vision", kind: "field_changed", subject: { type: "claim", id: "CLM-1" }, field: "cause", from: "sudden", to: "gradual" };
  it("claim templates never mention an invoice", () => {
    const tpl = templates(claim);
    expect(tpl.why).toBe("You changed the cause of loss on claim CLM-1 from sudden to gradual. What made you do that?");
    for (const q of Object.values(tpl)) expect(q).not.toMatch(/invoice|supplier|€/i);
    const cs = buildCandidates(claim, newContext(), 10);
    expect(cs.length).toBeGreaterThan(0);
    for (const c of cs) {
      expect(c.question).not.toMatch(/invoice/i);
      expect(c.questionRetro).toMatch(/^On claim CLM-1 a moment ago/);
    }
  });
  it("invoice wording matches the naturalized invoice templates", () => {
    const inv: ScreenEvent = { id: "e2", t: 3, source: "dom", kind: "field_changed", invoice: "4471", field: "costCenter", from: "4711", to: "0400" };
    expect(templates(inv).why).toBe("You re-coded invoice 4471 from 4711 to 0400. What made you choose 0400?");
  });
});
