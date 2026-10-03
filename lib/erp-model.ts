/**
 * The sandbox ERP model: types, cost centers and the seeded invoices. Pure, safe to import from client components.
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
  /** new-hire queue only: coached cases get the tutor's help; independent ones answer Apprentice Test 4 */
  mode?: "coached" | "independent";
}

export const COST_CENTERS: { code: string; label: string }[] = [
  { code: "4711", label: "Opex · Maintenance and repairs" },
  { code: "0400", label: "Capex · Machinery and equipment" },
  { code: "4120", label: "Opex · Freight and logistics" },
  { code: "4300", label: "Opex · Facilities and cleaning" },
  { code: "4050", label: "Opex · Consumables" },
];

export const APPROVERS = ["Sabine Koch (AP)", "Markus Weber (Group controller)", "Petra Lang (AP lead)"];

export function seedInvoices(): Invoice[] {
  return [
    // ---- the expert's queue: three invoices, one hidden judgment call each ----
    { id: "4471", supplier: "Müller Werkzeugbau GmbH", entity: "parent", amount: 7850, currency: "EUR", date: "2026-11-26", description: "CNC spindle unit, type SK40, incl. installation", category: "equipment", costCenter: "4711", route: "single", status: "open", hasPO: true, poNumber: "PO-88213", knownSupplier: true, queue: "expert" },
    { id: "4472", supplier: "Novak Logistik s.r.o.", entity: "subsidiary", amount: 2300, currency: "EUR", date: "2026-11-27", description: "Intercompany freight, Brno to Stuttgart, November", category: "freight", costCenter: "4120", route: "single", status: "open", hasPO: true, poNumber: "PO-88240", knownSupplier: true, queue: "expert" },
    { id: "4473", supplier: "Bäcker Elektrotechnik GmbH", entity: "parent", amount: 1180, currency: "EUR", date: "2026-12-02", description: "Preventive maintenance, hall 2 switchgear", category: "maintenance", costCenter: "4711", route: "single", status: "open", hasPO: true, poNumber: "PO-88102", knownSupplier: true, queue: "expert" },
    // ---- the new hire's queue: cases the expert never showed ----
    { id: "4490", supplier: "Hoffmann Maschinen GmbH", entity: "parent", amount: 7200, currency: "EUR", date: "2026-12-03", description: "Hydraulic press controller, replacement unit", category: "equipment", costCenter: "4711", route: "single", status: "open", hasPO: true, poNumber: "PO-88301", knownSupplier: true, queue: "newhire", mode: "coached" },
    { id: "4491", supplier: "Schmidt Reinigung GmbH", entity: "parent", amount: 640, currency: "EUR", date: "2026-12-04", description: "Office cleaning, December", category: "cleaning", costCenter: "4300", route: "single", status: "open", hasPO: true, poNumber: "PO-88150", knownSupplier: true, queue: "newhire", mode: "coached" },
    { id: "4492", supplier: "Müller Werkzeugbau GmbH", entity: "parent", amount: -420, currency: "EUR", date: "2026-12-04", description: "Credit note: returned tool holders", category: "credit_note", costCenter: "4711", route: "single", status: "open", hasPO: false, knownSupplier: true, queue: "newhire", mode: "coached" },
    // ---- independent follow-up: the tutor stays quiet; help, if any, is recorded before the decision ----
    { id: "4493", supplier: "Krüger Automation GmbH", entity: "parent", amount: 8900, currency: "EUR", date: "2026-12-05", description: "Robot gripper unit with controller", category: "equipment", costCenter: "4711", route: "single", status: "open", hasPO: true, poNumber: "PO-88322", knownSupplier: true, queue: "newhire", mode: "independent" },
    { id: "4494", supplier: "Novak Logistik s.r.o.", entity: "subsidiary", amount: 2750, currency: "EUR", date: "2026-12-05", description: "Intercompany freight, Brno to Stuttgart, December", category: "freight", costCenter: "4120", route: "single", status: "open", hasPO: true, poNumber: "PO-88330", knownSupplier: true, queue: "newhire", mode: "independent" },
    // ---- the autopilot queue: four routine, one that must stop ----
    { id: "4501", supplier: "Schmidt Reinigung GmbH", entity: "parent", amount: 640, currency: "EUR", date: "2026-12-05", description: "Office cleaning, hall 1", category: "cleaning", costCenter: "4300", route: "single", status: "open", hasPO: true, poNumber: "PO-88160", knownSupplier: true, queue: "autopilot" },
    { id: "4502", supplier: "Müller Werkzeugbau GmbH", entity: "parent", amount: 9400, currency: "EUR", date: "2026-12-05", description: "Tool changer module", category: "equipment", costCenter: "4711", route: "single", status: "open", hasPO: true, poNumber: "PO-88305", assetNumber: "A-2026-117", knownSupplier: true, queue: "autopilot" },
    { id: "4503", supplier: "Novak Logistik s.r.o.", entity: "subsidiary", amount: 1950, currency: "EUR", date: "2026-12-05", description: "Intercompany freight, December week 1", category: "freight", costCenter: "4120", route: "single", status: "open", hasPO: true, poNumber: "PO-88310", knownSupplier: true, queue: "autopilot" },
    { id: "4504", supplier: "Bäcker Elektrotechnik GmbH", entity: "parent", amount: 1180, currency: "EUR", date: "2026-12-06", description: "Preventive maintenance, hall 3", category: "maintenance", costCenter: "4711", route: "single", status: "open", hasPO: true, poNumber: "PO-88103", knownSupplier: true, queue: "autopilot" },
    { id: "4505", supplier: "Zenith Industrietechnik UG", entity: "parent", amount: 6100, currency: "EUR", date: "2026-12-06", description: "Laser alignment kit", category: "equipment", costCenter: "4711", route: "single", status: "open", hasPO: true, poNumber: "PO-88330", knownSupplier: false, queue: "autopilot" },
  ];
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
    costCenter: inv.costCenter,
    route: inv.route,
    status: inv.status,
    hasAssetNumber: !!inv.assetNumber,
    knownSupplier: inv.knownSupplier,
    hasPO: inv.hasPO,
    description: inv.description,
  };
}
