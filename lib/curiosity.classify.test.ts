import { describe, expect, it } from "vitest";
import { buildCandidates, classifyEvent, newContext } from "./curiosity";
import type { ScreenEvent } from "./events";

const event = (partial: Partial<ScreenEvent> & Pick<ScreenEvent, "kind">): ScreenEvent => ({
  id: "event",
  source: "dom",
  t: 10,
  ...partial,
});

describe("curiosity classification hardening", () => {
  it.each(["notes", "note", "assetNumber", "hasAssetNumber", "description"])(
    "treats the free-text field %s as non-judgment",
    (field) => {
      expect(classifyEvent(event({ kind: "field_changed", field, from: "old", to: "new" }), newContext()).value).toBe(0);
    },
  );

  it("rejects typing activity and incremental prefix edits", () => {
    const context = newContext();
    expect(classifyEvent(event({ kind: "field_changed", field: "custom", from: "No", to: "Nov", uiActivity: "typing" }), context).value).toBe(0);
    expect(classifyEvent(event({ kind: "field_changed", field: "custom", from: "No", to: "Nov" }), context).value).toBe(0);
    expect(classifyEvent(event({ kind: "field_changed", field: "custom", from: "November", to: "Nov" }), context).value).toBe(0);
  });

  it("does not invent an amount threshold before the expert names one", () => {
    const context = newContext();
    const opened = event({ kind: "invoice_opened", invoice: "9001", state: { amount: 8000, knownSupplier: true } });
    expect(classifyEvent(opened, context).value).toBe(0);
    expect(buildCandidates(opened, context, 10)).toEqual([]);
  });
});
