import { describe, expect, it } from "vitest";
import { seedInvoices } from "./erp-model";
import { confirmCopy, matchesQuery, money, progressLine, queueAvatar, queueOf, QUEUE_LABEL } from "./erp-ui";

const inv = { id: "4471", status: "open", costCenter: "4711", route: "single" };

describe("erp-ui confirm popover copy", () => {
  it("says Post for a post decision", () => {
    expect(confirmCopy(inv)).toBe("Post INV-4471 to cost center 4711, single approval?");
  });

  it("says Hold for a held draft (no longer Post)", () => {
    const copy = confirmCopy({ ...inv, status: "hold", route: "second_approval" });
    expect(copy).toBe("Hold INV-4471 for review, cost center 4711, second approval?");
    expect(copy).not.toMatch(/\bpost\b/i);
  });

  it("shows a dash for an empty cost center", () => {
    expect(confirmCopy({ ...inv, costCenter: "  " })).toContain("cost center —,");
  });

  it("never contains confirm or posted, so smoke text selectors stay unambiguous", () => {
    for (const status of ["open", "hold"]) {
      const copy = confirmCopy({ ...inv, status });
      expect(copy).not.toMatch(/confirm/i);
      expect(copy).not.toMatch(/posted/i);
      expect(copy).not.toMatch(/post invoice/i);
    }
  });
});

describe("erp-ui shell helpers", () => {
  it("falls back to the expert queue", () => {
    expect(queueOf("newhire")).toBe("newhire");
    expect(queueOf("bogus")).toBe("expert");
    expect(queueOf(undefined)).toBe("expert");
    expect(QUEUE_LABEL.expert).toBe("Invoice queue · expert");
  });

  it("uses neutral role initials, never a name", () => {
    expect(queueAvatar("expert").initials).toBe("AP");
    expect(queueAvatar("newhire").initials).toBe("NH");
    expect(queueAvatar("autopilot").initials).toBe("AG");
  });

  it("formats money with two decimals and a leading minus", () => {
    expect(money(7850)).toBe("€7,850.00");
    expect(money(-420)).toBe("-€420.00");
  });

  it("builds the progress line from real counts and mode", () => {
    expect(progressLine({ position: 2, total: 5, remainingOpen: 4 })).toBe("2 of 5 · 4 still open");
    expect(progressLine({ position: 1, total: 5, remainingOpen: 5 }, "coached")).toBe("1 of 5 · 5 still open · coached");
  });

  it("filters the queue by bill number, vendor and description", () => {
    const all = seedInvoices().filter((i) => i.queue === "expert");
    expect(all.filter((i) => matchesQuery(i, "")).length).toBe(all.length);
    expect(all.filter((i) => matchesQuery(i, "INV-4471")).map((i) => i.id)).toEqual(["4471"]);
    expect(all.filter((i) => matchesQuery(i, "4471")).map((i) => i.id)).toEqual(["4471"]);
    expect(all.filter((i) => matchesQuery(i, "müller spindle")).map((i) => i.id)).toEqual(["4471"]);
    expect(all.filter((i) => matchesQuery(i, "zzz-nothing")).length).toBe(0);
  });
});
