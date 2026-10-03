import { describe, expect, it } from "vitest";
import { buildAgentSessionOptions } from "@/components/voice";

describe("voice connection options", () => {
  it("always supplies safe dynamic-variable defaults and lets session values override them", () => {
    const options = buildAgentSessionOptions("agent_123", {
      dynamicVariables: { expert_name: "Ada", task: "reviewing claims" },
    });
    expect(options).toMatchObject({
      agentId: "agent_123",
      connectionType: "webrtc",
      dynamicVariables: { expert_name: "Ada", newhire_name: "the new hire", task: "reviewing claims" },
    });
  });
  it("omits empty overrides instead of sending blank fields", () => {
    const options = buildAgentSessionOptions("agent_123", { firstMessage: "", prompt: "", language: "" });
    expect(options).not.toHaveProperty("overrides");
  });
  it("includes only non-empty overrides", () => {
    const options = buildAgentSessionOptions("agent_123", {
      firstMessage: "Ready when you are.", prompt: "Use this session context.", language: "en",
    });
    expect(options).toMatchObject({
      overrides: {
        agent: {
          firstMessage: "Ready when you are.", prompt: { prompt: "Use this session context." }, language: "en",
        },
      },
    });
  });
});
