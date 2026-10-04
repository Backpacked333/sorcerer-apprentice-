"use client";

import { useEffect, useState } from "react";
import { Banner } from "./Banner";

/** Renders nothing until mounted (no hydration mismatch); then warns if this browser cannot share a screen. */
export function BrowserCheck() {
  const [blocked, setBlocked] = useState(false);
  useEffect(() => {
    const ua = navigator.userAgent;
    const chromium = /Chrome|Edg\//.test(ua) && !/Mobile|Android|iPhone|iPad/.test(ua);
    const share = typeof navigator.mediaDevices?.getDisplayMedia === "function";
    setBlocked(!(chromium && share));
  }, []);
  if (!blocked) return null;
  return <Banner tone="error">This browser cannot share a screen. Use desktop Chrome or Edge.</Banner>;
}
