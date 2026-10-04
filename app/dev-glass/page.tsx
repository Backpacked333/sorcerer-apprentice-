"use client";
import { useEffect, useState } from "react";
import { Orb } from "@/components/glass/Orb";
import { CompanionCard } from "@/components/glass/CompanionCard";
import { CompanionHeader } from "@/components/glass/CompanionHeader";
import { GlassSurface } from "@/components/glass/GlassSurface";
import { ORB_MOODS, MOODS, type OrbMood } from "@/lib/ui/moods";

const btn: React.CSSProperties = { flex: 1, height: 34, borderRadius: 17, fontSize: 12.5, fontWeight: 500, background: "rgba(255,255,255,.45)", boxShadow: "inset 0 0 0 .5px rgba(0,0,0,.07)", border: 0 };
const amber: React.CSSProperties = { ...btn, fontWeight: 600, color: "#6b3f00", background: "linear-gradient(180deg,rgba(255,222,160,.75),rgba(255,196,95,.5))", boxShadow: "inset 0 1px 0 rgba(255,255,255,.8),inset 0 0 0 .5px rgba(200,120,0,.18)" };

export default function DevGlass() {
  const [start, setStart] = useState<number | null>(null);
  const [cycle, setCycle] = useState(0);
  useEffect(() => { setStart(Date.now() - 252000); }, []);
  const cm: OrbMood = (["quiet", "notice", "asking", "listening", "understood"] as OrbMood[])[cycle % 5];
  return (
    <div style={{ minHeight: "100vh", padding: 24, background: "#f4f6f8", fontFamily: "var(--font-sans)" }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 18, marginBottom: 24 }}>
        {ORB_MOODS.map((m) => (
          <div key={m} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, width: 70 }}>
            <Orb mood={m} ringMs={m === "pausing" ? 1500 : null} />
            <span style={{ fontSize: 11, color: MOODS[m].kindColor }}>{m}</span>
          </div>
        ))}
        <Orb mood="understood" size={84} full />
        <button data-testid="cycle" onClick={() => setCycle((c) => c + 1)}>cycle ({cm})</button>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 28, alignItems: "flex-start" }}>
        <CompanionCard mood="quiet" mode="capsule" label="Tacit companion" testId="cc-capsule"
          header={<CompanionHeader mood="quiet" title="Quiet while you work" sub="I won't interrupt while you type" startedAt={start} />}
          footer={<div style={{ display: "flex", gap: 6 }}><button style={btn}>Pause</button><button style={{ ...btn, color: "#c9342f", flex: 1.25 }}>Scratch that</button><button style={amber}>Done</button></div>}>
          <div style={{ display: "flex", gap: 6, fontSize: 11.5, color: "#aeaeb2" }}><b style={{ color: "#8e8e93", fontSize: 11 }}>Understood</b> Nothing new yet</div>
        </CompanionCard>
        <CompanionCard mood={cm} mode="ask" label="Tacit companion ask" testId="cc-ask"
          header={<CompanionHeader mood={cm} eyebrow="Why · cost center" title="Asking" sub="You paused 1.6 s · seen on screen" startedAt={start} rippleKey={cycle} />}
          footer={<div style={{ display: "flex", gap: 6, alignItems: "center" }}><span style={{ flex: 1, fontSize: 12, color: "#6e6e73" }}>Asking…</span><button style={{ ...btn, flex: "none", padding: "0 13px", height: 30 }}>Not now</button></div>}>
          <div style={{ fontSize: 18, fontWeight: 600, lineHeight: 1.32 }}>What made you change the cost center on this line?{cycle % 2 ? " And would the same apply to a smaller amount on a different supplier?" : ""}</div>
        </CompanionCard>
        <CompanionCard mood="understood" mode="teachback" label="Tacit teachback" testId="cc-tb"
          header={<CompanionHeader mood="understood" eyebrow="Teach-back · round 1" title="Here's how I understand it" startedAt={start} />}
          footer={<div style={{ display: "flex", gap: 6 }}><button style={{ ...btn, height: 40, borderRadius: 20 }}>Correct one detail</button></div>}>
          <p style={{ fontSize: 15, lineHeight: 1.55, margin: 0 }}>Sentence one of the teach-back. Sentence two of the teach-back that is a bit longer to wrap across lines.</p>
        </CompanionCard>
        <CompanionCard mood="step" mode="teach" label="Tacit tutor" testId="cc-teach"
          header={<CompanionHeader mood="step" eyebrow="Before you save" title="Steps in" sub="Not posted" startedAt={null} />}>
          <div style={{ fontSize: 18, fontWeight: 600 }}>Prompt text here</div>
        </CompanionCard>
        <div style={{ width: 360 }}>
          <CompanionCard mood="off" mode="panel" label="Tacit panel" testId="cc-panel"
            header={<CompanionHeader mood="off" title="Paused" sub="Nothing is being sent" startedAt={start} frozen />} />
        </div>
        <CompanionCard mood="holding" mode="capsule" label="hold" header={<CompanionHeader mood="holding" title="Holding" sub="1 question held" />} />
        <CompanionCard mood="pausing" mode="capsule" label="pause" header={<CompanionHeader mood="pausing" title="You paused…" sub="Waiting 1.5 s to be sure" ringMs={1500} />} />
        <GlassSurface variant="panel" rim={{ opacity: 0.5 }} style={{ width: 240, height: 120, padding: 16 }} data-testid="gs">panel</GlassSurface>
        <GlassSurface variant="chip" style={{ padding: "6px 12px" }}>chip</GlassSurface>
      </div>
    </div>
  );
}
