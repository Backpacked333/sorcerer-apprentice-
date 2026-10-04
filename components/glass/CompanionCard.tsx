"use client";
// The floating companion card (design §6): glow (outside) → glass (tint + content) → rim (on top).
// Width per mode, height measured with a ResizeObserver and sprung (.64s ease-spring).
// The card itself never carries an infinite transform; glow/rim/tint are aria-hidden siblings.
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { MOODS, type OrbMood } from "@/lib/ui/moods";
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
  const inner = useRef<HTMLDivElement>(null);
  const [h, setH] = useState<number | null>(null);
  const [sprung, setSprung] = useState(false);

  useOccluder(outer, occluderId, floating);

  useIsoLayoutEffect(() => {
    const el = inner.current;
    if (!el) return;
    const measure = () => setH(Math.ceil(el.offsetHeight));
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

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
        transition: sprung ? `width .64s ${SPRING}, height .64s ${SPRING}` : "none",
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
          ref={inner}
          style={{
            position: measured ? "absolute" : "relative",
            top: 0,
            left: 0,
            width: panel ? "100%" : width,
            maxHeight: "calc(100dvh - 56px)",
            padding: 14,
            boxSizing: "border-box",
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          <div style={{ flex: "none" }}>{header}</div>
          {children != null && children !== false ? (
            <div
              className="tc-companion-body"
              style={{ flex: "1 1 auto", minHeight: 0, overflowY: "auto", overscrollBehavior: "contain", display: "flex", flexDirection: "column", gap: 12 }}
            >
              {children}
            </div>
          ) : null}
          {footer != null && footer !== false ? <div style={{ flex: "none", position: "sticky", bottom: 0 }}>{footer}</div> : null}
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
