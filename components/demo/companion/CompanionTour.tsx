"use client";
// DEMO MODE: scripted tour of the companion's glow states over a fake support console.
// Every value comes from lib/demo/companion-fixtures.ts (fictional). Nothing here is live.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  AnswerBubble,
  CompanionCard,
  CompanionHeader,
  ConnectorCurve,
  FieldHighlight,
  GlassButton,
  LearnedChip,
  NoticedChip,
  UnderstoodCard,
} from "@/components/glass";
import { MOODS } from "@/lib/ui/moods";
import { prefersReducedMotion } from "@/lib/ui/motion";
import { relativeRect, type Rect } from "@/lib/ui/geometry";
import { DEMO_COMPANY, LAYOUTS, TICKET, TOUR, TOUR_ANSWER, type TourStep, type TourTarget } from "@/lib/demo/companion-fixtures";
import { CapsuleFooter, InertButton, KindHeader, MetaRow, Muted, Question } from "./parts";

type Rects = { targets: Partial<Record<Exclude<TourTarget, null>, Rect>>; card: Rect | null };
const useIso = typeof window === "undefined" ? useEffect : useLayoutEffect;
const WORDS = TOUR_ANSWER.split(" ");

export function CompanionTour() {
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [run, setRun] = useState(0);
  const [words, setWords] = useState(0);
  const [rects, setRects] = useState<Rects>({ targets: {}, card: null });
  const root = useRef<HTMLDivElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const step: TourStep = TOUR[idx];

  // Advance while playing.
  useEffect(() => {
    if (!playing) return;
    if (idx >= TOUR.length - 1) {
      setPlaying(false);
      return;
    }
    const id = window.setTimeout(() => setIdx((n) => n + 1), step.dur);
    return () => window.clearTimeout(id);
  }, [playing, idx, step.dur]);

  // Stream the answer one word at a time while "listening" (full text otherwise).
  useEffect(() => {
    if (step.answer !== "stream" || prefersReducedMotion()) {
      setWords(WORDS.length);
      return;
    }
    setWords(0);
    const id = window.setInterval(() => setWords((n) => Math.min(WORDS.length, n + 1)), 150);
    return () => window.clearInterval(id);
  }, [step.answer, idx, run]);

  const measure = useCallback(() => {
    const r = root.current;
    if (!r) return;
    const targets: Rects["targets"] = {};
    r.querySelectorAll<HTMLElement>("[data-t]").forEach((el) => {
      targets[el.dataset.t as Exclude<TourTarget, null>] = relativeRect(el, r);
    });
    setRects({ targets, card: card.current ? relativeRect(card.current, r) : null });
  }, []);

  useIso(() => {
    measure();
    const ids = [120, 700].map((ms) => window.setTimeout(measure, ms));
    return () => ids.forEach(window.clearTimeout);
  }, [idx, measure]);

  useEffect(() => {
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => measure());
    if (root.current) ro.observe(root.current);
    if (card.current) ro.observe(card.current);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [measure]);

  const play = () => {
    if (prefersReducedMotion()) {
      setPlaying(false);
      setIdx(TOUR.length - 1);
      return;
    }
    if (playing) {
      setPlaying(false);
      return;
    }
    if (idx >= TOUR.length - 1) setIdx(0);
    setRun((n) => n + 1);
    setPlaying(true);
  };
  const jump = (i: number) => {
    setPlaying(false);
    setRun((n) => n + 1);
    setIdx(i);
  };

  const target = step.target ? rects.targets[step.target] ?? null : null;
  const showCable = !!target && step.mode !== "capsule";
  const M = MOODS[step.mood];
  const atEnd = idx >= TOUR.length - 1;

  return (
    <section aria-labelledby="tour-title" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <h2 id="tour-title" style={{ margin: 0, fontSize: 24, fontWeight: 700, letterSpacing: "-.02em" }}>Play the glow states</h2>
        <span style={{ height: 24, padding: "0 10px", borderRadius: 12, display: "inline-flex", alignItems: "center", fontSize: 12, fontWeight: 600, color: "#6a55d8", background: "rgba(143,123,255,.14)" }}>Scripted tour — demo data</span>
        <div className="ml-auto flex items-center gap-2">
          <GlassButton variant="amber" size={40} onClick={play} data-testid="demo-play" aria-pressed={playing}>
            {playing ? "Pause tour" : atEnd && idx > 0 ? "Play states again" : "Play states"}
          </GlassButton>
        </div>
      </div>

      {/* step chips */}
      <ol aria-label="Tour steps" className="flex flex-wrap gap-1.5" style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {TOUR.map((s, i) => (
          <li key={s.id}>
            <button
              type="button"
              onClick={() => jump(i)}
              aria-current={i === idx ? "step" : undefined}
              className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a35f00]"
              style={{
                height: 28, padding: "0 11px", borderRadius: 14, fontSize: 12.5, fontWeight: i === idx ? 600 : 500, cursor: "pointer",
                color: i === idx ? "#1d1d1f" : i < idx ? "#3a3a3c" : "#6e6e73",
                background: i === idx ? "#fff" : "rgba(0,0,0,.04)",
                boxShadow: i === idx ? `0 1px 3px rgba(0,0,0,.12),0 0 0 1px ${M.ring}` : "none",
                transition: "background-color .3s, box-shadow .3s, color .3s",
              }}
            >
              {s.label}
            </button>
          </li>
        ))}
      </ol>

      {/* stage */}
      <div ref={root} className="relative flex flex-col gap-4 md:block md:min-h-[600px]">
        <FakeConsole step={step} />
        <div ref={card} className="relative md:absolute md:right-6 md:bottom-6" style={{ zIndex: 5 }}>
          <TourCard step={step} idx={idx} words={words} />
        </div>
        {/* overlay root: halo, cable, noticed chip (decorative) */}
        <div aria-hidden className="pointer-events-none absolute inset-0" style={{ zIndex: 6 }}>
          <FieldHighlight rect={target} mood={step.mood} />
          {showCable && <ConnectorCurve from={target} to={rects.card} mood={step.mood} drawKey={`${step.target}|${step.mode}|${run}`} />}
          {step.chip && rects.targets.priority && (
            <NoticedChip key={`${idx}-${run}`} id={`${idx}-${run}`} rect={rects.targets.priority} text={step.chip} flyTo={rects.card} />
          )}
        </div>
      </div>
      <p key={`${idx}-${run}`} aria-live="polite" style={{ margin: 0, minHeight: 22, fontSize: 14, color: "#3a3a3c", animation: "tc-rise .5s var(--ease-rise) both" }}>
        <b style={{ fontWeight: 600 }}>Why now</b> <span style={{ color: "#6e6e73" }}>{step.caption}</span>
      </p>
    </section>
  );
}

