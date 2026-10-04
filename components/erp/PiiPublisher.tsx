"use client";

import { useEffect } from "react";
import type { PiiRegion } from "@/lib/redact";

const CHANNEL = "tacit-erp-pii";

/** Normalized rects of [data-pii] nodes, in the ERP page's own viewport. */
export function PiiPublisher() {
  useEffect(() => {
    const post = () => {
      const w = window.innerWidth || 1;
      const h = window.innerHeight || 1;
      const rects: PiiRegion[] = [...document.querySelectorAll<HTMLElement>("[data-pii]")].map((el) => {
        const r = el.getBoundingClientRect();
        return { kind: el.dataset.pii ?? "pii", x: r.left / w, y: r.top / h, w: r.width / w, h: r.height / h };
      });
      const ch = new BroadcastChannel(CHANNEL);
      ch.postMessage({ at: Date.now(), rects });
      ch.close();
    };
    post();
    const ro = new ResizeObserver(post);
    ro.observe(document.documentElement);
    window.addEventListener("resize", post);
    window.addEventListener("scroll", post, true);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", post);
      window.removeEventListener("scroll", post, true);
    };
  }, []);
  return null;
}
