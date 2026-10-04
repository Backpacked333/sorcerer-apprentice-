"use client";

import { useEffect, useState } from "react";
import { ERP_RELOAD_MS } from "@/lib/ui/layout";

export type ErpReloadKey = "idle" | "live";

/** The Workspace `reloadKey`: switches to "live" ERP_RELOAD_MS after `started`, remounting the ERP iframe. */
export function useErpReloadKey(started: boolean, initial: ErpReloadKey = "idle"): ErpReloadKey {
  const [key, setKey] = useState<ErpReloadKey>(initial);
  useEffect(() => {
    if (!started) return;
    const id = window.setTimeout(() => setKey("live"), ERP_RELOAD_MS);
    return () => window.clearTimeout(id);
  }, [started]);
  return key;
}
