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

const inv = seedInvoices();
const byId = (id: string) => inv.find((i) => i.id === id)!;

function frameFor(i: Invoice, t: number, overrides: Partial<Invoice> = {}, highlight?: string): Frame {
  const v = { ...i, ...overrides };
  const row = (y: number, k: string, val: string, hl = false) =>
    `<text x="40" y="${y}" fill="#7f8c99" font-size="14" font-family="Inter,Arial">${k}</text><text x="260" y="${y}" fill="${hl ? "#f5a623" : "#d7dee6"}" font-size="16" font-family="JetBrains Mono,monospace" font-weight="${hl ? 700 : 400}">${val}</text>${hl ? `<rect x="250" y="${y - 20}" width="420" height="30" fill="none" stroke="#f5a623" stroke-width="2" rx="4"/>` : ""}`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540"><rect width="960" height="540" fill="#0a0d10"/><rect x="0" y="0" width="960" height="44" fill="#11161b"/><rect x="16" y="16" width="12" height="12" fill="#f5a623"/><text x="36" y="29" fill="#d7dee6" font-size="15" font-family="Inter,Arial" font-weight="600">MB-ERP</text><text x="110" y="29" fill="#7f8c99" font-size="13" font-family="Inter,Arial">Maschinenbau Stuttgart GmbH · sandbox · Invoice INV-${v.id}</text><rect x="24" y="64" width="560" height="440" fill="#11161b" stroke="#1f2a33"/><text x="40" y="96" fill="#7f8c99" font-size="11" font-family="Inter,Arial" letter-spacing="2">SUPPLIER INVOICE</text><text x="40" y="128" fill="#d7dee6" font-size="26" font-family="JetBrains Mono,monospace" font-weight="700">INV-${v.id}</text><text x="560" y="128" fill="#d7dee6" font-size="26" font-family="JetBrains Mono,monospace" font-weight="700" text-anchor="end">€${v.amount.toLocaleString("en-IE")}</text>${row(180, "Supplier", v.supplier)}${row(214, "Entity", v.entity === "subsidiary" ? "Subsidiary (intercompany)" : "Parent company")}${row(248, "Invoice date", v.date)}${row(282, "Category", v.category)}${row(316, "Purchase order", v.poNumber ?? "none")}${row(350, "Line item", v.description.slice(0, 38))}<rect x="608" y="64" width="328" height="440" fill="#11161b" stroke="#1f2a33"/><text x="624" y="96" fill="#7f8c99" font-size="11" font-family="Inter,Arial" letter-spacing="2">CODING AND APPROVAL</text><text x="624" y="140" fill="#7f8c99" font-size="13" font-family="Inter,Arial">Cost center</text><rect x="624" y="150" width="296" height="36" fill="#0a0d10" stroke="${highlight === "costCenter" ? "#f5a623" : "#1f2a33"}" stroke-width="${highlight === "costCenter" ? 2 : 1}"/><text x="636" y="174" fill="#d7dee6" font-size="15" font-family="JetBrains Mono,monospace">${v.costCenter} · ${v.costCenter === "0400" ? "Capex · Machinery" : v.costCenter === "4120" ? "Opex · Freight" : "Opex · Maintenance"}</text><text x="624" y="220" fill="#7f8c99" font-size="13" font-family="Inter,Arial">Approval route</text><rect x="624" y="230" width="296" height="36" fill="#0a0d10" stroke="${highlight === "route" ? "#f5a623" : "#1f2a33"}" stroke-width="${highlight === "route" ? 2 : 1}"/><text x="636" y="254" fill="#d7dee6" font-size="15" font-family="Inter,Arial">${v.route === "second_approval" ? "Second approval (M. Weber)" : "Single approval (S. Koch)"}</text><text x="624" y="300" fill="#7f8c99" font-size="13" font-family="Inter,Arial">Status</text><rect x="624" y="310" width="80" height="32" fill="${v.status === "open" ? "#f5a623" : "#161d24"}" stroke="#1f2a33"/><text x="664" y="331" fill="${v.status === "open" ? "#0a0d10" : "#d7dee6"}" font-size="13" text-anchor="middle" font-family="Inter,Arial">open</text><rect x="712" y="310" width="80" height="32" fill="${v.status === "hold" ? "#ff4d4f" : "#161d24"}" stroke="${highlight === "status" ? "#f5a623" : "#1f2a33"}" stroke-width="${highlight === "status" ? 2 : 1}"/><text x="752" y="331" fill="#d7dee6" font-size="13" text-anchor="middle" font-family="Inter,Arial">hold</text><rect x="800" y="310" width="100" height="32" fill="${v.status === "approved" ? "#f5a623" : "#161d24"}" stroke="#1f2a33"/><text x="850" y="331" fill="${v.status === "approved" ? "#0a0d10" : "#d7dee6"}" font-size="13" text-anchor="middle" font-family="Inter,Arial">approved</text><rect x="624" y="440" width="140" height="36" fill="#f5a623"/><text x="694" y="463" fill="#0a0d10" font-size="14" text-anchor="middle" font-family="Inter,Arial" font-weight="600">Save and post</text></svg>`;
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
  push({ t: 58, source: "dom", kind: "field_changed", invoice: "4471", field: "assetNumber", from: "", to: "A-2026-118", state: { ...toInvoiceState(a), costCenter: "0400", hasAssetNumber: true } });
  push({ t: 96, source: "dom", kind: "save_clicked", invoice: "4471", boundary: true, state: { ...toInvoiceState(a), costCenter: "0400", status: "approved", hasAssetNumber: true }, frame: frameFor(a, 96, { costCenter: "0400", status: "approved" }) });
  push({ t: 101, source: "dom", kind: "invoice_closed", invoice: "4471", boundary: true });
  push({ t: 110, source: "dom", kind: "invoice_opened", invoice: "4472", state: toInvoiceState(b), frame: frameFor(b, 110) });
  push({ t: 131, source: "dom", kind: "route_changed", invoice: "4472", field: "route", from: "single", to: "second_approval", state: { ...toInvoiceState(b), route: "second_approval" }, frame: frameFor(b, 131, { route: "second_approval" }, "route") });
  push({ t: 170, source: "dom", kind: "save_clicked", invoice: "4472", boundary: true, state: { ...toInvoiceState(b), route: "second_approval", status: "approved" } });
  push({ t: 174, source: "dom", kind: "invoice_closed", invoice: "4472", boundary: true });
  push({ t: 182, source: "dom", kind: "invoice_opened", invoice: "4473", state: toInvoiceState(c), frame: frameFor(c, 182) });
  push({ t: 205, source: "dom", kind: "status_changed", invoice: "4473", field: "status", from: "open", to: "hold", state: { ...toInvoiceState(c), status: "hold" }, frame: frameFor(c, 205, { status: "hold" }, "status") });
  push({ t: 240, source: "dom", kind: "save_clicked", invoice: "4473", boundary: true, state: { ...toInvoiceState(c), status: "hold" } });
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
