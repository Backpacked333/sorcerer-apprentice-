"use client";

import { useEffect, useState } from "react";
import { IridescentRim } from "./IridescentRim";
import { MOODS, RAINBOW, type OrbMood } from "@/lib/ui/moods";
import { rectsEqual, type Rect } from "@/lib/ui/geometry";

export type FieldHighlightProps = { rect: Rect | null; mood: OrbMood };

const SPRING = "var(--ease-halo, cubic-bezier(.25,1.18,.35,1))";

/**
 * Halo around the field Tacit is attending to (design §6.5). Never a pop-up, never covers the field:
 * it sits 5px outside the rect, springs between fields (.9s) and fades out in place when rect becomes null.
 * Render inside an absolutely positioned, pointer-events:none overlay root whose origin matches the rects.
 */
export function FieldHighlight({ rect, mood }: FieldHighlightProps) {
  // Keep the last rect so the halo fades where it was instead of jumping (stored-previous-value pattern).
  const [last, setLast] = useState<Rect | null>(rect);
  if (rect && !rectsEqual(rect, last)) setLast(rect);
  const [shown, setShown] = useState(false);
  const hasRect = !!rect;
  useEffect(() => {
    if (!hasRect) {
      setShown(false);
      return;
    }
    // Mount at opacity 0 at the right place, then fade in on the next frame (no fly-in from the origin).
    const id = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(id);
  }, [hasRect]);

  const box = rect ?? last;
  if (!box) return null;
  const M = MOODS[mood] ?? MOODS.quiet;
  const opacity = rect && shown ? M.halo : 0;
  return (
    <div
      aria-hidden
      data-halo={mood}
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: box.w + 10,
        height: box.h + 10,
        transform: `translate(${box.x - 5}px, ${box.y - 5}px)`,
        borderRadius: 9,
        zIndex: 3,
        pointerEvents: "none",
        opacity,
        transition: `transform .9s ${SPRING}, width .9s ${SPRING}, height .9s ${SPRING}, opacity .6s`,
        willChange: "transform, opacity",
      }}
    >
      <div style={{ position: "absolute", inset: -2, animation: "tc-glowbreathe 3.2s ease-in-out infinite", pointerEvents: "none" }}>
        <IridescentRim radius={11} colors={M.rim.colors} blur={7} opacity={0.7 * RAINBOW} />
      </div>
      <IridescentRim radius={9} colors={M.rim.colors} speed={6} />
    </div>
  );
}
