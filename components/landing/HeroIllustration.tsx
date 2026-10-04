"use client";
// Landing hero: an ILLUSTRATION of the companion over a generic mini ERP (lead decision D5).
// Generic beats only (no business rules, no sandbox values). Every control is inert.
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { FieldHighlight, IridescentRim, Orb } from "@/components/glass";
import { MOODS, type OrbMood } from "@/lib/ui/moods";
import type { Rect } from "@/lib/ui/geometry";

type Target = "terms" | "note" | null;
const BEATS: { mood: OrbMood; t: string; s: string; target: Target; terms: string; note: string }[] = [
  { mood: "quiet", t: "Watching the bill", s: "Reading a still of the screen", target: null, terms: "Net 30", note: "" },
  { mood: "notice", t: "Noticed: a field changed", s: "Holding one question for a pause", target: "terms", terms: "Net 14", note: "" },
  { mood: "typing", t: "Quiet — you're typing", s: "I won't interrupt", target: "note", terms: "Net 14", note: "Agreed on the phone" },
  { mood: "asking", t: "What made you change that field?", s: "Asking at a natural pause", target: "terms", terms: "Net 14", note: "Agreed on the phone" },
  { mood: "listening", t: "Listening — your words become the reason", s: "Mic open only for the answer", target: "terms", terms: "Net 14", note: "Agreed on the phone" },
  { mood: "understood", t: "Understood · a reason, in your words", s: "Linked to the screen moment", target: "terms", terms: "Net 14", note: "Agreed on the phone" },
];
const W = 560, H = 420;
const RECTS: Record<Exclude<Target, null>, Rect> = {
  terms: { x: 138, y: 220, w: 200, h: 28 },
  note: { x: 138, y: 286, w: 400, h: 28 },
};
const useIso = typeof window === "undefined" ? useEffect : useLayoutEffect;

