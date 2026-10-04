import { describe, expect, it } from "vitest";
import type { ScreenEvent, SessionLog } from "../events";
import { WorkMapSchema, type WorkMap } from "../workmap";
import { debriefAt, deriveOntology, derivePlatform, deriveRole, mergeBeads, parseMastery, quoteAt, slug, type PlatformInput } from "./derive";

const T0 = Date.UTC(2026, 9, 3, 10, 0, 0);
const NOW = T0 + 60 * 60_000;

function session(id: string, over: Partial<SessionLog> = {}): SessionLog {
  return {
    id, mode: "capture", task: "Triage the ticket queue", expertName: "Alex", startedAt: T0, endedAt: T0 + 10 * 60_000,
    events: [], transcript: [{ id: "tr", t: 5, text: "SECRET TRANSCRIPT LINE", speaker: "expert", final: true }],
    windows: [], frames: [{ id: "f1", t: 5, dataUrl: "data:image/png;base64,AAAA", width: 10, height: 10, piiRegionsBlurred: 0 }],
    offRecord: [], ...over,
  };
}

const ev = (id: string, t: number, source: ScreenEvent["source"], state: ScreenEvent["state"], over: Partial<ScreenEvent> = {}): ScreenEvent =>
  ({ id, t, source, kind: "field_changed", invoice: state?.invoice, state, ...over });

function map(sessionId: string, over: Partial<WorkMap> = {}): WorkMap {
  return WorkMapSchema.parse({
    sessionId, task: "Triage the ticket queue", expert: { name: "Alex" },
    steps: [
      { id: "st1", index: 0, title: "Open ticket 1", screenMoment: { t: 10 }, action: { type: "open" }, decision: "Opened", judgment: false },
      { id: "st2", index: 1, title: "Set the status of ticket 1", screenMoment: { t: 40 }, action: { type: "hold" }, decision: "Held", judgment: true,
        reason: { text: "Big ones wait until someone checks them.", t: 45, source: "live" } },
    ],
    rules: [
      { id: "r1", stepId: "st2", title: "Large amounts are held", when: { field: "amount", op: ">", value: 900 }, then: { status: "hold" },
        quotes: [{ text: "Big ones wait until someone checks them.", t: 45, source: "live" }], confidence: "high",
        stopAndAsk: { who: "the team lead", when: { field: "knownSupplier", op: "==", value: false } } },
      { id: "r2", title: "Unknown senders go to review", when: { field: "knownSupplier", op: "==", value: false }, then: { route: "review" },
        quotes: [{ text: "If I do not know them, I ask the review desk.", t: 300, source: "debrief" }], confidence: "high",
        stopAndAsk: { who: "the review desk", when: { field: "knownSupplier", op: "==", value: false } } },
    ],
    slots: [
      { id: "s1", kind: "limit", ruleId: "r1", question: "How large is large?", status: "open" },
    ],
    privacy: {}, compiledAt: T0 + 11 * 60_000, revision: 1,
    ...over,
  });
}

function input(sessions: SessionLog[], maps: Record<string, WorkMap>): PlatformInput {
  return { sessions, maps, now: NOW };
}

describe("derive: empty and missing", () => {
  it("renders an empty store without throwing", () => {
    const p = derivePlatform(input([], {}));
    expect(p.mode).toBe("real");
    expect(p.roles).toEqual([]);
    expect(p.empty?.cta.href).toBe("/capture");
    expect(p.timeline.canPlay).toBe(false);
    expect(p.features).toEqual({ riskLens: false, editMap: false });
    expect(deriveRole(input([], {}), "x").role).toBeNull();
    expect(deriveOntology(input([], {}), "x").ontology).toBeNull();
  });

  it("a capture with no map is a capturing role with honest empty sections", () => {
    const s = session("c1", { events: [ev("e1", 3, "dom", { invoice: "T-1" })] });
    const { role } = deriveRole(input([s], {}), slug(s.task));
    expect(role!.status).toBe("capturing");
    expect(role!.synopsis.empty).toBeTruthy();
    expect(role!.asks).toEqual([]);
    expect(role!.mastery.empty).toMatch(/No new hire/);
  });
});

