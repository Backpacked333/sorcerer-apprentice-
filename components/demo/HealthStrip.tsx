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
        const voice = keys.eleven || keys.elevenlabs ? "Voice: ElevenAgents live" : "Voice: browser fallback";
        const vision = keys.gateway || keys.vision ? "Vision: live model" : "Vision: ERP telemetry only";
        const sample = data?.sample === false ? "Sample data: missing" : "Sample data: present";
        return `${voice} · ${vision} · ${sample}`;
      })
      .catch(() => "Status unavailable")
      .then((line) => { if (!cancelled) setText(line); });
    return () => { cancelled = true; };
  }, []);
  return <p className="t-small" data-testid="health-strip">{text}</p>;
}
