"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/ui/AppShell";
import { EmptyState } from "@/components/ui/EmptyState";
import { GlassButton } from "@/components/glass";

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
  const chosen = usable.find((m) => m.sessionId === from);
  return (
    <AppShell step={3} sessionId={from || undefined} confirmed={!!from}>
      <main className="mx-auto max-w-[560px] px-4 py-12 sm:py-16">
        <p className="text-[10.5px] font-bold uppercase tracking-[.11em] text-[#a35f00]">3 Teach</p>
        <h1 className="mt-2 text-[28px] font-bold leading-[1.15] tracking-[-.022em] text-[#1d1d1f] sm:text-[32px]">A new hire works a case on their own screen.</h1>
        <p className="mt-3 text-[15px] leading-[1.5] text-[#6e6e73]">The tutor watches the new hire&apos;s screen and speaks only where the confirmed Work Map says the expert would stop.</p>
        {usable.length === 0 ? (
          <div className="mt-8">
            <EmptyState sentence="No confirmed Work Map yet." href="/map" action="Open the maps" />
          </div>
        ) : (
          <section
            className="glass-panel mt-8 flex flex-col gap-4 p-5 sm:p-6"
            style={{ borderRadius: 28, animation: "tc-rise .6s var(--ease-rise, cubic-bezier(.2,.9,.3,1)) both" }}
          >
            <label className="block">
              <span className="text-[12px] font-semibold text-[#6e6e73]">Work Map</span>
              <select className="input mt-1.5 w-full" value={from} onChange={(e) => setFrom(e.target.value)}>
                {usable.map((m) => (
                  <option key={m.sessionId} value={m.sessionId}>
                    {m.expert} · {m.startedAt ? new Date(m.startedAt).toLocaleString() : m.task} · {m.steps} steps · {m.rules} rules
                  </option>
                ))}
              </select>
            </label>
            {chosen ? (
              <p className="text-[13px] leading-[1.45] text-[#3a3a3c]">
                {chosen.task} · {chosen.steps} steps · {chosen.rules} rules, confirmed by {chosen.expert}
              </p>
            ) : null}
            <label className="block">
              <span className="text-[12px] font-semibold text-[#6e6e73]">Your name</span>
              <input className="input mt-1.5 w-full" placeholder="Your first name" value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <GlassButton variant="amber" size={44} className="w-full" type="button" data-testid="teach-start" onClick={() => void start()} disabled={!from}>
              Start and share the ERP tab
            </GlassButton>
          </section>
        )}
      </main>
    </AppShell>
  );
}
