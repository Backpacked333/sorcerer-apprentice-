import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { DEMO_ROLE_ID, demoOntology, demoPlatform, demoRole } from "./demo-data";

const root = process.cwd();
const src = readFileSync(resolve(root, "lib/platform/demo-data.ts"), "utf8");

function filesUnder(rel: string): string[] {
  const abs = resolve(root, rel);
  let st;
  try { st = statSync(abs); } catch { return []; }
  if (st.isFile()) return [abs];
  const out: string[] = [];
  for (const name of readdirSync(abs)) {
    const p = join(abs, name);
    if (statSync(p).isDirectory()) out.push(...filesUnder(join(rel, name)));
    else if (/\.(tsx?|mjs|js|md|json)$/.test(name)) out.push(p);
  }
  return out;
}

describe("demo-data: private role card stays out", () => {
  it("contains no role-card terms", () => {
    const re = /capex|0400|4711|B(ä|ae)cker|subsidiar|intercompany|asset number|credit note|purchase order|controller|five thousand|5[.,]?000|second approval/i;
    const hits = src.split("\n").filter((l) => re.test(l));
    expect(hits).toEqual([]);
  });

  it("is pronoun-free and uses no persona from the brief", () => {
    expect(src).not.toMatch(/\b(her|she|hers|he|him|his)\b/i);
    expect(src).not.toMatch(/Sabine|Lena|Mehmet|Petra|Ingrid|Markus/);
  });

  it("is imported by no live module", () => {
    const live = [
      ...filesUnder("app/api"), ...filesUnder("lib/compile"), ...filesUnder("lib/compile.ts"), ...filesUnder("lib/matcher.ts"),
      ...filesUnder("agents"), ...filesUnder("lib/seed.ts"), ...filesUnder("lib/teachback.ts"), ...filesUnder("lib/export.ts"),
      ...readdirSync(resolve(root, "lib")).filter((n) => /^erp.*\.ts$/.test(n)).map((n) => resolve(root, "lib", n)),
      ...filesUnder("lib/platform/derive.ts"), ...filesUnder("lib/platform/load.ts"),
    ];
    expect(live.length).toBeGreaterThan(5);
    const importers = live.filter((f) => /(from\s*|import\s*\(\s*|require\s*\(\s*)["'][^"']*demo-data(\.ts)?["']/.test(readFileSync(f, "utf8")));
    expect(importers).toEqual([]);
  });
});

describe("demo-data: shape", () => {
  it("is a complete demo PlatformData", () => {
    const p = demoPlatform();
    expect(p.mode).toBe("demo");
    expect(p.company.name).toMatch(/\(fictional\)/);
    expect(p.roles.length).toBeGreaterThanOrEqual(10);
    expect(p.roles.filter((r) => r.isMain)).toHaveLength(1);
    expect(p.edges.some((e) => e.prov === "inferred" && e.suggest)).toBe(true);
    expect(p.roles.some((r) => r.risk?.level === "critical")).toBe(true);
    const ids = new Set(p.roles.map((r) => r.id));
    for (const e of p.edges) { expect(ids.has(e.from)).toBe(true); expect(ids.has(e.to)).toBe(true); }
    for (const r of p.roles) expect(new Set(p.departments.map((x) => x.id)).has(r.dept!)).toBe(true);
    const span = p.timeline.today - p.timeline.beads[0].at;
    expect(span).toBeGreaterThan(80 * 86_400_000);
    expect(p.timeline.canPlay).toBe(true);
  });

  it("has a role memory with an early answer and T3 mastery", () => {
    const { role } = demoRole(DEMO_ROLE_ID);
    expect(role).not.toBeNull();
    expect(role!.items.length).toBeGreaterThanOrEqual(8);
    expect(role!.asks.some((a) => a.early && a.early.until > a.learnedAt)).toBe(true);
    const labels = new Set(role!.mastery.rows.flatMap((r) => r.cells));
    for (const l of labels) expect(["correct without help", "correct after a hint", "corrected after intervention", "not tested", null]).toContain(l);
    expect(role!.items.filter((i) => !i.quote).every((i) => /teach-back/.test(i.noQuoteLabel ?? ""))).toBe(true);
    expect(demoRole("nope").role).toBeNull();
  });

  it("has an ontology whose rule paths and edges resolve", () => {
    const { ontology } = demoOntology();
    const o = ontology!;
    const nodes = new Set([...o.classes, ...o.concepts].map((n) => n.id));
    const edges = new Set(o.edges.map((e) => e.id));
    for (const e of o.edges) { expect(nodes.has(e.from)).toBe(true); expect(nodes.has(e.to)).toBe(true); }
    for (const r of o.rules) {
      for (const n of r.path) expect(nodes.has(n)).toBe(true);
      for (const e of r.edgeIds) expect(edges.has(e)).toBe(true);
      if (r.badgeEdgeId) expect(edges.has(r.badgeEdgeId)).toBe(true);
    }
  });
});
