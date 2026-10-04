"use client";
// Cable from the floating companion to the open-question row it is asking about (design §6.6).
// The map page captures nothing, so this overlay is always allowed (D1). Measured in viewport
// coordinates; pointer-events none; hidden when the row is scrolled out of view.

import { useEffect, useState, type RefObject } from "react";
import type { OrbMood } from "@/lib/ui/moods";
import type { Rect } from "@/lib/ui/geometry";
import { ConnectorCurve } from "@/components/glass";

function rectOf(el: Element): Rect {
  const r = el.getBoundingClientRect();
  return { x: r.left, y: r.top, w: r.width, h: r.height };
}

export function MapCable({ cardRef, rowSelector, mood, active }: { cardRef: RefObject<HTMLElement | null>; rowSelector: string | null; mood: OrbMood; active: boolean }) {
  const [rects, setRects] = useState<{ from: Rect; to: Rect } | null>(null);

  useEffect(() => {
    if (!active || !rowSelector) {
      setRects(null);
      return;
    }
    let raf = 0;
    const measure = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const card = cardRef.current;
        const row = document.querySelector(rowSelector);
        if (!card || !row) return setRects(null);
        const from = rectOf(row);
        const to = rectOf(card);
        const visible = from.y + from.h > 56 && from.y < window.innerHeight - 8 && from.x + from.w < to.x - 24;
        setRects(visible ? { from, to } : null);
      });
    };
    measure();
    const t = window.setTimeout(measure, 700); // after the card's size spring settles
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    if (cardRef.current) ro?.observe(cardRef.current);
    const row = document.querySelector(rowSelector);
    if (row) ro?.observe(row);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(t);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
      ro?.disconnect();
    };
  }, [active, rowSelector, cardRef]);

  if (!rects) return null;
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0" style={{ zIndex: 25 }}>
      <ConnectorCurve from={rects.from} to={rects.to} mood={mood} drawKey={rowSelector ?? ""} />
    </div>
  );
}
