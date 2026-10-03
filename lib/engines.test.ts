import { describe, expect, it } from "vitest";
import { Governor } from "./governor";
import { CandidateQueue, buildCandidates, classifyEvent, narrationFills, newContext, observe, extractThresholds } from "./curiosity";
import { Matcher, practiceCaseFor, saveVerdict } from "./matcher";
import { classifyActivity, diffGray, worthSending, type DiffResult } from "./framediff";
import { redactText } from "./redact";
import { compileDeterministic, fillSlot, applyCorrection } from "./compile";
import { generateTeachback, wordCount } from "./teachback";
import { toPolicy } from "./export";
import { planInvoice } from "./autopilot";
import { seedInvoices, toInvoiceState } from "./erp";
import { emptySession, type ScreenEvent, type SessionLog } from "./events";
import { evalCond, understanding, type Rule, type WorkMap } from "./workmap";
import { computeMetrics } from "./metrics";

const ev = (p: Partial<ScreenEvent> & { kind: ScreenEvent["kind"]; t: number }): ScreenEvent => ({ id: `e${p.t}`, source: "dom", ...p });

describe("governor: when to ask", () => {
  it("stays quiet while the expert types, talks or the screen moves", () => {
    const g = new Governor();
    const base = { now: 100, lastSpeechAt: 90, lastScreenChangeAt: 90, lastTypingAt: 90, lastBoundaryAt: -Infinity, lastInvoiceOpenedAt: -Infinity, agentSpeaking: false };
    expect(g.evaluate({ ...base, lastSpeechAt: 99 }).interruptible).toBe(false);
    expect(g.evaluate({ ...base, lastTypingAt: 99 }).interruptible).toBe(false);
    expect(g.evaluate({ ...base, lastScreenChangeAt: 99 }).interruptible).toBe(false);
    expect(g.evaluate({ ...base, agentSpeaking: true }).interruptible).toBe(false);
    expect(g.evaluate({ ...base, lastInvoiceOpenedAt: 95 }).interruptible).toBe(false); // reading a freshly opened invoice
    expect(g.evaluate(base).interruptible).toBe(true);
  });

  it("enforces the budget and cooldown", () => {
    const g = new Governor({ cooldownSecs: 60, maxPer10Min: 2, warmupSecs: 0 });
    const quiet = (now: number) => ({ now, lastSpeechAt: now - 10, lastScreenChangeAt: now - 10, lastTypingAt: now - 10, lastBoundaryAt: -Infinity, lastInvoiceOpenedAt: -Infinity, agentSpeaking: false });
    g.open("c1", 100);
    g.markAsked(101);
    g.close(110);
    expect(g.evaluate(quiet(150)).interruptible).toBe(false); // cooldown
    expect(g.evaluate(quiet(171)).interruptible).toBe(true);
    g.open("c2", 171);
    g.markAsked(172);
    g.close(180);
    expect(g.evaluate(quiet(300)).interruptible).toBe(false); // budget: 2 in 10 min
    expect(g.evaluate(quiet(800)).interruptible).toBe(true);
  });

  it("prefers step boundaries and times out an unanswered window", () => {
    const g = new Governor({ minValue: 0.6 });
    const s = { now: 100, lastSpeechAt: 90, lastScreenChangeAt: 90, lastTypingAt: 90, lastBoundaryAt: 95, lastInvoiceOpenedAt: -Infinity, agentSpeaking: false };
    expect(g.canOpen(s, 0.45)).toBe(true); // 0.45 + 0.2 bonus
    expect(g.canOpen({ ...s, lastBoundaryAt: 50 }, 0.45)).toBe(false);
    g.open("c", 100);
    g.markAsked(101);
    expect(g.timedOut(110)).toBe(false);
    expect(g.timedOut(122)).toBe(true);
  });
});

