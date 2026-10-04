/**
 * Keyless end-to-end smoke test with screenshots. Runs against a dev server on BASE (default http://localhost:3077).
 *   node scripts/smoke.mjs
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = process.env.BASE ?? "http://localhost:3077";
const OUT = process.env.OUT ?? "/tmp/tacit-shots";
mkdirSync(OUT, { recursive: true });
const shot = (page, name) => page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false });

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH || undefined,
  args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--auto-select-desktop-capture-source=Entire screen", "--autoplay-policy=no-user-gesture-required"],
});
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, permissions: ["microphone"] });
const errors = [];
ctx.on("page", (p) => {
  p.on("pageerror", (e) => errors.push(`${p.url()}: ${e.message}`));
  p.on("console", (m) => (m.type() === "error" || m.type() === "warning") && errors.push(`${m.type()} ${p.url()}: ${m.text().slice(0, 1200)}`));
});

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
await cap.check('input[type="checkbox"]');
await cap.click("text=Start session and share the ERP tab");
await cap.click("text=Show the mechanism");
await cap.waitForSelector("text=Governor", { timeout: 20000 });
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
await cap.waitForSelector("text=mic open, recording the answer", { timeout: 40000 }).catch(() => {});
await cap.waitForTimeout(500);
await shot(cap, "06-capture-question");
const asked = await cap.locator("text=mic open, recording the answer").count();
console.log("question window opened:", asked > 0);
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
await map.click("text=Yes, that is how it works");
await map.waitForSelector("text=Confirmed by Sabine", { timeout: 15000 });
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
await teach.waitForSelector("text=Replay", { timeout: 12000 }).catch(() => {});
await teach.waitForTimeout(500);
await shot(teach, "17-teach-replay");
await erp.selectOption("select >> nth=0", "0400");
await teach.waitForTimeout(1500);
await shot(teach, "18-teach-praise");
// 4491: December, other supplier: silence expected
await erp.goto(`${BASE}/erp/invoice/4491`);
await erp.waitForSelector("select");
await erp.selectOption("select >> nth=0", "4300");
await erp.click("text=Post invoice");
await erp.click("text=Confirm");
await erp.waitForSelector("text=POSTED", { timeout: 10000 });
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
await erp.fill('input[placeholder="A-2025-000"]', "A-2025-131");
await erp.click("text=Post invoice");
await erp.click("text=Confirm");
await erp.waitForSelector("text=POSTED", { timeout: 10000 });
await teach.waitForTimeout(1200);
await erp.goto(`${BASE}/erp/invoice/4494`);
await erp.waitForSelector("select");
await erp.waitForTimeout(1200);
await erp.selectOption("select >> nth=0", "4120");
await erp.click("text=Post invoice");
await erp.click("text=Confirm");
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
console.log("intervened:", decisions > 0);
console.log("guard held the independent miss:", (await teach.locator("text=needed the guard").count()) > 0);
console.log("independent success recorded:", (await teach.locator("text=independent: correct without help").count()) > 0);
console.log("page errors:", errors.length ? errors : "none");
await browser.close();