function TourCard({ step, idx, words }: { step: TourStep; idx: number; words: number }) {
  const rk = MOODS[step.mood].ripple ? idx : undefined;
  if (step.mode === "capsule") {
    return (
      <CompanionCard
        mood={step.mood}
        mode="capsule"
        label="Demo companion"
        header={<CompanionHeader mood={step.mood} title={step.title} sub={step.sub} ringMs={step.ringMs ?? null} rippleKey={rk} />}
        footer={<CapsuleFooter />}
      >
        <MetaRow label="Understood">
          {step.learned?.length ? step.learned.map((l) => <LearnedChip key={l.text} kind={l.kind} text={l.text} />) : <Muted>{step.mood === "off" ? "Struck — nothing kept" : "Nothing new yet"}</Muted>}
        </MetaRow>
      </CompanionCard>
    );
  }
  if (step.mode === "teach") {
    return (
      <CompanionCard
        mood={step.mood}
        mode="teach"
        label="Demo tutor"
        header={<KindHeader mood={step.mood} eyebrow={step.eyebrow ?? ""} sub={step.sub} badge="Coached" rippleKey={rk} />}
        footer={
          <div style={{ display: "flex", gap: 6 }}>
            <InertButton>Replay the expert</InertButton>
            <InertButton tone="amber">End session</InertButton>
          </div>
        }
      >
        {step.mood === "step" ? (
          <>
            <Question text={LAYOUTS.teach.prompt} />
            <div key="why" style={{ fontSize: 13.5, lineHeight: 1.45, color: "#3a3a3c", animation: "tc-rise .6s var(--ease-rise) .2s both" }}>
              In the expert&apos;s words: <span style={{ fontWeight: 500 }}>“{LAYOUTS.teach.because}”</span>
            </div>
          </>
        ) : (
          <>
            <Question text="Routed to network on-call before saving." />
            <MetaRow label="Mastery">{step.learned?.map((l) => <LearnedChip key={l.text} kind={l.kind} text={l.text} />)}</MetaRow>
          </>
        )}
      </CompanionCard>
    );
  }
  // ask
  const struck = step.answer === "struck";
  const text = step.answer === "stream" ? WORDS.slice(0, words).join(" ") : TOUR_ANSWER;
  return (
    <CompanionCard
      mood={step.mood}
      mode="ask"
      label="Demo companion"
      header={<KindHeader mood={step.mood} eyebrow={step.eyebrow ?? ""} sub={step.sub} rippleKey={rk} />}
      footer={
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ flex: 1, fontSize: 12, color: "#6e6e73" }}>
            {struck ? "Striking it…" : step.mood === "asking" ? "Asking…" : step.mood === "listening" ? "Listening to your answer" : "Saved with your words"}
          </span>
          <InertButton flex={0}>Not now</InertButton>
          <InertButton tone="danger" flex={0}>Off the record</InertButton>
        </div>
      }
    >
      <Question text={step.question ?? ""} />
      {step.answer && (
        <AnswerBubble text={text} listening={step.mood === "listening"} highlight={step.highlight} struck={struck} />
      )}
      {step.understood && <UnderstoodCard key={`u${idx}`} kind={step.understood.kind} text={step.understood.text} isQuote meta="→ Work Map" />}
      {step.learned?.length ? (
        <MetaRow label="Understood">{step.learned.map((l) => <LearnedChip key={l.text} kind={l.kind} text={l.text} />)}</MetaRow>
      ) : null}
    </CompanionCard>
  );
}