describe("curiosity: what to ask", () => {
  it("values an edit of a prefilled value highest and navigation at zero", () => {
    const ctx = newContext();
    const edit = ev({ kind: "field_changed", t: 10, invoice: "4471", field: "costCenter", from: "4711", to: "0400", state: { amount: 7850 } });
    expect(classifyEvent(edit, ctx).value).toBeGreaterThanOrEqual(0.9);
    expect(classifyEvent(ev({ kind: "screen_changed", t: 11 }), ctx).value).toBe(0);
  });

  it("grounds every question in the event's own values and queues sibling probes", () => {
    const ctx = newContext();
    const edit = ev({ kind: "field_changed", t: 10, invoice: "4471", field: "costCenter", from: "4711", to: "0400", state: { amount: 7850 } });
    const cs = buildCandidates(edit, ctx, 10);
    const why = cs.find((c) => c.kind === "why")!;
    expect(why.question).toContain("4471");
    expect(why.question).toContain("4711");
    expect(why.question).toContain("0400");
    const cf = cs.find((c) => c.kind === "counterfactual")!;
    expect(cf.question).toMatch(/€4,946/);
    expect(cs.filter((c) => c.guardrail).length).toBeGreaterThanOrEqual(3);
  });

  it("forces a guardrail question when asked to, and sends stale candidates to the debrief", () => {
    const ctx = newContext();
    const q = new CandidateQueue(90);
    q.add(buildCandidates(ev({ kind: "field_changed", t: 10, invoice: "4471", field: "costCenter", from: "4711", to: "0400", state: { amount: 7850 } }), ctx, 10));
    const first = q.pick(false)!;
    expect(first.kind).toBe("why");
    q.markAsked(first.id);
    const forced = q.pick(true)!;
    expect(forced.guardrail).toBe(true);
    q.expire(200, "4472");
    expect(q.items.filter((c) => c.status === "queued").length).toBe(0);
    expect(q.drainToDebrief().length).toBeGreaterThan(0);
  });

  it("recognises narration that already answers a why, and extracts thresholds", () => {
    const ctx = newContext();
    const cs = buildCandidates(ev({ kind: "field_changed", t: 10, invoice: "4471", field: "costCenter", from: "4711", to: "0400", state: { amount: 7850 } }), ctx, 10);
    const why = cs.find((c) => c.kind === "why")!;
    expect(narrationFills("this one goes to capex because equipment over five thousand is always capex", why)).toBe(true);
    expect(narrationFills("okay next one", why)).toBe(false);
    expect(extractThresholds("Equipment over €5,000 is always capex")).toEqual([5000]);
    expect(extractThresholds("anything above five thousand")).toEqual([5000]);
    observe(ev({ kind: "invoice_opened", t: 1, invoice: "4471", state: { supplier: "Müller Werkzeugbau GmbH" } }), ctx);
    expect(ctx.seenSuppliers.has("Müller Werkzeugbau GmbH")).toBe(true);
  });
});

describe("frame diff: typing versus scrolling", () => {
  const frame = (fill: number) => new Uint8ClampedArray(64 * 36).fill(fill);
  it("flags small localized repeated changes as typing", () => {
    const a = frame(100);
    const b = frame(100);
    for (let x = 20; x < 26; x++) b[10 * 64 + x] = 200; // a caret-sized change in one cell
    const d = diffGray(a, b);
    expect(d.changedCells).toBeLessThanOrEqual(2);
    const hist: DiffResult[] = [d, d, d];
    expect(classifyActivity(hist)).toBe("typing");
  });
  it("flags whole-screen changes as navigating and sends them to vision", () => {
    const d = diffGray(frame(0), frame(255));
    expect(classifyActivity([d])).toBe("navigating");
    expect(worthSending(d, 0.5)).toBe(true);
    expect(worthSending(diffGray(frame(10), frame(10)), 0.5)).toBe(false);
    expect(worthSending(diffGray(frame(10), frame(10)), 6)).toBe(true);
  });
});

describe("redaction", () => {
  it("masks IBANs, emails and phones but leaves invoice numbers and amounts", () => {
    const r = redactText("Pay DE89 3704 0044 0532 0130 00 for invoice 4471, €7,850, mail s.koch@example.de, call +49 711 123456");
    expect(r.text).toContain("[iban]");
    expect(r.text).toContain("[email]");
    expect(r.text).toContain("4471");
    expect(r.text).toContain("7,850");
    expect(r.entities.length).toBeGreaterThanOrEqual(2);
  });
});

