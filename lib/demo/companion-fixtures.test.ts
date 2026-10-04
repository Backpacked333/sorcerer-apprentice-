import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { HEARD_EXAMPLE, LAYOUTS, MOOD_GALLERY, TICKET, TOUR } from "./companion-fixtures";
import { ORB_MOODS } from "@/lib/ui/moods";

const root = process.cwd();
const FORBIDDEN = /capex|0400|4711|B(ä|ae)cker|intercompany|asset number|credit note|five thousand/i;

function filesUnder(dir: string): string[] {
  const abs = resolve(root, dir);
  let listed: string[] = [];
  try {
    listed = readdirSync(abs);
  } catch {
    return [];
  }
  const out: string[] = [];
  for (const name of listed) {
    if (name === "node_modules" || name.startsWith(".")) continue;
    const path = join(abs, name);
    if (statSync(path).isDirectory()) out.push(...filesUnder(path));
    else if (/\.(tsx?|mjs)$/.test(name)) out.push(path);
  }
  return out;
}

const fixtureSource = readFileSync(resolve(root, "lib/demo/companion-fixtures.ts"), "utf8");
const allCopy = JSON.stringify({ HEARD_EXAMPLE, LAYOUTS, MOOD_GALLERY, TICKET, TOUR });

describe("demo companion fixtures", () => {
  it("is gender-neutral (source and data)", () => {
    expect(/\b(her|she)\b/i.test(fixtureSource)).toBe(false);
    expect(/\b(her|she)\b/i.test(allCopy)).toBe(false);
  });

  it("carries no role-card terms", () => {
    expect(fixtureSource).not.toMatch(FORBIDDEN);
    expect(allCopy).not.toMatch(FORBIDDEN);
    expect(allCopy).not.toMatch(/€\s?5[,.]?000|5k\b/i);
  });

  it("covers all 13 moods in the gallery", () => {
    expect(new Set(MOOD_GALLERY.map((g) => g.mood))).toEqual(new Set(ORB_MOODS));
    expect(MOOD_GALLERY).toHaveLength(13);
  });

  it("tour walks the glow sequence in order", () => {
    const order = ["quiet", "notice", "pausing", "asking", "listening", "understood", "off", "step", "correct"];
    let at = -1;
    for (const m of order) {
      const i = TOUR.findIndex((s, idx) => idx > at && s.mood === m);
      expect(i, m).toBeGreaterThan(at);
      at = i;
    }
  });

  it("highlights only a literal substring of the answer", () => {
    for (const s of TOUR) {
      if (s.highlight) expect(LAYOUTS.listen.answer.includes(s.highlight)).toBe(true);
      if (s.understood) expect(LAYOUTS.listen.answer.includes(s.understood.text)).toBe(true);
    }
  });

  it("is not imported by any live module", () => {
    const allowed = [/^lib\/demo\//, /^app\/demo\/companion\//, /^components\/demo\/companion\//];
    const offenders = ["app", "components", "lib", "scripts"]
      .flatMap(filesUnder)
      .map((p) => relative(root, p).replace(/\\/g, "/"))
      .filter((rel) => !allowed.some((re) => re.test(rel)))
      .filter((rel) => /companion-fixtures/.test(readFileSync(resolve(root, rel), "utf8")));
    expect(offenders).toEqual([]);
  });
});
