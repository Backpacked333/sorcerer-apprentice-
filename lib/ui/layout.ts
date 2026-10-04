export type LayoutMode = "workspace" | "companion";

/** Below this viewport width the ERP cannot sit full width under a floating companion. */
export const WORKSPACE_MIN_WIDTH = 1180;

export interface LayoutInput {
  search: string;
  width: number;
  /** True when the pipeline can crop or restrict a self-tab capture to the ERP frame. */
  canCrop: boolean;
  source: string;
  share0: boolean;
}

/**
 * Pure layout rule. Order matters:
 * `?layout=companion` or a narrow viewport → companion; `?layout=workspace` → workspace;
 * otherwise workspace only when the capture can be cropped, the events come from the ERP (`dom`),
 * or no screen is shared (`?share=0`).
 */
export function layoutMode(input: LayoutInput): LayoutMode {
  const raw = input.search.startsWith("?") ? input.search.slice(1) : input.search;
  const layout = new URLSearchParams(raw).get("layout");
  if (layout === "companion" || input.width < WORKSPACE_MIN_WIDTH) return "companion";
  if (layout === "workspace") return "workspace";
  if (input.canCrop || input.source === "dom" || input.share0) return "workspace";
  return "companion";
}

/** Builds the rule input from a location search string (reads `share=0`). */
export function layoutInputFrom(search: string, width: number, canCrop: boolean, source: string): LayoutInput {
  const raw = search.startsWith("?") ? search.slice(1) : search;
  return { search, width, canCrop, source, share0: new URLSearchParams(raw).get("share") === "0" };
}
