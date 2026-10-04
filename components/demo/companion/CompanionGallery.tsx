"use client";
import type { ReactNode } from "react";
// DEMO MODE: every companion state and layout, with fictional Tier-2 support copy.
import {
  AnswerBubble,
  CompanionCard,
  CompanionHeader,
  HeardCard,
  LearnedChip,
  MoodLegend,
  UnderstoodCard,
} from "@/components/glass";
import { HEARD_EXAMPLE, LAYOUTS, MOOD_GALLERY } from "@/lib/demo/companion-fixtures";
import { CapsuleFooter, InertButton, KindHeader, MetaRow, Muted, Question } from "./parts";

const H = { margin: 0, fontSize: 24, fontWeight: 700, letterSpacing: "-.02em" } as const;
const SUB = { margin: "6px 0 0", fontSize: 15, color: "#6e6e73", maxWidth: 680 } as const;
// Columns are the card's own width (capsule 348): three per row at 1280+, no dead gutters
// between a card and its neighbour; the leftover space sits once, at the row's end.
const GRID = { display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(min(348px,100%),348px))", gap: "32px 32px", alignItems: "start" } as const;

export function CompanionGallery() {
  return (
    <div className="flex flex-col gap-16">
      <section aria-labelledby="legend-title">
        <h2 id="legend-title" style={H}>What the glow means</h2>
        <p style={SUB}>The five canonical glows. Every other state is a variation of one of them.</p>
        <div className="mt-7"><MoodLegend /></div>
      </section>

      <section aria-labelledby="moods-title">
        <h2 id="moods-title" style={H}>All 13 moods</h2>
        <p style={SUB}>The capsule the companion shows in each mood. In the product each mood is derived from real signals only.</p>
        <ul className="mt-7" style={{ ...GRID, listStyle: "none", padding: 0 }}>
          {MOOD_GALLERY.map((g) => (
            <li key={g.mood} className="flex flex-col gap-3">
              <div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{g.name} <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 500, color: "#8e8e93" }}>· {g.mood}</span></div>
                <div style={{ fontSize: 13, color: "#6e6e73", marginTop: 2 }}>{g.when}</div>
              </div>
              <CompanionCard
                mood={g.mood}
                mode="capsule"
                label={`Demo companion · ${g.name}`}
                header={<CompanionHeader mood={g.mood} title={g.title} sub={g.sub} ringMs={g.mood === "pausing" ? 1500 : null} />}
                footer={<CapsuleFooter />}
              >
                <MetaRow label="Understood"><Muted>{g.meta}</Muted></MetaRow>
              </CompanionCard>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="layouts-title">
        <h2 id="layouts-title" style={H}>Layouts</h2>
        <p style={SUB}>Capsule (348), ask (404), teach-back (440) and teach (404). The card springs to fit its content.</p>
        <div className="mt-7" style={{ ...GRID, gridTemplateColumns: "repeat(auto-fill,minmax(min(440px,100%),1fr))" }}>
          <Labeled title="Capsule · quiet">
            <CompanionCard
              mood="quiet"
              mode="capsule"
              label="Demo capsule"
              header={<CompanionHeader mood="quiet" title={LAYOUTS.capsule.title} sub={LAYOUTS.capsule.sub} />}
              footer={<CapsuleFooter />}
            >
              <MetaRow label="Understood"><Muted>{LAYOUTS.capsule.meta}</Muted><span style={{ marginLeft: "auto" }}><Muted>{LAYOUTS.capsule.budget}</Muted></span></MetaRow>
            </CompanionCard>
          </Labeled>

          <Labeled title="Ask · asking">
            <CompanionCard
              mood="asking"
              mode="ask"
              label="Demo ask"
              header={<KindHeader mood="asking" eyebrow={LAYOUTS.ask.eyebrow} sub={LAYOUTS.ask.sub} />}
              footer={<AskFooter status="Asking…" />}
            >
              <Question text={LAYOUTS.ask.question} />
            </CompanionCard>
          </Labeled>

          <Labeled title="Ask · listening">
            <CompanionCard
              mood="listening"
              mode="ask"
              label="Demo listening"
              header={<KindHeader mood="listening" eyebrow={LAYOUTS.listen.eyebrow} sub={LAYOUTS.listen.sub} />}
              footer={<AskFooter status="Listening to your answer" />}
            >
              <Question text={LAYOUTS.listen.question} />
              <AnswerBubble text={LAYOUTS.listen.answer} listening />
            </CompanionCard>
          </Labeled>

          <Labeled title="Ask · understood">
            <CompanionCard
              mood="understood"
              mode="ask"
              label="Demo understood"
              header={<KindHeader mood="understood" eyebrow="UNDERSTOOD · PRIORITY" sub="Linked to the screen moment at 00:41" />}
              footer={<AskFooter status="Saved with your words" />}
            >
              <AnswerBubble text={LAYOUTS.listen.answer} listening={false} highlight="Three sites on the same business line went down at once" />
              <UnderstoodCard kind="reason" text="Three sites on the same business line went down at once" isQuote meta="→ Work Map" />
              <MetaRow label="Understood"><LearnedChip kind="reason" text="P1 when sites fail together" /></MetaRow>
            </CompanionCard>
          </Labeled>

          <Labeled title="Ask · struck (off the record)">
            <CompanionCard
              mood="off"
              mode="ask"
              label="Demo struck"
              header={<KindHeader mood="off" eyebrow="STRIKING IT" sub="Scratch that" />}
              footer={<AskFooter status="Striking it…" />}
            >
              <AnswerBubble text={LAYOUTS.listen.answer} listening={false} struck />
            </CompanionCard>
          </Labeled>

          <Labeled title="Teach-back · understood">
            <CompanionCard
              mood="understood"
              mode="teachback"
              label="Demo teach-back"
              header={<KindHeader mood="understood" eyebrow={LAYOUTS.teachback.eyebrow} sub={LAYOUTS.teachback.sub} />}
              footer={
                <div style={{ display: "flex", gap: 6 }}>
                  <InertButton>Correct one detail</InertButton>
                  <InertButton tone="green" flex={1.2}>Yes, it works like that</InertButton>
                </div>
              }
            >
              <div style={{ fontSize: 15, lineHeight: 1.55 }}>
                {LAYOUTS.teachback.sentences.map((s) => <span key={s}>{s} </span>)}
              </div>
              <div style={{ fontSize: 11.5, color: "#8e8e93" }}>{LAYOUTS.teachback.meta}</div>
            </CompanionCard>
          </Labeled>

          <Labeled title="Teach · steps in">
            <CompanionCard
              mood="step"
              mode="teach"
              label="Demo tutor"
              header={<KindHeader mood="step" eyebrow={LAYOUTS.teach.eyebrow} sub={LAYOUTS.teach.sub} badge="Coached" />}
              footer={
                <div style={{ display: "flex", gap: 6 }}>
                  <InertButton>Replay the expert</InertButton>
                  <InertButton tone="amber">End session</InertButton>
                </div>
              }
            >
              <Question text={LAYOUTS.teach.prompt} />
              <div style={{ fontSize: 13.5, lineHeight: 1.45, color: "#3a3a3c" }}>
                In the expert&apos;s words: <span style={{ fontWeight: 500 }}>“{LAYOUTS.teach.because}”</span>
              </div>
            </CompanionCard>
          </Labeled>

          <Labeled title="Heard in passing">
            <div className="flex flex-col gap-3" style={{ maxWidth: 348 }}>
              <HeardCard quote={HEARD_EXAMPLE.quote} meta={HEARD_EXAMPLE.meta} />
              <CompanionCard
                mood="heard"
                mode="capsule"
                label="Demo heard"
                header={<CompanionHeader mood="heard" title="Reason heard — not asking" sub="Same outage → one parent ticket" />}
                footer={<CapsuleFooter />}
              >
                <MetaRow label="Understood"><LearnedChip kind="heard" text="one parent ticket per outage" /></MetaRow>
              </CompanionCard>
            </div>
          </Labeled>
        </div>
      </section>
    </div>
  );
}

function Labeled({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div style={{ fontSize: 13, fontWeight: 600, color: "#6e6e73" }}>{title}</div>
      {children}
    </div>
  );
}

function AskFooter({ status }: { status: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span style={{ flex: 1, fontSize: 12, color: "#6e6e73" }}>{status}</span>
      <InertButton flex={0}>Not now</InertButton>
      <InertButton tone="danger" flex={0}>Off the record</InertButton>
    </div>
  );
}
