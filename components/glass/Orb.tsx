"use client";
// The Tacit orb (design §5.1): fill ring (pause) → ripple (re-keyed) → body with swirl,
// bounce light, cursor-following specular and glass edge → amber "held" badge.
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { MOODS, PASTEL, SWIRL, type OrbMood } from "@/lib/ui/moods";
import { prefersReducedMotion } from "@/lib/ui/motion";

const useIso = typeof window === "undefined" ? useEffect : useLayoutEffect;
const BREATHE_BASE = 4.4; // s; the one constant breathe period, varied by playback rate

/** Split a mood's orb animation into a breathe period (or null = still) and a talk flag. */
function parseAnim(anim: string): { period: number | null; talk: boolean } {
  const m = /tc-breathe\s+([\d.]+)s/.exec(anim);
  if (m) return { period: parseFloat(m[1]) || BREATHE_BASE, talk: false };
  if (anim.includes("tc-talk")) return { period: 1.8, talk: true };
  return { period: null, talk: false };
}

export function Orb(p: {
  mood: OrbMood;
  size?: number;
  rippleKey?: string | number;
  ringMs?: number | null;
  badge?: boolean;
  follow?: boolean;
  full?: boolean;
  className?: string;
}) {
  const { mood, size = 38, rippleKey, ringMs = null, follow = true, full = false, className } = p;
  const M = MOODS[mood] ?? MOODS.quiet;
  const box = useRef<HTMLDivElement>(null);
  const hl = useRef<HTMLDivElement>(null);
  const gid = useId().replace(/:/g, "");

  // Base gradient cross-fade: layer A underneath, layer B on top toggles opacity (.7s).
  const [layers, setLayers] = useState({ a: M.base, b: M.base, front: "a" as "a" | "b" });
  useEffect(() => {
    setLayers((l) => {
      const cur = l.front === "a" ? l.a : l.b;
      if (cur === M.base) return l;
      return l.front === "a" ? { a: l.a, b: M.base, front: "b" } : { a: M.base, b: l.b, front: "a" };
    });
  }, [M.base]);

  // Motion continuity across moods: ONE breathe animation whose speed changes by playback rate
  // (keeps its phase, so a mood change never snaps the scale), paused for still moods; the
  // listening "talk" runs on its own layer and settles back to rest instead of snapping.
  const body = useRef<HTMLDivElement>(null);
  const talkEl = useRef<HTMLDivElement>(null);
  const { period, talk } = parseAnim(M.anim);
  useIso(() => {
    const el = body.current;
    if (!el || typeof el.getAnimations !== "function") return;
    const a = el.getAnimations().find((x) => (x as CSSAnimation).animationName === "tc-breathe");
    if (!a) return;
    const rate = period == null ? 0 : BREATHE_BASE / period;
    if (a.playbackRate !== rate) a.updatePlaybackRate(rate);
  }, [period]);
  const wasTalking = useRef(talk);
  useIso(() => {
    const el = talkEl.current;
    const was = wasTalking.current;
    wasTalking.current = talk;
    if (!el || !was || talk || typeof el.animate !== "function") return;
    // talk just ended: ease from wherever the talk left the scale back to rest.
    const from = getComputedStyle(el).transform;
    if (!from || from === "none") return;
    el.animate([{ transform: from }, { transform: "none" }], { duration: 320, easing: "cubic-bezier(.2,.9,.3,1)" });
  }, [talk]);

  // Ripple only on a real change of rippleKey (never on first mount).
  const firstRipple = useRef(rippleKey);
  const showRipple = rippleKey !== undefined && rippleKey !== firstRipple.current;

  // Cursor-follow specular, rAF-throttled, off under reduced motion.
  useEffect(() => {
    if (!follow || typeof window === "undefined") return;
    if (prefersReducedMotion()) return;
    let raf = 0;
    let last: { x: number; y: number } | null = null;
    const apply = () => {
      raf = 0;
      const b = box.current, h = hl.current;
      if (!b || !h || !last) return;
      const r = b.getBoundingClientRect();
      const dx = last.x - (r.left + r.width / 2), dy = last.y - (r.top + r.height / 2);
      const d = Math.hypot(dx, dy) || 1;
      const m = Math.min(1, d / 360) * size * 0.118;
      h.style.transform = `translate(${((dx / d) * m).toFixed(2)}px,${((dy / d) * m).toFixed(2)}px)`;
    };
    const onMove = (ev: MouseEvent) => {
      last = { x: ev.clientX, y: ev.clientY };
      if (!raf) raf = requestAnimationFrame(apply);
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => {
      window.removeEventListener("mousemove", onMove);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [follow, size]);

  const swirl = full ? M.raw.swirl : M.swirl;
  const badge = p.badge ?? M.badge;
  const ringBox = size + 12;
  const rr = ringBox / 2 - 1.5;

  return (
    <div
      ref={box}
      aria-hidden
      className={className}
      data-mood={mood}
      style={{ position: "relative", width: size, height: size, flex: "none", pointerEvents: "none" }}
    >
      {ringMs != null && (
        <svg
          key={`ring-${ringMs}-${rippleKey ?? ""}`}
          width={ringBox}
          height={ringBox}
          viewBox={`0 0 ${ringBox} ${ringBox}`}
          style={{ position: "absolute", left: -6, top: -6, transform: "rotate(-90deg)", overflow: "visible" }}
        >
          <defs>
            <linearGradient id={`pring${gid}`} x1="0" y1="0" x2="1" y2="1">
              {PASTEL.map((c, i) => (
                <stop key={i} offset={i / 5} stopColor={c} />
              ))}
            </linearGradient>
          </defs>
          <circle cx={ringBox / 2} cy={ringBox / 2} r={rr} fill="none" stroke="rgba(0,0,0,.05)" strokeWidth={1.2} />
          <circle
            cx={ringBox / 2}
            cy={ringBox / 2}
            r={rr}
            fill="none"
            stroke={`url(#pring${gid})`}
            strokeWidth={2.2}
            strokeLinecap="round"
            pathLength={1}
            strokeDasharray={1}
            style={{ animation: `tc-fillring ${ringMs}ms linear both`, filter: "drop-shadow(0 0 3px rgba(180,160,255,.6))" }}
          />
        </svg>
      )}
      {showRipple && (
        <div
          key={`r${rippleKey}`}
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
            boxShadow: `0 0 0 1.5px ${M.ring}`,
            animation: "tc-ripple 1.5s cubic-bezier(.2,.7,.3,1) both",
          }}
        />
      )}
      <div ref={talkEl} style={{ position: "absolute", inset: 0, borderRadius: "50%", animation: talk ? "tc-talk 1.1s ease-in-out infinite" : "none" }}>
      <div
        ref={body}
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "50%",
          overflow: "hidden",
          boxShadow: M.shadow,
          animation: `tc-breathe ${BREATHE_BASE}s ease-in-out infinite`,
          transition: "box-shadow .7s",
          transform: "translateZ(0)",
        }}
      >
        <div style={{ position: "absolute", inset: 0, background: layers.a }} />
        <div style={{ position: "absolute", inset: 0, background: layers.b, opacity: layers.front === "b" ? 1 : 0, transition: "opacity .7s" }} />
        <div
          style={{
            position: "absolute",
            inset: -size * 0.2,
            borderRadius: "50%",
            background: `conic-gradient(from 0deg,${SWIRL.join(",")})`,
            filter: `blur(${size * 0.18}px)`,
            opacity: swirl,
            animation: "tc-spin 7s linear infinite",
            transition: "opacity .8s",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
            background: "radial-gradient(circle at 50% 120%,rgba(255,255,255,.55),rgba(255,255,255,0) 60%)",
          }}
        />
        <div
          ref={hl}
          style={{
            position: "absolute",
            left: "16%",
            top: "12%",
            width: "44%",
            height: "38%",
            borderRadius: "50%",
            background: "radial-gradient(circle,rgba(255,255,255,.95),rgba(255,255,255,0) 70%)",
            transition: "transform .3s ease-out",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
            boxShadow: "inset 0 0 0 .5px rgba(255,255,255,.9),inset 0 -3px 6px rgba(0,0,0,.06)",
          }}
        />
      </div>
      </div>
      {badge && (
        <span
          style={{
            position: "absolute",
            top: -1,
            right: -1,
            width: Math.max(8, Math.round(size * 0.26)),
            height: Math.max(8, Math.round(size * 0.26)),
            borderRadius: "50%",
            background: "#f5a623",
            boxShadow: "0 0 0 2px rgba(255,255,255,.95),0 0 8px rgba(245,166,35,.8)",
            animation: "tc-dotpulse 2.2s ease-in-out infinite",
          }}
        />
      )}
    </div>
  );
}
