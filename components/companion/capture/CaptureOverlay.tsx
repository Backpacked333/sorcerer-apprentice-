"use client";
// Over-ERP overlays (halo, cable, "Noticed" chip). Rule D1: the View mounts this ONLY when no real frame
// capture is live (?share=0, the dom source, keyless). Targets are the ERP's own `data-erp-target` hooks,
// read from the same-origin iframe; when a hook is missing the halo simply hides.
import { useEffect, useState, type RefObject } from "react";
import { ConnectorCurve, FieldHighlight, NoticedChip } from "@/components/glass";
import { useWorkspaceFrame } from "@/components/ui/Workspace";
import type { OrbMood } from "@/lib/ui/moods";
import { findErpTarget, iframeTargetRect, rectsEqual, relativeRect, roundRect, type Rect } from "@/lib/ui/geometry";

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
    // Measured every animation frame (cheap: two rects + a cached query) so the halo and the cable's card end
    // track the card's height spring and any scroll inside the ERP continuously instead of in 200 ms steps.
    let el: Element | null = null;
    let raf = 0;
    const measure = () => {
      let next: Rect | null = null;
      try {
        el = findErpTarget(iframe.contentDocument, target, el);
        next = el ? iframeTargetRect(el, iframe, frame) : null;
      } catch {
        next = null; // not same-origin (should not happen): no halo
      }
      setRect((prev) => (rectsEqual(prev, next) ? prev : next));
      const c = cardRef.current;
      const nextCard = c ? roundRect(relativeRect(c, frame)) : null;
      setCard((prev) => (rectsEqual(prev, nextCard) ? prev : nextCard));
      raf = requestAnimationFrame(measure);
    };
    measure();
    return () => cancelAnimationFrame(raf);
  }, [target, iframe, frame, cardRef]);

  return (
    <>
      <FieldHighlight rect={rect} mood={mood} />
      {cable && rect && card ? <ConnectorCurve from={rect} to={card} mood={mood} drawKey={target ?? ""} /> : null}
      {notice && rect ? <NoticedChip key={notice.id} id={notice.id} rect={rect} text={notice.text} flyTo={card} /> : null}
    </>
  );
}
