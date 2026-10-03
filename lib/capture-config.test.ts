import { describe, expect, it } from "vitest";
import { DEMO_GOVERNOR } from "./governor";
import { captureConfig, num } from "./capture-config";

describe("capture configuration", () => {
  it.each([undefined, "", "   ", "NaN", "Infinity", "-Infinity"])("uses the default for %j", (value) => {
    expect(num(value, 7)).toBe(7);
  });

  it("accepts finite numeric strings including zero", () => {
    expect(num(" 2.5 ", 7)).toBe(2.5);
    expect(num("0", 7)).toBe(0);
  });

  it("starts from demo defaults", () => {
    expect(captureConfig({}, {})).toEqual({ ...DEMO_GOVERNOR, graceSecs: 18 });
  });

  it("maps every supported environment override", () => {
    expect(
      captureConfig(
        {
          NEXT_PUBLIC_SILENCE_SECS: "3.1",
          NEXT_PUBLIC_STILL_SECS: "2.2",
          NEXT_PUBLIC_COOLDOWN_SECS: "24",
          NEXT_PUBLIC_MAX_QUESTIONS_PER_10MIN: "4",
          NEXT_PUBLIC_WARMUP_SECS: "9",
          NEXT_PUBLIC_READING_SECS: "6",
          NEXT_PUBLIC_TYPING_QUIET_SECS: "3.5",
          NEXT_PUBLIC_WINDOW_TIMEOUT_SECS: "22",
          NEXT_PUBLIC_MIN_VALUE: "0.7",
          NEXT_PUBLIC_GRACE_SECS: "19",
          NEXT_PUBLIC_MAX_CHAINED: "1",
        },
        {},
      ),
    ).toMatchObject({
      silenceSecs: 3.1,
      stillSecs: 2.2,
      cooldownSecs: 24,
      maxPer10Min: 4,
      warmupSecs: 9,
      readingSecs: 6,
      typingQuietSecs: 3.5,
      windowTimeoutSecs: 22,
      minValue: 0.7,
      graceSecs: 19,
      maxChained: 1,
    });
  });

  it("ignores URL knobs unless tune is exactly enabled", () => {
    const env = { NEXT_PUBLIC_COOLDOWN_SECS: "24" };
    expect(captureConfig(env, { cooldown: "7" }).cooldownSecs).toBe(24);
    expect(captureConfig(env, { tune: "0", cooldown: "7" }).cooldownSecs).toBe(24);
  });

  it("applies URL knobs after env and falls back to env for invalid URL values", () => {
    const config = captureConfig(
      {
        NEXT_PUBLIC_COOLDOWN_SECS: "24",
        NEXT_PUBLIC_WARMUP_SECS: "9",
        NEXT_PUBLIC_READING_SECS: "6",
        NEXT_PUBLIC_SILENCE_SECS: "3.1",
        NEXT_PUBLIC_STILL_SECS: "2.2",
        NEXT_PUBLIC_GRACE_SECS: "19",
        NEXT_PUBLIC_MAX_CHAINED: "1",
      },
      {
        tune: "1",
        cooldown: "21",
        warmup: "8.5",
        reading: "5.5",
        silence: "2.8",
        still: "2.1",
        grace: "17",
        chained: "2",
      },
    );
    expect(config).toMatchObject({ cooldownSecs: 21, warmupSecs: 8.5, readingSecs: 5.5, silenceSecs: 2.8, stillSecs: 2.1, graceSecs: 17, maxChained: 2 });
    expect(captureConfig({ NEXT_PUBLIC_COOLDOWN_SECS: "24" }, { tune: "1", cooldown: "Infinity" }).cooldownSecs).toBe(24);
  });
});
