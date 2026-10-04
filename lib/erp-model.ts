/**
 * The sandbox ERP model: types, cost centers and the seeded invoices. Pure, safe to import from client components.
 * This file holds invoice fields. It does not hold business reasons.
 */
import type { InvoiceState } from "./workmap";

export type Queue = "expert" | "newhire" | "autopilot";

export interface Invoice {
  id: string;
  supplier: string;
  entity: "parent" | "subsidiary";
  amount: number;
  currency: "EUR";
  date: string; // ISO date
  description: string;
  category: "equipment" | "freight" | "maintenance" | "cleaning" | "credit_note" | "consumables";
  costCenter: string;
  route: "single" | "second_approval";
  status: "open" | "approved" | "hold" | "posted";
  hasPO: boolean;
  poNumber?: string;
  assetNumber?: string;
  knownSupplier: boolean;
  queue: Queue;
  notes?: string;
  /** new-hire queue only: coached or independent */
  mode?: "coached" | "independent";
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  iban?: string;
}

export const COST_CENTERS: { code: string; label: string }[] = [
  { code: "4711", label: "Opex · Maintenance and repairs" },
  { code: "0400", label: "Capex · Machinery and equipment" },
  { code: "4120", label: "Opex · Freight and logistics" },
  { code: "4300", label: "Opex · Facilities and cleaning" },
  { code: "4050", label: "Opex · Consumables" },
];

function person(name: string, email: string, phone: string, iban: string): Pick<Invoice, "contactName" | "contactEmail" | "contactPhone" | "iban"> {
  return { contactName: name, contactEmail: email, contactPhone: phone, iban };
}

