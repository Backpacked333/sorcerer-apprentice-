import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import Home from "@/app/page";
import { Meter } from "@/components/Meter";
import { WorkMapView } from "@/components/WorkMapView";
import type { Decision } from "./governor";
import { WorkMapSchema } from "./workmap";

const map = WorkMapSchema.parse({
  sessionId: "presentation-test", task: "Inspect a returned item", expert: { name: "Alex" }, privacy: {},
  steps: [{ id: "inspect", index: 0, title: "Inspect the label", judgment: true, screenMoment: { t: 12 },
    action: { type: "open" }, decision: "Check the label before proceeding",
    reason: { text: "I check the label first.", source: "live", t: 14 },
    guardrails: [{ id: "ask", kind: "escalation", text: "Ask if the label cannot be read",
      quote: { text: "If I cannot read it, I ask the team.", source: "debrief", t: 30 } }],
  }],
  rules: [], slots: [{ id: "limit", kind: "limit", question: "What is the limit?", status: "open" }],
});
const renderMap = (value = map, editable = false) => renderToStaticMarkup(createElement(WorkMapView, {
  map: value, frames: [], sessionId: value.sessionId, editable, onChange: () => {},
}));

describe("knowledge-first presentation", () => {
  it("keeps all entry paths and clearly labels keyless mode", () => {
    const html = renderToStaticMarkup(createElement(Home));
    for (const path of ["/map", "/capture", "/teach", "/erp"]) expect(html).toContain(`href="${path}"`);
    expect(html).toContain("Explore Work Maps");
    expect(html).toContain("Keyless mode uses ERP telemetry and browser speech");
  });

  it("puts the decision and literal evidence before the screen moment", () => {
    const html = renderMap();
    expect(html.indexOf(map.steps[0].decision)).toBeLessThan(html.indexOf("The screen moment"));
    expect(html).toContain(`“${map.steps[0].reason!.text}”`);
    expect(html).toContain(`“${map.steps[0].guardrails[0].quote!.text}”`);
    expect(html).not.toContain(`“${map.steps[0].guardrails[0].text}”`);
    expect(html).toContain("described by the expert; not directly demonstrated");
    expect(html).toContain('aria-current="step"');
  });

  it("reports draft state, counts, missing evidence and read-only controls honestly", () => {
    const html = renderMap();
    expect(html).toContain("Draft · awaiting expert confirmation");
    expect(html).toContain("1 recorded step · 1 explanation");
    expect(html).toContain("1 guardrail · 1 open follow-up");
    expect(html).toContain("No screen evidence attached to this step.");
    expect(html).not.toContain("delete step");
    expect(html).not.toContain("remove quote");
    expect(renderMap({ ...map, confirmedAt: 100 })).toContain("Expert-confirmed map");
    expect(renderMap(map, true)).toContain("delete step");
  });

  it("leaves missing explanations and guardrail quotes explicit", () => {
    const html = renderMap({ ...map, steps: [{ ...map.steps[0], reason: undefined,
      guardrails: [{ ...map.steps[0].guardrails[0], quote: undefined }] }] });
    expect(html).toContain("Not yet explained");
    expect(html).toContain("No expert quote attached.");
    expect(renderMap({ ...map, steps: [] })).toContain("No steps compiled yet.");
  });
});

describe("quiet observation presence", () => {
  it("does not invent a listening state before receiving a decision", () => {
    const html = renderToStaticMarkup(createElement(Meter, { questions: 0, budget: 3 }));
    expect(html).toContain('data-state="unavailable"');
    expect(html).toContain("Waiting for observation state");
    expect(html).toContain("No timing information yet.");
    expect(html).not.toContain("listening");
  });

  it.each(["listening", "waiting", "asking", "answering"] as const)("reflects %s without decorative activity", (state) => {
    const decision: Decision = { state, interruptible: false, boundaryBonus: 0, reasons: [],
      lights: { silence: false, still: false, notTyping: false, notReading: false, budget: true } };
    const html = renderToStaticMarkup(createElement(Meter, { decision, questions: 1, budget: 3 }));
    expect(html).toContain(`data-state="${state}"`);
    expect(html).toContain("1/3 questions · 10 min");
    expect(html).toContain("<details");
    expect(html).not.toMatch(/<details[^>]*\sopen/);
    expect(html).not.toContain("pulse");
    expect(html).toContain('aria-live="polite"');
  });
});
