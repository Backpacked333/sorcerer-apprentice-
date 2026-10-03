import Link from "next/link";

const cards = [
  { href: "/erp", title: "Sandbox ERP", body: "Accounts payable at a machine builder near Stuttgart. Three invoices for the expert, three for the new hire, five for the autopilot.", tag: "sandbox" },
  { href: "/capture", title: "1 · Capture", body: "The expert shares the ERP tab. The apprentice watches, stays quiet while she works, asks why at the pause.", tag: "expert" },
  { href: "/map", title: "2 · Map", body: "The debrief closes the open slots, the teach-back is confirmed, and the Work Map becomes clickable.", tag: "debrief" },
  { href: "/teach", title: "3 · Teach", body: "The new hire works a case the expert never showed. The tutor steps in before a wrong value is saved.", tag: "new hire" },
];

export default function Home() {
  return (
    <main className="grid-bg min-h-screen">
      <div className="mx-auto max-w-5xl px-6 py-16">
        <p className="panel-title">Tacit · the AI Apprentice</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">We know more than we can tell.</h1>
        <p className="mt-3 max-w-2xl text-muted">
          A recorder captures what happened. An automation tool copies the clicks. An apprentice asks why, learns the limit and the moment to stop, and refuses to say it
          understands until the expert says so.
        </p>
        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {cards.map((c) => (
            <Link key={c.href} href={c.href} className="panel p-5 transition hover:border-amber">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-medium">{c.title}</h2>
                <span className="tag">{c.tag}</span>
              </div>
              <p className="mt-2 text-sm text-muted">{c.body}</p>
            </Link>
          ))}
        </div>
        <p className="mt-10 text-xs text-muted">
          Keyless mode runs the whole flow with the ERP&apos;s own telemetry and the browser&apos;s speech synthesis. Add ElevenLabs and AI Gateway keys in <span className="mono">.env.local</span> for the real voice agents and vision.
        </p>
      </div>
    </main>
  );
}
