"use client";
// Iridescent hairline rim (design §3.3): a conic gradient rotating via the registered
// `--tc-a` angle, masked to a 1.25px ring. `filled` gives the blurred glow disc instead.
//
// Motion continuity: the rotation keeps ONE constant-period CSS animation; `speed` is applied as a
// playback rate (Web Animations `updatePlaybackRate`, which keeps the current angle), so a speed
// change never restarts the hue sweep. A colour change cross-fades a new ring over the old one,
// phase-locked to it, instead of swapping the gradient in one frame.
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { PASTEL } from "@/lib/ui/moods";
import { prefersReducedMotion } from "@/lib/ui/motion";

const BASE_PERIOD = 9; // seconds; matches the CSS default period of tc-hue
const FADE_MS = 800;
const useIso = typeof window === "undefined" ? useEffect : useLayoutEffect;

type Layer = { id: number; colors: string[] };

function hueAnims(el: Element | null): Animation[] {
  if (!el || typeof (el as HTMLElement).getAnimations !== "function") return [];
  return (el as HTMLElement).getAnimations().filter((a) => (a as CSSAnimation).animationName === "tc-hue");
}

export function IridescentRim(p: {
  radius: number | string;
  colors?: string[];
  opacity?: number;
  /** Hue period in seconds (default 9). */
  speed?: number;
  filled?: boolean;
  blur?: number;
  inset?: number;
}) {
  const { radius, colors = PASTEL, opacity = 1, speed = BASE_PERIOD, filled = false, blur, inset = 0 } = p;
  const key = colors.join(",");
  const wrap = useRef<HTMLDivElement>(null);
  const [layers, setLayers] = useState<Layer[]>(() => [{ id: 0, colors }]);
  const top = layers[layers.length - 1];

  // New colour set → add a layer on top (render-phase state update keyed on a real prop change).
  if (top.colors.join(",") !== key) setLayers((ls) => [...ls, { id: ls[ls.length - 1].id + 1, colors }]);

  // Drop layers that are fully covered once the newest has faded in.
  useEffect(() => {
    if (layers.length < 2) return;
    const newest = layers[layers.length - 1].id;
    const t = window.setTimeout(() => setLayers((ls) => ls.filter((l) => l.id >= newest)), FADE_MS + 50);
    return () => window.clearTimeout(t);
  }, [layers]);

  // Phase-lock every layer to the oldest one and apply the speed as a playback rate.
  const rate = BASE_PERIOD / Math.max(0.5, speed || BASE_PERIOD);
  useIso(() => {
    const rings = wrap.current ? Array.from(wrap.current.children) : [];
    const anims = rings.map((r) => hueAnims(r)[0]).filter((a): a is Animation => !!a);
    const lead = anims[0];
    for (const a of anims) {
      if (a !== lead && lead && lead.currentTime != null) a.currentTime = lead.currentTime;
      if (a.playbackRate !== rate) a.updatePlaybackRate(rate);
    }
  }, [layers, rate]);

  // Fade the newest layer in (skipped for the first layer and under reduced motion).
  const lastFaded = useRef(0);
  useIso(() => {
    if (top.id === 0 || top.id === lastFaded.current) return;
    lastFaded.current = top.id;
    const el = wrap.current?.lastElementChild as HTMLElement | null;
    if (!el || typeof el.animate !== "function") return;
    if (prefersReducedMotion()) return;
    el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: FADE_MS, easing: "ease-in-out", fill: "backwards" });
  }, [top.id]);

  const ring = (c: string[]): CSSProperties => ({
    position: "absolute",
    inset: 0,
    borderRadius: radius,
    padding: filled ? 10 : 1.25,
    boxSizing: "border-box",
    background: `conic-gradient(from var(--tc-a, 0deg),${c.join(",")})`,
    animation: `tc-hue ${BASE_PERIOD}s linear infinite`,
    pointerEvents: "none",
    ...(filled
      ? {}
      : {
          WebkitMask: "linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0)",
          WebkitMaskComposite: "xor",
          maskComposite: "exclude",
        }),
  });

  return (
    <div
      ref={wrap}
      aria-hidden
      className="iri-rim-wrap"
      style={{
        position: "absolute",
        inset,
        borderRadius: radius,
        opacity,
        filter: blur ? `blur(${blur}px)` : undefined,
        pointerEvents: "none",
        transition: "opacity .8s",
      }}
    >
      {layers.map((l) => (
        <div key={l.id} style={ring(l.colors)} />
      ))}
    </div>
  );
}
