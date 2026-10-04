"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { layoutInputFrom, layoutMode, type LayoutMode } from "@/lib/ui/layout";

export interface LayoutModeState {
  mode: LayoutMode;
  /** False on the server and on the first client render; true once the real mode is known. */
  ready: boolean;
}

/**
 * Layout mode plus a `ready` flag. Render the layout-dependent region behind
 * `<LayoutReveal ready={ready}>` so the SSR default ("companion") never flashes.
 * Read on mount; frozen after the session starts so a resize cannot swap the tree.
 */
export function useLayoutModeState(input: { canCrop: boolean; source: string; started: boolean }): LayoutModeState {
  const [state, setState] = useState<LayoutModeState>({ mode: "companion", ready: false });
  const frozen = useRef(false);
  useLayoutEffect(() => {
    if (!frozen.current) {
      const mode = layoutMode(layoutInputFrom(window.location.search, window.innerWidth, input.canCrop, input.source));
      setState((prev) => (prev.ready && prev.mode === mode ? prev : { mode, ready: true }));
    }
    if (input.started) frozen.current = true;
  }, [input.canCrop, input.source, input.started]);
  return state;
}

/** Backwards-compatible: returns only the mode. */
export function useLayoutMode(input: { canCrop: boolean; source: string; started: boolean }): LayoutMode {
  return useLayoutModeState(input).mode;
}
