import { describe, expect, it } from "vitest";
import { seedInvoices } from "./erp-model";
import { canCommit, commitStatus, proposedState, statusBadge, textCommit } from "./erp-ui";

describe("erp-ui", () => {
  it("ignores unchanged and whitespace-only text edits", () => {
    expect(textCommit("assetNumber", "A-1", "A-1")).toBeNull();
    expect(textCommit("assetNumber", "A-1", "  A-1  ")).toBeNull();
    expect(textCommit("notes", "  hello  ", "hello")).toBeNull();
  });

  it("reports one trimmed change and never the note text", () => {
    expect(textCommit("assetNumber", "", "A-2025-118")).toEqual({ from: "", to: "A-2025-118" });
    const notes = textCommit("notes", "", "do not broadcast this");
    expect(notes).toEqual({ from: "", to: "(note, 21 chars)" });
    expect(JSON.stringify(notes)).not.toContain("do not broadcast");
  });

  it("commits hold only for a held draft", () => {
    expect(commitStatus({ status: "hold" })).toBe("hold");
    expect(commitStatus({ status: "open" })).toBe("posted");
    expect(commitStatus({ status: "posted" })).toBe("posted");
  });

  it("requires a cost center to post and not to hold", () => {
    expect(canCommit({ status: "open", costCenter: "" })).toEqual({
      ok: false,
      field: "costCenter",
      message: "Choose a cost center before posting.",
    });
    expect(canCommit({ status: "hold", costCenter: "  " })).toEqual({ ok: true });
    expect(canCommit({ status: "open", costCenter: "4711" })).toEqual({ ok: true });
  });

  it("proposes the commit status and no personal-data keys", () => {
    const inv = seedInvoices().find((i) => i.id === "4471")!;
    const state = proposedState(inv);
    expect(state.status).toBe("posted");
    for (const key of Object.keys(state)) expect(key).not.toMatch(/contact|iban|email|phone/i);
  });

  it("renders an old approved row as POSTED", () => {
    expect(statusBadge("approved").label).toBe("POSTED");
    expect(statusBadge("hold").label).toBe("ON HOLD");
    expect(statusBadge("open").label).toBe("OPEN");
  });
});
