import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { getMap, listSessions } from "@/lib/store";
import { pickSample } from "@/lib/ui/landing";
import { BrowserCheck } from "@/components/ui/BrowserCheck";
import { HealthStrip } from "@/components/demo/HealthStrip";
import { Orb } from "@/components/glass";
import { HeroIllustration } from "@/components/landing/HeroIllustration";
import { CyclingOrb } from "@/components/landing/CyclingOrb";
import { PlatformMiniMap, type MiniMapData } from "@/components/landing/PlatformMiniMap";

export const dynamic = "force-dynamic";

const REPO = "https://github.com/Backpacked333/sorcerer-apprentice-";

// Every "Look at" target is a label that exists under that name in the product.
const TESTS = [
  { n: "1", dot: "#d2d9e3", q: "When to ask", line: "Timing is code, not a prompt. It stays quiet while you type, read or talk.", where: "the companion's glow, and the Governor under Show the mechanism" },
  { n: "2", dot: "#f5a623", q: "What to ask", line: "It never asks what happened. The screen shows that.", where: "Candidate questions, under Show the mechanism" },
  { n: "3", dot: "#b7a6ff", q: "When it has understood", line: "Only the expert's words fill a slot, and only an explicit yes locks the map.", where: "Gaps closed, on the Work Map" },
  { n: "4", dot: "#22b45e", q: "Whether the new hire learned", line: "Rescued and learned are different labels.", where: "the Mastery card at the end of Teach" },
  { n: "5", dot: "#e5484d", q: "Trust", line: "It sees a still at a time and keeps only what explains a decision.", where: "Struck from the record, and the Privacy ledger" },
];

const LIMITS: { lead: string; text: string }[] = [
  { lead: "Seen is not reported.", text: "Vision events are badged seen, ERP telemetry is badged erp. They are never presented as the same source." },
  { lead: "Off the record means gone.", text: "It strikes the transcript, the events, the frames and the clips in this app. The voice provider keeps conversation data under the account's retention settings." },
  { lead: "Only a confirmed map can teach.", text: "The model does not confirm its own output." },
  { lead: "The rules are the expert's.", text: "Whatever the expert says in that session. No business rule is hardcoded into the product." },
  { lead: "Masks before it leaves.", text: "In the workspace, names, emails, phones and IBANs are painted over before a frame leaves the browser." },
  { lead: "Prevention, where it's integrated.", text: "Stopping a save is guaranteed in the sandbox ERP. On a third-party application it is a warning." },
];

const STEPS = [
  { mood: "asking" as const, tag: "01 · Capture", color: "#a35f00", title: "It asks why at the pauses.", body: "The expert shares their screen and works a real task. Tacit stays quiet while they type, read or talk, and asks one short question at a natural pause — about something visible on screen.", foot: "Read by the expert, who confirms it." },
  { mood: "understood" as const, tag: "02 · Map", color: "#7a5cff", title: "It explains it back until it's right.", body: "A short spoken debrief closes the gaps. Then Tacit explains the whole process in its own words until the expert says: yes, that is how it works. Every step links to a screen moment and the expert's words.", foot: "Read by the new hire, who is tutored from it." },
  { mood: "step" as const, tag: "03 · Teach", color: "#b4501f", title: "It steps in before the save.", body: "The new hire works a case on their own screen. The tutor stays quiet and catches a wrong decision when the field changes, before it is saved — in the expert's own words.", foot: "Read by an agent that loads the same rules." },
];

const amberLink: CSSProperties = {
  display: "inline-flex", alignItems: "center", height: 44, padding: "0 20px", borderRadius: 22, fontSize: 14.5, fontWeight: 600, color: "#6b3f00",
  background: "linear-gradient(180deg,rgba(255,222,160,.95),rgba(255,196,95,.7))",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,.8),inset 0 0 0 .5px rgba(200,120,0,.2),0 8px 24px rgba(245,166,35,.22)",
};
const glassLink: CSSProperties = {
  display: "inline-flex", alignItems: "center", height: 44, padding: "0 20px", borderRadius: 22, fontSize: 14.5, fontWeight: 500, color: "#1d1d1f",
  background: "rgba(255,255,255,.75)", boxShadow: "inset 0 1px 0 #fff,0 0 0 .5px rgba(0,0,0,.1)",
};
const LIFT = "transition-transform duration-200 hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a35f00]";

function Eyebrow({ children }: { children: ReactNode }) {
  return <p style={{ margin: 0, fontSize: 13, fontWeight: 600, letterSpacing: ".08em", color: "#8e8e93", textTransform: "uppercase" }}>{children}</p>;
}
function H2({ children }: { children: ReactNode }) {
  return <h2 style={{ margin: "10px 0 0", fontSize: "clamp(32px,4.4vw,52px)", lineHeight: 1.05, fontWeight: 700, letterSpacing: "-.035em", textWrap: "balance" }}>{children}</h2>;
}

