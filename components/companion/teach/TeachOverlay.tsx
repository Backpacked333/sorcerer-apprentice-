"use client";
// Over-ERP layer for Teach (D1): halo on the field the latest event names, plus the cable to the card.
// Rendered by TeachView only while no real frame capture is live. Measures inside the same-origin
// iframe through the sandbox's `data-erp-target` hooks, and only when the iframe shows that invoice.
import { useEffect, useState } from "react";
import { ConnectorCurve, FieldHighlight } from "@/components/glass";
import { useWorkspaceFrame } from "@/components/ui/Workspace";
import { findErpTarget, iframeTargetRect, rectsEqual, relativeRect, roundRect, type Rect } from "@/lib/ui/geometry";
import type { OrbMood } from "@/lib/ui/moods";

export function TeachOverlay({ target, invoice, mood, cable }: { target: string | null; invoice?: string; mood: OrbMood; cable: boolean }) {
  const { iframe, frame } = useWorkspaceFrame();
  const [rect, setRect] = useState<Rect | null>(null);
  const [card, setCard] = useState<Rect | null>(null);

  useEffect(() => {
    if (!target || !iframe) {
      setRect(null);
      return;
    }
    // Measured every animation frame so the halo follows scrolling inside the ERP and the cable's card end
    // follows the card's height spring smoothly (no 400 ms steps). The field query is cached per document.
    let el: Element | null = null;
    let raf = 0;
    const measure = () => {
      let next: Rect | null = null;
      try {
        const onInvoice = !invoice || (iframe.contentWindow?.location.pathname ?? "").includes(`/invoice/${invoice}`);
        el = onInvoice ? findErpTarget(iframe.contentDocument, target, el) : null;
        next = el ? iframeTargetRect(el, iframe, frame) : null;
        const c = document.querySelector(".workspace-companion .tc-companion");
        if (c) {
          const nc = roundRect(relativeRect(c, frame));
          setCard((p) => (rectsEqual(p, nc) ? p : nc));
        }
      } catch {
        next = null;
      }
      setRect((p) => (rectsEqual(p, next) ? p : next));
      raf = requestAnimationFrame(measure);
    };
    measure();
    return () => cancelAnimationFrame(raf);
  }, [target, iframe, frame, invoice]);

  return (
    <>
      <FieldHighlight rect={rect} mood={mood} />
      {cable && rect && card ? <ConnectorCurve from={rect} to={card} mood={mood} drawKey={`${target}|${invoice ?? ""}`} /> : null}
    </>
  );
}
