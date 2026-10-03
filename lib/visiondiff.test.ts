import { describe, expect, it } from "vitest";
import { diffVision, type VisionFrame } from "./visiondiff";

const detail = (state: VisionFrame["state"] = {}, extra: Partial<VisionFrame> = {}): VisionFrame => ({ screen: "invoice_detail", state: { invoice: "1001", status: "open", ...state }, banner: "none", confidence: 1, ...extra });
const saves = (prev: VisionFrame, next: VisionFrame) => diffVision(prev, next).specs.filter((s) => s.kind === "save_clicked");

describe("visual observations only", () => {
  it("ignores list rows before invoice detection, closes once, and never invents an opening", () => {
    const list = detail({ invoice: "INV-2002" }, { screen: "invoice_list" });
    expect(diffVision(null, list).specs).toEqual([]);
    const result = diffVision(detail(), list);
    expect(result.state).toEqual({}); expect(result.specs).toMatchObject([{ kind: "invoice_closed", invoice: "1001", boundary: true }]);
    expect(diffVision(result.frame, list).specs).toEqual([]);
  });
  it("normalizes invoice prefixes without false close/open boundaries", () => {
    for (const invoice of ["INV-1001", "invoice #1001", "Inv: 1001", " 1001 "])
      expect(diffVision(detail(), detail({ invoice })).specs).toEqual([]);
    expect(diffVision(detail(), detail({ invoice: " INV- " })).specs).toEqual([]);
    expect(diffVision(detail(), detail({ invoice: "INV-2002" })).specs.map((e) => [e.kind, e.invoice])).toEqual([["invoice_closed", "1001"], ["invoice_opened", "2002"]]);
  });
  it.each([{ screen: "other" }, { confidence: 0.3 }])("ignores uncertain frames: %j", (extra) => {
    const prev = detail(); expect(diffVision(prev, detail({ invoice: "2002" }, extra))).toMatchObject({ specs: [], state: prev.state, frame: prev });
  });
  it.each([true, false])("reports asset presence as entered/cleared, not a boolean decision (%s)", (present) => {
    const { specs } = diffVision(detail({ hasAssetNumber: !present }), detail({ hasAssetNumber: present }));
    expect(specs).toMatchObject([{ kind: "field_changed", field: "assetNumber", to: present ? "entered" : "cleared", source: "vision" }]);
    expect(specs[0]).not.toHaveProperty("from");
  });
  it("diffs known decision fields and keeps unread values without phantom edits", () => {
    const prev = detail({ costCenter: "010", route: "single" });
    expect(diffVision(prev, detail({ costCenter: "020", route: "second_approval", status: "On hold" })).specs.map((s) => s.kind)).toEqual(["field_changed", "route_changed", "status_changed"]);
    const result = diffVision(prev, detail({ costCenter: null } as unknown as VisionFrame["state"]));
    expect(result.specs).toEqual([]); expect(result.state.costCenter).toBe("010");
  });
  it("requires observed success, not status alone, an open dialog, cancel, or blocked banner", () => {
    const dialog = detail({}, { screen: "confirm_dialog" });
    expect(saves(detail(), detail({ status: "posted" }))).toEqual([]);
    expect(saves(detail(), dialog)).toEqual([]); expect(saves(dialog, detail())).toEqual([]);
    expect(saves(dialog, detail({ status: "posted" }, { banner: "blocked" }))).toEqual([]);
    expect(saves(dialog, detail({ invoice: "2002", status: "posted" }))).toEqual([]);
    expect(saves(dialog, detail({}, { screen: "invoice_list" }))).toEqual([]);
    expect(saves(dialog, detail({ status: "posted" }))).toHaveLength(1);
    expect(diffVision(dialog, detail({}, { banner: "blocked" })).specs).toEqual([]);
  });
  it("deduplicates dialog success then delayed/persistent Posted banners", () => {
    const first = diffVision(detail({}, { screen: "confirm_dialog" }), detail({ status: "saved" }));
    const banner = detail({ status: "posted" }, { banner: "posted" });
    let prev = first.frame;
    for (let i = 0; i < 10; i++) { const result = diffVision(prev, banner); expect(result.specs.filter((s) => s.kind === "save_clicked")).toEqual([]); prev = result.frame; }
    expect(saves(detail(), banner)).toHaveLength(1);
    expect(saves(detail(), detail({}, { screen: "invoice_list", banner: "posted" }))).toHaveLength(1);
  });
  it("emits no phantom events for ten identical frames or reappearing success banners", () => {
    const frame = detail({ costCenter: "010", hasAssetNumber: true });
    let prev = diffVision(null, frame).frame;
    for (let i = 0; i < 10; i++) { const result = diffVision(prev, frame); expect(result.specs).toEqual([]); prev = result.frame; }
    prev = diffVision(prev, { ...frame, banner: "posted" }).frame;
    prev = diffVision(prev, frame).frame;
    expect(diffVision(prev, { ...frame, banner: "posted" }).specs).toEqual([]);
  });
});
