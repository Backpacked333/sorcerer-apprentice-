import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { compileDeterministic } from "./compile";
import { emptySession } from "./events";
import { compileCorpus, corpusOracle, corpusOutcomeMeaning } from "./fixtures/compile-corpus";

describe("synthetic corpus integrity only — not compiler acceptance", () => {
  it("has unique IDs, complete groups and exclusively synthetic provenance", () => {
    expect(compileCorpus.length).toBeGreaterThan(0);
    expect(new Set(compileCorpus.map((f) => f.id)).size).toBe(compileCorpus.length);
    expect([...new Set(compileCorpus.map((f) => f.group))].sort()).toEqual(["A", "B", "C", "D", "K", "adverse", "variation"]);
    for (const f of compileCorpus) {
      expect(f.provenance, f.id).toBe("synthetic");
      expect(f.humanRecorded, f.id).toBe(false);
      expect(f.liveProviderVerified, f.id).toBe(false);
      expect(f.caseId, f.id).toBe(f.id.split("-")[0]);
      expect(f.utterance.trim(), f.id).toBe(f.utterance);
      expect(f.utterance.length, f.id).toBeGreaterThan(3);
      expect(f.context.observed.length, f.id).toBeGreaterThan(15);
      expect(Object.keys(f.context.state).length, f.id).toBeGreaterThan(0);
      expect(f.expected.oracle, f.id).not.toMatch(/TODO|TBD|placeholder/i);
      // Bare RULE/SLOT in the appendix are meaningful via the shared outcome contract + decision context.
      expect(f.expected.oracle.length, f.id).toBeGreaterThanOrEqual(4);
      if (f.expected.outcome === "EITHER") expect(f.expected.oracle, f.id).toContain("never");
      if (f.context.phase === "correction" || f.context.phase === "debrief") expect(f.context.prior?.length, f.id).toBeGreaterThan(15);
      if (f.context.phase === "debrief") expect(f.context.slot, f.id).toBeTruthy();
      if (f.expected.sameAs) {
        const target = compileCorpus.find((other) => other.id === f.expected.sameAs);
        expect(target, f.id).toBeDefined();
        expect(target?.id, f.id).not.toBe(f.id);
        expect(target?.expected.sameAs, f.id).toBeUndefined();
        expect(target?.expected.outcome, f.id).toBe(f.expected.outcome);
      }
    }
    expect(corpusOutcomeMeaning).toEqual({ RULE: "A rule must result and behave as described.", SLOT: "No runnable rule; an open question remains.", EITHER: "Rule or slot is acceptable, but the oracle's never clause must hold." });
  });

  it("preserves every appendix row, literal utterance, oracle and debrief slot", () => {
    const source = readFileSync(corpusOracle, "utf8");
    const appendixRows = source.split("\n").filter((line) => /^\| [ABCKD]\d+ \|/.test(line));
    expect(appendixRows).toHaveLength(60);
    const sourceIds = new Set<string>();
    for (const line of appendixRows) {
      const cells = line.split("|").slice(1, -1).map((cell) => cell.trim());
      const caseId = cells[0];
      sourceIds.add(caseId);
      const debrief = caseId.startsWith("D");
      const utteranceCell = cells[debrief ? 2 : 1];
      const literalUtterances = [...utteranceCell.matchAll(/"([^"]+)"/g)].map((match) => match[1]);
      const fixtures = compileCorpus.filter((f) => f.caseId === caseId);
      expect(fixtures.map((f) => f.utterance), caseId).toEqual(literalUtterances);
      for (const f of fixtures) {
        expect(f.group, f.id).toBe(caseId[0]);
        expect(f.expected.oracle, f.id).toBe(cells[debrief ? 3 : 2]);
        if (debrief) expect(f.context.slot, f.id).toBe(cells[1]);
        if (["A", "B", "C"].includes(f.group)) expect(f.expected.outcome, f.id).toBe(f.expected.oracle.match(/^(RULE|SLOT|EITHER)/)?.[0]);
      }
    }
    const appendixFixtures = compileCorpus.filter((f) => !["variation", "adverse"].includes(f.group));
    expect(appendixFixtures).toHaveLength(63);
    expect(new Set(appendixFixtures.map((f) => f.caseId))).toEqual(sourceIds);
  });

  it("keeps correction/debrief outcomes distinct from compile outcomes", () => {
    const outcomes = (group: string) => compileCorpus.filter((f) => f.group === group).map((f) => [f.id, f.expected.outcome]);
    expect(outcomes("K")).toEqual([["K1", "PATCH"], ["K2", "PATCH"], ["K3", "PATCH"], ["K4", "PATCH"], ["K5", "REJECT"], ["K6", "NOTE"], ["K7", "GUARDRAIL"], ["K8", "PATCH"], ["K9", "UNCHANGED"], ["K10-a", "CONFIRM"], ["K10-b", "CONFIRM"], ["K11-a", "REASK"], ["K11-b", "REASK"]]);
    expect(outcomes("D")).toEqual([["D1", "PATCH"], ["D2", "GUARDRAIL"], ["D3", "SKIPPED"], ["D4", "SKIPPED"], ["D5", "NOTE"], ["D6", "RULE"], ["D7", "GUARDRAIL"], ["D8", "SKIPPED"], ["D9-a", "THIN"], ["D9-b", "THIN"]]);
  });

  it("retains boundary probes, including inclusive, exclusive and unresolved equality", () => {
    const boundaries = compileCorpus.filter((f) => f.expected.boundary);
    expect(new Set(boundaries.map((f) => f.expected.boundary!.operator))).toEqual(new Set(["exclusive", "inclusive", "unresolved"]));
    for (const f of boundaries) {
      const boundary = f.expected.boundary!;
      expect(boundary.value, f.id).toBeGreaterThan(0);
      expect(boundary.value, f.id).not.toBe(f.context.state.amount);
      const equality = f.expected.probes?.find((probe) => probe.state.amount === boundary.value);
      if (boundary.operator === "unresolved") {
        expect(equality, f.id).toBeUndefined();
        expect(f.expected.oracle, f.id).toContain("boundary slot open");
      } else {
        expect(equality?.fires, f.id).toBe(boundary.operator === "inclusive");
      }
    }
    const byId = (id: string) => compileCorpus.find((f) => f.id === id)!;
    expect(byId("A1").expected.probes).toContainEqual({ state: { category: "maintenance", amount: 5001 }, fires: false });
    expect(byId("C1").expected.probes).toContainEqual({ state: { supplier: "Other Supplier", invoiceMonth: 12 }, fires: false });
    expect(byId("C10").expected.probes).toContainEqual({ state: { supplier: "Other Supplier", invoiceMonth: 12 }, fires: true });
    expect(byId("K5").context.state.amount).toBe(7850);
    const variants = compileCorpus.filter((f) => f.group === "variation");
    expect(variants).toHaveLength(4);
    expect(new Set(variants.flatMap((f) => f.expected.boundary ? [f.expected.boundary.value] : []))).toEqual(new Set([6275, 3240]));
    expect(new Set(variants.flatMap((f) => f.context.suppliers))).toEqual(new Set(["Lumen Forge", "Tern Parts"]));
    for (const f of variants) expect(f.utterance).not.toMatch(/5000|5,000|Bäcker|Novak|Markus|December/);
  });

  it("labels adverse evidence as rejection requirements, not observed successes", () => {
    const adverse = compileCorpus.filter((f) => f.group === "adverse");
    expect(adverse).toHaveLength(4);
    expect(adverse.some((f) => f.evidence.speaker === "agent")).toBe(true);
    expect(adverse.some((f) => f.evidence.redacted)).toBe(true);
    expect(adverse.some((f) => f.evidence.offRecord)).toBe(true);
    expect(adverse.some((f) => f.evidence.questionEcho)).toBe(true);
    for (const f of adverse) {
      expect(f.expected.evidence, f.id).toBe("reject");
      expect(f.expected.outcome, f.id).toBe("SLOT");
      expect(f.expected.oracle, f.id).toMatch(/Reject.*no.*rule.*quote.*slot open/);
      if (f.evidence.questionEcho) expect(f.evidence.question, f.id).toBe(f.utterance);
    }
  });

  it("keeps the corpus outside runtime imports", () => {
    function check(directory: string) {
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const file = path.join(directory, entry.name);
        if (entry.isDirectory()) check(file);
        else if (/\.[cm]?[jt]sx?$/.test(file) && !file.includes(".test.") && !file.includes(`${path.sep}fixtures${path.sep}`)) {
          expect(readFileSync(file, "utf8"), file).not.toMatch(/(?:from\s*|import\s*\(?\s*|require\s*\(\s*)["'][^"']*compile-corpus/);
        }
      }
    }
    for (const directory of ["lib", "app", "components", "scripts"]) check(directory);
  });
});

describe("present-day deterministic smoke — not corpus acceptance", () => {
  it("does not create runnable rules from screen decisions without expert evidence", () => {
    const log = emptySession("synthetic-empty-evidence", "capture", "Synthetic smoke", "Synthetic expert");
    log.events = [
      { id: "cost", t: 10, source: "dom", kind: "field_changed", invoice: "synthetic-1", field: "costCenter", from: "4711", to: "0400", state: { amount: 7850, category: "equipment" } },
      { id: "route", t: 20, source: "dom", kind: "route_changed", invoice: "synthetic-2", from: "single", to: "second_approval", state: { entity: "subsidiary" } },
      { id: "hold", t: 30, source: "dom", kind: "status_changed", invoice: "synthetic-3", from: "open", to: "hold", state: { supplier: "Synthetic supplier", invoiceMonth: 12 } },
    ];
    const map = compileDeterministic(log);
    expect(map.steps.filter((step) => step.judgment)).toHaveLength(3);
    expect(map.rules).toEqual([]);
    expect(map.steps.every((step) => !step.reason)).toBe(true);
  });
});
