import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { COST_CENTERS, sandboxPersonNames, seedInvoices, toInvoiceState } from "./erp-model";
import { redactText } from "./redact";

const invoices = seedInvoices();
const by = (id: string) => invoices.find((i) => i.id === id)!;
const codes = new Set(COST_CENTERS.map((c) => c.code));

describe("scenario", () => {
  it("keeps the expert queue in work order", () => {
    expect(invoices.filter((i) => i.queue === "expert").map((i) => i.id)).toEqual(["4470", "4471", "4472", "4473", "4474"]);
  });

  it("keeps the original three expert invoices", () => {
    expect(by("4471")).toMatchObject({ supplier: "Müller Werkzeugbau GmbH", entity: "parent", amount: 7850, category: "equipment", costCenter: "4711" });
    expect(by("4472")).toMatchObject({ supplier: "Novak Logistik s.r.o.", entity: "subsidiary", amount: 2300, category: "freight", costCenter: "4120" });
    expect(by("4473")).toMatchObject({ supplier: "Bäcker Elektrotechnik GmbH", entity: "parent", amount: 1180, category: "maintenance", costCenter: "4711" });
  });

  it("starts every new-hire invoice with nothing decided", () => {
    for (const inv of invoices.filter((i) => i.queue === "newhire")) {
      expect(inv.costCenter).toBe("");
      expect(toInvoiceState(inv).costCenter).toBeUndefined();
    }
  });

  it("uses only known cost centers on expert and autopilot invoices", () => {
    for (const inv of invoices.filter((i) => i.queue !== "newhire")) expect(codes.has(inv.costCenter)).toBe(true);
  });

  it("dates every invoice in late 2025", () => {
    for (const inv of invoices) expect(inv.date).toMatch(/^2025-1[12]-/);
    expect(toInvoiceState(by("4473")).invoiceMonth).toBe(12);
  });

  it("marks personal data on expert and new-hire invoices and keeps it out of InvoiceState", () => {
    for (const inv of invoices.filter((i) => i.queue !== "autopilot")) {
      expect(inv.contactName && inv.contactEmail && inv.contactPhone && inv.iban).toBeTruthy();
      expect(redactText(inv.iban!).entities.some((e) => e.kind === "iban")).toBe(true);
      expect(redactText(inv.contactEmail!).entities.some((e) => e.kind === "email")).toBe(true);
      for (const key of Object.keys(toInvoiceState(inv))) expect(key).not.toMatch(/contact|iban|email|phone/i);
    }
    expect(sandboxPersonNames().length).toBe(10);
  });

  it("keeps the autopilot queue, including the unknown supplier", () => {
    expect(invoices.filter((i) => i.queue === "autopilot").map((i) => i.id)).toEqual(["4501", "4502", "4503", "4504", "4505"]);
    expect(by("4502").assetNumber).toBe("A-2025-117");
    expect(by("4505").knownSupplier).toBe(false);
  });

  it("does not export an approver list", () => {
    expect(readFileSync(new URL("./erp-model.ts", import.meta.url), "utf8")).not.toMatch(/APPROVERS/);
  });
});