export function seedInvoices(): Invoice[] {
  return [
    // expert queue
    { id: "4470", supplier: "Schmidt Reinigung GmbH", entity: "parent", amount: 640, currency: "EUR", date: "2025-11-25", description: "Office cleaning, November", category: "cleaning", costCenter: "4300", route: "single", status: "open", hasPO: true, poNumber: "PO-88140", knownSupplier: true, queue: "expert", ...person("Petra Klein", "petra.klein@schmidt-reinigung.example", "+49 711 555 0100", "DE00 6005 0101 0000 4470 01") },
    { id: "4471", supplier: "Müller Werkzeugbau GmbH", entity: "parent", amount: 7850, currency: "EUR", date: "2025-11-26", description: "CNC spindle unit, type SK40, incl. installation", category: "equipment", costCenter: "4711", route: "single", status: "open", hasPO: true, poNumber: "PO-88213", knownSupplier: true, queue: "expert", ...person("Jonas Meier", "jonas.meier@mueller-werkzeug.example", "+49 711 555 0101", "DE00 6005 0101 0000 4471 01") },
    { id: "4472", supplier: "Novak Logistik s.r.o.", entity: "subsidiary", amount: 2300, currency: "EUR", date: "2025-11-27", description: "Intercompany freight, Brno to Stuttgart, November", category: "freight", costCenter: "4120", route: "single", status: "open", hasPO: true, poNumber: "PO-88240", knownSupplier: true, queue: "expert", ...person("Alena Horak", "alena.horak@novak-logistik.example", "+49 711 555 0102", "CZ00 0800 0000 0000 0044 7201") },
    { id: "4473", supplier: "Bäcker Elektrotechnik GmbH", entity: "parent", amount: 1180, currency: "EUR", date: "2025-12-02", description: "Preventive maintenance, hall 2 switchgear", category: "maintenance", costCenter: "4711", route: "single", status: "open", hasPO: true, poNumber: "PO-88102", knownSupplier: true, queue: "expert", ...person("Ines Vogel", "ines.vogel@baecker-elektro.example", "+49 711 555 0103", "DE00 6005 0101 0000 4473 01") },
    { id: "4474", supplier: "Hartmann Werkzeuge GmbH", entity: "parent", amount: 1460, currency: "EUR", date: "2025-11-28", description: "Bench vise and clamping set, assembly station 3", category: "equipment", costCenter: "4711", route: "single", status: "open", hasPO: true, poNumber: "PO-88220", knownSupplier: true, queue: "expert", ...person("Lukas Berger", "lukas.berger@hartmann-werkzeuge.example", "+49 711 555 0104", "DE00 6005 0101 0000 4474 01") },
    // new-hire queue: coached
    { id: "4490", supplier: "Hoffmann Maschinen GmbH", entity: "parent", amount: 7200, currency: "EUR", date: "2025-12-03", description: "Hydraulic press controller, replacement unit", category: "equipment", costCenter: "", route: "single", status: "open", hasPO: true, poNumber: "PO-88301", knownSupplier: true, queue: "newhire", mode: "coached", ...person("Mira Keller", "mira.keller@hoffmann-maschinen.example", "+49 711 555 0105", "DE00 6005 0101 0000 4490 01") },
    { id: "4491", supplier: "Schmidt Reinigung GmbH", entity: "parent", amount: 640, currency: "EUR", date: "2025-12-04", description: "Office cleaning, December", category: "cleaning", costCenter: "", route: "single", status: "open", hasPO: true, poNumber: "PO-88150", knownSupplier: true, queue: "newhire", mode: "coached", ...person("Sven Oster", "sven.oster@schmidt-reinigung.example", "+49 711 555 0106", "DE00 6005 0101 0000 4491 01") },
    { id: "4492", supplier: "Müller Werkzeugbau GmbH", entity: "parent", amount: -420, currency: "EUR", date: "2025-12-04", description: "Credit note: returned tool holders", category: "credit_note", costCenter: "", route: "single", status: "open", hasPO: false, knownSupplier: true, queue: "newhire", mode: "coached", ...person("Klara Weiss", "klara.weiss@mueller-werkzeug.example", "+49 711 555 0107", "DE00 6005 0101 0000 4492 01") },
    // new-hire queue: independent
    { id: "4493", supplier: "Krüger Automation GmbH", entity: "parent", amount: 8900, currency: "EUR", date: "2025-12-05", description: "Robot gripper unit with controller", category: "equipment", costCenter: "", route: "single", status: "open", hasPO: true, poNumber: "PO-88322", knownSupplier: true, queue: "newhire", mode: "independent", ...person("Nils Adler", "nils.adler@krueger-automation.example", "+49 711 555 0108", "DE00 6005 0101 0000 4493 01") },
    { id: "4494", supplier: "Novak Logistik s.r.o.", entity: "subsidiary", amount: 2750, currency: "EUR", date: "2025-12-05", description: "Intercompany freight, Brno to Stuttgart, December", category: "freight", costCenter: "", route: "single", status: "open", hasPO: true, poNumber: "PO-88330", knownSupplier: true, queue: "newhire", mode: "independent", ...person("Eva Soukup", "eva.soukup@novak-logistik.example", "+49 711 555 0109", "DE00 6005 0101 0000 4494 01") },
    // autopilot queue
    { id: "4501", supplier: "Schmidt Reinigung GmbH", entity: "parent", amount: 640, currency: "EUR", date: "2025-12-05", description: "Office cleaning, hall 1", category: "cleaning", costCenter: "4300", route: "single", status: "open", hasPO: true, poNumber: "PO-88160", knownSupplier: true, queue: "autopilot" },
    { id: "4502", supplier: "Müller Werkzeugbau GmbH", entity: "parent", amount: 9400, currency: "EUR", date: "2025-12-05", description: "Tool changer module", category: "equipment", costCenter: "4711", route: "single", status: "open", hasPO: true, poNumber: "PO-88305", assetNumber: "A-2025-117", knownSupplier: true, queue: "autopilot" },
    { id: "4503", supplier: "Novak Logistik s.r.o.", entity: "subsidiary", amount: 1950, currency: "EUR", date: "2025-12-05", description: "Intercompany freight, December week 1", category: "freight", costCenter: "4120", route: "single", status: "open", hasPO: true, poNumber: "PO-88310", knownSupplier: true, queue: "autopilot" },
    { id: "4504", supplier: "Bäcker Elektrotechnik GmbH", entity: "parent", amount: 1180, currency: "EUR", date: "2025-12-06", description: "Preventive maintenance, hall 3", category: "maintenance", costCenter: "4711", route: "single", status: "open", hasPO: true, poNumber: "PO-88103", knownSupplier: true, queue: "autopilot" },
    { id: "4505", supplier: "Zenith Industrietechnik UG", entity: "parent", amount: 6100, currency: "EUR", date: "2025-12-06", description: "Laser alignment kit", category: "equipment", costCenter: "4711", route: "single", status: "open", hasPO: true, poNumber: "PO-88340", knownSupplier: false, queue: "autopilot" },
  ];
}

/** Seeded contact names, for name redaction (lane B). */
export function sandboxPersonNames(): string[] {
  return seedInvoices().map((inv) => inv.contactName).filter((n): n is string => !!n);
}

export function toInvoiceState(inv: Invoice): InvoiceState {
  return {
    invoice: inv.id,
    supplier: inv.supplier,
    entity: inv.entity,
    amount: inv.amount,
    category: inv.category,
    invoiceMonth: Number(inv.date.slice(5, 7)),
    invoiceDate: inv.date,
    costCenter: inv.costCenter || undefined,
    route: inv.route,
    status: inv.status,
    hasAssetNumber: !!inv.assetNumber,
    knownSupplier: inv.knownSupplier,
    hasPO: inv.hasPO,
    description: inv.description,
  };
}
