import { DEMO_GOVERNOR, type GovernorConfig } from "./governor";

export type CaptureSearchParams = Record<string, string | string[] | undefined>;
export type CaptureEnv = Record<string, string | undefined>;

export interface CaptureConfig extends GovernorConfig {
  graceSecs: number;
}

const first = (value: string | string[] | undefined): string | undefined => (Array.isArray(value) ? value[0] : value);

export function num(value: string | string[] | undefined, fallback: number): number {
  const raw = first(value);
  if (raw === undefined || raw.trim() === "") return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/** Build Capture timing as demo defaults, then environment, then explicitly enabled URL tuning. */
export function captureConfig(env: CaptureEnv, searchParams: CaptureSearchParams): CaptureConfig {
  const config: CaptureConfig = {
    ...DEMO_GOVERNOR,
    graceSecs: 18,
  };

  config.silenceSecs = num(env.NEXT_PUBLIC_SILENCE_SECS, config.silenceSecs);
  config.stillSecs = num(env.NEXT_PUBLIC_STILL_SECS, config.stillSecs);
  config.cooldownSecs = num(env.NEXT_PUBLIC_COOLDOWN_SECS, config.cooldownSecs);
  config.maxPer10Min = num(env.NEXT_PUBLIC_MAX_QUESTIONS_PER_10MIN, config.maxPer10Min);
  config.warmupSecs = num(env.NEXT_PUBLIC_WARMUP_SECS, config.warmupSecs);
  config.readingSecs = num(env.NEXT_PUBLIC_READING_SECS, config.readingSecs);
  config.typingQuietSecs = num(env.NEXT_PUBLIC_TYPING_QUIET_SECS, config.typingQuietSecs);
  config.windowTimeoutSecs = num(env.NEXT_PUBLIC_WINDOW_TIMEOUT_SECS, config.windowTimeoutSecs);
  config.minValue = num(env.NEXT_PUBLIC_MIN_VALUE, config.minValue);
  config.graceSecs = num(env.NEXT_PUBLIC_GRACE_SECS, config.graceSecs);
  config.maxChained = num(env.NEXT_PUBLIC_MAX_CHAINED, config.maxChained ?? 2);

  if (first(searchParams.tune) !== "1") return config;

  config.cooldownSecs = num(searchParams.cooldown, config.cooldownSecs);
  config.warmupSecs = num(searchParams.warmup, config.warmupSecs);
  config.readingSecs = num(searchParams.reading, config.readingSecs);
  config.silenceSecs = num(searchParams.silence, config.silenceSecs);
  config.stillSecs = num(searchParams.still, config.stillSecs);
  config.graceSecs = num(searchParams.grace, config.graceSecs);
  config.maxChained = num(searchParams.chained, config.maxChained ?? 2);

  return config;
}
