import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

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

const paths = [
  ...filesUnder("app/erp"),
  ...filesUnder("app/demo"),
  ...filesUnder("components/views"),
  ...filesUnder("components/ui"),
  ...filesUnder("components/erp"),
  ...filesUnder("components/demo"),
  resolve(root, "app/page.tsx"),
  resolve(root, "components/InvoiceForm.tsx"),
  resolve(root, "components/ErpHeader.tsx"),
  resolve(root, "components/WorkMapView.tsx"),
  resolve(root, "components/Meter.tsx"),
  resolve(root, "components/TeachStart.tsx"),
];

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

describe("judge-facing copy", () => {
  it("does not contain role-card answers or gendered pronouns", () => {
    const hits: string[] = [];
    for (const path of paths) {
      const raw = readFileSync(path, "utf8");
      const body = stripComments(raw);
      for (const re of forbidden) {
        if (re.test(body)) hits.push(`${path}: ${re}`);
      }
      if (/\b(her|she)\b/i.test(body)) hits.push(`${path}: her/she`);
    }
    expect(hits).toEqual([]);
  });
});
