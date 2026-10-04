import { describe, expect, it } from "vitest";
import { presenceOf } from "./presence";

const base = { holding: false, sharing: true, queued: 0 };

describe("presenceOf", () => {
  it("lets a pause win over an open window", () => {
    const view = presenceOf({ ...base, holding: true, phase: "asking" });
    expect(view).toMatchObject({ state: "off-record", label: "Paused", sub: "Nothing is being sent" });
  });

  it("shows a fresh strike as off the record", () => {
    const view = presenceOf({ ...base, struckAgoMs: 3999, phase: "answering" });
    expect(view).toMatchObject({ state: "off-record", label: "Paused", sub: "Struck from the record" });
    expect(presenceOf({ ...base, struckAgoMs: 4000, phase: "answering" }).state).toBe("listening");
  });

  it("listens while the window is answering", () => {
    expect(presenceOf({ ...base, phase: "answering" })).toMatchObject({ state: "listening", label: "Listening to your answer" });
  });

  it("names the first governor reason while a question waits", () => {
    const view = presenceOf({ ...base, queued: 2, waitingReason: "expert talking" });
    expect(view.label).toBe("Quiet while you work");
    expect(view.sub).toBe("Waiting — expert talking");
  });

  it("does not claim to be watching when no screen is shared", () => {
    const view = presenceOf({ ...base, sharing: false, queued: 2, waitingReason: "typing" });
    expect(view.label).toBe("Quiet while you work");
    expect(view.sub).toBe("Not watching — no screen shared");
    expect(view.label.toLowerCase()).not.toContain("watching");
  });
});