function FakeConsole({ step }: { step: TourStep }) {
  const f = step.fields;
  const lab = { fontSize: 12, color: "#52606d", marginBottom: 4 } as const;
  const box = { height: 36, border: "1px solid #d0d7de", borderRadius: 6, display: "flex", alignItems: "center", padding: "0 10px", background: "#fff", fontSize: 14, boxSizing: "border-box" } as const;
  const saveGlow = step.mood === "step";
  return (
    <div aria-label={`Fake support console · ${DEMO_COMPANY}`} role="img" className="relative flex overflow-hidden md:min-h-[600px]" style={{ borderRadius: 18, background: "#f5f6f8", color: "#17202a", boxShadow: "0 0 0 .5px rgba(0,0,0,.12),0 30px 70px rgba(15,23,42,.12)" }}>
      <div aria-hidden className="hidden sm:flex" style={{ width: 150, flex: "none", flexDirection: "column", gap: 8, padding: "16px 12px", background: "#2a2440", color: "#fff", fontSize: 13 }}>
        <div style={{ fontWeight: 600, marginBottom: 10, lineHeight: 1.25 }}>Larkspur Telecom<br /><span style={{ fontWeight: 400, opacity: 0.7, fontSize: 11.5 }}>(fictional)</span></div>
        <span style={{ opacity: 0.75 }}>Inbox</span>
        <span style={{ padding: "5px 8px", borderRadius: 5, background: "rgba(255,255,255,.12)", fontWeight: 600 }}>Escalations</span>
        <span style={{ opacity: 0.75 }}>Outages</span>
        <span style={{ opacity: 0.75 }}>Reports</span>
      </div>
      <div aria-hidden className="min-w-0 flex-1" style={{ padding: "18px 20px" }}>
        <div style={{ fontSize: 12.5, color: "#7b8794" }}>{TICKET.app} · Tier 2</div>
        <div data-t="ticket" className="mt-1 inline-flex flex-wrap items-center gap-2" style={{ padding: "2px 4px", marginLeft: -4 }}>
          <b style={{ fontSize: 18 }}>Ticket {TICKET.id}</b>
          <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 7px", borderRadius: 4, background: "#eef1f4", border: "1px solid #d0d7de", color: "#3a4753" }}>OPEN</span>
        </div>
        <div className="mt-4 grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", maxWidth: 420, background: "#fff", border: "1px solid #e3e7eb", borderRadius: 8, padding: "12px 14px", fontSize: 14 }}>
          <div><div style={lab}>Customer</div>{TICKET.customer}</div>
          <div><div style={lab}>Category</div>{TICKET.category}</div>
          <div><div style={lab}>Impact</div>{TICKET.sites}</div>
          <div><div style={lab}>Opened</div>{TICKET.opened}</div>
        </div>
        <div className="mt-4 grid gap-3" style={{ maxWidth: 260 }}>
          <div>
            <div style={lab}>Priority</div>
            <div data-t="priority" style={box}><span key={f.priority} style={{ animation: "tc-fade .4s both" }}>{f.priority}</span><span style={{ marginLeft: "auto", color: "#7b8794" }}>▾</span></div>
          </div>
          <div>
            <div style={lab}>Assigned queue</div>
            <div data-t="queue" style={box}><span key={f.queue} style={{ animation: "tc-fade .4s both" }}>{f.queue}</span><span style={{ marginLeft: "auto", color: "#7b8794" }}>▾</span></div>
          </div>
        </div>
        <div className="mt-4" style={{ maxWidth: 420 }}>
          <div style={lab}>Internal note</div>
          <div data-t="note" style={{ ...box, color: f.note ? "#17202a" : "#9aa5b1" }}>
            {f.note ? <Typed text={f.note} active={!!f.typing} /> : "Add a note for the team"}
          </div>
        </div>
        <div className="mt-5 flex gap-2">
          <span style={{ height: 36, padding: "0 14px", borderRadius: 6, display: "grid", placeItems: "center", fontSize: 14, background: "#fff", border: "1px solid #d0d7de" }}>Save draft</span>
          <span
            data-t="save"
            style={{ height: 36, padding: "0 16px", borderRadius: 6, display: "grid", placeItems: "center", fontSize: 14, fontWeight: 600, color: "#fff", background: "#4b3fa8", boxShadow: saveGlow ? "0 0 0 3px rgba(240,100,47,.35),0 0 18px rgba(240,100,47,.55)" : "0 0 0 0 rgba(240,100,47,0)", transition: "box-shadow .6s" }}
          >
            Save ticket
          </span>
        </div>
      </div>
    </div>
  );
}

function Typed({ text, active }: { text: string; active: boolean }) {
  const [n, setN] = useState(text.length);
  useEffect(() => {
    if (!active || prefersReducedMotion()) {
      setN(text.length);
      return;
    }
    setN(0);
    const id = window.setInterval(() => setN((c) => Math.min(text.length, c + 1)), 75);
    return () => window.clearInterval(id);
  }, [active, text]);
  return (
    <span>
      {text.slice(0, n)}
      {active && <span style={{ display: "inline-block", width: 1, height: 15, marginLeft: 1, background: "#17202a", verticalAlign: "-2px", animation: "tc-blink 1s step-end infinite" }} />}
    </span>
  );
}