async function loadSample(): Promise<{ sample?: string; mini?: MiniMapData }> {
  const sessions = await listSessions();
  const samples = [];
  const maps = new Map<string, Awaited<ReturnType<typeof getMap>>>();
  for (const s of sessions) {
    if (!s.id.startsWith("demo_")) continue;
    const map = await getMap(s.id);
    maps.set(s.id, map);
    samples.push({ id: s.id, startedAt: s.startedAt, confirmedAt: map?.confirmedAt ?? null });
  }
  const sample = pickSample(samples);
  const map = sample ? maps.get(sample) : undefined;
  if (!sample || !map?.confirmedAt) return { sample };
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  const mentioned = Array.from(new Set(map.rules.map((r) => r.stopAndAsk?.who?.trim()).filter((w): w is string => !!w).map(cap)));
  return { sample, mini: { task: map.task, expert: map.expert.name, rules: map.rules.length, steps: map.steps.length, mentioned } };
}

export default async function Home() {
  const { sample, mini } = await loadSample();
  return (
    <main className="relative min-h-screen overflow-x-clip" style={{ background: "#f7f7f9", color: "#1d1d1f" }}>
      {/* drifting pastel blobs (decorative) */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div style={{ position: "absolute", top: -180, left: -160, width: 720, height: 720, borderRadius: "50%", background: "radial-gradient(circle,rgba(255,200,230,.45),rgba(255,200,230,0) 65%)", animation: "tc-drift 16s ease-in-out infinite" }} />
        <div style={{ position: "absolute", top: 120, right: -200, width: 760, height: 760, borderRadius: "50%", background: "radial-gradient(circle,rgba(185,220,255,.45),rgba(185,220,255,0) 65%)", animation: "tc-drift 20s ease-in-out infinite reverse" }} />
        <div style={{ position: "absolute", top: 900, left: "30%", width: 640, height: 640, borderRadius: "50%", background: "radial-gradient(circle,rgba(255,228,170,.35),rgba(255,228,170,0) 65%)", animation: "tc-drift 18s ease-in-out infinite" }} />
      </div>

      {/* sticky glass nav */}
      <div className="sticky top-3 z-20 px-4">
        <nav aria-label="Main" className="glass-nav mx-auto flex max-w-[1120px] items-center gap-x-6 gap-y-1" style={{ minHeight: 52, padding: "6px 6px 6px 18px", borderRadius: 26 }}>
          <a href="#top" className="flex items-center gap-2" style={{ fontSize: 16, fontWeight: 600, color: "#1d1d1f" }}>
            <span aria-hidden style={{ width: 12, height: 12, borderRadius: 3, background: "#f5a623" }} />Tacit
          </a>
          <div className="hidden flex-wrap gap-x-5 gap-y-1 md:flex" style={{ fontSize: 14 }}>
            <a href="#how" className="text-[#3a3a3c] hover:text-[#a35f00]">How it works</a>
            <a href="#test" className="text-[#3a3a3c] hover:text-[#a35f00]">The Apprentice Test</a>
            <a href="#platform" className="text-[#3a3a3c] hover:text-[#a35f00]">Platform</a>
            <a href="#trust" className="text-[#3a3a3c] hover:text-[#a35f00]">Trust</a>
          </div>
          <Link href="/capture" className={`ml-auto ${LIFT}`} style={{ ...amberLink, height: 40, padding: "0 18px", fontSize: 14, boxShadow: "inset 0 1px 0 rgba(255,255,255,.8),inset 0 0 0 .5px rgba(200,120,0,.2)" }}>See it live</Link>
        </nav>
      </div>

      {/* hero */}
      <section id="top" className="relative mx-auto grid max-w-[1120px] scroll-mt-20 grid-cols-1 items-center gap-x-12 gap-y-7 lg:gap-y-10 px-6 pt-8 pb-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.04fr)] lg:pt-12">
        <div className="flex min-w-0 flex-col gap-4 lg:gap-5">
          <BrowserCheck />
          <p style={{ margin: 0, fontSize: 13, fontWeight: 600, letterSpacing: ".08em", color: "#a35f00" }}>TACIT · THE AI APPRENTICE</p>
          <h1 style={{ margin: 0, fontSize: "clamp(42px,5.6vw,76px)", lineHeight: 1, fontWeight: 700, letterSpacing: "-.04em", textWrap: "balance" }}>We know more than we can tell.</h1>
          <p style={{ margin: 0, maxWidth: 520, fontSize: "clamp(16px,1.5vw,19px)", lineHeight: 1.5, color: "#3a3a3c", textWrap: "pretty" }}>
            Tacit sits beside an expert while they work, asks why at the pauses, and turns what it learns into a tutor that stops a new hire before a wrong decision is saved.
          </p>
        </div>
        <div className="order-3 min-w-0 pt-3 pb-6 lg:order-none lg:pt-0 lg:pb-0">
          <HeroIllustration />
        </div>
        <div className="order-2 grid min-w-0 gap-3 sm:grid-cols-2 lg:order-none lg:col-span-2 lg:gap-5" id="doors">
          <section className="glass-panel relative flex flex-col gap-2 p-5 lg:p-6" style={{ borderRadius: 26 }}>
            <h2 style={{ margin: 0, fontSize: 20, lineHeight: 1.25, fontWeight: 600, letterSpacing: "-.015em" }}>See a finished Work Map and try the tutor</h2>
            <p style={{ margin: 0, fontSize: 14, color: "#6e6e73" }}>One click. No setup.</p>
            {sample ? (
              <div className="mt-2 flex flex-wrap gap-2">
                <Link className={LIFT} style={amberLink} href={`/map/${sample}`}>Open the Work Map</Link>
                <Link className={LIFT} style={glassLink} href={`/teach?from=${sample}`}>Be the new hire</Link>
              </div>
            ) : (
              <p style={{ margin: "8px 0 0", fontSize: 14, color: "#6e6e73" }}>No sample is loaded. Run npm run seed:session, then reload.</p>
            )}
          </section>
          <section className="glass-panel relative flex flex-col gap-2 p-5 lg:p-6" style={{ borderRadius: 26 }}>
            <h2 style={{ margin: 0, fontSize: 20, lineHeight: 1.25, fontWeight: 600, letterSpacing: "-.015em" }}>Run it yourself</h2>
            <p style={{ margin: 0, fontSize: 14, color: "#6e6e73" }}>About five minutes. Microphone and desktop Chrome. You will play the expert. Headphones recommended.</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Link className={LIFT} style={amberLink} href="/capture">Start a capture</Link>
              <Link className={LIFT} style={glassLink} href="/demo/companion">Tour the companion (demo)</Link>
            </div>
          </section>
          <div className="sm:col-span-2"><HealthStrip /></div>
        </div>
      </section>

      {/* story */}
      <section className="relative mx-auto max-w-[1120px] px-6 pt-10 pb-5">
        <p style={{ margin: 0, maxWidth: 820, fontSize: "clamp(20px,2.3vw,28px)", lineHeight: 1.4, fontWeight: 500, letterSpacing: "-.015em", textWrap: "pretty" }}>
          An expert has run accounts payable for twenty-four years. Which invoice to question, which to hold, who to call: none of it is written down, it lives in judgment calls made without a word.{" "}
          <span style={{ color: "#8e8e93" }}>The expert retires in eighteen months. A new hire started on Monday.</span>
        </p>
      </section>

      {/* how it works */}
      <section id="how" className="relative mx-auto max-w-[1120px] scroll-mt-20 px-6 pt-20 pb-5">
        <Eyebrow>How it works</Eyebrow>
        <H2>One pipeline. One artifact, the Work Map. Three readers.</H2>
        <div className="mt-10 grid gap-5" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))" }}>
          {STEPS.map((s) => (
            <article key={s.tag} className="glass-panel flex flex-col gap-3" style={{ borderRadius: 28, padding: 26 }}>
              <div className="flex items-center gap-3">
                <Orb mood={s.mood} size={30} full follow={false} />
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 600, color: s.color }}>{s.tag}</span>
              </div>
              <h3 style={{ margin: 0, fontSize: 19, fontWeight: 600, letterSpacing: "-.015em" }}>{s.title}</h3>
              <p style={{ margin: 0, fontSize: 15, lineHeight: 1.55, color: "#3a3a3c" }}>{s.body}</p>
              <p style={{ margin: "auto 0 0", fontSize: 13, color: "#8e8e93" }}>{s.foot}</p>
            </article>
          ))}
        </div>
      </section>

      {/* the apprentice test */}
      <section id="test" className="relative mx-auto max-w-[1120px] scroll-mt-20 px-6 pt-24 pb-5">
        <Eyebrow>The Apprentice Test</Eyebrow>
        <H2>An apprentice, not a recorder.</H2>
        <ol className="mt-10" style={{ listStyle: "none", padding: 0, margin: "40px 0 0" }}>
          {TESTS.map((t) => (
            <li key={t.n} className="grid gap-x-4 gap-y-2 py-5 md:grid-cols-[56px_minmax(0,1fr)_minmax(0,300px)]" style={{ borderTop: ".5px solid rgba(0,0,0,.1)" }}>
              <span className="flex items-center gap-2" style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "#6e6e73", height: 26 }}>
                {t.n}
                <span aria-hidden style={{ width: 10, height: 10, borderRadius: 5, background: t.dot, boxShadow: `0 0 8px ${t.dot}` }} />
              </span>
              <div>
                <h3 style={{ margin: 0, fontSize: 20, fontWeight: 600, letterSpacing: "-.015em" }}>{t.q}</h3>
                <p style={{ margin: "4px 0 0", fontSize: 15.5, lineHeight: 1.5, color: "#3a3a3c" }}>{t.line}</p>
              </div>
              <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.45, color: "#8e8e93", alignSelf: "center" }}>Look at: {t.where}.</p>
            </li>
          ))}
        </ol>
      </section>

      {/* the platform */}
      <section id="platform" className="relative mx-auto grid max-w-[1120px] scroll-mt-20 grid-cols-1 items-center gap-12 px-6 pt-24 pb-5 lg:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-5">
          <div>
            <Eyebrow>The platform</Eyebrow>
            <H2>A living memory of every role.</H2>
          </div>
          <p style={{ margin: 0, fontSize: 17, lineHeight: 1.55, color: "#3a3a3c", textWrap: "pretty" }}>
            Every capture adds to what Tacit knows about a role — its decisions, the reasons in the expert&apos;s words, the guardrails and who to ask. Roles appear on the company map as experts mention them, so you can see whose knowledge is captured and whose isn&apos;t yet.
          </p>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8, fontSize: 15 }}>
            {[["#f5a623", "Company map: roles, people and the rules between them"], ["#8f7bff", "Role memory: what it knows, and when it learned it"], ["#3b82f6", "Ontology: the data a role works with, growing over time"]].map(([c, t]) => (
              <li key={t} className="flex items-center gap-2"><span aria-hidden style={{ width: 7, height: 7, borderRadius: 4, background: c }} />{t}</li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            <Link className={LIFT} style={glassLink} href="/platform">Open the company map →</Link>
            <Link className={LIFT} style={glassLink} href="/platform/demo">Explore a fictional company (demo)</Link>
          </div>
        </div>
        <div className="min-w-0">
          {mini ? (
            <PlatformMiniMap data={mini} />
          ) : (
            <p style={{ margin: 0, fontSize: 15, color: "#6e6e73" }}>The company map fills in from confirmed captures. No confirmed sample is loaded yet.</p>
          )}
        </div>
      </section>

      {/* honest limits */}
      <section id="trust" className="relative mx-auto max-w-[1120px] scroll-mt-20 px-6 pt-24 pb-5">
        <Eyebrow>Honest limits</Eyebrow>
        <H2>What it keeps, and what it doesn&apos;t claim.</H2>
        <div className="mt-10 grid gap-x-10" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(min(300px,100%),1fr))" }}>
          {LIMITS.map((l) => (
            <p key={l.lead} style={{ margin: 0, padding: "18px 0", borderTop: ".5px solid rgba(0,0,0,.1)", fontSize: 15.5, lineHeight: 1.55, color: "#3a3a3c" }}>
              <b style={{ color: "#1d1d1f", fontWeight: 600 }}>{l.lead}</b> {l.text}
            </p>
          ))}
        </div>
      </section>

      {/* closer */}
      <section className="relative mx-auto flex max-w-[1120px] flex-col items-center gap-6 px-6 pt-28 pb-14 text-center">
        <CyclingOrb size={84} />
        <h2 style={{ margin: 0, fontSize: "clamp(36px,5.4vw,68px)", lineHeight: 1.04, fontWeight: 700, letterSpacing: "-.04em", textWrap: "balance", maxWidth: 900 }}>People first, then agents, then a living memory.</h2>
        <div className="flex flex-wrap justify-center gap-2">
          <Link className={LIFT} style={amberLink} href="/capture">Start a capture</Link>
          <Link className={LIFT} style={glassLink} href="/platform">Open the platform</Link>
        </div>
      </section>

      <footer className="relative mx-auto flex max-w-[1120px] flex-wrap items-center gap-x-6 gap-y-2 px-6 pt-7 pb-10" style={{ borderTop: ".5px solid rgba(0,0,0,.08)", fontSize: 13, color: "#8e8e93" }}>
        <span className="flex items-center gap-2" style={{ fontWeight: 600, color: "#1d1d1f" }}><span aria-hidden style={{ width: 10, height: 10, borderRadius: 2.5, background: "#f5a623" }} />Tacit</span>
        <span>Built for the AI Apprentice challenge · Hack-Nation × ElevenLabs</span>
        <a className="ml-auto hover:text-[#a35f00]" style={{ color: "#6e6e73" }} href={REPO}>Repository ↗</a>
      </footer>
    </main>
  );
}