function demoSession(): SessionLog {
  const s = emptySession("s1", "capture", "Process supplier invoices", "Sabine");
  const inv = seedInvoices();
  const st = (id: string) => toInvoiceState(inv.find((i) => i.id === id)!);
  s.events = [
    ev({ kind: "invoice_opened", t: 5, invoice: "4471", state: st("4471"), frameId: "f1" }),
    ev({ kind: "field_changed", t: 30, invoice: "4471", field: "costCenter", from: "4711", to: "0400", state: { ...st("4471"), costCenter: "0400" }, frameId: "f2" }),
    ev({ kind: "save_clicked", t: 60, invoice: "4471", boundary: true }),
    ev({ kind: "invoice_opened", t: 70, invoice: "4472", state: st("4472") }),
    ev({ kind: "route_changed", t: 90, invoice: "4472", from: "single", to: "second_approval", state: { ...st("4472"), route: "second_approval" } }),
    ev({ kind: "save_clicked", t: 110, invoice: "4472", boundary: true }),
    ev({ kind: "invoice_opened", t: 120, invoice: "4473", state: st("4473") }),
    ev({ kind: "status_changed", t: 140, invoice: "4473", from: "open", to: "hold", state: { ...st("4473"), status: "hold" } }),
    ev({ kind: "save_clicked", t: 160, invoice: "4473", boundary: true }),
  ];
  s.windows = [
    { id: "w1", candidateId: "c1", kind: "why", question: "...", stepRef: "4471:costCenter", openedAt: 33, askedAt: 34, answeredAt: 40, closedAt: 41, outcome: "answered", answerText: "Equipment over five thousand is always capex, so this goes to 0400." },
    { id: "w2", candidateId: "c2", kind: "counterfactual", question: "...", stepRef: "4471:costCenter", openedAt: 45, askedAt: 46, answeredAt: 50, closedAt: 51, outcome: "answered", answerText: "No, then it is opex. Only above five thousand." },
    { id: "w3", candidateId: "c3", kind: "limit", question: "...", stepRef: "4472:route", openedAt: 95, askedAt: 96, answeredAt: 100, closedAt: 101, outcome: "answered", answerText: "Anything from a subsidiary gets a second approval, the group controller signs it." },
  ];
  s.transcript = [{ id: "t1", t: 142, text: "Bäcker double bills every December so this one waits until I have matched it against November", speaker: "expert", final: true }];
  return s;
}

describe("compile: the Work Map", () => {
  it("builds steps with screen moments, attaches verbatim quotes, derives rules and leaves slots open", () => {
    const map = compileDeterministic(demoSession());
    expect(map.steps.length).toBe(9);
    expect(map.steps.filter((s) => s.judgment).length).toBe(3);
    const capex = map.steps.find((s) => s.invoice === "4471" && "field" in s.action)!;
    expect(capex.reason?.text).toContain("always capex");
    expect(capex.screenMoment.frameId).toBe("f2");
    expect(capex.guardrails.some((g) => g.kind === "limit")).toBe(true);
    const capexRule = map.rules.find((r) => "set" in r.then)!;
    expect(evalCond(capexRule.when, { amount: 7200, category: "equipment" })).toBe(true);
    expect(evalCond(capexRule.when, { amount: 4900, category: "equipment" })).toBe(false);
    expect(capexRule.confirmedBy).toContain("counterfactual");
    expect(capexRule.confidence).toBe("high");
    const hold = map.steps.find((s) => s.invoice === "4473" && "type" in s.action && s.action.type === "hold")!;
    expect(hold.reason?.source).toBe("narration");
    expect(map.slots.filter((s) => s.status === "open").length).toBeGreaterThanOrEqual(3);
    expect(understanding(map)).toBeLessThan(1);
  });

  it("fills a slot from a debrief answer and narrows the December rule on correction", () => {
    const map = compileDeterministic(demoSession());
    const holdRule = map.rules.find((r) => "status" in r.then)!;
    const slot = map.slots.find((s) => s.ruleId === holdRule.id && s.kind === "limit") ?? map.slots.find((s) => s.ruleId === holdRule.id)!;
    fillSlot(map, slot.id, { text: "That is for every supplier in December", t: 200, source: "debrief" });
    expect(evalCond(holdRule.when, { invoiceMonth: 12, supplier: "Schmidt Reinigung GmbH" })).toBe(true);
    applyCorrection(map, "No, only Bäcker. The others go through normally.", 260);
    expect(evalCond(holdRule.when, { invoiceMonth: 12, supplier: "Schmidt Reinigung GmbH" })).toBe(false);
    expect(evalCond(holdRule.when, { invoiceMonth: 12, supplier: "Bäcker Elektrotechnik GmbH" })).toBe(true);
    expect(holdRule.confirmedBy).toContain("teachback");
  });

  it("generates a calibrated teach-back under the word cap", () => {
    const map = compileDeterministic(demoSession());
    const tb = generateTeachback(map);
    expect(wordCount(tb.text)).toBeLessThanOrEqual(130);
    expect(tb.text).toMatch(/Is that how it works\?$/);
    expect(tb.sure.length + tb.unsure.length).toBe(3);
  });
});

