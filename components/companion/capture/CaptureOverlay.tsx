"use client";
// Over-ERP overlays (halo, cable, "Noticed" chip). Rule D1: the View mounts this ONLY when no real frame
// capture is live (?share=0, the dom source, keyless). Targets are the ERP's own `data-erp-target` hooks,
// read from the same-origin iframe; when a hook is missing the halo simply hides.
import { useEffect, useState, type RefObject } from "react";
import { ConnectorCurve, FieldHighlight, NoticedChip } from "@/components/glass";
import { useWorkspaceFrame } from "@/components/ui/Workspace";
import type { OrbMood } from "@/lib/ui/moods";
import type { Rect } from "@/lib/ui/geometry";

const same = (a: Rect | null, b: Rect | null) => a === b || (!!a && !!b && a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h);
const round = (r: DOMRect | { left: number; top: number; width: number; height: number }): Rect => ({ x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) });

export function CaptureOverlay(p: {
  /** data-erp-target key of the attended field, or null */
  target: string | null;
  mood: OrbMood;
  /** cable only while a question is on the card */
  cable: boolean;
  cardRef: RefObject<HTMLElement | null>;
  notice?: { id: string; text: string } | null;
}) {
  const { target, mood, cable, cardRef, notice } = p;
  const { iframe, frame } = useWorkspaceFrame();
  const [rect, setRect] = useState<Rect | null>(null);
  const [card, setCard] = useState<Rect | null>(null);

  useEffect(() => {
    if (!target || !iframe || !frame) {
      setRect(null);
      return;
    }
    const measure = () => {
      let next: Rect | null = null;
      try {
        const doc = iframe.contentDocument;
        const el = doc?.querySelector(`[data-erp-target="${CSS.escape(target)}"]`);
        if (el) {
          const r = el.getBoundingClientRect();
          const fr = frame.getBoundingClientRect();
          const ir = iframe.getBoundingClientRect();
          const box = { left: r.left + ir.left - fr.left, top: r.top + ir.top - fr.top, width: r.width, height: r.height };
          const visible = box.width > 0 && box.height > 0 && box.top + box.height > 0 && box.top < fr.height && box.left < fr.width;
          next = visible ? round(box) : null;
        }
      } catch {
        next = null; // not same-origin (should not happen): no halo
      }
      setRect((prev) => (same(prev, next) ? prev : next));
      const c = cardRef.current?.getBoundingClientRect();
      const fr = frame.getBoundingClientRect();
      const nextCard = c ? round({ left: c.left - fr.left, top: c.top - fr.top, width: c.width, height: c.height }) : null;
      setCard((prev) => (same(prev, nextCard) ? prev : nextCard));
    };
    measure();
    const id = window.setInterval(measure, 200);
    return () => window.clearInterval(id);
  }, [target, iframe, frame, cardRef]);

  return (
    <>
      <FieldHighlight rect={rect} mood={mood} />
      {cable && rect && card ? <ConnectorCurve from={rect} to={card} mood={mood} drawKey={target ?? ""} /> : null}
      {notice && rect ? <NoticedChip key={notice.id} id={notice.id} rect={rect} text={notice.text} flyTo={card} /> : null}
    </>
  );
}
