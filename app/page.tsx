import Link from "next/link";
import { getMap, listSessions } from "@/lib/store";
import { pickSample } from "@/lib/ui/landing";

export const dynamic = "force-dynamic";

const knowledge = [
  { title: "The decision", body: "What changed, and at which moment in the work." },
  { title: "The reason", body: "The expert’s own words, attached to that moment." },
  { title: "The boundaries", body: "When the approach changes. When to stop and ask." },
];

export default async function Home() {
  const sessions = (await listSessions()).filter((s) => s.mode === "capture" && s.id.startsWith("demo_"));
  const sample = pickSample(await Promise.all(sessions.map(async (session) => ({ ...session, map: await getMap(session.id) }))));
  const sampleId = sample ? encodeURIComponent(sample.id) : undefined;
  return (
    <main className="min-h-screen">
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-5">
          <Link href="/" className="flex items-center gap-3 text-lg font-semibold tracking-tight" aria-label="Tacit home">
            <span className="brand-mark" aria-hidden="true">t</span>Tacit
          </Link>
          <nav aria-label="Main navigation" className="flex flex-wrap gap-6 text-sm text-muted">
            <Link href="/map" className="hover:text-ink">Work Maps</Link>
            <Link href="/capture" className="hover:text-ink">Capture</Link>
            <Link href="/teach" className="hover:text-ink">Practice</Link>
          </nav>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-6 py-12 md:py-20">
        <div className="grid items-start gap-12 lg:grid-cols-[1.1fr_1fr] lg:gap-20">
          <section aria-labelledby="welcome-title">
            <p className="panel-title">Experience, made shareable</p>
            <h1 id="welcome-title" className="mt-5 max-w-xl text-4xl font-medium leading-[1.12] tracking-tight md:text-6xl">
              Keep the know-how.<br /><span className="text-amber">Not just the steps.</span>
            </h1>
            <p className="mt-6 max-w-lg text-lg leading-relaxed text-muted">
              The small decisions. The reasons behind them. The moment to ask for help.
              Turn an expert’s experience into a Work Map someone else can learn from.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              {sampleId ? <>
                <Link href={`/map/${sampleId}`} className="btn btn-primary px-5 py-3">Open a finished Work Map <span aria-hidden="true">↗</span></Link>
                <Link href={`/teach?from=${sampleId}`} className="btn px-5 py-3">Be the new hire</Link>
              </> : <button type="button" className="btn btn-primary px-5 py-3" disabled>No sample Work Map yet</button>}
              <Link href="/capture" className="btn px-5 py-3">Share your know-how</Link>
            </div>
            <p className="mt-4 text-sm text-muted">{sampleId ? "Explore a confirmed sample, or capture something new." : "No confirmed sample is available. You can still capture something new."}</p>
          </section>
          <section aria-labelledby="knowledge-title" className="panel p-6 md:p-8">
            <p className="panel-title">Inside a Work Map</p>
            <h2 id="knowledge-title" className="mt-2 text-2xl font-medium tracking-tight">The why belongs with the work.</h2>
            <p className="mt-3 text-sm leading-relaxed text-muted">A connected record of decisions, evidence and the expert’s reasoning—not a transcript to sift through.</p>
            <ol className="knowledge-outline mt-7">
              {knowledge.map((item, index) => (
                <li key={item.title} className="relative pb-7 pl-10 last:pb-0">
                  <span className="knowledge-node mono" aria-hidden="true">{index + 1}</span>
                  <h3 className="font-medium">{item.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted">{item.body}</p>
                </li>
              ))}
            </ol>
            <p className="mt-7 border-t border-line pt-5 text-sm text-muted">Missing explanations stay visible. The expert decides when the map is right.</p>
          </section>
        </div>
        <section aria-label="How Tacit works" className="mt-16 grid gap-8 border-t border-line pt-8 md:grid-cols-3">
          <div><p className="panel-title">01 · Capture</p><h2 className="mt-2 text-lg font-medium">Make room for the expert.</h2><p className="mt-2 text-sm leading-relaxed text-muted">Work through a case and share the reasoning behind a decision. You choose what to share.</p></div>
          <div><p className="panel-title">02 · Map</p><h2 className="mt-2 text-lg font-medium">Give knowledge a shape.</h2><p className="mt-2 text-sm leading-relaxed text-muted">Connect the screen moment, the explanation and its limits. Review and confirm what was learned.</p></div>
          <div><p className="panel-title">03 · Teach</p><h2 className="mt-2 text-lg font-medium">Let someone else try.</h2><p className="mt-2 text-sm leading-relaxed text-muted">Use the confirmed map on a new case. See what was understood independently and where help was needed.</p></div>
        </section>
        <footer className="mt-12 flex flex-wrap items-center justify-between gap-4 border-t border-line pt-6 text-sm text-muted">
          <p>Keyless mode uses ERP telemetry and browser speech—not live vision or ElevenLabs.</p>
          <Link href="/erp" className="underline underline-offset-4 hover:text-ink">Open the ERP sandbox</Link>
        </footer>
      </div>
    </main>
  );
}
