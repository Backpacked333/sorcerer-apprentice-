"use client";
// Mastery card after End (T3 labels, D7). A glass sheet over the ERP (floating) or inline (companion layout).
import Link from "next/link";
import { useRef } from "react";
import { CountRing, Pill, useOccluder, type PillTone } from "@/components/glass";
import type { TeachVM } from "@/components/views/teach.vm";

type Row = TeachVM["card"][number];

const tone = (c: Row): PillTone => (c.status === "mastered" ? "green" : c.status === "untested" ? "neutral" : "amber");

export function MasterySheet({ vm, learner, expert, floating }: { vm: TeachVM; learner: string; expert: string; floating: boolean }) {
  const ref = useRef<HTMLElement>(null);
  useOccluder(ref, "teach-mastery", floating);
  const mastered = vm.card.filter((c) => c.status === "mastered").length;
  const untested = vm.card.filter((c) => c.status === "untested");
  const rise = (i: number) => ({ animation: `tc-rise .55s var(--ease-rise, cubic-bezier(.2,.9,.3,1)) ${0.12 + i * 0.07}s both` });
  return (
    <section
      ref={ref}
      data-testid="teach-outcome"
      aria-label="Mastery card"
      className="glass-inspector"
      style={{
        ...(floating
          ? { position: "fixed", left: 28, top: 28, width: "min(560px, calc(100vw - 404px - 84px))", maxHeight: "calc(100dvh - 56px)", zIndex: 6 }
          : { position: "relative", width: "100%" }),
        overflowY: "auto",
        overscrollBehavior: "contain",
        borderRadius: 28,
        padding: 20,
        background: "linear-gradient(180deg,rgba(255,255,255,.92),rgba(250,250,252,.82))",
        color: "#1d1d1f",
        animation: "tc-rise .6s var(--ease-rise, cubic-bezier(.2,.9,.3,1)) both",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".11em", textTransform: "uppercase", color: "#7a5cff", margin: 0 }}>Mastery card</p>
          <h2 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-.02em", margin: "4px 0 0" }}>What {learner} can do alone</h2>
          <p style={{ fontSize: 13, color: "#6e6e73", margin: "4px 0 0" }}>
            Rules from {expert}&apos;s confirmed Work Map, rev {vm.map?.revision ?? "–"}
          </p>
        </div>
        <CountRing value={mastered} total={vm.card.length} size={64} label={`${mastered} of ${vm.card.length} correct without help`} />
      </div>

      <ul style={{ listStyle: "none", padding: 0, margin: "16px 0 0", display: "flex", flexDirection: "column", gap: 8 }}>
        {vm.card.map((c, i) => (
          <li
            key={c.ruleId}
            style={{ padding: "12px 14px", borderRadius: 18, background: "rgba(255,255,255,.6)", boxShadow: "inset 0 0 0 .5px rgba(0,0,0,.06), inset 0 1px 0 #fff", ...rise(i) }}
          >
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
              <span style={{ flex: "1 1 200px", minWidth: 0, fontSize: 14.5, fontWeight: 600 }}>{c.title}</span>
              <Pill tone={tone(c)} dot>{c.label}</Pill>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginTop: 6 }}>
              {c.independent ? (
                <Pill tone={c.independent === "correct without help" ? "green" : "red"}>
                  <span>independent: {c.independent}</span>
                </Pill>
              ) : null}
              <span style={{ fontSize: 12.5, color: "#6e6e73" }}>{c.detail}</span>
              {vm.practice ? (
                <button type="button" className="underline" style={{ fontSize: 12.5, color: "#a35f00" }} onClick={() => vm.practice?.(c.ruleId)}>
                  Practice this
                </button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>

      {vm.flaggedCount > 0 ? (
        <p style={{ fontSize: 13, color: "#3a3a3c", margin: "12px 2px 0", ...rise(vm.card.length) }}>
          {vm.flaggedCount} case{vm.flaggedCount > 1 ? "s" : ""} sent to {expert}&apos;s map as open questions
        </p>
      ) : null}

      {vm.missed.length > 0 || untested.length > 0 ? (
        <div style={{ marginTop: 14, ...rise(vm.card.length + 1) }}>
          <p style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".11em", textTransform: "uppercase", color: "#6e6e73", margin: "0 2px" }}>Practice next</p>
          <ul style={{ margin: "6px 0 0", padding: "0 2px", listStyle: "none", fontSize: 13, color: "#6e6e73", display: "flex", flexDirection: "column", gap: 4 }}>
            {vm.missed.map((c) => (
              <li key={c.ruleId}>{c.title}: another case of this kind, with {expert}&apos;s words at hand</li>
            ))}
            {untested.map((c) => (
              <li key={c.ruleId}>{c.title}: not exercised today</li>
            ))}
          </ul>
        </div>
      ) : null}

      {vm.map ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 16 }}>
          <Link className="btn" href={`/map/${vm.map.sessionId}`}>Back to the map</Link>
          <Link className="btn" href={`/teach?from=${vm.map.sessionId}`}>Another teach session</Link>
        </div>
      ) : null}
    </section>
  );
}
