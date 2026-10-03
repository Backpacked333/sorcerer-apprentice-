/**
 * Keyless production smoke gate. Builds, seeds isolated data, starts port 3077, and exits nonzero on failure.
 *   node scripts/smoke.mjs
 */
import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";

const BASE = "http://localhost:3077";
const OUT = process.env.OUT ?? "/tmp/tacit-shots";
mkdirSync(OUT, { recursive: true });
const shot = (page, name) => page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false });
const dataDir = mkdtempSync(join(tmpdir(), "tacit-smoke-"));
const projectDir = process.cwd();
const next = resolve("node_modules/next/dist/bin/next");
const env = {
  ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !/KEY|TOKEN|AGENT_ID/.test(key))),
  ELEVENLABS_API_KEY: "", AI_GATEWAY_API_KEY: "", VERCEL_OIDC_TOKEN: "",
  NEXT_PUBLIC_INTERVIEWER_AGENT_ID: "", NEXT_PUBLIC_TUTOR_AGENT_ID: "",
  NEXT_PUBLIC_EVENT_SOURCE: "dom", DATA_DIR: dataDir, NEXT_TELEMETRY_DISABLED: "1",
};
const run = (args, cwd = projectDir) => new Promise((resolve, reject) => {
  const child = spawn(process.execPath, args, { env, cwd, stdio: "inherit" });
  child.on("error", reject);
  child.on("exit", (code) => code === 0 ? resolve() : reject(new Error(`${args[0]} exited ${code}`)));
});
let server;
let browser;
try {
  // Refuse to test a leftover process which could have real provider credentials.
  await fetch(`${BASE}/api/health`, { signal: AbortSignal.timeout(1000) }).then(() => {
    throw new Error("Port 3077 is occupied; stop the existing server before smoke.");
  }, () => {});
  await run([next, "build"]);
  await run([resolve("node_modules/tsx/dist/cli.mjs"), resolve("scripts/seed-session.ts"), "--if-missing"], dataDir);
  server = spawn(process.execPath, [next, "start", projectDir, "-p", "3077"], { env, cwd: dataDir, stdio: "inherit" });
  let serverError;
  server.on("error", (error) => { serverError = error; });
  let healthy = false;
  for (let n = 0; n < 120; n++) {
    if (serverError) throw serverError;
    if (server.exitCode !== null) throw new Error(`Server exited ${server.exitCode}`);
    const response = await fetch(`${BASE}/api/health`, { signal: AbortSignal.timeout(1000) }).catch(() => null);
    if (response?.ok) {
      const health = await response.json();
      assert.deepEqual(health.keys, { elevenlabs: false, gateway: false }, "Smoke must never use paid credentials");
      assert.equal(health.agents.interviewer, false);
      assert.equal(health.agents.tutor, false);
      healthy = true;
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  assert.ok(healthy, "Server must become ready within 30 seconds");

browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH || undefined,
  args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--auto-select-desktop-capture-source=Entire screen", "--autoplay-policy=no-user-gesture-required"],
});
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addInitScript(() => {
  Object.defineProperty(window, "SpeechRecognition", { value: undefined, configurable: true });
  Object.defineProperty(window, "webkitSpeechRecognition", { value: undefined, configurable: true });
  if (navigator.mediaDevices) Object.defineProperty(navigator.mediaDevices, "getUserMedia", { value: async () => new MediaStream(), configurable: true });
});
const errors = [];
ctx.on("page", (p) => {
  p.on("pageerror", (e) => errors.push(`${p.url()}: ${e.message}`));
});
const sel = async (page, testId, fallback) => {
  const locator = page.getByTestId(testId);
  return await locator.count() ? locator : page.locator(fallback);
};

// 1. ERP
const erp = await ctx.newPage();
await erp.goto(`${BASE}/erp?queue=expert`);
await shot(erp, "01-erp-queue");
await erp.goto(`${BASE}/erp/invoice/4471`);
await erp.waitForSelector("select");
await shot(erp, "02-erp-invoice-4471");

// 2. Capture
const cap = await ctx.newPage();
await cap.goto(`${BASE}/capture?share=0`);
await shot(cap, "03-capture-start");
await (await sel(cap, "cap-consent", 'input[type="checkbox"]')).check();
await (await sel(cap, "cap-start", "text=Start session and share the ERP tab")).click();
await cap.waitForSelector("text=Governor", { timeout: 20000 });
await cap.click("text=Show the mechanism");
await cap.waitForTimeout(1500);
await shot(cap, "04-capture-listening");

// the expert works in the ERP tab: re-open the invoice so the capture session sees it, then re-code it
await erp.reload();
await erp.waitForSelector("select");
await erp.waitForTimeout(1200);
await erp.selectOption("select >> nth=0", "0400");
await cap.waitForTimeout(1000);
await shot(cap, "05-capture-event");
// a pause: no typing, no speech. The governor should open a window within a few seconds.
await cap.waitForSelector("text=mic open, recording the answer", { timeout: 40000 });
await cap.waitForTimeout(500);
await shot(cap, "06-capture-question");
const asked = await cap.locator("text=mic open, recording the answer").count();
assert.ok(asked > 0, "Capture question window must open");
const input = cap.locator('input[placeholder^="Type the answer"]');
if (await input.count()) {
  await input.fill("Equipment over five thousand is always capex, the system defaults everything to opex.");
  await cap.click("text=Log");
  await cap.waitForTimeout(800);
}
await shot(cap, "07-capture-answered");
// scratch that
await cap.click("text=Scratch that");
await cap.waitForTimeout(500);
await shot(cap, "08-capture-off-record");
// done -> map
await cap.click("text=Done · start the debrief");
await cap.waitForURL(/\/map\//, { timeout: 30000 });
await cap.waitForSelector("text=Gaps closed", { timeout: 30000 });
const liveId = new URL(cap.url()).pathname.split("/").pop();
const live = await (await ctx.request.get(`${BASE}/api/sessions/${liveId}`)).json();
assert.ok(live.map?.slots.some((slot) => slot.status === "open"), "Live map must compile with open gaps");
await cap.waitForTimeout(1000);
await shot(cap, "09-map-compiled-live");

// 3. Map on the seeded session: debrief, teach-back, confirm
const map = await ctx.newPage();
await map.goto(`${BASE}/map/demo_sabine`);
await map.waitForSelector("text=Gaps closed", { timeout: 30000 });
await map.waitForTimeout(800);
await shot(map, "10-map-seeded");
await map.click("text=Start the spoken debrief");
await map.waitForSelector('input[placeholder="Type the answer"]', { timeout: 15000 });
const answers = [
  "That is for every supplier in December, I hold them all until matched.",
  "If I am unsure I ask Petra, the AP lead; she decides when a held invoice is released.",
  "I reject it outright when there is no purchase order and the supplier is new.",
  "A credit note never gets posted on its own, I book it against the original invoice.",
  "Without a purchase order it goes back to purchasing, I never code it myself.",
  "Month-end I do the capex ones first.",
  "Anything intercompany gets the second signature, always.",
];
for (let i = 0; i < answers.length; i++) {
  const inp = map.locator('input[placeholder="Type the answer"]');
  if (!(await inp.count())) break;
  await inp.fill(answers[i]);
  await map.click("button:has-text('Log')");
  await map.waitForTimeout(900);
}
await map.waitForSelector("text=Yes, that is how it works", { timeout: 20000 });
await shot(map, "11-map-teachback");
await map.fill('input[placeholder^="Correct one detail"]', "No, only Bäcker. The others go through normally in December.");
await map.click("button:has-text('Correct')");
await map.waitForTimeout(1200);
await shot(map, "12-map-corrected");
const confirmedResponse = map.waitForResponse((response) => response.url().endsWith("/api/sessions/demo_sabine/confirm") && response.request().method() === "POST");
await (await sel(map, "map-confirm", "text=Yes, that is how it works")).click();
const confirmed = await confirmedResponse;
assert.ok(confirmed.ok(), "Teach-back confirmation request must succeed");
assert.ok((await confirmed.json()).map.confirmedAt, "Teach-back confirmation must persist");
await map.waitForTimeout(500);
await shot(map, "13-map-confirmed");

// 4. Teach on the confirmed map
const teach = await ctx.newPage();
await teach.goto(`${BASE}/teach?from=demo_sabine_confirmed&share=0`);
await teach.click("text=Start and share the ERP tab");
await teach.waitForURL(/\/teach\/t_/, { timeout: 20000 });
await teach.waitForSelector("text=Start and share the ERP tab", { timeout: 20000 });
await shot(teach, "14-teach-start");
await teach.click("text=Start and share the ERP tab");
await teach.waitForSelector("text=Tutor", { timeout: 20000 });
await teach.waitForTimeout(1500);
// Lena opens 4490 and reaches for opex
await erp.goto(`${BASE}/erp/invoice/4490`);
await erp.waitForSelector("select");
await erp.waitForTimeout(1500);
await shot(teach, "15-teach-predict");
await erp.selectOption("select >> nth=0", "4120"); // a wrong opex code
await teach.waitForTimeout(1500);
await shot(teach, "16-teach-intervene");
await teach.waitForSelector("text=Replay", { timeout: 12000 });
await teach.waitForTimeout(500);
await shot(teach, "17-teach-replay");
await erp.selectOption("select >> nth=0", "0400");
await teach.waitForTimeout(1500);
await shot(teach, "18-teach-praise");
// 4491: December, other supplier: silence expected
await erp.goto(`${BASE}/erp/invoice/4491`);
await erp.waitForSelector("select");
await erp.click("button:has-text('approved')");
await teach.waitForTimeout(1500);
// 4492: credit note nobody taught
await erp.goto(`${BASE}/erp/invoice/4492`);
await erp.waitForSelector("select");
await teach.waitForTimeout(1500);
await shot(teach, "19-teach-novel");
// independent follow-up: 4493 decided correctly without help; 4494 commits a wrong route and the guard holds it
await erp.goto(`${BASE}/erp/invoice/4493`);
await erp.waitForSelector("select");
await erp.waitForTimeout(1200);
await erp.selectOption("select >> nth=0", "0400");
await erp.fill('input[placeholder="A-2026-000"]', "A-2026-131");
await erp.click("text=Save and post");
await erp.click("text=Confirm");
await erp.waitForSelector("text=saved", { timeout: 10000 });
await teach.waitForTimeout(1200);
await erp.goto(`${BASE}/erp/invoice/4494`);
await erp.waitForSelector("select");
await erp.waitForTimeout(1200);
await erp.click("text=Save and post");
const heldResponse = erp.waitForResponse((response) => response.url().includes("/api/erp/invoices/") && response.request().method() === "PATCH");
await erp.click("text=Confirm");
assert.equal((await heldResponse).status(), 409, "Independent mistake must be rejected by the save guard");
await erp.waitForSelector("text=Not posted", { timeout: 10000 });
await shot(erp, "19b-erp-save-held");
await teach.waitForSelector("text=Not posted", { timeout: 10000 });
await teach.waitForTimeout(800);
await shot(teach, "19c-teach-guard");
await map.click("text=Prove it: load policy.json");
await map.waitForSelector("text=halted", { timeout: 30000 });
await map.waitForTimeout(1200);
await shot(map, "20-map-autopilot");
await teach.click("text=End session · show the mastery card");
await teach.waitForSelector("text=Mastery card", { timeout: 15000 });
await teach.waitForTimeout(500);
await shot(teach, "21-teach-mastery");

const decisions = await teach.locator("text=Sabine would stop here").count();
assert.ok(decisions > 0, "Tutor must intervene on a new-hire mistake");
assert.ok((await teach.locator("text=needed the guard").count()) > 0, "Independent miss must appear in mastery");
assert.ok((await teach.locator("text=independent: correct without help").count()) > 0, "Independent success must be recorded");
assert.deepEqual(errors, [], "Smoke must have no page errors");
console.log("PASS: capture, map, confirmation, tutor, independent guard, and page errors");
} finally {
  await browser?.close();
  if (server && server.exitCode === null) {
    await new Promise((resolve) => { server.once("exit", resolve); server.kill("SIGTERM"); });
  }
  rmSync(dataDir, { recursive: true, force: true });
}