describe("teach: the matcher", () => {
  const map = (): WorkMap => {
    const m = compileDeterministic(demoSession());
    const hold = m.rules.find((r) => "status" in r.then)!;
    hold.when = { all: [{ field: "invoiceMonth", op: "==", value: 12 }, { field: "supplier", op: "matches", value: "Bäcker" }] };
    return m;
  };
  const inv = seedInvoices();
  const st = (id: string) => toInvoiceState(inv.find((i) => i.id === id)!);

  it("intervenes before save on the €7,200 equipment invoice coded to opex, then praises the fix", () => {
    const mt = new Matcher(map());
    const opened = mt.decide(ev({ kind: "invoice_opened", t: 1, invoice: "4490" }), st("4490"), 1);
    expect(opened.kind).toBe("predict");
    const wrong = mt.decide(ev({ kind: "field_changed", t: 5, invoice: "4490", field: "costCenter", from: "", to: "4711" }), { ...st("4490"), costCenter: "4711" }, 5);
    expect(wrong.kind).toBe("intervene");
    expect(wrong.message).toContain("Sabine would stop here");
    expect(wrong.quote).toContain("capex");
    const fixed = mt.decide(ev({ kind: "field_changed", t: 9, invoice: "4490", field: "costCenter", from: "4711", to: "0400" }), { ...st("4490"), costCenter: "0400" }, 9);
    expect(fixed.kind).toBe("praise");
    expect(mt.masteryCard().find((c) => c.title.includes("capex"))?.status).toBe("practicing");
  });

  it("stays silent on a December invoice from another supplier, because the boundary was learned", () => {
    const m = map();
    const capex = m.rules.find((r) => "set" in r.then)!;
    capex.stopAndAsk = { who: "the controller", when: { any: [{ field: "knownSupplier", op: "==", value: false }, { field: "hasAssetNumber", op: "==", value: false }] } };
    const mt = new Matcher(m);
    mt.decide(ev({ kind: "invoice_opened", t: 1, invoice: "4491" }), st("4491"), 1);
    const d = mt.decide(ev({ kind: "status_changed", t: 5, invoice: "4491", from: "open", to: "approved" }), { ...st("4491"), status: "approved" }, 5);
    expect(d.kind).toBe("none");
  });

  it("flags a credit note as a case the expert never showed", () => {
    const mt = new Matcher(map());
    const d = mt.decide(ev({ kind: "invoice_opened", t: 1, invoice: "4492" }), st("4492"), 1);
    expect(d.kind).toBe("novel");
    expect(d.quote).toBeUndefined();
    expect(mt.ledger[0].outcome).toBe("novel_case_flagged");
  });

  it("asks about unseen cases in the debrief and quotes the expert when the new hire meets one", () => {
    const m = compileDeterministic(demoSession());
    const unseen = m.slots.find((s) => s.kind === "novel")!;
    expect(unseen.question).toMatch(/credit note/);
    fillSlot(m, unseen.id, { text: "A credit note never gets posted on its own, I book it against the original invoice.", t: 300, source: "debrief" });
    expect(m.notes[0].topic).toBe("credit_note");
    const mt = new Matcher(m);
    const d = mt.decide(ev({ kind: "invoice_opened", t: 1, invoice: "4492" }), st("4492"), 1);
    expect(d.kind).toBe("novel");
    expect(d.quote).toContain("against the original invoice");
    expect(mt.ledger[0].outcome).toBe("novel_case_covered");
  });

  it("builds a practice case that targets a missed rule", () => {
    const m = map();
    const capex = m.rules.find((r) => "set" in r.then) as Rule;
    const pc = practiceCaseFor(capex, st("4490"));
    expect(pc.amount).toBeGreaterThan(5000);
    expect(pc.category).toBe("equipment");
    expect(evalCond(capex.when, pc)).toBe(true);
  });
});

