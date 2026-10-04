import { describe, expect, it } from "vitest";
import { tutorLine, visibleRules } from "./teachview";

const card = [
  { status: "mastered", label: "correct without help", title: "a" },
  { status: "practicing", label: "correct after a hint", title: "b" },
  { status: "needs_practice", label: "corrected after intervention", title: "c" },
  { status: "untested", label: "not tested", title: "d" },
];

describe("teach view helpers", () => {
  it("hides the quote on a prediction and shows it on an intervention", () => {
    expect(tutorLine({ kind: "predict", message: "Before you code this", quote: "the answer" }).quote).toBeUndefined();
    expect(tutorLine({ kind: "intervene", message: "Hold on", quote: "the answer" }).quote).toBe("the answer");
    expect(tutorLine({ kind: "predict", message: "Before you code this" }).word).toBe("Before you decide");
    expect(tutorLine({ kind: "stop", message: "stop", quote: "q" }).word).toBe("Stop and ask");
  });

  it("hides untested titles unless the presenter asked for them", () => {
    expect(visibleRules(card, false).shown.map((c) => c.title)).toEqual(["a", "b", "c"]);
    expect(visibleRules(card, false).hidden).toBe(1);
    expect(visibleRules(card, true).shown).toEqual(card);
    expect(visibleRules(card, true).hidden).toBe(0);
  });

  it("passes the four mastery labels through unchanged", () => {
    expect(visibleRules(card, true).shown.map((c) => c.label)).toEqual([
      "correct without help",
      "correct after a hint",
      "corrected after intervention",
      "not tested",
    ]);
  });
});
