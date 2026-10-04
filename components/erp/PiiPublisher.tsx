"use client";

import { useEffect } from "react";
import { piiSourceId, projectPiiRects, publishPiiRects } from "@/lib/pii-masks";
import type { PiiRegion } from "@/lib/redact";

/** The queue this sandbox page shows: `?queue=`, else the header's queue link, else "expert". */
function currentQueue(app: string): string {
  const q = new URLSearchParams(window.location.search).get("queue");
  if (q) return q;
  const link = document.querySelector<HTMLAnchorElement>('a[href*="/erp?queue="]');
  const fromLink = link ? new URL(link.href, window.location.href).searchParams.get("queue") : null;
  return fromLink ?? (app === "erp" ? "expert" : "default");
}

/** Inside a same-origin frame (the workspace iframe), rects are re-expressed in the TOP window's viewport, because
 * a capture of that tab sees the whole top window. Cross-origin parent: nothing is published (undefined). */
function toTopViewport(rects: PiiRegion[]): PiiRegion[] | undefined {
  if (window.top === window) return rects;
  try {
    const frame = window.frameElement as HTMLElement | null;
    const top = window.top;
    if (!frame || !top || !(top.innerWidth > 0 && top.innerHeight > 0)) return undefined;
    let x = 0, y = 0;
    // walk up nested same-origin frames to the top window's CSS px
    for (let w: Window = window; w !== top; w = w.parent) {
      const el = w.frameElement as HTMLElement | null;
      if (!el) return undefined;
      const r = el.getBoundingClientRect();
      x += r.left + el.clientLeft; y += r.top + el.clientTop;
    }
    const viewport = { x, y, w: frame.clientWidth, h: frame.clientHeight };
    if (!(viewport.w > 0 && viewport.h > 0)) return undefined;
    return projectPiiRects(rects, viewport, { x: 0, y: 0, w: top.innerWidth, h: top.innerHeight });
  } catch { return undefined; }
}

/**
 * Publishes normalized rects of recognized [data-pii] nodes (name/email/iban/phone, clipped by overflow) in this
 * page's own viewport, paired by `piiSourceId({ origin, app, queue })` (P-24, two-window mode). A capture in the
 * same tab (workspace iframe) reads the iframe DOM directly and does not need this channel.
 * Each mount sends its own instance id, so the receiver unions two tabs on the same app+queue instead of letting one
 * replace the other. Inside the workspace iframe the rects are projected into the top window's viewport.
 * Publishes on layout, scroll, resize and DOM changes, plus a 1 s heartbeat so a subscriber can judge freshness.
 */
export function PiiPublisher() {
  useEffect(() => {
    const instanceId = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `pii_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
    let raf = 0;
    const post = () => {
      raf = 0;
      try {
        const app = window.location.pathname.startsWith("/claims") ? "claims" : "erp";
        publishPiiRects(piiSourceId({ origin: window.location.origin, app, queue: currentQueue(app) }), document, instanceId, toTopViewport);
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
