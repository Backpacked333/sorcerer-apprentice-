"use client";

import { useEffect } from "react";

export function EmbedAware() {
  useEffect(() => {
    if (window.self !== window.top) document.documentElement.classList.add("erp-embedded");
    return () => document.documentElement.classList.remove("erp-embedded");
  }, []);
  return null;
}
