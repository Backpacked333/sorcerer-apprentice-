"use client";

import { useEffect } from "react";
import { piiSourceId, publishPiiRects } from "@/lib/pii-masks";

/** The queue this sandbox page shows: `?queue=`, else the header's queue link, else "expert". */
function currentQueue(app: string): string {
  const q = new URLSearchParams(window.location.search).get("queue");
  if (q) return q;
  const link = document.querySelector<HTMLAnchorElement>('a[href*="/erp?queue="]');
  const fromLink = link ? new URL(link.href, window.location.href).searchParams.get("queue") : null;
  return fromLink ?? (app === "erp" ? "expert" : "default");
}

/**
 * Publishes normalized rects of recognized [data-pii] nodes (name/email/iban/phone, clipped by overflow) in this
 * page's own viewport, paired by `piiSourceId({ origin, app, queue })` (P-24, two-window mode). A capture in the
 * same tab (workspace iframe) reads the iframe DOM directly and does not need this channel.
 * Publishes on layout, scroll, resize and DOM changes, plus a 1 s heartbeat so a subscriber can judge freshness.
 */
export function PiiPublisher() {
  useEffect(() => {
    let raf = 0;
    const post = () => {
      raf = 0;
      try {
        const app = window.location.pathname.startsWith("/claims") ? "claims" : "erp";
        publishPiiRects(piiSourceId({ origin: window.location.origin, app, queue: currentQueue(app) }));
      } catch { /* no geometry yet */ }
    };
    const schedule = () => { if (!raf) raf = window.requestAnimationFrame(post); };
    post();
    const ro = new ResizeObserver(schedule);
    ro.observe(document.documentElement);
    const mo = new MutationObserver(schedule);
    mo.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["data-pii", "class", "style", "hidden"] });
    const beat = window.setInterval(post, 1000);
    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", schedule, true);
    return () => {
      ro.disconnect();
      mo.disconnect();
      window.clearInterval(beat);
      if (raf) window.cancelAnimationFrame(raf);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule, true);
    };
  }, []);
  return null;
}
