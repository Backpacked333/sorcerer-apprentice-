import { Children, createElement, isValidElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Home from "@/app/page";
import DemoPage from "@/app/demo/page";
import { Meter } from "@/components/Meter";
import { WorkMapView } from "@/components/WorkMapView";
import { Presence } from "@/components/ui/Presence";
import type { Decision } from "./governor";
import { presenceOf, type PresenceInput } from "./ui/presence";
import { WorkMapSchema } from "./workmap";
import { getMap, listSessions } from "./store";
import { seedDemo } from "./seed";
import { redirect } from "next/navigation";

vi.mock("./store", () => ({ getMap: vi.fn(), listSessions: vi.fn() }));
vi.mock("./seed", () => ({ seedDemo: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

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

function sampleAction(page: ReactNode): (() => Promise<void>) | undefined {
  const nodes = Children.toArray(page);
  while (nodes.length) {
    const node = nodes.pop();
    if (!isValidElement<{ action?: () => Promise<void>; children?: ReactNode }>(node)) continue;
    if (node.type === "form") return node.props.action;
    nodes.push(...Children.toArray(node.props.children));
  }
}

describe("knowledge-first presentation", () => {
  it("keeps all entry paths and clearly labels keyless mode and the missing sample", async () => {
    const html = renderToStaticMarkup(await Home());
    expect(html).toContain('aria-label="Simon home"');
    expect(html).toContain('aria-label="How Simon works"');
    expect(html).not.toContain("Tacit");
    for (const path of ["/map", "/capture", "/teach", "/erp"]) expect(html).toContain(`href="${path}"`);
    expect(html).toMatch(/<button[^>]*type="submit"[^>]*>Load the sample Work Map<\/button>/);
    expect(html).toContain("A scripted example with synthetic evidence, separate from your own captures.");
    expect(seedDemo).not.toHaveBeenCalled();
    expect(html).toContain("No confirmed sample is available.");
    expect(html).not.toContain("/teach?from=");
    expect(html).toContain("Keyless mode uses ERP telemetry and browser speech");
    expect((await DemoPage()).props.sampleMap).toBeUndefined();
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
    const page = await Home();
    const html = renderToStaticMarkup(page);
    expect(html).toContain('href="/map/demo_latest"');
    expect(sampleAction(page)).toBeUndefined();
    expect(seedDemo).not.toHaveBeenCalled();
    expect(html).toContain('href="/teach?from=demo_latest"');
    expect(html).toContain("Open a finished Work Map");
    expect(html).toContain("Explore a confirmed sample");
    expect(html).not.toContain('href="/map/demo_draft"');
    expect((await DemoPage()).props.sampleMap).toBe("demo_latest");
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
    expect(html).toContain("Load the sample Work Map");
    expect(seedDemo).not.toHaveBeenCalled();
    expect((await DemoPage()).props.sampleMap).toBeUndefined();
  });

  it("seeds missing samples only on explicit submission, before opening the confirmed example", async () => {
    vi.mocked(seedDemo).mockImplementation(async () => {
      expect(redirect).not.toHaveBeenCalled();
      return { samples: ["demo_sabine", "demo_sabine_confirmed"] };
    });
    const action = sampleAction(await Home());
    expect(action).toBeTypeOf("function");
    expect(seedDemo).not.toHaveBeenCalled();
    await action!();
    expect(seedDemo).toHaveBeenCalledExactlyOnceWith({ ifMissing: true });
    expect(redirect).toHaveBeenCalledExactlyOnceWith("/map/demo_sabine_confirmed");
  });

  it("does not redirect to a finished sample when seeding fails", async () => {
    vi.mocked(seedDemo).mockRejectedValue(new Error("storage unavailable"));
    const action = sampleAction(await Home());
    expect(action).toBeTypeOf("function");
    await expect(action!()).rejects.toThrow("storage unavailable");
    expect(redirect).not.toHaveBeenCalled();
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

  it.each([
    ["data:image/png;base64,AAAA", undefined],
    ["data:image/png;base64,AAAA", "/api/sessions/sample/frames/frame-1"],
    [undefined, "/api/sessions/sample/frames/frame-1"],
  ])("retains recorded frame URLs, regions and translations after the seam integration: %s, %s", (dataUrl, url) => {
    const translated = { ...map, steps: [{ ...map.steps[0],
      screenMoment: { t: 12, frameId: "frame-1", region: { x: 0.1, y: 0.2, w: 0.3, h: 0.4 } },
      reason: { ...map.steps[0].reason!, translation: "Translated explanation" },
    }] };
    const frames = [{ id: "frame-1", t: 12, dataUrl, url, width: 100, height: 100, piiRegionsBlurred: 1 }];
    const html = renderToStaticMarkup(createElement(WorkMapView, {
      map: translated, sessionId: map.sessionId, onChange: () => {}, editable: false, frames,
    }));
    expect(html).toContain(`src="${url ?? "data:image/png;base64,AAAA"}"`);
    expect(html).toContain('class="frame-region"');
    expect(html).toContain("left:10%;top:20%;width:30%;height:40%");
    expect(html).toContain("Translated explanation");
    expect(html).toContain("not a live screen");
    expect(html.indexOf(map.steps[0].decision)).toBeLessThan(html.indexOf("<img"));
  });

  it("retains the optional evidence matrix provided by the map controller", () => {
    const html = renderToStaticMarkup(createElement(WorkMapView, {
      map, frames: [], sessionId: map.sessionId, onChange: () => {}, editable: false,
      matrix: [{ stepId: "inspect", cells: [{ key: "reason", word: "Reason captured" }] }],
    }));
    expect(html).toContain('id="step-inspect"');
    expect(html).toContain("Replay-verified");
    expect(html).toContain("Reason captured");
    expect(renderMap()).not.toContain("<table");
  });
});

describe("quiet observation presence", () => {
  it.each([
    [{ holding: true, sharing: true, queued: 0 }, "off-record", "Paused", "Nothing is being sent"],
    [{ holding: false, sharing: true, queued: 0, struckAgoMs: 1 }, "off-record", "Paused", "Struck from the record"],
    [{ holding: false, sharing: true, queued: 0, phase: "asking" }, "asking", "Asking", ""],
    [{ holding: false, sharing: true, queued: 0, phase: "answering" }, "answering", "Listening to your answer", ""],
    [{ holding: false, sharing: false, queued: 0 }, "quiet", "Quiet while you work", "Not watching — no screen shared"],
    [{ holding: false, sharing: true, queued: 1, waitingReason: "typing" }, "quiet", "Quiet while you work", "Waiting — typing"],
  ] satisfies [PresenceInput, string, string, string][])("preserves the capture companion state and privacy copy: %j", (input, state, label, sub) => {
    const html = renderToStaticMarkup(createElement(Presence, presenceOf(input)));
    expect(html).toContain('data-testid="capture-presence"');
    expect(html).toContain(`data-state="${state}"`);
    expect(html).toContain('class="presence-dot"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain(label);
    if (sub) expect(html).toContain(sub);
    expect(html).not.toContain("pulse");
    expect(html).not.toContain("presence-mark");
  });

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
