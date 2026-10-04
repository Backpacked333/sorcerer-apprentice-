import type { Metadata } from "next";
import Link from "next/link";
import { DemoBanner } from "@/components/glass";
import { CompanionTour } from "@/components/demo/companion/CompanionTour";
import { CompanionGallery } from "@/components/demo/companion/CompanionGallery";

export const metadata: Metadata = { title: "Companion states · Demo mode · Tacit" };

export default function CompanionDemoPage() {
  return (
    <main className="min-h-screen overflow-x-clip" style={{ background: "#f4f4f7", color: "#1d1d1f" }}>
      <DemoBanner href="/" />
      <div className="mx-auto flex max-w-[1180px] flex-col gap-12 px-4 pt-10 pb-20 sm:px-6">
        <header className="flex flex-col gap-3">
          <p style={{ margin: 0, fontSize: 13, fontWeight: 600, letterSpacing: ".08em", color: "#6a55d8" }}>DEMO MODE · LARKSPUR TELECOM (FICTIONAL)</p>
          <h1 style={{ margin: 0, fontSize: "clamp(34px,4.6vw,56px)", lineHeight: 1.04, fontWeight: 700, letterSpacing: "-.035em" }}>Every state of the companion.</h1>
          <p style={{ margin: 0, maxWidth: 700, fontSize: 17, lineHeight: 1.5, color: "#3a3a3c" }}>
            A fictional Tier-2 support escalation desk, so you can see each glow, layout and animation without running a capture. Nothing on this page was learned by Tacit.
          </p>
          <p style={{ margin: 0, fontSize: 14, color: "#6e6e73" }}>
            <Link href="/demo" className="text-[#a35f00] hover:underline">Presenter room</Link>
            {" · "}
            <Link href="/platform/demo" className="text-[#a35f00] hover:underline">Platform demo</Link>
            {" · "}
            <Link href="/capture" className="text-[#a35f00] hover:underline">Run a real capture</Link>
          </p>
        </header>
        <CompanionTour />
        <CompanionGallery />
      </div>
    </main>
  );
}
