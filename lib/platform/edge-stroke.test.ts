import { describe, expect, it } from "vitest";
import { EDGE_DASH, edgeStroke, PROV } from "@/components/platform/meta";
import type { Provenance } from "@/lib/platform/types";

const expected: Record<Provenance, { gradient: boolean; dash: string | null }> = {
  said: { gradient: true, dash: null },
  seen: { gradient: false, dash: null },
  erp: { gradient: false, dash: null },
  described: { gradient: false, dash: EDGE_DASH.dashed },
  inferred: { gradient: false, dash: EDGE_DASH.dashed },
  teachback: { gradient: false, dash: EDGE_DASH.dashed },
  mapped: { gradient: false, dash: EDGE_DASH.dotted },
};

describe("edgeStroke", () => {
  it("uses one stroke rule for every provenance", () => {
    for (const prov of Object.keys(PROV) as Provenance[]) {
      expect(edgeStroke(prov)).toEqual({ ...expected[prov], color: PROV[prov].color });
    }
    expect(Object.keys(PROV).filter((prov) => edgeStroke(prov as Provenance).gradient)).toEqual(["said"]);
    expect(edgeStroke("teachback").dash).toBe(EDGE_DASH.dashed);
    expect(edgeStroke("mapped").dash).toBe(EDGE_DASH.dotted);
    expect(edgeStroke("seen").dash).toBeNull();
    expect(edgeStroke("erp").dash).toBeNull();
  });

  it("records a stroke style on every provenance entry", () => {
    for (const prov of Object.keys(PROV) as Provenance[]) {
      expect(PROV[prov].stroke).toBeDefined();
    }
  });
});
