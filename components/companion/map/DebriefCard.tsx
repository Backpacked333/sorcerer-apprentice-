"use client";
// The floating debrief companion (design §6.2/§6.3): asks one open question at a time,
// shows the expert's words as they arrive, reads the teach-back back, and locks only on an explicit yes.
// Presentational: every action calls an existing vm handler.

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import type { Slot } from "@/lib/workmap";
import type { OrbMood } from "@/lib/ui/moods";
import { slotEyebrow, slotSub, splitSentences, teachbackMeta } from "@/lib/ui/mapview";
import { AnswerBubble, CompanionCard, Eyebrow, GlassButton, Orb, SessionClock, UnderstoodCard } from "@/components/glass";
import type { MapVM } from "@/components/views/map.vm";

const RISE = (d = 0) => `tc-rise .6s var(--ease-rise, cubic-bezier(.2,.9,.3,1)) ${d}s both`;
const REVEAL_MS = 650;

function Head({ mood, eyebrow, sub, startedAt, rippleKey }: { mood: OrbMood; eyebrow: string; sub: string; startedAt?: number | null; rippleKey?: string | number }) {
  return (
    <div className="flex min-w-0 items-center gap-3" style={{ padding: 2 }}>
      <Orb mood={mood} size={38} rippleKey={rippleKey} />
      <div className="min-w-0 flex-1">
        <div key={eyebrow} style={{ animation: RISE() }}>
          <Eyebrow text={eyebrow} mood={mood} />
        </div>
        <div key={sub} className="mt-0.5 truncate text-[12px] text-[#8e8e93]" style={{ animation: RISE() }}>{sub}</div>
      </div>
      {startedAt !== undefined && <SessionClock startedAt={startedAt ?? null} />}
    </div>
  );
}

function Status({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 text-[12px] text-[#6e6e73]" style={{ padding: "0 2px" }}>
      <span className="min-w-0 truncate">{children}</span>
      {right}
    </div>
  );
}

/** Teach-back text revealed one sentence at a time; sentences changed by the last correction are underlined. */
function Sentences({ text, previous }: { text: string; previous: string }) {
  const parts = splitSentences(text);
  const before = new Set(previous ? splitSentences(previous) : []);
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setShown(parts.length);
      return;
    }
    setShown(1);
    let n = 1;
    const id = window.setInterval(() => {
      n += 1;
      setShown(n);
      if (n >= parts.length) window.clearInterval(id);
    }, REVEAL_MS);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- replay only when the text changes
  }, [text]);
  return (
    <p className="text-[15px] leading-[1.55] text-[#1d1d1f]" style={{ padding: "0 2px", textWrap: "pretty" }} aria-live="polite">
      {parts.slice(0, Math.max(1, shown)).map((s, i) => {
        const changed = !!previous && !before.has(s);
        return (
          <span
            key={`${i}|${s}`}
            style={{
              animation: RISE(),
              display: "inline",
              textDecoration: changed ? "underline" : undefined,
              textDecorationColor: changed ? "#c9b8ff" : undefined,
              textDecorationThickness: changed ? 1.5 : undefined,
              textUnderlineOffset: changed ? 3 : undefined,
            }}
          >
            {s}{" "}
          </span>
        );
      })}
    </p>
  );
}

