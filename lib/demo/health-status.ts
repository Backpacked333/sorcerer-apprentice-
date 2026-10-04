// Honest status line for the landing page and the presenter room (non-negotiable #5).
// Pure: takes the /api/health body (200 or 503) and the build-time event source.

export type HealthTone = "green" | "amber" | "neutral";
export interface HealthItem { label: string; tone: HealthTone }

interface HealthBody {
  keys?: { elevenlabs?: unknown; gateway?: unknown };
  agents?: { interviewer?: unknown; tutor?: unknown };
  sample?: { present?: unknown } | unknown;
}

export type EventSource = "vision" | "dom" | "both";

export function normalizeSource(raw: string | undefined | null): EventSource {
  return raw === "vision" || raw === "dom" || raw === "both" ? raw : "both";
}

export function healthItems(body: unknown, source: EventSource): HealthItem[] {
  if (!body || typeof body !== "object") return [{ label: "Status unavailable", tone: "neutral" }];
  const b = body as HealthBody;
  const key = !!b.keys?.elevenlabs;
  const interviewer = !!b.agents?.interviewer;
  const tutor = !!b.agents?.tutor;

  let voice: HealthItem;
  if (key && interviewer && tutor) voice = { label: "Voice: ElevenAgents live", tone: "green" };
  else if (key && (interviewer || tutor)) voice = { label: `Voice: ElevenAgents for ${interviewer ? "capture" : "teach"} only, browser fallback elsewhere`, tone: "amber" };
  else if (key) voice = { label: "Voice: browser fallback (no agent ids)", tone: "amber" };
  else voice = { label: "Voice: browser fallback", tone: "amber" };

  const gateway = !!b.keys?.gateway;
  let vision: HealthItem;
  if (source === "dom") vision = { label: "Vision: off · ERP telemetry only", tone: "amber" };
  else if (!gateway) vision = { label: source === "vision" ? "Vision: no model key" : "Vision: no model key · ERP telemetry only", tone: "amber" };
  else if (source === "vision") vision = { label: "Vision: live model", tone: "green" };
  else vision = { label: "Vision: live model + ERP telemetry", tone: "green" };

  const sampleRaw = b.sample;
  const present = typeof sampleRaw === "object" && sampleRaw !== null ? !!(sampleRaw as { present?: unknown }).present : sampleRaw === true;
  const sample: HealthItem = present ? { label: "Sample data: present", tone: "green" } : { label: "Sample data: missing", tone: "amber" };

  return [voice, vision, sample];
}
