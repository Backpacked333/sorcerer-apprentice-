import Link from "next/link";
import { getMap, listSessions } from "@/lib/store";
import { pickSample } from "@/lib/ui/landing";
import { BrowserCheck } from "@/components/ui/BrowserCheck";
import { HealthStrip } from "@/components/demo/HealthStrip";
import { seedDemo } from "@/lib/seed";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

const TESTS = [
  { n: "1", q: "When to ask", line: "Timing is code, not a prompt.", where: "The presence line in the side panel" },
  { n: "2", q: "What to ask", line: "It never asks what happened. The screen shows that.", where: "The candidate queue, inside the mechanism" },
  { n: "3", q: "When it has understood", line: "Only the expert's words fill a slot, and only an explicit yes locks the map.", where: "Gaps closed, on the map" },
  { n: "4", q: "Whether the new hire learned", line: "Rescued and learned are different labels.", where: "The mastery card at the end of Teach" },
  { n: "5", q: "Trust", line: "It sees a still at a time and keeps only what explains a decision.", where: "The struck band and the privacy ledger" },
];

export default async function Home() {
  const sessions = await listSessions();
  const samples = [];
  for (const s of sessions) {
    if (!s.id.startsWith("demo_")) continue;
    const map = await getMap(s.id);
    samples.push({ id: s.id, startedAt: s.startedAt, confirmedAt: map?.confirmedAt ?? null });
  }
  const sample = pickSample(samples);
  return (
    <main className="grid-bg min-h-screen">
      <div className="mx-auto max-w-5xl px-6 py-12">
        <BrowserCheck />
        <p className="t-meta">Simon · the AI Apprentice</p>
        <h1 className="mt-3 t-display">We know more than we can tell.</h1>
        <p className="mt-4 max-w-3xl t-body">
          Simon sits beside an expert while they work, asks why at the pauses, and turns what it learns into a tutor that stops a new hire before a wrong decision is saved.
        </p>
        <div className="mt-4"><HealthStrip /></div>
        <div className="doors mt-8">
          <section className="panel p-6">
            <h2 className="t-h2">See a finished Work Map and try the tutor</h2>
            <p className="mt-2 t-small text-muted">One click. No setup.</p>
            {sample ? (
              <div className="mt-4 flex flex-wrap gap-2">
                <Link className="btn btn-primary" href={`/map/${sample}`}>Open the Work Map</Link>
                <Link className="btn" href={`/teach?from=${sample}`}>Be the new hire</Link>
              </div>
            ) : (
              <form action={async () => {
                "use server";
                await seedDemo({ ifMissing: true });
                redirect("/map/demo_sabine_confirmed");
              }}>
                <p className="mt-4 t-small text-muted">A scripted example with synthetic evidence, separate from your own captures.</p>
                <button type="submit" className="btn btn-primary mt-4">Load the sample Work Map</button>
              </form>
            )}
          </section>
          <section className="panel p-6">
            <h2 className="t-h2">Run it yourself</h2>
            <p className="mt-2 t-small text-muted">About five minutes. Microphone and desktop Chrome. You will play the expert. Headphones recommended.</p>
            <Link className="btn btn-primary mt-4 inline-block" href="/capture">Start a capture</Link>
          </section>
        </div>
        <section className="mt-12 space-y-3">
          <h2 className="t-h2">The Apprentice Test</h2>
          {TESTS.map((t) => (
            <p key={t.n} className="t-small"><span className="text-ink">{t.n}. {t.q}.</span> {t.line} <span className="text-muted">Look at: {t.where}.</span></p>
          ))}
          <p className="t-small text-muted"><a className="underline" href="https://github.com/Backpacked333/sorcerer-apprentice-">Repository</a> · videos land with the submission.</p>
        </section>
      </div>
    </main>
  );
}