describe("derive: roles", () => {
  it("groups capture sessions by slug(task)", () => {
    const a = session("a", { task: "Triage the ticket queue", events: [ev("e", 1, "dom", { invoice: "1" })] });
    const b = session("b", { task: "  triage THE ticket-queue!", events: [ev("e", 1, "dom", { invoice: "2" })] });
    const c = session("c", { task: "Close the month", events: [ev("e", 1, "dom", { invoice: "3" })] });
    const p = derivePlatform(input([a, b, c], {}));
    expect(p.roles.map((r) => r.id).sort()).toEqual(["close-the-month", "triage-the-ticket-queue"]);
  });

  it("an unconfirmed map is not memory: no mentioned roles, no Ask, no policy, a draft banner", () => {
    const s = session("c1");
    const m = map("c1");
    const inp = input([s], { c1: m });
    const p = derivePlatform(inp);
    expect(p.roles).toHaveLength(1);
    expect(p.roles[0].status).toBe("in_debrief");
    expect(p.edges).toEqual([]);
    expect(p.exports).toEqual([]);
    expect(p.suggestions.map((x) => x.kind)).toContain("continue_debrief");
    const { role } = deriveRole(inp, p.roles[0].id);
    expect(role!.confirmed).toBe(false);
    expect(role!.asks).toEqual([]);
    expect(role!.asksEmpty).toBeTruthy();
    expect(role!.synopsis.draftBanner).toMatch(/not yet confirmed by Alex/);
    const { ontology } = deriveOntology(inp, p.roles[0].id);
    expect(ontology!.rules.every((r) => r.policy === null && /Not agent-ready until Alex confirms/.test(r.policyNote ?? ""))).toBe(true);
  });

  it("mentioned roles from a confirmed map: said only when the expert's words name the role", () => {
    const s = session("c1");
    const m = map("c1", { confirmedAt: T0 + 20 * 60_000 });
    const inp = input([s], { c1: m });
    const p = derivePlatform(inp);
    const lead = p.roles.find((r) => r.title === "Team lead")!;
    const desk = p.roles.find((r) => r.title === "Review desk")!;
    expect(lead.status).toBe("mentioned");
    expect(p.edges.find((e) => e.to === lead.id)!.prov).toBe("teachback");
    expect(p.edges.find((e) => e.to === desk.id)!.prov).toBe("said");
    const { role } = deriveRole(inp, p.roles[0].id);
    const stop = role!.items.find((i) => i.id === "stop-r1")!;
    expect(stop.quote).toBeNull();
    expect(stop.noQuoteLabel).toBe("Confirmed in the teach-back, not in Alex's words");
    expect(role!.asks.length).toBeGreaterThan(0);
    for (const a of role!.asks) expect([...m.rules.flatMap((r) => r.quotes), ...m.slots.flatMap((x) => (x.filledBy ? [x.filledBy] : []))].map((q) => q.text)).toContain(a.answer);
    const { ontology } = deriveOntology(inp, p.roles[0].id);
    expect(JSON.parse(ontology!.rules[0].policy!).id).toBe("r1");
  });
});

describe("derive: time", () => {
  it("live quotes are exact, debrief quotes are approximate and clamped between capture end and confirm", () => {
    const s = session("c1");
    const m = map("c1", { confirmedAt: T0 + 20 * 60_000 });
    expect(quoteAt({ t: 45, source: "live" }, s, m)).toEqual({ at: T0 + 45_000, approx: false });
    const d = quoteAt({ t: 300, source: "debrief" }, s, m);
    expect(d.approx).toBe(true);
    expect(d.at).toBeGreaterThanOrEqual(s.endedAt!);
    expect(d.at).toBeLessThanOrEqual(m.confirmedAt!);
    // compiled after confirm (clock skew): still clamped to the confirm
    expect(debriefAt(s, { ...m, compiledAt: T0 + 30 * 60_000 })).toBe(m.confirmedAt);
  });

  it("merges beads of one type that would overlap; play needs two distinct times", () => {
    const beads = mergeBeads([
      { id: "a", at: T0, type: "capture", title: "A" },
      { id: "b", at: T0 + 10, type: "capture", title: "B" },
      { id: "c", at: T0 + 10, type: "confirm", title: "C" },
    ], T0 - 60_000, NOW);
    expect(beads).toHaveLength(2);
    expect(beads[0].merged).toEqual(["A", "B"]);
    const one = derivePlatform(input([session("x", { events: [ev("e", 1, "dom", { invoice: "1" })], endedAt: undefined })], {}));
    expect(one.timeline.canPlay).toBe(false);
  });
});

