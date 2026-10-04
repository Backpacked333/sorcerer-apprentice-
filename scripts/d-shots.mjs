/**
 * Lane D screenshots and layout checks. Dev server on BASE (default http://localhost:3077).
 *   node scripts/d-shots.mjs
 *   node scripts/d-shots.mjs --erp
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = process.env.BASE ?? "http://localhost:3077";
const OUT = process.env.OUT ?? "/tmp/tacit-d-shots";
const erpOnly = process.argv.includes("--erp");
mkdirSync(OUT, { recursive: true });
const fails = [];
const check = (ok, msg) => {
  console.log(`${ok ? "ok" : "FAIL"} ${msg}`);
  if (!ok) fails.push(msg);
};

const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || undefined });

async function shot(page, name) {
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false });
}

if (!erpOnly) {
  const desk = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const home = await desk.newPage();
  await home.goto(`${BASE}/`);
  await shot(home, "landing-1440");
  const doors = await home.locator("h2").allTextContents();
  check(doors.some((t) => t.includes("finished Work Map")), "door 1 visible at 1440");
  check(doors.some((t) => t.includes("Run it yourself")), "door 2 visible at 1440");

  const phone = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const narrow = await phone.newPage();
  await narrow.goto(`${BASE}/`);
  await shot(narrow, "landing-390");
  check((await narrow.locator("h2").count()) >= 2, "both doors exist at 390");

  const cap = await desk.newPage();
  await cap.goto(`${BASE}/capture?share=0`);
  const frame = cap.locator("iframe[title='Sandbox ERP']");
  await frame.waitFor({ timeout: 15000 });
  await shot(cap, "capture-workspace-1440");
  check(await frame.count() === 1, "workspace has one ERP frame");
  const box = await frame.boundingBox();
  check(!!box && box.width >= 1400, `frame is full width (${box?.width ?? 0})`);
  // The companion floats bottom-right over the full-width ERP (its rectangle is painted out of every frame).
  const card = await cap.locator(".workspace-companion").boundingBox();
  check(!!card && card.x + card.width <= 1440 && card.y + card.height <= 900 && card.width >= 340 && card.width <= 460, `floating companion ${card?.width ?? 0}x${card?.height ?? 0}`);

  const two = await browser.newContext({ viewport: { width: 480, height: 900 } });
  const comp = await two.newPage();
  await comp.goto(`${BASE}/capture?layout=companion`);
  await shot(comp, "capture-companion-480");
  check(await comp.locator("iframe").count() === 0, "companion layout has no frame");
  const overflow = await comp.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  check(!overflow, "companion layout has no horizontal scroll");
  await two.close();
  await phone.close();
  await desk.close();
}

const erp = await browser.newContext();
for (const [w, h, name] of [[1020, 852, "erp-1020"], [936, 800, "erp-936"]]) {
  const page = await erp.newPage();
  await page.setViewportSize({ width: w, height: h });
  await page.goto(`${BASE}/erp/invoice/4471`);
  await page.waitForSelector("[data-testid=erp-status-badge]");
  await shot(page, name);
  const overflow = await page.evaluate(() => document.documentElement.scrollHeight > window.innerHeight + 2);
  check(!overflow, `${name} has no vertical overflow`);
  const badge = (await page.locator("[data-testid=erp-status-badge]").innerText()).trim();
  check(["OPEN", "ON HOLD", "POSTED"].includes(badge), `${name} badge ${badge}`);
  const small = await page.evaluate(() => {
    const nodes = [...document.querySelectorAll(".erp *")].filter((el) => el.childNodes.length && [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()));
    return nodes.some((el) => parseFloat(getComputedStyle(el).fontSize) < 14);
  });
  check(!small, `${name} text is at least 14px`);
  await page.close();
}
const colors = await erp.newPage();
await colors.setViewportSize({ width: 1280, height: 800 });
await colors.goto(`${BASE}/erp`);
const erpBg = await colors.evaluate(() => getComputedStyle(document.body).backgroundColor);
await colors.goto(`${BASE}/capture?layout=companion`);
const tacitBg = await colors.evaluate(() => getComputedStyle(document.body).backgroundColor);
check(erpBg !== tacitBg, `ERP background ${erpBg} differs from Tacit ${tacitBg}`);
await erp.close();

await browser.close();
console.log(fails.length ? `failed: ${fails.join("; ")}` : "d-shots passed");
process.exit(fails.length ? 1 : 0);
