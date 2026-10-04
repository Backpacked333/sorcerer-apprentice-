import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("deployable governor defaults", () => {
  it("documents the complete demo cadence without credentials", () => {
    const env = Object.fromEntries(readFileSync(new URL("../.env.example", import.meta.url), "utf8")
      .split("\n").filter((line) => line && !line.startsWith("#"))
      .map((line) => line.split("=", 2)));
    expect(env).toMatchObject({
      NEXT_PUBLIC_SILENCE_SECS: "2.5", NEXT_PUBLIC_STILL_SECS: "2",
      NEXT_PUBLIC_COOLDOWN_SECS: "20", NEXT_PUBLIC_MAX_QUESTIONS_PER_10MIN: "5",
      NEXT_PUBLIC_WARMUP_SECS: "8", NEXT_PUBLIC_READING_SECS: "5",
      NEXT_PUBLIC_TYPING_QUIET_SECS: "3", NEXT_PUBLIC_WINDOW_TIMEOUT_SECS: "20",
      NEXT_PUBLIC_MIN_VALUE: "0.6", NEXT_PUBLIC_GRACE_SECS: "18", NEXT_PUBLIC_MAX_CHAINED: "2",
      ELEVENLABS_API_KEY: "", AI_GATEWAY_API_KEY: "",
    });
  });
});