describe("autopilot and export", () => {
  it("posts routine invoices, holds the December Bäcker invoice and halts on the unknown supplier", () => {
    const m = compileDeterministic(demoSession());
    const capex = m.rules.find((r) => "set" in r.then)!;
    capex.stopAndAsk = { who: "the controller", when: { field: "knownSupplier", op: "==", value: false } };
    const hold = m.rules.find((r) => "status" in r.then)!;
    hold.when = { all: [{ field: "invoiceMonth", op: "==", value: 12 }, { field: "supplier", op: "matches", value: "Bäcker" }] };
    const queue = seedInvoices().filter((i) => i.queue === "autopilot");
    const plan = queue.map((i) => planInvoice(m, i));
    expect(plan.map((p) => p.outcome)).toEqual(["posted", "posted", "posted", "applied", "halted"]);
    expect(plan[1].action?.costCenter).toBe("0400");
    expect(plan[2].action?.route).toBe("second_approval");
    expect(plan[4].who).toBe("the controller");
    const policy = toPolicy(m);
    expect(policy.rules.length).toBe(3);
    expect(policy.rules.every((r) => r.evidence.length > 0)).toBe(true);
  });

  it("computes metrics from the log", () => {
    const s = demoSession();
    const m = computeMetrics(s, compileDeterministic(s));
    expect(m.liveQuestions).toBe(3);
    expect(m.interruptionsWhileTyping).toBe(0);
    expect(m.medianPauseToFirstWordSecs).toBe(1);
  });
});

describe("anti-hardcoding: rules come only from what the expert said", () => {
  it("creates no capex rule when no threshold was stated, and keeps the gap open", () => {
    const s = demoSession();
    s.windows = s.windows.map((w) => ({ ...w, answerText: "That one is capex, it is a spindle." }));
    s.transcript = [];
    const m = compileDeterministic(s);
    expect(m.rules.some((r) => "set" in r.then)).toBe(false);
    expect(m.slots.some((sl) => sl.kind === "reason" || sl.kind === "limit")).toBe(true);
  });
  it("respects inclusive wording and names only who the expert named", () => {
    const s = demoSession();
    s.windows[0].answerText = "Equipment from five thousand goes to capex.";
    s.windows[2].answerText = "I always add a second approval on these.";
    const m = compileDeterministic(s);
    const capex = m.rules.find((r) => "set" in r.then)!;
    expect(evalCond(capex.when, { amount: 5000, category: "equipment" })).toBe(true);
    expect(m.rules.some((r) => "route" in r.then)).toBe(false);
  });
});

describe("independent follow-up and the pre-save guard", () => {
  const inv = seedInvoices();
  const st = (id: string) => toInvoiceState(inv.find((i) => i.id === id)!);
  const confirmed = (): WorkMap => {
    const m = compileDeterministic(demoSession());
    m.confirmedAt = Date.now();
    return m;
  };

  it("stays silent during the independent case and records a correct unaided decision", () => {
    const mt = new Matcher(confirmed());
    expect(mt.decide(ev({ kind: "invoice_opened", t: 1, invoice: "4493", mode: "independent" }), st("4493"), 1).kind).toBe("none");
    expect(mt.decide(ev({ kind: "field_changed", t: 3, invoice: "4493", field: "costCenter", from: "4711", to: "0400", mode: "independent" }), { ...st("4493"), costCenter: "0400" }, 3).kind).toBe("none");
    mt.decide(ev({ kind: "save_clicked", t: 5, invoice: "4493", mode: "independent", boundary: true }), { ...st("4493"), costCenter: "0400", status: "approved" }, 5);
    const card = mt.masteryCard().find((c) => c.title.includes("capex"))!;
    expect(card.independent).toBe("correct without help");
    expect(card.label).toBe("correct without help");
  });

  it("blocks a commit that breaks a confirmed rule and lets the tutor explain it with her words", () => {
    const m = confirmed();
    const verdict = saveVerdict(m, { ...st("4494"), status: "approved" }, true);
    expect(verdict.blocked).toBe(true);
    expect(verdict.title).toMatch(/second approval/);
    expect(saveVerdict(m, { ...st("4494"), route: "second_approval", status: "approved" }, true).blocked).toBe(false);
    expect(saveVerdict({ ...m, confirmedAt: undefined }, { ...st("4494"), status: "approved" }, true).blocked).toBe(false);
    const mt = new Matcher(m);
    const d = mt.decide(ev({ kind: "save_blocked", t: 9, invoice: "4494", mode: "independent", blocked: { ruleId: verdict.ruleId!, title: verdict.title!, quote: verdict.quote } }), { ...st("4494"), status: "approved" }, 9);
    expect(d.kind).toBe("intervene");
    expect(d.quote).toContain("second approval");
    expect(mt.masteryCard().find((c) => c.title.includes("second approval"))?.independent).toBe("needed the guard");
  });
});