export function HeroIllustration() {
  const wrap = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState<number | null>(null);
  const [i, setI] = useState(0);

  useIso(() => {
    const el = wrap.current;
    if (!el) return;
    const measure = () => setScale(Math.min(1.07, el.clientWidth / W));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mq.matches) {
      setI(BEATS.length - 1);
      return;
    }
    const id = window.setInterval(() => {
      if (!document.hidden) setI((n) => (n + 1) % BEATS.length);
    }, 2600);
    return () => window.clearInterval(id);
  }, []);

  const b = BEATS[i];
  const M = MOODS[b.mood];
  const s = scale ?? 1;
  return (
    <div ref={wrap} aria-label="Illustration: the companion asking why at a pause" role="img" style={{ position: "relative", width: "100%", aspectRatio: `${W} / ${H + 24}` }}>
      <div style={{ position: "absolute", left: 0, top: 0, width: W, height: H, transform: `scale(${s})`, transformOrigin: "0 0", opacity: scale == null ? 0 : 1, transition: "opacity .4s" }}>
        <MiniErp beat={b} />
      </div>
      <span style={{ position: "absolute", left: 12, top: -12, zIndex: 4, height: 24, padding: "0 10px", borderRadius: 12, display: "inline-flex", alignItems: "center", fontSize: 11.5, fontWeight: 600, letterSpacing: ".04em", color: "#6e6e73", background: "rgba(255,255,255,.9)", boxShadow: "0 0 0 .5px rgba(0,0,0,.1),0 4px 12px rgba(15,23,42,.08)" }}>
        Illustration
      </span>
      {/* Companion card (decorative copy of the real one) */}
      <div className="absolute right-[-18px] bottom-[-22px] max-lg:right-2 max-lg:bottom-[-14px]" style={{ width: 300, maxWidth: "86%", zIndex: 3 }}>
        <div aria-hidden style={{ position: "absolute", inset: -3, borderRadius: 31, opacity: M.raw.glow, filter: "blur(20px)", transition: "opacity .9s", pointerEvents: "none" }}>
          <IridescentRim radius={31} colors={M.rim.colors} filled speed={M.rim.speed} />
        </div>
        <div style={{ position: "relative", borderRadius: 28, overflow: "hidden", padding: 14, display: "flex", flexDirection: "column", gap: 10, background: "linear-gradient(180deg,rgba(255,255,255,.72),rgba(255,255,255,.5))", backdropFilter: "blur(28px) saturate(1.9)", WebkitBackdropFilter: "blur(28px) saturate(1.9)", boxShadow: "inset 0 1px 0 #fff,0 20px 50px rgba(15,23,42,.14)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Orb mood={b.mood} size={40} full rippleKey={M.ripple ? i : undefined} />
            <div style={{ flex: 1, minWidth: 0, minHeight: 40, display: "flex", flexDirection: "column", justifyContent: "center" }}>
              <div key={i} style={{ animation: "tc-rise .55s var(--ease-rise) both" }}>
                <div style={{ fontSize: 14.5, fontWeight: 600, lineHeight: 1.25, color: "#1d1d1f", letterSpacing: "-.01em" }}>{b.t}</div>
                <div style={{ fontSize: 12, color: "#6e6e73", marginTop: 2 }}>{b.s}</div>
              </div>
            </div>
          </div>
          <div aria-hidden style={{ display: "flex", gap: 6, fontSize: 11.5, fontWeight: 500, pointerEvents: "none" }}>
            <span tabIndex={-1} style={{ flex: 1, height: 30, borderRadius: 15, display: "grid", placeItems: "center", background: "rgba(255,255,255,.5)", boxShadow: "inset 0 0 0 .5px rgba(0,0,0,.07)" }}>Pause</span>
            <span tabIndex={-1} style={{ flex: 1.3, height: 30, borderRadius: 15, display: "grid", placeItems: "center", color: "#c9342f", background: "rgba(255,255,255,.5)", boxShadow: "inset 0 0 0 .5px rgba(0,0,0,.07)" }}>Off the record</span>
            <span tabIndex={-1} style={{ flex: 1, height: 30, borderRadius: 15, display: "grid", placeItems: "center", color: "#6b3f00", fontWeight: 600, background: "linear-gradient(180deg,rgba(255,222,160,.8),rgba(255,196,95,.55))" }}>Done</span>
          </div>
        </div>
        <div aria-hidden style={{ position: "absolute", inset: 0, borderRadius: 28, pointerEvents: "none" }}>
          <IridescentRim radius={28} colors={M.rim.colors} opacity={M.raw.rim} speed={M.rim.speed} />
        </div>
      </div>
    </div>
  );
}

function MiniErp({ beat }: { beat: (typeof BEATS)[number] }) {
  const lab = { fontSize: 9.5, color: "#52606d", marginBottom: 3 } as const;
  const field = { position: "absolute", height: 28, border: "1px solid #d0d7de", borderRadius: 4, display: "flex", alignItems: "center", padding: "0 8px", boxSizing: "border-box", background: "#fff", fontSize: 11.5 } as const;
  return (
    <div aria-hidden style={{ position: "absolute", inset: 0, borderRadius: 18, overflow: "hidden", background: "#f4f6f8", color: "#17202a", boxShadow: "0 0 0 .5px rgba(0,0,0,.14),0 30px 70px rgba(15,23,42,.16)", fontFamily: "var(--font-plex, var(--font-sans))" }}>
      <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: 110, background: "#16324f", padding: "14px 10px", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: 7, color: "#fff", fontSize: 11 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 600, marginBottom: 8 }}><span style={{ width: 9, height: 9, background: "#fff", borderRadius: 1.5 }} />Any ERP</div>
        <span style={{ opacity: 0.75 }}>Dashboard</span>
        <span style={{ padding: "4px 6px", borderRadius: 4, background: "rgba(255,255,255,.12)", fontWeight: 600 }}>Bills</span>
        <span style={{ opacity: 0.75 }}>Reports</span>
        <span style={{ opacity: 0.75 }}>Accounting</span>
      </div>
      <div style={{ position: "absolute", top: 0, left: 110, right: 0, height: 36, background: "#fff", borderBottom: "1px solid #e3e7eb", display: "flex", alignItems: "center", padding: "0 14px", fontSize: 11, color: "#7b8794" }}>
        <span style={{ width: 180, height: 22, borderRadius: 4, background: "#f3f5f7", border: "1px solid #e3e7eb", display: "flex", alignItems: "center", padding: "0 8px" }}>Search bills, vendors</span>
      </div>
      <div style={{ position: "absolute", top: 50, left: 126, right: 16, display: "flex", alignItems: "center", gap: 8 }}>
        <b style={{ fontSize: 15 }}>Bill B-1024</b>
        <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 3, background: "#eef1f4", border: "1px solid #d0d7de", color: "#3a4753" }}>OPEN</span>
        <span style={{ marginLeft: "auto", fontSize: 18, fontWeight: 600 }}>€1,240.00</span>
      </div>
      <div style={{ position: "absolute", top: 84, left: 126, right: 16, background: "#fff", border: "1px solid #e3e7eb", borderRadius: 6, padding: "10px 12px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 12px", fontSize: 11.5 }}>
        <div><div style={lab}>Vendor</div>Example Supplier Ltd</div>
        <div><div style={lab}>Category</div>services</div>
        <div><div style={lab}>Line item</div>Quarterly support contract</div>
        <div><div style={lab}>IBAN · masked in the browser</div><span style={{ display: "inline-block", width: 110, height: 8, borderRadius: 2, background: "#17202a" }} /></div>
      </div>
      <div style={{ position: "absolute", top: 186, left: 126, right: 16, height: 148, background: "#fff", border: "1px solid #e3e7eb", borderRadius: 6 }} />
      <div style={{ position: "absolute", top: 200, left: 138, ...lab }}>Payment terms</div>
      <div style={{ ...field, left: RECTS.terms.x, top: RECTS.terms.y, width: RECTS.terms.w }}>
        <span key={beat.terms} style={{ animation: "tc-fade .4s both" }}>{beat.terms}</span>
      </div>
      <div style={{ position: "absolute", top: 266, left: 138, ...lab }}>Internal note</div>
      <div style={{ ...field, left: RECTS.note.x, top: RECTS.note.y, width: RECTS.note.w, color: beat.note ? "#17202a" : "#9aa5b1" }}>
        {beat.note ? <TypedText text={beat.note} active={beat.mood === "typing"} /> : "Add a note"}
      </div>
      <div style={{ position: "absolute", left: 0, top: 0, width: W, height: H, pointerEvents: "none" }}>
        <FieldHighlight rect={beat.target ? RECTS[beat.target] : null} mood={beat.mood} />
      </div>
      <div style={{ position: "absolute", bottom: 14, left: 126, display: "flex", gap: 8 }}>
        <span style={{ height: 28, padding: "0 12px", borderRadius: 4, display: "grid", placeItems: "center", fontSize: 11.5, background: "#fff", border: "1px solid #d0d7de" }}>Save draft</span>
        <span style={{ height: 28, padding: "0 12px", borderRadius: 4, display: "grid", placeItems: "center", fontSize: 11.5, fontWeight: 600, color: "#fff", background: "#0b5cad" }}>Save</span>
      </div>
    </div>
  );
}

/** Types the note one character at a time while the beat is "typing"; static otherwise. */
function TypedText({ text, active }: { text: string; active: boolean }) {
  const [n, setN] = useState(active ? 0 : text.length);
  useEffect(() => {
    if (!active) {
      setN(text.length);
      return;
    }
    setN(0);
    const id = window.setInterval(() => setN((c) => (c >= text.length ? c : c + 1)), 95);
    return () => window.clearInterval(id);
  }, [active, text]);
  return (
    <span>
      {text.slice(0, n)}
      {active && <span style={{ display: "inline-block", width: 1, height: 13, marginLeft: 1, background: "#17202a", verticalAlign: "-2px", animation: "tc-blink 1s step-end infinite" }} />}
    </span>
  );
}
