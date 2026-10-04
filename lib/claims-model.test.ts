import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CLAIMS, CLAIMS_TITLE, getClaim, NEXT_STEPS } from "./claims-model";

const root = join(__dirname, "..");
const source = readFileSync(join(__dirname, "claims-model.ts"), "utf8");

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

describe("claims sandbox model", () => {
  it("is gender-neutral and free of role-card terms", () => {
    expect(source).not.toMatch(/\b(her|hers|she)\b/i);
    expect(source).not.toMatch(/capex|0400|4711|B(ä|ae)cker|intercompany|asset number|credit note|five thousand/i);
  });

  it("encodes no decision logic: no thresholds, no conditionals over claim fields", () => {
    expect(source).not.toMatch(/\bif\s*\(/);
    expect(source).not.toMatch(/\?\s*["'`](approve|deny|escalate|Covered|Not covered)/i);
  });

  it("is never read by compile, matcher, the invoice ERP or the agents", () => {
    const files = [
      ...walk(join(root, "lib/compile")),
      join(root, "lib/compile.ts"),
      join(root, "lib/matcher.ts"),
      ...readdirSync(join(root, "lib")).filter((f) => /^erp.*\.ts$/.test(f)).map((f) => join(root, "lib", f)),
      ...walk(join(root, "agents")),
    ].filter(existsSync);
    expect(files.length).toBeGreaterThan(3);
    for (const f of files) expect(readFileSync(f, "utf8"), f).not.toMatch(/claims-model/);
  });

  it("has 4–6 fictional claims with unique ids and the labelled title", () => {
    expect(CLAIMS.length).toBeGreaterThanOrEqual(4);
    expect(CLAIMS.length).toBeLessThanOrEqual(6);
    expect(new Set(CLAIMS.map((c) => c.id)).size).toBe(CLAIMS.length);
    expect(CLAIMS_TITLE).toBe("Claims workbench · Kestrel Bay Mutual (fictional)");
    expect(getClaim(" clm-30412 ")?.id).toBe("CLM-30412");
    expect(NEXT_STEPS.map((s) => s.id)).toEqual(["approve", "deny", "escalate"]);
  });
});
