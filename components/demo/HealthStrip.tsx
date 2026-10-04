"use client";

import { useEffect, useState } from "react";

export function HealthStrip() {
  const [text, setText] = useState("Status unavailable");
  useEffect(() => {
    let cancelled = false;
    fetch("/api/health")
      .then(async (res) => {
        if (!res.ok) return "Status unavailable";
        const data = await res.json().catch(() => null);
        const keys = (data?.keys ?? {}) as Record<string, unknown>;
        const voiceConfigured = data?.integrations?.voice?.configured ?? Boolean(keys.eleven || keys.elevenlabs);
        const gatewayConfigured = data?.integrations?.gateway?.configured ?? Boolean(keys.gateway || keys.vision);
        const voice = voiceConfigured ? "Voice: ElevenLabs configured" : "Voice: browser fallback";
        const vision = gatewayConfigured ? "Vision: Gateway configured" : "Vision: ERP telemetry only";
        return `${voice} · ${vision} · Configuration is not a live provider check`;
      })
      .catch(() => "Status unavailable")
      .then((line) => { if (!cancelled) setText(line); });
    return () => { cancelled = true; };
  }, []);
  return <p className="t-small" data-testid="health-strip">{text}</p>;
}