export function DebriefCard({ vm, mood, justFilled, floating }: { vm: MapVM; mood: OrbMood; justFilled: Slot | null; floating: boolean }) {
  const map = vm.map!;
  const name = map.expert.name;
  const confirmed = !!vm.confirmed || !!map.confirmedAt;
  const open = vm.progress?.open ?? 0;
  const [answer, setAnswer] = useState("");
  const [correction, setCorrection] = useState("");
  const [prevText, setPrevText] = useState("");
  const [busy, setBusy] = useState(false);
  const locked = !!vm.pending || busy;
  const run = async (fn: () => Promise<void>) => {
    if (locked) return;
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => setAnswer(""), [map.revision, vm.currentSlot?.id]);
  useEffect(() => setCorrection(""), [vm.rounds]);

  const engine = vm.sttEngine === "scribe" ? "Scribe v2 is listening" : vm.sttEngine === "webspeech" ? "browser STT is listening" : "no STT: type the answer";
  const voiceTag = (
    <span className="flex-none truncate text-[11px] text-[#8e8e93]" title="Voice connection">
      {vm.voice.status}
    </span>
  );
  const common = { mood, floating, label: "Debrief companion", occluderId: "map-companion" } as const;

  // 1. Confirmed: the map is locked and can teach.
  if (confirmed) {
    return (
      <CompanionCard
        {...common}
        mode="capsule"
        testId="map-companion"
        header={<Head mood={mood} eyebrow={`CONFIRMED · REV ${map.revision}`} sub={`Only ${name}'s explicit yes locks the map`} rippleKey="confirmed" />}
        footer={
          <div className="flex flex-col gap-2">
            <p className="text-[15px] font-semibold text-[#1d1d1f]" style={{ padding: "0 2px", animation: RISE(0.1) }}>Confirmed — rev {map.revision} can teach</p>
            {vm.teachback && vm.phase === "confirmed" && (
              <p className="text-[12px] text-[#6e6e73]" style={{ padding: "0 2px" }}>{teachbackMeta(vm.teachback)}</p>
            )}
            <Link
              href={`/teach?from=${vm.sessionId}`}
              className="inline-flex h-[34px] items-center justify-center rounded-[17px] text-[12.5px] font-semibold text-[#6b3f00] no-underline transition-transform hover:-translate-y-px active:scale-95"
              style={{ background: "linear-gradient(180deg,rgba(255,222,160,.75),rgba(255,196,95,.5))", boxShadow: "inset 0 1px 0 rgba(255,255,255,.8),inset 0 0 0 .5px rgba(200,120,0,.18)" }}
            >
              Start a teach session from this map
            </Link>
          </div>
        }
      />
    );
  }

  // 2. Teach-back: read back, correct one detail, or say yes.
  if (vm.phase === "teachback" && vm.teachback) {
    const tb = vm.teachback;
    return (
      <CompanionCard
        {...common}
        mode="teachback"
        testId="map-companion"
        header={<Head mood={mood} eyebrow={`TEACH-BACK · ROUND ${vm.rounds + 1}`} sub={`Here's how I understand it, ${name}`} startedAt={vm.debriefStartedAt ?? null} rippleKey={`tb${vm.rounds}`} />}
        footer={
          <div className="flex flex-col gap-2">
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const c = correction.trim() || vm.heard.trim();
                if (!c || locked) return;
                setPrevText(tb.text);
                void run(() => vm.confirm(false, c));
              }}
            >
              <input
                className="input min-w-0 flex-1"
                style={{ minHeight: 40, borderRadius: 20, fontSize: 14, padding: "0 14px" }}
                data-testid="map-correct-input"
                aria-label="Correct one detail"
                placeholder="Correct one detail (say it or type it)"
                value={correction}
                onChange={(e) => setCorrection(e.target.value)}
              />
              <GlassButton type="submit" size={40} data-testid="map-correct-submit" disabled={locked}>Correct</GlassButton>
            </form>
            <div data-testid="map-confirm-yes">
              <GlassButton variant="green" size={40} className="w-full" data-testid="map-confirm" disabled={locked} onClick={() => void run(() => vm.confirm(true))}>
                Yes, that is how it works
              </GlassButton>
            </div>
          </div>
        }
      >
        <Sentences text={tb.text} previous={prevText} />
        <p className="text-[11.5px] text-[#8e8e93]" style={{ padding: "0 2px" }}>
          {teachbackMeta(tb)}
          {prevText ? " · underlined = changed in this round" : ""}
        </p>
        {vm.lastPatch && vm.lastPatch.length > 0 && (
          <ul className="m-0 flex list-none flex-col gap-1 p-0 text-[12.5px]">
            {vm.lastPatch.map((p) => (
              <li key={p.ruleTitle}><span className="text-[#8e8e93]">{p.ruleTitle}:</span> {p.before} → {p.after}</li>
            ))}
          </ul>
        )}
        {(vm.heard || vm.partial) && <AnswerBubble text={vm.heard} partial={vm.partial || undefined} listening={!!vm.micOpen && vm.debriefOn && !vm.voice.isSpeaking} />}
      </CompanionCard>
    );
  }

  // 3. Asking one open question.
  if (vm.phase === "asking" && vm.currentSlot) {
    const slot = vm.currentSlot;
    const listening = !!vm.micOpen && vm.debriefOn && !vm.voice.isSpeaking;
    const status = vm.voice.isSpeaking ? "Asking…" : justFilled ? "Saved with your own words" : listening && vm.sttEngine !== "none" ? "Listening to your answer" : engine;
    return (
      <CompanionCard
        {...common}
        mode="ask"
        testId="map-companion"
        header={<Head mood={mood} eyebrow={slotEyebrow(slot, map.steps)} sub={slotSub(slot.kind)} startedAt={vm.debriefStartedAt ?? null} rippleKey={slot.id} />}
        footer={
          <div className="flex flex-col gap-2">
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const text = answer.trim() || vm.heard.trim();
                if (!text) return;
                void vm.submitAnswer(text);
              }}
            >
              <input
                className="input min-w-0 flex-1"
                style={{ minHeight: 34, borderRadius: 17, fontSize: 14, padding: "0 14px" }}
                data-testid="map-answer-input"
                aria-label="Answer"
                placeholder={vm.voice.mode === "fallback" ? "Type the answer" : "or type it"}
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
              />
              <GlassButton variant="amber" type="submit" size={34} data-testid="map-answer-log">Log</GlassButton>
            </form>
            <Status right={voiceTag}>{status}</Status>
          </div>
        }
      >
        {justFilled?.filledBy && (
          <div key={`u|${justFilled.id}`}>
            <UnderstoodCard kind={justFilled.kind} text={justFilled.filledBy.text} isQuote meta="→ Work Map" />
          </div>
        )}
        <p key={slot.id} className="text-[18px] font-semibold leading-[1.32] tracking-[-.01em] text-[#1d1d1f]" style={{ minHeight: 46, padding: "0 2px", animation: RISE(0.1), textWrap: "pretty" }}>
          {slot.question}
        </p>
        {(vm.heard || vm.partial) && <AnswerBubble text={vm.heard} partial={vm.partial || undefined} listening={listening} />}
      </CompanionCard>
    );
  }

  // 4. Debrief connecting (started, first question not yet asked).
  if (vm.debriefOn) {
    return (
      <CompanionCard
        {...common}
        mode="capsule"
        testId="map-companion"
        header={<Head mood={mood} eyebrow="DEBRIEF" sub="Starting the debrief" startedAt={vm.debriefStartedAt ?? null} />}
        footer={<Status right={voiceTag}>{open} open question{open === 1 ? "" : "s"} to ask</Status>}
      />
    );
  }

  // 5. Idle: offer the debrief.
  const tbDisabled = open > 0 && vm.phase !== "idle";
  return (
    <CompanionCard
      {...common}
      mode="capsule"
      testId="map-companion"
      header={<Head mood={mood} eyebrow="DEBRIEF" sub={open > 0 ? `${open} open question${open === 1 ? "" : "s"} for ${name}` : `Nothing left to ask ${name}`} />}
      footer={
        <div className="flex flex-col gap-2">
          <GlassButton variant="amber" size={40} className="w-full" data-testid="map-start-debrief" onClick={() => void vm.startDebrief()}>
            Start the spoken debrief ({open} open slot{open === 1 ? "" : "s"})
          </GlassButton>
          {!vm.teachback && (
            <GlassButton variant="ghost" size={30} className="w-full" disabled={tbDisabled} onClick={() => vm.startTeachback()}>
              Generate teach-back now
            </GlassButton>
          )}
          <Status right={voiceTag}>Asks only what the capture left open</Status>
        </div>
      }
    />
  );
}
