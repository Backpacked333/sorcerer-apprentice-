"use client";
// Over-ERP layer for Teach (D1): halo on the field the latest event names, plus the cable to the card.
// Rendered by TeachView only while no real frame capture is live. Measures inside the same-origin
// iframe through the sandbox's `data-erp-target` hooks, and only when the iframe shows that invoice.
import { useEffect, useState } from "react";
import { ConnectorCurve, FieldHighlight } from "@/components/glass";
import { useWorkspaceFrame } from "@/components/ui/Workspace";
import type { Rect } from "@/lib/ui/geometry";
import type { OrbMood } from "@/lib/ui/moods";

const same = (a: Rect | null, b: Rect | null) => a === b || (!!a && !!b && a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h);
const round = (r: Rect): Rect => ({ x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.w), h: Math.round(r.h) });

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
        const w = iframe.contentWindow;
        const doc = iframe.contentDocument;
        const onInvoice = !invoice || (w?.location.pathname ?? "").includes(`/invoice/${invoice}`);
        if (!onInvoice) el = null;
        else if (!el || !el.isConnected || el.ownerDocument !== doc) el = doc?.querySelector(`[data-erp-target="${CSS.escape(target)}"]`) ?? null;
        const root = frame?.getBoundingClientRect() ?? { left: 0, top: 0 };
        if (el && w) {
          const r = el.getBoundingClientRect();
          const visible = r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < w.innerHeight;
          if (visible) {
            const f = iframe.getBoundingClientRect();
            next = round({ x: r.left + f.left - root.left, y: r.top + f.top - root.top, w: r.width, h: r.height });
          }
        }
        const c = document.querySelector(".workspace-companion .tc-companion");
        if (c) {
          const cr = c.getBoundingClientRect();
          const nc = round({ x: cr.left - root.left, y: cr.top - root.top, w: cr.width, h: cr.height });
          setCard((p) => (same(p, nc) ? p : nc));
        }
      } catch {
        next = null;
      }
      setRect((p) => (same(p, next) ? p : next));
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
