"use client";

import { useEffect, useState } from "react";
import type { Rect } from "@/lib/ui/geometry";

export type NoticedChipProps = {
  /** The changed field, in overlay-root coordinates. */
  rect: Rect;
  text: string;
  /** Companion card rect to fly into; null fades the chip out in place. */
  flyTo: Rect | null;
  id: string | number;
  onDone?: () => void;
};

type Phase = "pre" | "in" | "fly" | "done";
const SPRING = "var(--ease-spring, cubic-bezier(.25,1.18,.35,1))";
const SWIRL = "conic-gradient(#ff9ad5,#ffd27a,#9be7c4,#8fd3ff,#b7a6ff,#ff9ad5)";

/** "Noticed · 4711 → 0400" chip: pops above the field, then flies into the companion (design §6.7). */
export function NoticedChip({ rect, text, flyTo, id, onDone }: NoticedChipProps) {
  const [phase, setPhase] = useState<Phase>("pre");

  useEffect(() => {
    setPhase("pre");
    let r2 = 0;
    // pre → in on the next-next frame, so the entry transition actually runs.
    const r1 = requestAnimationFrame(() => {
      r2 = requestAnimationFrame(() => setPhase("in"));
    });
    const tFly = window.setTimeout(() => setPhase("fly"), 1600);
    const tDone = window.setTimeout(() => {
      setPhase("done");
      onDone?.();
    }, 2500);
    return () => {
      cancelAnimationFrame(r1);
      cancelAnimationFrame(r2);
      window.clearTimeout(tFly);
      window.clearTimeout(tDone);
    };
    // onDone is intentionally not a dependency: a new callback identity must not restart the chip.
  }, [id]);

  if (phase === "done") return null;
  const cx = rect.x + Math.max(0, Math.min(rect.w - 40, 120));
  let x = cx, y = rect.y - 22, s = 0.85, o = 0;
  if (phase === "in") {
    y = rect.y - 36;
    s = 1;
    o = 1;
  } else if (phase === "fly") {
    if (flyTo) {
      x = flyTo.x + 18;
      y = flyTo.y + 18;
      s = 0.3;
    } else {
      y = rect.y - 36;
      s = 0.9;
    }
    o = 0;
  }
  const transition =
    phase === "fly"
      ? "transform .85s cubic-bezier(.55,0,.3,1), opacity .85s ease-in"
      : `transform .55s ${SPRING}, opacity .3s`;
  return (
    <div
      role="status"
      data-noticed={id}
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        zIndex: 6,
        height: 28,
        padding: "0 12px 0 9px",
        borderRadius: 14,
        display: "flex",
        alignItems: "center",
        gap: 7,
        whiteSpace: "nowrap",
        fontSize: 12,
        fontWeight: 500,
        lineHeight: 1,
        color: "#1d1d1f",
        background: "rgba(255,255,255,.7)",
        backdropFilter: "blur(14px) saturate(1.8)",
        WebkitBackdropFilter: "blur(14px) saturate(1.8)",
        boxShadow: "inset 0 1px 0 #fff,0 0 0 .5px rgba(0,0,0,.08),0 8px 20px rgba(15,23,42,.12)",
        transformOrigin: "left center",
        transform: `translate(${x}px, ${y}px) scale(${s})`,
        opacity: o,
        transition,
        pointerEvents: "none",
        willChange: "transform, opacity",
      }}
    >
      <span aria-hidden style={{ width: 7, height: 7, borderRadius: "50%", flex: "none", background: SWIRL, animation: "tc-spin 2s linear infinite" }} />
      <span style={{ color: "#6e6e73" }}>Noticed</span>
      <span>{text}</span>
    </div>
  );
}
