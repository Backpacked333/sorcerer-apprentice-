"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { HealthStrip } from "./HealthStrip";
import { OpenErpButton } from "@/components/ui/OpenErpButton";

const CUES = [
  "0:00 Capture. Consent, start. Open the first routine invoice and post it. The apprentice stays quiet.",
  "0:30 Change the equipment invoice's cost center, then pause. Let the question land.",
  "1:30 Set the subsidiary invoice to second approval. The question should ask for a limit.",
  "2:30 Hold the December maintenance invoice. Say scratch that once. The red band and the ledger move.",
  "3:30 Done. Answer the debrief. The open slots are the questions.",
  "4:30 Correct one detail, then confirm. The map locks.",
  "5:00 Open a judgment step: still, decision, the expert's words, guardrails.",
  "5:30 New hire, first equipment invoice. The tutor speaks before the save, then the replay. The next routine invoice stays quiet.",
  "6:15 If there is time: load policy.json. The routine queue stops on the unknown supplier.",
];

const TESTS = [
  "When to ask — timing is code, not a prompt. Look at the presence line.",
  "What to ask — it never asks what happened. Look in the mechanism, at the candidate queue.",
  "When it has understood — only the expert's words fill a slot, and only an explicit yes locks the map.",
  "Whether the new hire learned — rescued and learned are different labels, on the mastery card.",
  "Trust — a still at a time, and only what explains a decision. Look at the struck band and the ledger.",
];

export function DemoRoom({ latestMap, sampleMap }: { latestMap?: string; sampleMap?: string }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);

  const reset = async () => {
    setBusy(true);
    setNote("");
    try {
      const demo = await fetch("/api/demo/reset", { method: "POST" });
      if (demo.ok) {
        setNote("Reset. Queues, sample sessions and the guard are clear.");
        return;
      }
      for (const queue of ["expert", "newhire", "autopilot"]) {
        await fetch(`/api/erp/reset?queue=${queue}`, { method: "POST" });
      }
      await fetch("/api/teach/guard", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "disarm" }),
      });
      setNote("Queues reset and the guard is disarmed. Samples are reseeded with npm run seed:session.");
    } catch {
      setNote("Reset failed. Nothing was confirmed changed.");
    } finally {
      setBusy(false);
    }
  };

  const twin = (href: string, label: string) => (
    <span className="flex flex-wrap gap-2">
      <Link className="btn" href={href}>{label}</Link>
      <Link className="btn" href={href.includes("?") ? `${href}&presenter=1` : `${href}?presenter=1`}>{label} · presenter</Link>
    </span>
  );

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-6 py-12">
      <p className="t-meta">Presenter</p>
      <h1 className="t-h1">Demo control</h1>
      <p className="t-display" data-testid="demo-origin">{origin || "This origin"}</p>
      <p className="t-small text-muted">Use only this origin. A second host drops the sandbox events.</p>
      <HealthStrip />
      <section className="panel space-y-3 p-4">
        <p className="panel-title">Reset</p>
        <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void reset()}>{busy ? "Resetting…" : "Reset the sandbox"}</button>
        {note && <p className="t-small">{note}</p>}
      </section>
      <section className="panel space-y-3 p-4">
        <p className="panel-title">Launch</p>
        {twin("/capture", "Capture, workspace")}
        <div className="flex flex-wrap items-center gap-2">
          <OpenErpButton queue="expert">Open the ERP window</OpenErpButton>
          <Link className="btn" href="/capture?layout=companion">Capture, two windows</Link>
          <Link className="btn" href="/capture?layout=companion&presenter=1">Capture, two windows · presenter</Link>
        </div>
        {latestMap ? twin(`/map/${latestMap}`, "Latest map") : <p className="t-small text-muted">No capture session yet.</p>}
        {sampleMap ? twin(`/teach?from=${sampleMap}`, "Teach on the sample") : <p className="t-small text-muted">No confirmed sample. Run npm run seed:session.</p>}
        {sampleMap && twin(`/map/${sampleMap}`, "Sample map")}
      </section>
      <section className="panel space-y-2 p-4">
        <p className="panel-title">Cue card</p>
        {CUES.map((line) => <p key={line} className="t-small">{line}</p>)}
        {TESTS.map((line) => <p key={line} className="t-small text-muted">{line}</p>)}
      </section>
    </main>
  );
}
