"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import { HealthStrip } from "./HealthStrip";
import { OpenErpButton } from "@/components/ui/OpenErpButton";
import { GlassButton } from "@/components/glass";

// Presenter cues describe actions only. The decisions and reasons come from the expert, live.
const CUES = [
  "0:00 Capture. Consent, start. Open the first routine invoice and post it. The apprentice stays quiet.",
  "0:30 Make a judgment call on the next invoice, then pause. Let the question land.",
  "1:30 Make a second judgment call. The question should ask for a limit.",
  "2:30 Make a third call. Say scratch that once. The red band and the ledger move.",
  "3:30 Done. Answer the debrief. The open slots are the questions.",
  "4:30 Correct one detail, then confirm. The map locks.",
  "5:00 Open a judgment step: still, decision, the expert's words, guardrails.",
  "5:30 New hire, first invoice that needs judgment. The tutor speaks before the save, then the replay. The next routine invoice stays quiet.",
  "6:15 If there is time: load policy.json. The routine queue stops where the expert would.",
];

// Same targets as the landing page's Apprentice Test (labels that exist in the product).
const TESTS = [
  "When to ask — timing is code, not a prompt. Look at the companion's glow and the Governor, under Show the mechanism.",
  "What to ask — it never asks what happened. Look at Candidate questions, under Show the mechanism.",
  "When it has understood — only the expert's words fill a slot, and only an explicit yes locks the map. Look at Gaps closed.",
  "Whether the new hire learned — rescued and learned are different labels, on the Mastery card.",
  "Trust — a still at a time, and only what explains a decision. Look at Struck from the record and the Privacy ledger.",
];

const link: CSSProperties = {
  display: "inline-flex", alignItems: "center", height: 36, padding: "0 15px", borderRadius: 18, fontSize: 13.5, fontWeight: 500, color: "#1d1d1f",
  background: "rgba(255,255,255,.75)", boxShadow: "inset 0 1px 0 #fff,0 0 0 .5px rgba(0,0,0,.1)",
};
const LIFT = "transition-transform duration-200 hover:-translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a35f00]";

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="glass-panel flex flex-col gap-3 p-5" style={{ borderRadius: 24 }}>
      <p style={{ margin: 0, fontSize: 12, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: "#8e8e93" }}>{title}</p>
      {children}
    </section>
  );
}

export function DemoRoom({ latestMap, sampleMap }: { latestMap?: string; sampleMap?: string }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);

  const reset = async () => {
    setBusy(true);
    setNote("");
    const failed: string[] = [];
    try {
      for (const queue of ["expert", "newhire", "autopilot"]) {
        const res = await fetch(`/api/erp/reset?queue=${queue}`, { method: "POST" }).catch(() => null);
        if (!res?.ok) failed.push(`${queue} queue`);
      }
      const guard = await fetch("/api/teach/guard", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "disarm" }),
      }).catch(() => null);
      if (!guard?.ok) failed.push("save guard");
      setNote(
        failed.length
          ? `Not everything reset: ${failed.join(", ")} failed. Check the server log.`
          : "Queues reset and the guard is disarmed. Samples are reseeded with npm run seed:session.",
      );
    } finally {
      setBusy(false);
    }
  };

  const twin = (href: string, label: string) => (
    <span className="flex flex-wrap gap-2">
      <Link className={LIFT} style={link} href={href}>{label}</Link>
      <Link className={LIFT} style={link} href={href.includes("?") ? `${href}&presenter=1` : `${href}?presenter=1`}>{label} · presenter</Link>
    </span>
  );

  return (
    <main className="min-h-screen" style={{ background: "#f4f4f7", color: "#1d1d1f" }}>
      <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-12 sm:px-6">
        <div className="flex flex-col gap-2">
          <p style={{ margin: 0, fontSize: 13, fontWeight: 600, letterSpacing: ".08em", color: "#a35f00" }}>PRESENTER</p>
          <h1 style={{ margin: 0, fontSize: "clamp(32px,4.4vw,48px)", lineHeight: 1.05, fontWeight: 700, letterSpacing: "-.035em" }}>Demo control</h1>
          <p data-testid="demo-origin" style={{ margin: "6px 0 0", fontFamily: "var(--font-mono)", fontSize: 20, fontWeight: 600, overflowWrap: "anywhere" }}>{origin || "This origin"}</p>
          <p style={{ margin: 0, fontSize: 14, color: "#6e6e73" }}>Use only this origin. A second host drops the sandbox events.</p>
          <div className="mt-1"><HealthStrip /></div>
        </div>

        <Panel title="Reset">
          <div><GlassButton variant="amber" size={40} disabled={busy} loading={busy} onClick={() => void reset()}>{busy ? "Resetting…" : "Reset the sandbox"}</GlassButton></div>
          {note && <p role="status" style={{ margin: 0, fontSize: 14 }}>{note}</p>}
        </Panel>

        <Panel title="Launch">
          {twin("/capture", "Capture, workspace")}
          <div className="flex flex-wrap items-center gap-2">
            <OpenErpButton queue="expert">Open the ERP window</OpenErpButton>
            <Link className={LIFT} style={link} href="/capture?layout=companion">Capture, two windows</Link>
            <Link className={LIFT} style={link} href="/capture?layout=companion&presenter=1">Capture, two windows · presenter</Link>
          </div>
          {latestMap ? twin(`/map/${latestMap}`, "Latest map") : <p style={{ margin: 0, fontSize: 14, color: "#6e6e73" }}>No capture session yet.</p>}
          {sampleMap ? twin(`/teach?from=${sampleMap}`, "Teach on the sample") : <p style={{ margin: 0, fontSize: 14, color: "#6e6e73" }}>No confirmed sample. Run npm run seed:session.</p>}
          {sampleMap && twin(`/map/${sampleMap}`, "Sample map")}
          <span className="flex flex-wrap gap-2">
            <Link className={LIFT} style={link} href="/platform">Company map</Link>
          </span>
        </Panel>

        <Panel title="Demo mode · fictional data">
          <p style={{ margin: 0, fontSize: 14, color: "#3a3a3c" }}>Clearly labelled pages with fictional data, for showing every interface without a capture.</p>
          <span className="flex flex-wrap gap-2">
            <Link className={LIFT} style={link} href="/demo/companion">Companion states and scripted tour</Link>
            <Link className={LIFT} style={link} href="/platform/demo">Platform demo</Link>
          </span>
        </Panel>

        <Panel title="Cue card">
          {CUES.map((line) => <p key={line} style={{ margin: 0, fontSize: 14, lineHeight: 1.45 }}>{line}</p>)}
          <div style={{ borderTop: ".5px solid rgba(0,0,0,.1)", margin: "4px 0" }} />
          {TESTS.map((line) => <p key={line} style={{ margin: 0, fontSize: 14, lineHeight: 1.45, color: "#6e6e73" }}>{line}</p>)}
        </Panel>
      </div>
    </main>
  );
}
