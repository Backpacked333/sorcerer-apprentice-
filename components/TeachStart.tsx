"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function TeachStart({ maps, preselect }: { maps: { sessionId: string; expert: string; task: string; confirmed: boolean; rules: number; steps: number }[]; preselect?: string }) {
  const router = useRouter();
  const [from, setFrom] = useState(preselect ?? maps[0]?.sessionId ?? "");
  const [name, setName] = useState("Lena");
  const start = async () => {
    const res = await fetch("/api/sessions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ mode: "teach", expertName: name, task: maps.find((m) => m.sessionId === from)?.task, sourceMapSessionId: from }) });
    const { session } = await res.json();
    router.push(`/teach/${session.id}${window.location.search.includes("share=0") ? "?share=0" : ""}`);
  };
  return (
    <main className="grid-bg min-h-screen">
      <div className="mx-auto max-w-xl px-6 py-20">
        <p className="panel-title">3 · Teach</p>
        <h1 className="mt-2 text-3xl font-semibold">A new hire works a case the expert never showed.</h1>
        <div className="panel mt-8 space-y-4 p-6">
          <label className="block text-sm">
            <span className="text-muted">Work Map</span>
            <select className="mt-1 w-full" value={from} onChange={(e) => setFrom(e.target.value)}>
              {maps.map((m) => (
                <option key={m.sessionId} value={m.sessionId}>
                  {m.expert} · {m.task} · {m.rules} rules · {m.confirmed ? "confirmed" : "not confirmed"}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-muted">New hire</span>
            <input className="mt-1 w-full" value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <button className="btn btn-primary w-full" onClick={start} disabled={!from}>
            Start and share the ERP tab (Lena&apos;s queue)
          </button>
          {maps.length === 0 && <p className="text-xs text-amber">No compiled map yet. Run a capture and a debrief first, or seed one with npm run seed:session.</p>}
          {maps.find((m) => m.sessionId === from && !m.confirmed) && <p className="text-xs text-amber">This map is not confirmed yet. The tutor will still run it, but the demo bar is a confirmed map.</p>}
        </div>
      </div>
    </main>
  );
}
