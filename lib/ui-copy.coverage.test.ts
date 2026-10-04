import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Extends lib/ui-copy.spoilers.test.ts to the UI directories added by the front-end overhaul.
// Same forbidden patterns; paths that do not exist yet are skipped.

const root = process.cwd();

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
    const path = join(abs, name);
    if (statSync(path).isDirectory()) out.push(...filesUnder(path));
    else if (/\.(tsx|ts)$/.test(name)) out.push(path);
  }
  return out;
}

function fileIfExists(rel: string): string[] {
  const abs = resolve(root, rel);
  try {
    return statSync(abs).isFile() ? [abs] : [];
  } catch {
    return [];
  }
}

const coveredDirs = [
  "components/glass",
  "components/companion",
  "components/landing",
  "components/platform",
  "components/claims",
  "app/platform",
  "app/claims",
  "app/capture",
  "app/map",
  "app/teach",
];

const coveredFiles = ["lib/platform/demo-data.ts", "lib/claims-model.ts"];

const paths = [...coveredDirs.flatMap(filesUnder), ...coveredFiles.flatMap(fileIfExists)];

const forbidden = [
  /capex only/i,
  /over the threshold/i,
  /another supplier\)/i,
  /e\.g\. only/i,
  /Open invoice \d{4}/,
  /hidden judgment/i,
  /Sabine Koch/,
  /(Lena|Sabine)('s|’s) queue/,
];

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

describe("judge-facing copy in the new UI directories", () => {
  it("does not contain role-card answers or gendered pronouns", () => {
    const hits: string[] = [];
    for (const path of paths) {
      const body = stripComments(readFileSync(path, "utf8"));
      for (const re of forbidden) {
        if (re.test(body)) hits.push(`${path}: ${re}`);
      }
      if (/\b(her|she)\b/i.test(body)) hits.push(`${path}: her/she`);
    }
    expect(hits).toEqual([]);
  });

  it("flags a pronoun or role-card phrase (self-check of the patterns)", () => {
    const sample = stripComments("const a = 'Ask her first';\n// she is fine in a comment\nconst b = 'capex only';");
    expect(/\b(her|she)\b/i.test(sample)).toBe(true);
    expect(forbidden.some((re) => re.test(sample))).toBe(true);
    expect(/\b(her|she)\b/i.test(stripComments("// she\nconst x = 'share the other tab here';"))).toBe(false);
  });
});
