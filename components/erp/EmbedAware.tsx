"use client";

import { useEffect } from "react";

export function EmbedAware() {
  useEffect(() => {
    if (window.self !== window.top) document.documentElement.classList.add("erp-embedded");
    else {
      // A standalone sandbox tab announces itself, so a capture of it is never mistaken for Tacit's own tab.
      const md = navigator.mediaDevices as (MediaDevices & { setCaptureHandleConfig?: (c: { handle: string; exposeOrigin: boolean; permittedOrigins: string[] }) => void }) | undefined;
      try { md?.setCaptureHandleConfig?.({ handle: `sandbox:${location.pathname.split("/")[1] || "app"}`, exposeOrigin: false, permittedOrigins: [location.origin] }); } catch { /* unsupported */ }
    }
    return () => document.documentElement.classList.remove("erp-embedded");
  }, []);
  return null;
}
