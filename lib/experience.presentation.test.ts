import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Home from "@/app/page";
import { Meter } from "@/components/Meter";
import { WorkMapView } from "@/components/WorkMapView";
import type { Decision } from "./governor";
import { WorkMapSchema } from "./workmap";
import { getMap, listSessions } from "./store";

vi.mock("./store", () => ({ getMap: vi.fn(), listSessions: vi.fn() }));

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(listSessions).mockResolvedValue([]);
});

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
  it("keeps all entry paths and clearly labels keyless mode and the missing sample", async () => {
    const html = renderToStaticMarkup(await Home());
    for (const path of ["/map", "/capture", "/teach", "/erp"]) expect(html).toContain(`href="${path}"`);
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>No sample Work Map yet<\/button>/);
    expect(html).toContain("No confirmed sample is available.");
    expect(html).not.toContain("/teach?from=");
    expect(html).toContain("Keyless mode uses ERP telemetry and browser speech");
  });

  it("links directly to the newest confirmed sample and its tutor, not a draft or real capture", async () => {
    const sessions = [
      { id: "real_capture", startedAt: 5, mode: "capture" as const },
      { id: "demo_teach", startedAt: 4, mode: "teach" as const },
      { id: "demo_draft", startedAt: 3, mode: "capture" as const },
      { id: "demo_latest", startedAt: 2, mode: "capture" as const },
      { id: "demo_old", startedAt: 1, mode: "capture" as const },
    ].map((s) => ({ ...s, task: map.task, expertName: map.expert.name }));
    vi.mocked(listSessions).mockResolvedValue(sessions);
    vi.mocked(getMap).mockImplementation(async (id) => ({ ...map, sessionId: id, confirmedAt: id === "demo_draft" ? undefined : 100 }));
    const html = renderToStaticMarkup(await Home());
    expect(html).toContain('href="/map/demo_latest"');
    expect(html).toContain('href="/teach?from=demo_latest"');
    expect(html).toContain("Open a finished Work Map");
    expect(html).toContain("Explore a confirmed sample");
    expect(html).not.toContain('href="/map/demo_draft"');
    expect(getMap).not.toHaveBeenCalledWith("real_capture");
    expect(getMap).not.toHaveBeenCalledWith("demo_teach");
  });

  it.each([undefined, map])("does not offer a finished map for missing or draft sample data", async (storedMap) => {
    vi.mocked(listSessions).mockResolvedValue([{ id: "demo_pending", startedAt: 1, mode: "capture", task: map.task, expertName: map.expert.name }]);
    vi.mocked(getMap).mockResolvedValue(storedMap);
    const html = renderToStaticMarkup(await Home());
    expect(html).toContain("No confirmed sample is available.");
    expect(html).not.toContain('href="/map/demo_pending"');
    expect(html).not.toContain("/teach?from=");
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
