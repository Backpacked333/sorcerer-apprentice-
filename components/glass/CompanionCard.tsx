"use client";
// The floating companion card (design §6): glow (outside) → glass (tint + content) → rim (on top).
// Width per mode, height measured with a ResizeObserver and sprung (.64s ease-spring).
// The card itself never carries an infinite transform; glow/rim/tint are aria-hidden siblings.
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { MOODS, type OrbMood } from "@/lib/ui/moods";
import { prefersReducedMotion } from "@/lib/ui/motion";
import { IridescentRim } from "./IridescentRim";
import { TintBlobs } from "./TintBlobs";
import { useOccluder } from "./occluders";

export type CompanionMode = "capsule" | "ask" | "teachback" | "teach" | "panel";

export const COMPANION_WIDTH: Record<Exclude<CompanionMode, "panel">, number> = {
  capsule: 348,
  ask: 404,
  teachback: 440,
  teach: 404,
};

const SPRING = "var(--ease-spring, cubic-bezier(.2,1.12,.3,1))";
const RISE = "var(--ease-rise, cubic-bezier(.2,.9,.3,1))";
const PAD = 14;
const GAP = 12;
const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

export function CompanionCard(p: {
  mood: OrbMood;
  mode: CompanionMode;
  header: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  floating?: boolean;
  occluderId?: string;
  label: string;
  className?: string;
  testId?: string;
}) {
  const { mood, mode, header, children, footer, floating = false, occluderId = "companion", label, className, testId } = p;
  const M = MOODS[mood] ?? MOODS.quiet;
  const outer = useRef<HTMLElement>(null);
  const headRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const footRef = useRef<HTMLDivElement>(null);
  const [h, setH] = useState<number | null>(null);
  // Growing springs (overshoot reads as "opening"); shrinking eases out without the undershoot
  // that would briefly clip the content, and a little faster so no gap lingers.
  const [shrinking, setShrinking] = useState(false);
  const lastH = useRef<number | null>(null);
  const [sprung, setSprung] = useState(false);
  const hasBody = children != null && children !== false;
  const hasFoot = footer != null && footer !== false;

  useOccluder(outer, occluderId, floating);

  // The card's height springs to the content's NATURAL height (header + body content + footer),
  // measured from parts that never stretch. The content box itself fills the springing card with
  // the footer pinned to its bottom edge, so while the height moves the body is revealed/clipped
  // above the footer — never an empty band of glass under the footer, never a clipped footer.
  useIsoLayoutEffect(() => {
    const parts = [headRef.current, bodyRef.current, footRef.current].filter((el): el is HTMLDivElement => !!el);
    const measure = () => {
      let sum = PAD * 2 + GAP * Math.max(0, parts.length - 1);
      for (const el of parts) sum += el.offsetHeight;
      const next = Math.ceil(sum);
      if (lastH.current != null && next !== lastH.current) setShrinking(next < lastH.current);
      lastH.current = next;
      setH(next);
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    parts.forEach((el) => ro.observe(el));
    return () => ro.disconnect();
  }, [hasBody, hasFoot]);

  // Layout change (capsule ↔ ask ↔ teach…): the body and footer are new content, so they fade up
  // just behind the size spring instead of appearing at full strength in a card that is still
  // springing to its new size. Web Animations (not a key) so stateful children never remount.
  const prevMode = useRef(mode);
  useIsoLayoutEffect(() => {
    if (prevMode.current === mode) return;
    prevMode.current = mode;
    if (prefersReducedMotion()) return;
    const anims = [bodyRef.current, footRef.current]
      .filter((el): el is HTMLDivElement => !!el && typeof el.animate === "function")
      .map((el, i) =>
        el.animate([{ opacity: 0, transform: "translateY(5px)" }, { opacity: 1, transform: "none" }], {
          duration: 440,
          delay: 50 + i * 40,
          easing: "cubic-bezier(.2,.9,.3,1)",
          fill: "backwards",
        }),
      );
    return () => anims.forEach((a) => a.cancel());
  }, [mode]);

  // Enable the size spring only after the first measured frame (no spring on mount).
  useEffect(() => {
    if (h == null || sprung) return;
    const id = requestAnimationFrame(() => setSprung(true));
    return () => cancelAnimationFrame(id);
  }, [h, sprung]);

  const panel = mode === "panel";
  const width = panel ? "100%" : `min(${COMPANION_WIDTH[mode]}px, calc(100vw - 32px))`;
  const measured = h != null;

  return (
    <section
      ref={outer}
      role="region"
      aria-label={label}
      data-testid={testId}
      data-mood={mood}
      data-mode={mode}
      className={["tc-companion", className].filter(Boolean).join(" ")}
      style={{
        position: "relative",
        width,
        flexShrink: 0,
        height: measured ? h : undefined,
        maxHeight: "calc(100dvh - 56px)",
        transition: sprung
          ? `width .64s ${SPRING}, height ${shrinking ? `.5s ${RISE}` : `.64s ${SPRING}`}`
          : "none",
        color: "#1d1d1f",
        fontFamily: "var(--font-sans, -apple-system,BlinkMacSystemFont,'SF Pro Text','Helvetica Neue',sans-serif)",
      }}
    >
      {/* glow: blurred filled conic disc, breathing */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: -3,
          borderRadius: 33,
          opacity: M.glow,
          transition: "opacity .9s",
          pointerEvents: "none",
          animation: "tc-glowbreathe 4.5s ease-in-out infinite",
          filter: "blur(20px)",
        }}
      >
        <IridescentRim radius={33} colors={M.rim.colors} filled speed={M.rim.speed} />
      </div>
      {/* glass */}
      <div className="glass-companion" style={{ position: "absolute", inset: 0, overflow: "hidden", borderRadius: 30 }}>
        <TintBlobs mood={mood} />
        <div
          style={{
            position: measured ? "absolute" : "relative",
            top: 0,
            left: 0,
            width: panel ? "100%" : width,
            height: measured ? "100%" : undefined,
            maxHeight: "calc(100dvh - 56px)",
            padding: PAD,
            boxSizing: "border-box",
            display: "flex",
            flexDirection: "column",
            gap: GAP,
          }}
        >
          <div ref={headRef} style={{ flex: "none" }}>{header}</div>
          {hasBody ? (
            <div
              className="tc-companion-body"
              style={{ flex: "1 1 auto", minHeight: 0, overflowY: "auto", overflowX: "hidden", overscrollBehavior: "contain", display: "flex", flexDirection: "column" }}
            >
              {/* margin-top:auto keeps the body resting on the footer while the card is taller than
                  its content (mid-shrink); it resolves to 0 when the body overflows, so scrolling works. */}
              <div ref={bodyRef} style={{ display: "flex", flexDirection: "column", gap: GAP, marginTop: "auto", flex: "none" }}>
                {children}
              </div>
            </div>
          ) : null}
          {hasFoot ? <div ref={footRef} style={{ flex: "none", marginTop: "auto" }}>{footer}</div> : null}
        </div>
      </div>
      {/* rim on top */}
      <div aria-hidden style={{ position: "absolute", inset: 0, borderRadius: 30, pointerEvents: "none" }}>
        <IridescentRim radius={30} colors={M.rim.colors} opacity={M.rim.opacity} speed={M.rim.speed} />
        <div style={{ position: "absolute", inset: 0, borderRadius: 30, boxShadow: "inset 0 1px 0 rgba(255,255,255,.95)" }} />
      </div>
    </section>
  );
}
