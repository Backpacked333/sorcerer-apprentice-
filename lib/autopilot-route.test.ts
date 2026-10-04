import { beforeEach, describe, expect, it, vi } from "vitest";

const store = vi.hoisted(() => ({
  getMap: vi.fn(),
}));
const erp = vi.hoisted(() => ({
  listInvoices: vi.fn(),
  patchInvoice: vi.fn(),
  resetErp: vi.fn(),
}));
const autopilot = vi.hoisted(() => ({
  planInvoice: vi.fn(),
}));
vi.mock("@/lib/store", () => store);
vi.mock("@/lib/erp", () => erp);
vi.mock("@/lib/autopilot", () => autopilot);

import { POST } from "../app/api/autopilot/route";

function req(body?: string) {
  return new Request("http://localhost/api/autopilot", { method: "POST", headers: { "content-type": "application/json" }, body });
}

const confirmedMap = { confirmedAt: "2026-01-01T00:00:00Z" };
const invoices = [
  { id: "inv_1", supplier: "A", amount: 10 },
  { id: "inv_2", supplier: "B", amount: 20 },
];
const appliedStep = { outcome: "applied", action: { status: "hold" }, reason: "Held per rule" };

describe("autopilot request boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    store.getMap.mockResolvedValue(confirmedMap);
    erp.resetErp.mockResolvedValue(invoices);
    erp.listInvoices.mockResolvedValue(invoices);
    erp.patchInvoice.mockResolvedValue(undefined);
    autopilot.planInvoice.mockReturnValue(appliedStep);
  });

  it("rejects invalid JSON with 400 and never touches storage", async () => {
    const response = await POST(req("{"));
    expect(response.status).toBe(400);
    expect(store.getMap).not.toHaveBeenCalled();
  });

  it("rejects an empty body with 400", async () => {
    const response = await POST(req(""));
    expect(response.status).toBe(400);
    expect(store.getMap).not.toHaveBeenCalled();
  });

  it.each([JSON.stringify({}), JSON.stringify({ sessionId: 7 }), "null"])("rejects malformed body %s with 400", async (body) => {
    const response = await POST(req(body));
    expect(response.status).toBe(400);
    expect(store.getMap).not.toHaveBeenCalled();
  });

  it("rejects a non-boolean apply flag with 400", async () => {
    const response = await POST(req(JSON.stringify({ sessionId: "s_1", apply: "no" })));
    expect(response.status).toBe(400);
    expect(store.getMap).not.toHaveBeenCalled();
  });

  it("routes storage failures through jsonError as 500", async () => {
    store.getMap.mockRejectedValue(new Error("boom"));
    const response = await POST(req(JSON.stringify({ sessionId: "s_1" })));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "storage unavailable" });
  });

  it("maps InvalidIdError to 400", async () => {
    const err = new Error("bad id");
    err.name = "InvalidIdError";
    store.getMap.mockRejectedValue(err);
    const response = await POST(req(JSON.stringify({ sessionId: "s_1" })));
    expect(response.status).toBe(400);
  });

  it("returns 404 when there is no map", async () => {
    store.getMap.mockResolvedValue(null);
    const response = await POST(req(JSON.stringify({ sessionId: "s_1" })));
    expect(response.status).toBe(404);
  });

  it("returns 409 for an unconfirmed map without resetting the ERP", async () => {
    store.getMap.mockResolvedValue({});
    const response = await POST(req(JSON.stringify({ sessionId: "s_1" })));
    expect(response.status).toBe(409);
    expect(erp.resetErp).not.toHaveBeenCalled();
  });

  it("applies every invoice by default and reports remaining 0", async () => {
    const response = await POST(req(JSON.stringify({ sessionId: "s_1" })));
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.steps).toHaveLength(2);
    expect(json.remaining).toBe(0);
    expect(erp.patchInvoice).toHaveBeenCalledTimes(2);
    expect(erp.patchInvoice).toHaveBeenCalledWith("inv_1", appliedStep.action);
  });

  it("does not patch invoices when apply is false", async () => {
    const response = await POST(req(JSON.stringify({ sessionId: "s_1", apply: false })));
    expect(response.status).toBe(200);
    expect(erp.patchInvoice).not.toHaveBeenCalled();
  });

  it("stops the loop when a step halts", async () => {
    autopilot.planInvoice.mockReturnValueOnce({ outcome: "halted", reason: "Stop" }).mockReturnValueOnce(appliedStep);
    const response = await POST(req(JSON.stringify({ sessionId: "s_1" })));
    const json = await response.json();
    expect(json.steps).toHaveLength(1);
    expect(json.remaining).toBe(1);
    expect(autopilot.planInvoice).toHaveBeenCalledTimes(1);
  });
});