describe("derive: ontology provenance and struck content", () => {
  it("vision is seen, dom is erp, struck events never appear", () => {
    const s = session("c1", {
      events: [
        ev("e1", 10, "dom", { invoice: "T-1", amount: 120, supplier: "Acme" }),
        ev("e2", 20, "vision", { invoice: "T-1", category: "hardware" }),
        ev("e3", 30, "dom", { invoice: "T-SECRET", supplier: "Hidden Corp" }, { redacted: true }),
        ev("e4", 65, "vision", { invoice: "T-OFF", supplier: "Off Record Ltd" }),
      ],
      offRecord: [{ from: 60, to: 70 }],
    });
    const inp = input([s], { c1: map("c1") });
    const { ontology } = deriveOntology(inp, slug(s.task));
    const inv = ontology!.classes.find((c) => c.id === "invoice")!;
    expect(inv.fields.find((f) => f.name === "amount")!.prov).toBe("erp");
    expect(inv.fields.find((f) => f.name === "category")!.prov).toBe("seen");
    expect(inv.instances).toEqual(["T-1"]);
    const sup = ontology!.classes.find((c) => c.id === "supplier")!;
    expect(sup.instances).toEqual(["Acme"]);
    const known = sup.fields.find((f) => f.name === "known supplier")!;
    expect(known.prov).toBe("said");
    const all = JSON.stringify(ontology);
    expect(all).not.toMatch(/SECRET|Hidden Corp|Off Record|T-OFF/);
  });

  it("never ships frames, transcript or raw event state", () => {
    const s = session("c1", { events: [ev("e1", 10, "dom", { invoice: "T-1", description: "RAW-STATE-ONLY" })] });
    const m = map("c1", { confirmedAt: T0 + 20 * 60_000 });
    const inp = input([s], { c1: m });
    const out = JSON.stringify([derivePlatform(inp), deriveRole(inp, slug(s.task)), deriveOntology(inp, slug(s.task)).ontology!.edges]);
    expect(out).not.toMatch(/data:image|SECRET TRANSCRIPT/);
  });
});

describe("derive: mastery (T3 labels)", () => {
  it("parses the persisted outcome strings", () => {
    expect(parseMastery({ ruleId: "r1", outcome: "missed (coached, help before the decision)", t: 1 })).toEqual({ ruleId: "r1", outcome: "missed", t: 1, phase: "coached", helpBefore: true });
    expect(parseMastery({ ruleId: "r1", outcome: "applied_unprompted (independent)", t: 2 })?.phase).toBe("independent");
    expect(parseMastery({ ruleId: "r1", outcome: "nonsense", t: 2 })).toBeNull();
  });

  it("builds a grid per teach session with T3 labels and a live pill for a running session", () => {
    const s = session("c1");
    const m = map("c1", { confirmedAt: T0 + 20 * 60_000 });
    const teach: SessionLog = {
      ...session("t1"), mode: "teach", expertName: "Sam", startedAt: NOW - 5 * 60_000, endedAt: undefined, sourceMapSessionId: "c1",
      events: [ev("e", 1, "dom", { invoice: "1" }, { mode: "coached" })],
      mastery: [
        { ruleId: "r1", outcome: "missed (coached, help before the decision)", t: 1 },
        { ruleId: "r1", outcome: "applied_after_hint (coached, help before the decision)", t: 2 },
        { ruleId: "r2", outcome: "applied_unprompted (coached)", t: 3 },
      ],
    };
    const inp = input([s, teach], { c1: m });
    const { data, role } = deriveRole(inp, slug(s.task));
    expect(role!.mastery.columns).toHaveLength(1);
    expect(role!.mastery.columns[0].label).toMatch(/coached/);
    const cells = Object.fromEntries(role!.mastery.rows.map((r) => [r.ruleId, r.cells[0]]));
    expect(cells).toEqual({ r1: "corrected after intervention", r2: "correct without help" });
    expect(role!.people.map((x) => `${x.name}:${x.tag}`)).toEqual(["Alex:expert", "Sam:new hire"]);
    expect(data.live?.href).toBe("/teach/t1");
  });
});
