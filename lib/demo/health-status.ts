// Honest status line for the landing page and the presenter room (non-negotiable #5).
// Pure: takes the /api/health body (200 or 503) and the build-time event source.

export type HealthTone = "green" | "amber" | "neutral";
export interface HealthItem { label: string; tone: HealthTone }

interface HealthBody {
  keys?: { elevenlabs?: unknown; gateway?: unknown };
  agents?: { interviewer?: unknown; tutor?: unknown };
  integrations?: { voice?: { configured?: unknown }; gateway?: { configured?: unknown } };
  storage?: { configured?: unknown; reachable?: unknown; backend?: unknown };
}

export type EventSource = "vision" | "dom" | "both";

export function normalizeSource(raw: string | undefined | null): EventSource {
  return raw === "vision" || raw === "dom" || raw === "both" ? raw : "both";
}

// P-10: provider presence is "configured"/"degraded", never a live provider check — the
// labels say "configured", not "live". Storage reachability replaces the old sample flag.
export function healthItems(body: unknown, source: EventSource): HealthItem[] {
  if (!body || typeof body !== "object") return [{ label: "Status unavailable", tone: "neutral" }];
  const b = body as HealthBody;
  const key = !!b.keys?.elevenlabs;
  const interviewer = !!b.agents?.interviewer;
  const tutor = !!b.agents?.tutor;
  const voiceConfigured = b.integrations?.voice?.configured !== undefined ? !!b.integrations.voice.configured : key && interviewer && tutor;

  let voice: HealthItem;
  if (voiceConfigured) voice = { label: "Voice: ElevenLabs configured", tone: "green" };
  else if (key && (interviewer || tutor)) voice = { label: `Voice: ElevenLabs configured for ${interviewer ? "capture" : "teach"} only, browser fallback elsewhere`, tone: "amber" };
  else if (key) voice = { label: "Voice: browser fallback (no agent ids)", tone: "amber" };
  else voice = { label: "Voice: browser fallback", tone: "amber" };

  const gateway = b.integrations?.gateway?.configured !== undefined ? !!b.integrations.gateway.configured : !!b.keys?.gateway;
  let vision: HealthItem;
  if (source === "dom") vision = { label: "Vision: off · ERP telemetry only", tone: "amber" };
  else if (!gateway) vision = { label: source === "vision" ? "Vision: Gateway not configured" : "Vision: Gateway not configured · ERP telemetry only", tone: "amber" };
  else if (source === "vision") vision = { label: "Vision: Gateway configured", tone: "green" };
  else vision = { label: "Vision: Gateway configured + ERP telemetry", tone: "green" };

  const st = b.storage;
  let storage: HealthItem;
  if (!st || typeof st !== "object") storage = { label: "Storage: unknown", tone: "neutral" };
  else if (!st.configured) storage = { label: "Storage: not configured", tone: "amber" };
  else if (!st.reachable) storage = { label: "Storage: unreachable", tone: "amber" };
  else storage = { label: `Storage: ${typeof st.backend === "string" ? st.backend : "ready"}`, tone: "green" };

  return [voice, vision, storage, { label: "Configuration is not a live provider check", tone: "neutral" }];
}
