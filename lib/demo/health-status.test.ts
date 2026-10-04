import { describe, expect, it } from "vitest";
import { healthItems, normalizeSource } from "./health-status";

const body = (o: Record<string, unknown>) => ({ keys: { elevenlabs: false, gateway: false }, agents: { interviewer: false, tutor: false }, sample: { present: true }, ...o });

describe("healthItems", () => {
  it("reads sample.present from a 503 body", () => {
    const items = healthItems(body({ sample: { present: false } }), "both");
    expect(items[2]).toEqual({ label: "Sample data: missing", tone: "amber" });
  });

  it("voice is live only with key and both agent ids", () => {
    expect(healthItems(body({ keys: { elevenlabs: true } }), "both")[0].label).toBe("Voice: browser fallback (no agent ids)");
    expect(healthItems(body({ keys: { elevenlabs: true }, agents: { interviewer: true, tutor: true } }), "both")[0].label).toBe("Voice: ElevenAgents live");
    expect(healthItems(body({ keys: { elevenlabs: false }, agents: { interviewer: true, tutor: true } }), "both")[0].tone).toBe("amber");
  });

  it("vision honours the event source", () => {
    expect(healthItems(body({ keys: { gateway: true } }), "dom")[1].label).toBe("Vision: off · ERP telemetry only");
    expect(healthItems(body({ keys: { gateway: true } }), "both")[1].label).toBe("Vision: live model + ERP telemetry");
    expect(healthItems(body({ keys: { gateway: true } }), "vision")[1].label).toBe("Vision: live model");
    expect(healthItems(body({}), "both")[1].tone).toBe("amber");
  });

  it("never claims anything without a body", () => {
    expect(healthItems(null, "both")).toEqual([{ label: "Status unavailable", tone: "neutral" }]);
    expect(normalizeSource(undefined)).toBe("both");
    expect(normalizeSource("dom")).toBe("dom");
  });
});
