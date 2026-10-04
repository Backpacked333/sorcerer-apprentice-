"use client";

import { useEffect, useState } from "react";

export function BrowserCheck() {
  const [blocked, setBlocked] = useState(false);
  useEffect(() => {
    const ua = navigator.userAgent;
    const chromium = /Chrome|Edg\//.test(ua) && !/Mobile|Android|iPhone|iPad/.test(ua);
    const share = typeof navigator.mediaDevices?.getDisplayMedia === "function";
    setBlocked(!(chromium && share));
  }, []);
  if (!blocked) return null;
  return <p className="banner banner-error" role="alert">This browser cannot share a screen. Use desktop Chrome or Edge.</p>;
}
