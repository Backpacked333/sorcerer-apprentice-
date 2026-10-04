import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { configDefaults } from "vitest/config";
import nextConfig from "../next.config";
import vitestConfig from "../vitest.config";

const root = path.resolve(__dirname, "..");
const read = (file: string) => readFileSync(path.join(root, file), "utf8");
const pkg = JSON.parse(read("package.json"));
const lock = JSON.parse(read("package-lock.json"));
const workflow = read(".github/workflows/ci.yml");

describe("platform configuration", () => {
  it("runs installation, typecheck, tests, and production build in one Node 22 check job", () => {
    expect(workflow.match(/^  \w+:$/gm)).toEqual(["  pull_request:", "  push:", "  check:"]);
    expect(workflow).toMatch(/branches: \[main\]/);
    expect(workflow).toMatch(/node-version: 22\b/);
    expect([...workflow.matchAll(/- run: (.+)/g)].map((match) => match[1])).toEqual([
      "npm ci", "npm run typecheck", "npm test", "npx next build",
    ]);
  });

  it("cancels stale PR runs but gives each main run a distinct concurrency group", () => {
    expect(workflow).toContain("group: check-${{ github.event_name == 'pull_request' && github.ref || github.run_id }}");
    expect(workflow).toContain("cancel-in-progress: ${{ github.event_name == 'pull_request' }}");
  });

  it("requires Node 22 and retains the seed runner in production installations", () => {
    expect(pkg.engines).toEqual({ node: ">=22" });
    expect(pkg.dependencies.tsx).toBe("^4");
    expect(pkg.devDependencies).not.toHaveProperty("tsx");
    expect(lock.packages[""].dependencies).toEqual(pkg.dependencies);
    expect(lock.packages[""].engines).toEqual(pkg.engines);
    expect(lock.packages["node_modules/tsx"].dev).not.toBe(true);
  });

  it("exposes smoke and production start without unconditional reseeding", () => {
    expect(pkg.scripts.smoke).toBe("node scripts/smoke.mjs");
    expect(pkg.scripts["start:prod"]).toBe("npm run seed:session -- --if-missing && next start -p ${PORT:-3000}");
  });

  it("excludes agent workspaces without dropping application typechecks or tests", () => {
    const tsconfig = JSON.parse(read("tsconfig.json"));
    expect(tsconfig.exclude).toEqual(expect.arrayContaining(["node_modules", ".worktrees", ".claude"]));
    expect(tsconfig.include).toEqual(expect.arrayContaining(["**/*.ts", "**/*.tsx"]));
    expect(vitestConfig.test?.exclude).toEqual(expect.arrayContaining([
      ...configDefaults.exclude, "**/.worktrees/**", "**/.claude/**",
    ]));
    expect(vitestConfig.test?.include).toEqual(["lib/**/*.test.ts"]);
  });

  it("ignores env files, worktrees and recordings while retaining the env example and tests", () => {
    const ignored = [".env", ".env.local", ".env.production", ".envrc", ".worktrees/b/task/lib/test.ts", "recordings/demo.mp4"];
    const visible = [".env.example", "lib/platform-config.test.ts", "lib/engines.test.ts"];
    const result = execFileSync("git", ["check-ignore", "--no-index", "--stdin"], {
      cwd: root, input: [...ignored, ...visible].join("\n") + "\n", encoding: "utf8",
    });
    expect(result.trim().split("\n")).toEqual(ignored);
  });

  it("permits Cloudflare dev tunnels without pretending Server Actions configure route bodies", () => {
    expect(nextConfig.allowedDevOrigins).toEqual(["*.trycloudflare.com"]);
    expect(nextConfig.experimental ?? {}).not.toHaveProperty("serverActions");
  });
});
