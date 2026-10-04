"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { layoutMode, type LayoutMode } from "@/lib/ui/layout";

/** Read once on mount. Freeze after the session starts so a resize cannot swap the tree. */
export function useLayoutMode(input: { canCrop: boolean; source: string; started: boolean }): LayoutMode {
  const [mode, setMode] = useState<LayoutMode>("companion");
  const frozen = useRef(false);
  useLayoutEffect(() => {
    if (!frozen.current) {
      const params = new URLSearchParams(window.location.search);
      setMode(layoutMode({
        search: window.location.search,
        width: window.innerWidth,
        canCrop: input.canCrop,
        source: input.source,
        share0: params.get("share") === "0",
      }));
    }
    if (input.started) frozen.current = true;
  }, [input.canCrop, input.source, input.started]);
  return mode;
}
