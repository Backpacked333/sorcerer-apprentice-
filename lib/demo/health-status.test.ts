import { describe, expect, it } from "vitest";
import { healthItems, normalizeSource } from "./health-status";

const body = (o: Record<string, unknown>) => ({ keys: { elevenlabs: false, gateway: false }, agents: { interviewer: false, tutor: false }, storage: { configured: true, reachable: true, backend: "fs" }, ...o });

describe("healthItems", () => {
  it("reads storage reachability from a 503 body", () => {
    const items = healthItems(body({ storage: { configured: true, reachable: false, backend: "supabase" } }), "both");
    expect(items[2]).toEqual({ label: "Storage: unreachable", tone: "amber" });
    expect(healthItems(body({}), "both")[2]).toEqual({ label: "Storage: fs", tone: "green" });
  });

  it("voice is configured only with key and both agent ids, and never claims live", () => {
    expect(healthItems(body({ keys: { elevenlabs: true } }), "both")[0].label).toBe("Voice: browser fallback (no agent ids)");
    expect(healthItems(body({ keys: { elevenlabs: true }, agents: { interviewer: true, tutor: true } }), "both")[0].label).toBe("Voice: ElevenLabs configured");
    expect(healthItems(body({ keys: { elevenlabs: false }, agents: { interviewer: true, tutor: true } }), "both")[0].tone).toBe("amber");
    expect(healthItems(body({ integrations: { voice: { configured: false } }, keys: { elevenlabs: true }, agents: { interviewer: true, tutor: true } }), "both")[0].tone).toBe("amber");
    expect(healthItems(body({}), "both").map((i) => i.label).join(" ")).not.toMatch(/\blive\b(?! provider)/);
  });

  it("vision honours the event source", () => {
    expect(healthItems(body({ keys: { gateway: true } }), "dom")[1].label).toBe("Vision: off · ERP telemetry only");
    expect(healthItems(body({ keys: { gateway: true } }), "both")[1].label).toBe("Vision: Gateway configured + ERP telemetry");
    expect(healthItems(body({ keys: { gateway: true } }), "vision")[1].label).toBe("Vision: Gateway configured");
    expect(healthItems(body({}), "both")[1].tone).toBe("amber");
  });

  it("never claims anything without a body", () => {
    expect(healthItems(null, "both")).toEqual([{ label: "Status unavailable", tone: "neutral" }]);
    expect(normalizeSource(undefined)).toBe("both");
    expect(normalizeSource("dom")).toBe("dom");
  });
});
