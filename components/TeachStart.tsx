"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/ui/AppShell";
import { EmptyState } from "@/components/ui/EmptyState";

export function TeachStart({
  maps,
  preselect,
}: {
  maps: { sessionId: string; expert: string; task: string; confirmed: boolean; rules: number; steps: number; startedAt?: number }[];
  preselect?: string;
}) {
  const router = useRouter();
  const usable = maps.filter((m) => m.confirmed && m.steps > 0);
  const initial = usable.some((m) => m.sessionId === preselect) ? preselect ?? "" : usable[0]?.sessionId ?? "";
  const [from, setFrom] = useState(initial);
  const [name, setName] = useState("");
  const start = async () => {
    const chosen = usable.find((m) => m.sessionId === from);
    if (!chosen) return;
    const res = await fetch("/api/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mode: "teach", expertName: name.trim() || "New hire", task: chosen.task, sourceMapSessionId: from }),
    });
    const { session } = await res.json();
    const share = window.location.search.includes("share=0") ? "?share=0" : "";
    router.push(`/teach/${session.id}${share}`);
  };
  return (
    <AppShell step={3} sessionId={from || undefined} confirmed={!!from}>
      <main className="mx-auto max-w-xl px-6 py-16">
        <p className="t-meta">3 Teach</p>
        <h1 className="mt-2 t-h1">A new hire works a case on their own screen.</h1>
        {usable.length === 0 ? (
          <div className="mt-8">
            <EmptyState sentence="No confirmed Work Map yet." href="/map" action="Open the maps" />
          </div>
        ) : (
          <div className="panel mt-8 space-y-4 p-6">
            <label className="block t-small">
              <span className="text-muted">Work Map</span>
              <select className="mt-1 w-full" value={from} onChange={(e) => setFrom(e.target.value)}>
                {usable.map((m) => (
                  <option key={m.sessionId} value={m.sessionId}>
                    {m.expert} · {m.startedAt ? new Date(m.startedAt).toLocaleString() : m.task} · {m.steps} steps · {m.rules} rules
                  </option>
                ))}
              </select>
            </label>
            <label className="block t-small">
              <span className="text-muted">Your name</span>
              <input className="mt-1 w-full" placeholder="Your first name" value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <button className="btn btn-primary w-full" type="button" data-testid="teach-start" onClick={() => void start()} disabled={!from}>
              Start and share the ERP tab
            </button>
          </div>
        )}
      </main>
    </AppShell>
  );
}
