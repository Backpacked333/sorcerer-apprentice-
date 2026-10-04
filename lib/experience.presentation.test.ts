import { Children, createElement, isValidElement, type ReactNode } from "react";
import * as React from "react";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Home from "@/app/page";
import DemoPage from "@/app/demo/page";
import { Meter } from "@/components/Meter";
import { WorkMapView } from "@/components/WorkMapView";
import { Presence } from "@/components/ui/Presence";
import { ReplayRow } from "@/components/companion/teach/ReplayRow";
import type { Decision } from "./governor";
import { presenceOf, type PresenceInput } from "./ui/presence";
import { WorkMapSchema } from "./workmap";
import { getMap, listSessions } from "./store";
import { seedDemo } from "./seed";
import { redirect } from "next/navigation";

vi.mock("./store", () => ({ getMap: vi.fn(), listSessions: vi.fn() }));
vi.mock("./seed", () => ({ seedDemo: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof React>();
  return { ...actual, useState: vi.fn(actual.useState) };
});

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

describe("Liquid Glass presentation compatibility", () => {
  it("keeps Claude's platform and companion entry paths and explicit sample loading", async () => {
    const html = renderToStaticMarkup(await Home());
    expect(html).toContain('aria-label="Main"');
    expect(html).toContain('class="glass-panel');
    expect(html).toContain("We know more than we can tell.");
    expect(html).not.toContain("Tacit");
    for (const path of ["/platform", "/platform/demo", "/capture", "/demo/companion"]) expect(html).toContain(`href="${path}"`);
    expect(html).toMatch(/<button[^>]*type="submit"[^>]*>Load the sample Work Map<\/button>/);
    expect(html).toContain("A scripted example with synthetic evidence, separate from your own captures.");
    expect(seedDemo).not.toHaveBeenCalled();
    expect(html).toContain("No confirmed sample is loaded yet.");
    expect(html).not.toContain("/teach?from=");
    expect(html).toContain("Only a confirmed map can teach.");
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
    expect(html).toContain("Open the Work Map");
    expect(html).toContain("Be the new hire");
    expect(html).not.toContain('href="/map/demo_draft"');
    expect((await DemoPage()).props.sampleMap).toBe("demo_latest");
    expect(getMap).not.toHaveBeenCalledWith("real_capture");
    expect(getMap).not.toHaveBeenCalledWith("demo_teach");
  });

  it.each([undefined, map, { ...map, confirmedAt: 100, steps: [] }])("does not offer a finished map for missing, draft or empty sample data", async (storedMap) => {
    vi.mocked(listSessions).mockResolvedValue([{ id: "demo_pending", startedAt: 1, mode: "capture", task: map.task, expertName: map.expert.name }]);
    vi.mocked(getMap).mockResolvedValue(storedMap);
    const html = renderToStaticMarkup(await Home());
    expect(html).toContain("No confirmed sample is loaded yet.");
    expect(html).not.toContain('href="/map/demo_pending"');
    expect(html).not.toContain("/teach?from=");
    expect(html).toContain("Load the sample Work Map");
    expect(seedDemo).not.toHaveBeenCalled();
    expect((await DemoPage()).props.sampleMap).toBeUndefined();
  });

  it("seeds missing samples only on explicit submission, before opening the confirmed example", async () => {
    vi.mocked(seedDemo).mockImplementation(async () => {
      expect(redirect).not.toHaveBeenCalled();
      vi.mocked(listSessions).mockResolvedValue([{ id: "demo_sabine_confirmed", startedAt: 1, mode: "capture", task: map.task, expertName: map.expert.name }]);
      vi.mocked(getMap).mockResolvedValue({ ...map, sessionId: "demo_sabine_confirmed", confirmedAt: 100 });
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

  it.each([undefined, map, { ...map, confirmedAt: 100, steps: [] }])("rejects an ineligible sample left unchanged by ifMissing seeding: %j", async (storedMap) => {
    vi.mocked(listSessions).mockResolvedValue([{ id: "demo_sabine_confirmed", startedAt: 1, mode: "capture", task: map.task, expertName: map.expert.name }]);
    vi.mocked(getMap).mockResolvedValue(storedMap);
    vi.mocked(seedDemo).mockResolvedValue({ samples: ["demo_sabine", "demo_sabine_confirmed"] });
    const action = sampleAction(await Home());
    expect(action).toBeTypeOf("function");
    await expect(action!()).rejects.toThrow("No confirmed, nonempty sample Work Map is available");
    expect(seedDemo).toHaveBeenCalledExactlyOnceWith({ ifMissing: true });
    expect(redirect).not.toHaveBeenCalled();
  });

  it("selects a freshly validated destination rather than assuming the fixed sample ID is eligible", async () => {
    const action = sampleAction(await Home());
    vi.mocked(seedDemo).mockImplementation(async () => {
      vi.mocked(listSessions).mockResolvedValue([
        { id: "demo_sabine_confirmed", startedAt: 2, mode: "capture", task: map.task, expertName: map.expert.name },
        { id: "demo_other", startedAt: 1, mode: "capture", task: map.task, expertName: map.expert.name },
      ]);
      vi.mocked(getMap).mockImplementation(async (id) => ({ ...map, sessionId: id, confirmedAt: id === "demo_other" ? 100 : undefined }));
      return { samples: ["demo_sabine", "demo_sabine_confirmed"] };
    });
    await action!();
    expect(redirect).toHaveBeenCalledExactlyOnceWith("/map/demo_other");
  });

  it("preserves Claude's step rail and detail layout with literal quotes, not quoted paraphrases", () => {
    const html = renderMap();
    expect(html).toContain(map.steps[0].decision);
    expect(html).toContain('data-testid="map-rail-step"');
    expect(html).toContain(`“${map.steps[0].reason!.text}”`);
    expect(html).toContain(`“${map.steps[0].guardrails[0].quote!.text}”`);
    expect(html).not.toContain(`“${map.steps[0].guardrails[0].text}”`);
    expect(html).toContain("described");
    expect(html).toContain("debrief");
    expect(html).toContain('aria-current="step"');
  });

  it("reports step counts and missing evidence without reintroducing legacy controls", () => {
    const html = renderMap();
    expect(html).toContain("1 step · 1 judgment call");
    expect(html).toContain("No still kept for this step");
    expect(html).not.toContain("delete step");
    expect(html).not.toContain("remove quote");
  });

  it("leaves missing explanations and guardrail quotes explicit", () => {
    const html = renderMap({ ...map, steps: [{ ...map.steps[0], reason: undefined,
      guardrails: [{ ...map.steps[0].guardrails[0], quote: undefined }] }] });
    expect(html).toContain("Not yet explained");
    expect(html).not.toContain(`“${map.steps[0].guardrails[0].text}”`);
    expect(html).not.toContain(`“${map.steps[0].guardrails[0].quote!.text}”`);
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
    expect(html).toContain("aspect-ratio:1");
    expect(html).toContain("calc(min(52vh, 460px) * 1.0000)");
    expect(html).toContain("left:10%;top:20%;width:30%;height:40%");
    expect(html).toContain("Translated explanation");
    expect(html).toContain("captured still");
    expect(html).toContain("1 regions blurred");
    expect(html.indexOf("<img")).toBeLessThan(html.indexOf(map.steps[0].decision));
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

describe("Liquid Glass evidence frame geometry", () => {
  it.each([
    [960, 540],
    [540, 960],
    [800, 800],
  ])("keeps Claude's responsive Work Map wrapper aligned with a %dx%d still", (width, height) => {
    const withFrame = { ...map, steps: [{ ...map.steps[0], screenMoment: { t: 12, frameId: "frame", region: { x: 0, y: 0.2, w: 0.3, h: 0.4 } } }] };
    const html = renderToStaticMarkup(createElement(WorkMapView, {
      map: withFrame, frames: [{ id: "frame", t: 12, url: "/frame.jpg", width, height, piiRegionsBlurred: 0 }], sessionId: map.sessionId, editable: false, onChange: () => {},
    }));
    expect(html).toContain(`aspect-ratio:${width / height}`);
    expect(html).toContain(`calc(min(52vh, 460px) * ${(width / height).toFixed(4)})`);
    expect(html).toContain("left:0%;top:20%;width:30%;height:40%");
    expect(html).toContain("block h-full w-full object-contain");
  });

  it.each(["/frame.jpg", "data:image/png;base64,AAAA"])("retains natural sizing and region coordinates in the expanded Teach replay: %s", (src) => {
    const state = vi.mocked(React.useState).mockReturnValueOnce([true, vi.fn()]);
    try {
      const html = renderToStaticMarkup(createElement(ReplayRow, {
        expert: "Alex", onClose: () => {}, replay: {
          step: { ...map.steps[0], screenMoment: { t: 12, region: { x: 0.1, y: 0.2, w: 0.3, h: 0.4 } } },
          frame: { id: "frame", t: 12, url: src, width: 960, height: 540, piiRegionsBlurred: 0 }, quote: map.steps[0].reason!.text,
        },
      }));
      expect(html).toContain('aria-label="Shrink the still"');
      expect(html).toContain('width="960" height="540"');
      expect(html).toContain(`src="${src}"`);
      expect(html).toContain('style="display:block;width:100%;height:auto"');
      expect(html).toContain("left:10%;top:20%;width:30%;height:40%");
      expect(html).toContain(map.steps[0].reason!.text);
    } finally {
      state.mockReset();
    }
  });

  it("does not restore the legacy frame height cap that letterboxed the image", () => {
    const css = readFileSync("app/globals.css", "utf8");
    expect(css).not.toMatch(/\.frame-lg img\s*\{[^}]*(max-height|object-fit)/);
  });
});

describe("Liquid Glass observation presence", () => {
  it("reserves horizontal ERP space only on wide screens but keeps vertical clearance everywhere", () => {
    const css = readFileSync("app/erp/erp.css", "utf8");
    expect(css).toContain("html.erp-embedded .erp-main { padding-bottom: calc(var(--tacit-reserve-h, 0px) + 28px); }");
    expect(css).toMatch(/@media \(min-width: 1024px\)\s*\{\s*html\.erp-embedded \.erp-main \.erp-card-flush,\s*html\.erp-embedded \.erp-main \.erp-approval-card \{ margin-right: max\(0px, calc\(var\(--tacit-reserve-w, 0px\) - 28px\)\); \}\s*\}/);
    expect(css.match(/margin-right: max\(0px, calc\(var\(--tacit-reserve-w/g)).toHaveLength(1);
  });

  it("stacks and scrolls the Capture mechanism on narrow screens without remounting the preview", () => {
    const view = readFileSync("components/views/CaptureView.tsx", "utf8");
    const workspace = readFileSync("components/ui/Workspace.tsx", "utf8");
    const css = readFileSync("app/globals.css", "utf8");
    expect(view).toContain('className={floating ? "capture-floating-stack" : undefined}');
    expect(view).toContain('<MechanismSheet vm={vm} open={mech && vm.started} floating={floating} />');
    expect(css).toMatch(/\.capture-floating-stack\s*\{[^}]*flex-direction: row-reverse;[^}]*max-height: calc\(100dvh - 56px\)/);
    const narrow = css.slice(css.indexOf("@media (max-width: 780px)"));
    expect(narrow).toContain(".workspace-companion:has(.capture-floating-stack) { right: clamp(0px, calc((100vw - 320px) / 2), 16px); }");
    expect(narrow).toContain("flex-direction: column; overflow-y: auto; overscroll-behavior: contain;");
    expect(narrow).toContain(".capture-floating-stack > * { flex-shrink: 0; }");
    expect(workspace).not.toContain("right: SLOT_GAP");
  });

  it.each([
    [{ holding: true, sharing: true, queued: 0 }, "off", "Paused", "Nothing is being sent"],
    [{ holding: false, sharing: true, queued: 0, struckAgoMs: 1 }, "off", "Paused", "Struck from the record"],
    [{ holding: false, sharing: true, queued: 0, phase: "asking" }, "asking", "Asking", ""],
    [{ holding: false, sharing: true, queued: 0, phase: "answering" }, "listening", "Listening to your answer", ""],
    [{ holding: false, sharing: false, queued: 0 }, "quiet", "Quiet while you work", "Not watching — no screen shared"],
    [{ holding: false, sharing: true, queued: 1, waitingReason: "typing" }, "quiet", "Quiet while you work", "Waiting — typing"],
  ] satisfies [PresenceInput, string, string, string][])("preserves the capture companion state and privacy copy: %j", (input, state, label, sub) => {
    const html = renderToStaticMarkup(createElement(Presence, presenceOf(input)));
    expect(html).toContain('data-testid="capture-presence"');
    expect(html).toContain(`data-mood="${state}"`);
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain(label);
    if (sub) expect(html).toContain(sub);
    expect(html).not.toContain('class="presence-dot"');
  });

  it("does not invent a listening state before receiving a decision", () => {
    const html = renderToStaticMarkup(createElement(Meter, { questions: 0, budget: 3 }));
    expect(html).toContain('data-state="unavailable"');
    expect(html).toContain("Waiting for observation state");
    expect(html).toContain("No timing information yet.");
    expect(html).not.toContain("listening");
  });

  it.each(["listening", "waiting", "asking", "answering"] as const)("reflects the real %s governor state inside the mechanism sheet", (state) => {
    const decision: Decision = { state, interruptible: false, boundaryBonus: 0, reasons: [],
      lights: { silence: false, still: false, notTyping: false, notReading: false, budget: true } };
    const html = renderToStaticMarkup(createElement(Meter, { decision, questions: 1, budget: 3 }));
    expect(html).toContain(`data-state="${state}"`);
    expect(html).toContain("1/3 questions · 10 min");
    expect(html).toContain("Governor");
    expect(html).toContain('aria-live="polite"');
  });

  it("keeps the redesign's global reduced-motion rule", () => {
    const css = readFileSync("app/globals.css", "utf8");
    expect(css).toContain("@media (prefers-reduced-motion:reduce)");
    expect(css).toContain("animation-iteration-count:1!important");
  });
});
