import { describe, expect, it } from "vitest";

import { confirmedByOf, sourceForWindowKind } from "./compile/evidence";
import type { QuestionWindow } from "./events";
import type { Quote } from "./workmap";

const quote = (source: Quote["source"]): Quote => ({ text: "x", t: 0, source });

describe("quote provenance", () => {
  it("labels window answers by window kind, collapsing other kinds to live", () => {
    const kinds: QuestionWindow["kind"][] = ["why", "counterfactual", "limit", "stop", "who", "debrief", "intervene", "predict"];
    expect(kinds.map(sourceForWindowKind)).toEqual(["live", "counterfactual", "live", "live", "live", "debrief", "live", "live"]);
  });

  it("maps each quote source to a rule confirmation without deduplicating", () => {
    expect(confirmedByOf(["live", "narration", "debrief", "counterfactual", "live"].map((s) => quote(s as Quote["source"]))))
      .toEqual(["live", "live", "debrief", "counterfactual", "live"]);
    expect(confirmedByOf([])).toEqual([]);
  });
});
