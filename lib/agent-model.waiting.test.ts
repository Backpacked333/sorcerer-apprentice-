import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("bounded conversational waiting", () => {
  it.each(["interviewer", "tutor"])("keeps %s acknowledgments honest about the app-controlled window", (role) => {
    const prompt = readFileSync(`agents/${role}.md`, "utf8");
    expect(prompt).toContain("No rush — we can come back to this.");
    expect(prompt).toContain("Never promise indefinite listening or that a later answer will be saved.");
    expect(prompt).toContain("only within the app's current listening window");
    expect(prompt).toContain("A new tagged question replaces the earlier one");
    expect(prompt).not.toMatch(/pending until they actually/);
    expect(readFileSync("docs/lanes/A-voice-and-timing.md", "utf8")).toContain(prompt.trim());
  });
});
