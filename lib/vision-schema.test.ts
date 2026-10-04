import { describe, expect, it } from "vitest";
import { z } from "zod";
import { fromWire, normInvoice, VisionWire, WireState } from "./vision-schema";

const emptyState = Object.fromEntries(Object.keys(WireState.shape).map((key) => [key, null]));
const frame = (state = {}, screen = "invoice_detail", confidence = 0.9) => VisionWire.parse({
  screen, state: { ...emptyState, ...state }, banner: "none", uiActivity: "reading", piiRegions: [], confidence,
});

describe("vision wire contract", () => {
  it("emits only required, flat objects with 14 nullable fields and no provider-unsupported constraints", () => {
    const schema = z.toJSONSchema(VisionWire);
    const visit = (value: unknown) => {
      if (!value || typeof value !== "object") return;
      const node = value as Record<string, unknown>;
      for (const key of ["minimum", "maximum", "exclusiveMinimum", "exclusiveMaximum", "$ref", "$defs"])
        expect(node).not.toHaveProperty(key);
      if (node.type === "object") {
        expect(node.additionalProperties).toBe(false);
        expect(node.required).toEqual(Object.keys(node.properties as object));
      }
      Object.values(node).forEach(visit);
    };
    visit(schema);
    expect(Object.keys(WireState.shape)).toHaveLength(14);
    expect(WireState.safeParse(emptyState).success).toBe(true);
    expect(WireState.safeParse({}).success).toBe(false);
  });

  it.each(["INV-1234", "invoice #1234", " Inv: 1234 ", "1234"])("normalizes %s", (value) => {
    expect(normInvoice(value)).toBe("1234");
  });
  it("drops null and empty identifiers, but preserves zero and false", () => {
    expect(fromWire(frame({ invoice: "INV-", amount: 0, hasAssetNumber: false, hasPO: false })).state)
      .toEqual({ amount: 0, hasAssetNumber: false, hasPO: false });
    expect(normInvoice(null)).toBeUndefined();
  });
  it("normalizes decision fields without losing leading zeros", () => {
    expect(fromWire(frame({ invoice: "INV-1234", costCenter: "0400 Machinery", category: "Credit Note", route: "Second approval", status: "On hold" })).state)
      .toEqual({ invoice: "1234", costCenter: "0400", category: "credit_note", route: "second_approval", status: "hold" });
  });
  it.each(["invoice_list", "other"])("suppresses all invoice data on %s", (screen) => {
    expect(fromWire(frame({ invoice: "INV-1234", status: "posted" }, screen)).state).toEqual({});
  });
  it.each([[1.7, 1], [-0.5, 0], [0.4, 0.4]])("clamps confidence %s locally, not in the wire schema", (input, expected) => {
    expect(fromWire(frame({}, "invoice_detail", input)).confidence).toBe(expected);
  });
});
