import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

const clients = [
  ["components/CaptureClient.tsx", "CaptureView"],
  ["components/MapClient.tsx", "MapView"],
  ["components/TeachClient.tsx", "TeachView"],
] as const;

describe("view seam", () => {
  it("keeps each client free of markup except the view return", () => {
    for (const [path, view] of clients) {
      const src = read(path);
      expect(src).toContain(`return <${view} vm={vm} />`);
      expect(src).not.toMatch(/<main|<div|<button|className=/);
    }
  });

  it("keeps each view presentational", () => {
    for (const name of ["CaptureView", "MapView", "TeachView"]) {
      const src = read(`components/views/${name}.tsx`);
      expect(src).toContain('"use client"');
      expect(src).not.toMatch(/fetch\(|@elevenlabs/);
      expect(src).not.toMatch(/from ["']@\/lib\/(governor|curiosity|matcher|compile|store|erp)["']/);
    }
  });
});
