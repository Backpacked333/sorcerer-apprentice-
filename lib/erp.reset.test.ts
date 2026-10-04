import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./store", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./store")>();
  return {
    ...actual,
    getErpSnapshot: vi.fn(),
    saveErpInvoices: vi.fn(),
  };
});

import { resetErp } from "./erp";
import { seedInvoices } from "./erp-model";
import { getErpSnapshot, saveErpInvoices } from "./store";

function mockSnapshot(invoices: ReturnType<typeof seedInvoices>): void {
  vi.mocked(getErpSnapshot).mockResolvedValue({ invoices, guard: null });
  vi.mocked(saveErpInvoices).mockResolvedValue(undefined);
}

describe("resetErp", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns fresh invoices and saves them when no queue is provided", async () => {
    const stored = seedInvoices();
    stored[0] = { ...stored[0], costCenter: "9999" };
    mockSnapshot(stored);

    const result = await resetErp();

    expect(result).toEqual(seedInvoices());
    expect(getErpSnapshot).toHaveBeenCalledOnce();
    expect(saveErpInvoices).toHaveBeenCalledOnce();
    expect(vi.mocked(saveErpInvoices).mock.calls[0][0]).toBe(result);
  });

  it("returns fresh invoices when the stored queue is empty", async () => {
    mockSnapshot([]);

    const result = await resetErp("newhire");

    expect(result).toEqual(seedInvoices());
  });

  it("resets matching queue invoices while preserving other stored invoices and order", async () => {
    const stored = seedInvoices();
    const storedNewhire = stored.find((invoice) => invoice.id === "4490")!;
    Object.assign(storedNewhire, { costCenter: "9999", status: "approved" });
    const storedExpert = stored.find((invoice) => invoice.id === "4470")!;
    storedExpert.costCenter = "1234";
    mockSnapshot(stored);

    const result = await resetErp("newhire");
    const fresh = seedInvoices();

    expect(result).toHaveLength(stored.length);
    expect(result.map((invoice) => invoice.id)).toEqual(stored.map((invoice) => invoice.id));
    expect(result.find((invoice) => invoice.id === "4490")).toEqual(fresh.find((invoice) => invoice.id === "4490"));
    expect(result.find((invoice) => invoice.id === "4470")?.costCenter).toBe("1234");
    expect(result.find((invoice) => invoice.id === "4470")).toBe(storedExpert);
    expect(vi.mocked(saveErpInvoices).mock.calls[0][0]).toBe(result);
  });

  it("keeps a stored invoice whose id is absent from the seed", async () => {
    const stored = seedInvoices();
    const firstNewhire = stored.find((invoice) => invoice.queue === "newhire")!;
    const extra = { ...firstNewhire, id: "x-missing" };
    stored.push(extra);
    mockSnapshot(stored);

    const result = await resetErp("newhire");

    expect(result.find((invoice) => invoice.id === "x-missing")).toBe(extra);
  });
});
