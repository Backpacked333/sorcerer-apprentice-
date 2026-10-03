import { describe, expect, it } from "vitest";

import { classifyConfirmation, countsAsSpeech, detectCommand } from "./voice-protocol";

describe("detectCommand", () => {
  it.each([
    ["Actually, scratch that last explanation.", "off_record"],
    ["Please forget what I just said", "off_record"],
    ["Tacit, pause", "pause"],
    ["pause recording", "pause"],
    ["not right now", "not_now"],
    ["skip that", "not_now"],
  ] as const)("detects %j as %s", (text, command) => {
    expect(detectCommand(text)).toBe(command);
  });

  it.each([
    "I pause the invoice before review",
    "we do that later in the month",
    "the pause recording control is useful",
    "The instruction says do not keep that field blank",
    "streich das",
  ])(
    "does not treat ordinary speech as a command: %s",
    (text) => expect(detectCommand(text)).toBeNull(),
  );
});

describe("classifyConfirmation", () => {
  it("accepts an unqualified affirmation", () => {
    expect(classifyConfirmation("Yes, that's how it works.")).toBe("yes");
  });

  it("routes a qualified affirmation to correction", () => {
    expect(classifyConfirmation("Yes, but only when the request is complete.")).toBe("correction");
  });

  it("does not treat a backchannel as confirmation", () => {
    expect(classifyConfirmation("mhm")).toBe("unclear");
  });
});

describe("countsAsSpeech", () => {
  it("ignores isolated one-word noise", () => {
    expect(countsAsSpeech("", "uh")).toBe(false);
  });

  it("counts two words and substantial partial growth", () => {
    expect(countsAsSpeech("", "yes because")).toBe(true);
    expect(countsAsSpeech("ex", "explanation")).toBe(true);
  });
});
