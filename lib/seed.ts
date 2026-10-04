/**
 * Seeds a realistic capture session (events, transcript, answered question windows, screen moments) so Map and Teach
 * can be demoed without running Capture, and as insurance on demo day.
 *
 *   npx tsx scripts/seed-session.ts
 *
 * Creates:
 *   demo_sabine            compiled, debrief still open (use it to demo the debrief and teach-back)
 *   demo_sabine_confirmed  compiled, slots filled, confirmed (use it to demo Teach and the autopilot)
 */
import { compileDeterministic, fillSlot, applyCorrection } from "./compile";
import { emptySession, type Frame, type ScreenEvent, type SessionLog } from "./events";
import { seedInvoices, toInvoiceState, type Invoice } from "./erp";
import { getMap, getSession, saveMap, saveSession } from "./store";
import { disarmTeachGuard, resetErp } from "./erp";
import { openSlots } from "./workmap";
import { confirmationIssues } from "./confirmation";

const inv = seedInvoices();
const byId = (id: string) => inv.find((i) => i.id === id)!;

function frameFor(i: Invoice, t: number, overrides: Partial<Invoice> = {}, highlight?: string): Frame {
  // A synthetic, already-masked still of the MB-ERP bill page (contact and IBAN are painted black, as a stored frame would be).
  const v = { ...i, ...overrides };
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const F = `font-family="IBM Plex Sans,Arial,sans-serif"`;
  const INK = "#17202a", MUTED = "#52606d", LINE = "#e3e7eb", CTL = "#d0d7de", BLUE = "#0a5fb4", AMBER = "#f5a623";
  const txt = (x: number, y: number, s: string, size = 12, fill = INK, extra = "") => `<text x="${x}" y="${y}" fill="${fill}" font-size="${size}" ${F} ${extra}>${esc(s)}</text>`;
  const box = (x: number, y: number, w: number, h: number, fill = "#fff", stroke = CTL, rx = 4) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" stroke="${stroke}"/>`;
  const hl = (on: boolean, x: number, y: number, w: number, h: number) => (on ? `<rect x="${x - 3}" y="${y - 3}" width="${w + 6}" height="${h + 6}" rx="6" fill="none" stroke="${AMBER}" stroke-width="2"/>` : "");
  const caret = (x: number, y: number) => `<path d="M${x} ${y}l4 4 4-4" fill="none" stroke="#7b8794" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>`;
  const row = (x: number, y: number, k: string, val: string) => `${txt(x, y, k, 11, MUTED)}${txt(x, y + 18, val, 12.5, INK, `font-weight="500"`)}`;
  const masked = (x: number, y: number, k: string, w: number) => `${txt(x, y, k, 11, MUTED)}<rect x="${x}" y="${y + 6}" width="${w}" height="15" fill="#111"/>`;
  const money = `€${v.amount.toLocaleString("en-IE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const cc = `${v.costCenter} · ${v.costCenter === "0400" ? "Capex · Machinery" : v.costCenter === "4120" ? "Opex · Freight" : "Opex · Maintenance"}`;
  const routeLabel = v.route === "second_approval" ? "Second approval (M. Weber)" : "Single approval (S. Koch)";
  const hold = v.status === "hold";
  const pill = hold ? { label: "ON HOLD", bg: "#fff1cc", fg: "#7a4b00", bd: "#e6d7a8", w: 62 } : v.status === "approved" || v.status === "posted" ? { label: "POSTED", bg: "#dff5e7", fg: "#0b5d33", bd: "#b7e0c6", w: 56 } : { label: "OPEN", bg: "#eef1f4", fg: "#3a4753", bd: CTL, w: 44 };
  const desc = v.description.length > 34 ? `${v.description.slice(0, 33)}…` : v.description;
  const nav = ["Dashboard", "Banking", "Expenses & Bills", "Sales", "Payroll", "Reports", "Taxes", "Accounting"]
    .map((n, k) => {
      const y = 104 + k * 28, on = n === "Expenses & Bills";
      return `${on ? `<rect x="8" y="${y - 17}" width="134" height="26" rx="4" fill="#ffffff" fill-opacity=".12"/><rect x="8" y="${y - 17}" width="3" height="26" fill="#fff"/>` : ""}<rect x="22" y="${y - 10}" width="10" height="10" rx="2" fill="none" stroke="#fff" stroke-opacity="${on ? 1 : 0.7}" stroke-width="1.3"/><text x="42" y="${y}" fill="#fff" fill-opacity="${on ? 1 : 0.8}" font-size="12" ${F} font-weight="${on ? 600 : 400}">${esc(n)}</text>`;
    })
    .join("");
  const L = 166, R = 944; // content column
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540"><rect width="960" height="540" fill="#f4f6f8"/>`
    // sidebar
    + `<rect x="0" y="0" width="150" height="540" fill="#16324f"/><rect x="16" y="20" width="11" height="11" rx="2" fill="#fff"/><text x="35" y="30" fill="#fff" font-size="14" ${F} font-weight="700">MB-ERP</text>`
    + `<rect x="12" y="46" width="126" height="28" rx="6" fill="#ffffff" fill-opacity=".08" stroke="#fff" stroke-opacity=".35"/><text x="26" y="64" fill="#fff" font-size="12.5" ${F} font-weight="600">+  New</text>${nav}`
    // top bar
    + `<rect x="150" y="0" width="810" height="44" fill="#fff"/><rect x="150" y="43.5" width="810" height="1" fill="${LINE}"/>`
    + `${box(L, 10, 300, 24, "#f3f5f7", LINE, 6)}<circle cx="${L + 14}" cy="21" r="4.5" fill="none" stroke="#7b8794" stroke-width="1.4"/><path d="M${L + 17.5} 24.5l3 3" stroke="#7b8794" stroke-width="1.4"/>${txt(L + 26, 26, "Search bills, vendors, POs", 11.5, "#7b8794")}`
    + `${txt(860, 27, "Posting period 12/2025", 11.5, MUTED, `text-anchor="end"`)}<circle cx="880" cy="22" r="11" fill="none" stroke="${CTL}"/>${txt(880, 26, "?", 11, MUTED, `text-anchor="middle"`)}<circle cx="910" cy="22" r="11" fill="${BLUE}"/>${txt(910, 26, "AP", 10, "#fff", `text-anchor="middle" font-weight="600"`)}`
    // breadcrumb + title row
    + txt(L, 64, "Expenses & Bills  ›  Bills  ›  Expert queue", 11.5, MUTED)
    + txt(L, 92, `Bill INV-${v.id}`, 20, INK, `font-weight="600"`)
    + `<rect x="${L + 140}" y="77" width="${pill.w}" height="20" rx="10" fill="${pill.bg}" stroke="${pill.bd}"/>${txt(L + 140 + pill.w / 2, 91, pill.label, 10.5, pill.fg, `text-anchor="middle" font-weight="600" letter-spacing=".4"`)}`
    + `<rect x="${R - 112}" y="74" width="112" height="28" rx="4" fill="${BLUE}"/>${txt(R - 56, 92, hold ? "Save as held" : "Post invoice", 12.5, "#fff", `text-anchor="middle" font-weight="600"`)}`
    // header card
    + box(L, 112, R - L, 110, "#fff", LINE, 8)
    + row(L + 16, 134, "Vendor", v.supplier) + row(L + 196, 134, "Bill date", v.date) + row(L + 296, 134, "Purchase order", v.poNumber ?? "none")
    + row(L + 412, 134, "Entity", v.entity === "subsidiary" ? "Subsidiary (intercompany)" : "Parent company")
    + txt(R - 16, 134, "Amount due", 11, MUTED, `text-anchor="end"`) + txt(R - 16, 162, money, 24, INK, `text-anchor="end" font-weight="600"`)
    + txt(R - 16, 186, "Supplier status", 11, MUTED, `text-anchor="end"`) + txt(R - 16, 203, v.knownSupplier ? "Known supplier" : "New supplier", 12, INK, `text-anchor="end"`)
    + (v.contactName ? masked(L + 16, 180, "Contact", 120) : "") + (v.iban ? masked(L + 196, 180, "Bank (IBAN)", 200) : "")
    // category details card
    + box(L, 234, R - L, 124, "#fff", LINE, 8)
    + txt(L + 16, 256, "Category details", 13, INK, `font-weight="600"`) + `<text x="${R - 16}" y="256" fill="${MUTED}" font-size="11.5" ${F} text-anchor="end">Category <tspan fill="${INK}" font-weight="600">${esc(v.category.replace(/_/g, " "))}</tspan></text>`
    + `<rect x="${L + 0.5}" y="266" width="${R - L - 1}" height="22" fill="#f8fafb"/><rect x="${L}" y="266" width="${R - L}" height="1" fill="${LINE}"/>`
    + txt(L + 16, 281, "#", 11, MUTED) + txt(L + 40, 281, "Account · cost center", 11, MUTED) + txt(L + 286, 281, "Description", 11, MUTED) + txt(L + 534, 281, "Asset number", 11, MUTED) + txt(R - 16, 281, "Amount", 11, MUTED, `text-anchor="end"`)
    + `<rect x="${L}" y="288" width="${R - L}" height="1" fill="${LINE}"/>`
    + txt(L + 16, 312, "1", 12, MUTED) + box(L + 40, 296, 230, 26) + txt(L + 48, 313, cc, 12, INK) + caret(L + 254, 307) + hl(highlight === "costCenter", L + 40, 296, 230, 26)
    + txt(L + 286, 313, desc, 12, INK) + box(L + 534, 296, 110, 26) + (v.assetNumber ? txt(L + 542, 313, v.assetNumber, 12, INK) : txt(L + 542, 313, "A-2025-000", 12, "#9aa5b1"))
    + txt(R - 16, 313, money, 12, INK, `text-anchor="end"`)
    + `<rect x="${L}" y="330" width="${R - L}" height="1" fill="${LINE}"/>` + txt(L + 16, 348, "+ Add lines", 11.5, BLUE, `font-weight="500"`)
    + `<text x="${R - 16}" y="348" fill="${INK}" font-size="11.5" ${F} text-anchor="end">Total <tspan font-weight="600">${esc(money)}</tspan></text>`
    // approval card
    + box(L, 370, R - L, 76, "#fff", LINE, 8)
    + txt(L + 16, 392, "Approval route", 11, MUTED) + box(L + 16, 400, 230, 28) + txt(L + 24, 418, routeLabel, 12, INK) + caret(L + 230, 412) + hl(highlight === "route", L + 16, 400, 230, 28)
    + txt(L + 266, 392, "Status", 11, MUTED) + box(L + 266, 400, 160, 28)
    + (hold ? `<rect x="${L + 346}" y="400.75" width="79.25" height="26.5" fill="#fff1cc" stroke="${AMBER}" stroke-width="1.5"/>` : `<rect x="${L + 266.5}" y="400.5" width="80" height="27" rx="3.5" fill="${BLUE}"/>`)
    + txt(L + 306, 418, "Post", 12, hold ? INK : "#fff", `text-anchor="middle" font-weight="${hold ? 400 : 600}"`) + txt(L + 386, 418, "Hold", 12, hold ? "#7a4b00" : INK, `text-anchor="middle" font-weight="${hold ? 600 : 400}"`)
    + hl(highlight === "status", L + 266, 400, 160, 28)
    + txt(L + 446, 392, "Memo", 11, MUTED) + box(L + 446, 400, R - L - 462, 28)
    + `</svg>`;
  return { id: `frame_${i.id}_${Math.round(t)}`, t, dataUrl: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`, width: 960, height: 540, piiRegionsBlurred: 0 };
}

function buildSession(id: string): SessionLog {
  const s = Object.assign(emptySession(id, "capture", "Process supplier invoices before month-end close", "Sabine"), { sample: true });
  s.startedAt = Date.now() - 9 * 60 * 1000;
  s.endedAt = Date.now() - 60 * 1000;
  const E: ScreenEvent[] = [];
  const F: Frame[] = [];
  const push = (e: Omit<ScreenEvent, "id"> & { frame?: Frame }) => {
    const { frame, ...rest } = e;
    if (frame) F.push(frame);
    E.push({ id: `ev_${E.length}`, ...rest, frameId: frame?.id });
  };
  const a = byId("4471"), b = byId("4472"), c = byId("4473");
  push({ t: 4, source: "dom", kind: "screen_changed", uiActivity: "navigating" });
  push({ t: 12, source: "dom", kind: "invoice_opened", invoice: "4471", state: toInvoiceState(a), frame: frameFor(a, 12) });
  push({ t: 24, source: "dom", kind: "typing", invoice: "4471", uiActivity: "typing" });
  push({ t: 41, source: "dom", kind: "field_changed", invoice: "4471", field: "costCenter", from: "4711", to: "0400", state: { ...toInvoiceState(a), costCenter: "0400" }, frame: frameFor(a, 41, { costCenter: "0400" }, "costCenter") });
  push({ t: 58, source: "dom", kind: "field_changed", invoice: "4471", field: "assetNumber", from: "", to: "A-2026-118", state: { ...toInvoiceState(a), costCenter: "0400", hasAssetNumber: true }, frame: frameFor(a, 58, { costCenter: "0400", assetNumber: "A-2026-118" }) });
  push({ t: 96, source: "dom", kind: "save_clicked", invoice: "4471", boundary: true, state: { ...toInvoiceState(a), costCenter: "0400", status: "approved", hasAssetNumber: true }, frame: frameFor(a, 96, { costCenter: "0400", status: "approved" }) });
  push({ t: 101, source: "dom", kind: "invoice_closed", invoice: "4471", boundary: true });
  push({ t: 110, source: "dom", kind: "invoice_opened", invoice: "4472", state: toInvoiceState(b), frame: frameFor(b, 110) });
  push({ t: 131, source: "dom", kind: "route_changed", invoice: "4472", field: "route", from: "single", to: "second_approval", state: { ...toInvoiceState(b), route: "second_approval" }, frame: frameFor(b, 131, { route: "second_approval" }, "route") });
  push({ t: 170, source: "dom", kind: "save_clicked", invoice: "4472", boundary: true, state: { ...toInvoiceState(b), route: "second_approval", status: "approved" }, frame: frameFor(b, 170, { route: "second_approval", status: "approved" }) });
  push({ t: 174, source: "dom", kind: "invoice_closed", invoice: "4472", boundary: true });
  push({ t: 182, source: "dom", kind: "invoice_opened", invoice: "4473", state: toInvoiceState(c), frame: frameFor(c, 182) });
  push({ t: 205, source: "dom", kind: "status_changed", invoice: "4473", field: "status", from: "open", to: "hold", state: { ...toInvoiceState(c), status: "hold" }, frame: frameFor(c, 205, { status: "hold" }, "status") });
  push({ t: 240, source: "dom", kind: "save_clicked", invoice: "4473", boundary: true, state: { ...toInvoiceState(c), status: "hold" }, frame: frameFor(c, 240, { status: "hold" }) });
  push({ t: 244, source: "dom", kind: "invoice_closed", invoice: "4473", boundary: true });
  s.events = E;
  s.frames = F;
  s.transcript = [
    { id: "tr0", t: 14, text: "Okay, Müller, the spindle. Let me check the PO first.", speaker: "expert", final: true },
    { id: "tr1", t: 46, text: "Agent: You moved invoice 4471 from 4711 to 0400 on the cost center. What made you do that?", speaker: "agent", final: true },
    { id: "tr2", t: 49, text: "It is a spindle unit, that is equipment, and equipment over five thousand is always capex. The system defaults everything to opex.", speaker: "expert", final: true },
    { id: "tr3", t: 68, text: "Agent: If it had been four thousand nine hundred instead of seven thousand eight hundred fifty, would you still have put it on 0400?", speaker: "agent", final: true },
    { id: "tr4", t: 71, text: "No, then it is opex. Only above five thousand. And I need an asset number, no asset number means no capex booking.", speaker: "expert", final: true },
    { id: "tr5", t: 112, text: "Novak, that is our Czech subsidiary.", speaker: "expert", final: true },
    { id: "tr6", t: 136, text: "Agent: Is there a kind of invoice you would never approve alone?", speaker: "agent", final: true },
    { id: "tr7", t: 139, text: "Anything intercompany. From a subsidiary it always gets a second approval, Markus in group controlling signs it. Four eyes.", speaker: "expert", final: true },
    { id: "tr8", t: 207, text: "Bäcker, December. They double bill every December, so this one waits until I have matched it against November.", speaker: "expert", final: true },
    { id: "tr9", t: 238, text: "Right, that is the queue for today.", speaker: "expert", final: true },
  ];
  s.windows = [
    { id: "w1", candidateId: "c1", kind: "why", question: "You moved invoice 4471 from 4711 to 0400 on the cost center. What made you do that?", stepRef: "4471:costCenter", openedAt: 44.5, askedAt: 46, answeredAt: 49, closedAt: 56, outcome: "answered", answerText: "It is a spindle unit, that is equipment, and equipment over five thousand is always capex. The system defaults everything to opex.", logged: { reason: "equipment over five thousand is always capex", kind: "why" } },
    { id: "w2", candidateId: "c2", kind: "counterfactual", question: "If it had been €4,946 instead of €7,850, would you still have put it on 0400?", stepRef: "4471:costCenter", openedAt: 66, askedAt: 68, answeredAt: 71, closedAt: 78, outcome: "answered", answerText: "No, then it is opex. Only above five thousand. And I need an asset number, no asset number means no capex booking.", logged: { reason: "no, then it is opex, only above five thousand", guardrail: "no asset number means no capex booking", kind: "counterfactual" } },
    { id: "w3", candidateId: "c3", kind: "limit", question: "Is there a kind of invoice you would never approve alone?", stepRef: "4472:route", openedAt: 134.5, askedAt: 136, answeredAt: 139, closedAt: 146, outcome: "answered", answerText: "Anything intercompany. From a subsidiary it always gets a second approval, Markus in group controlling signs it. Four eyes.", logged: { reason: "anything from a subsidiary gets a second approval", guardrail: "group controller signs", kind: "limit" } },
  ];
  s.metrics = { framesSeen: 318, entitiesRedacted: 2 };
  return s;
}

export async function seedDemo({ ifMissing = false }: { ifMissing?: boolean } = {}) {
  const existing = ifMissing ? await Promise.all(["demo_sabine", "demo_sabine_confirmed"].map(async (id) => {
    const [session, map] = await Promise.all([getSession(id), getMap(id)]);
    if (!!session !== !!map) throw new Error(`Incomplete sample: ${id}`);
    if ((session && session.id !== id) || (map && map.sessionId !== id)) throw new Error(`Invalid sample: ${id}`);
    return { session, map };
  })) : undefined;
  if (!ifMissing) {
    await disarmTeachGuard();
    await resetErp();
  }
  const existingOpen = existing?.[0].session;
  const open = existingOpen ?? buildSession("demo_sabine");
  if (!existingOpen) await saveSession(open);
  const existingMap = existing?.[0].map;
  const map = existingMap ?? compileDeterministic(open);
  if (!existingMap) await saveMap(map);
  console.log(`demo_sabine: ${map.steps.length} steps, ${map.steps.filter((s) => s.judgment).length} judgment calls, ${map.rules.length} rules, ${openSlots(map).length} open slots`);

  const existingDone = existing?.[1].session;
  const done = existingDone ?? buildSession("demo_sabine_confirmed");
  if (!existingDone) await saveSession(done);
  const existingConfirmed = existing?.[1].map;
  if (!existingConfirmed) {
    const m2 = compileDeterministic(done);
    // the debrief, as the judges' script runs it
    const answers: Record<string, string> = {
      limit: "That is for every supplier in December, I hold them all until I have matched them.",
      escalation: "If I am not sure I stop and ask Petra, the AP lead. She decides when a held one gets released.",
      reason: "Because that is how we do it.",
      exception: "I reject it outright when there is no purchase order and the supplier is new; that goes back to purchasing.",
      novel: "A credit note never gets posted on its own. I book it against the original invoice and Petra releases the pair together.",
    };
    for (const slot of openSlots(m2)) fillSlot(m2, slot.id, { text: answers[slot.kind] ?? answers.exception, t: 300, source: "debrief" });
    applyCorrection(m2, "No, only Bäcker. The other suppliers go through normally in December.", 340);
    const issues = confirmationIssues(m2);
    if (issues.length) throw new Error(`Invalid scripted sample: ${issues.join(" ")}`);
    m2.confirmedAt = Date.now();
    for (const r of m2.rules) {
      if (!r.confirmedBy.includes("teachback")) r.confirmedBy.push("teachback");
      if (r.confidence !== "low") r.confidence = "high";
      if ("set" in r.then) r.stopAndAsk = { who: "the controller", when: { any: [{ field: "knownSupplier", op: "==", value: false }, { field: "hasAssetNumber", op: "==", value: false }] } };
    }
    await saveMap(m2);
    console.log(`demo_sabine_confirmed: ${m2.rules.length} rules, confirmed, ${openSlots(m2).length} open slots`);
  }
  console.log("\nOpen /map/demo_sabine for the debrief, /teach?from=demo_sabine_confirmed for the tutor.");
  return { samples: [open.id, done.id] };
}
