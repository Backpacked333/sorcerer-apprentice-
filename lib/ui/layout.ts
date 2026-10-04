export type LayoutMode = "workspace" | "companion";

export function layoutMode(input: { search: string; width: number; canCrop: boolean; source: string; share0: boolean }): LayoutMode {
  const raw = input.search.startsWith("?") ? input.search.slice(1) : input.search;
  const layout = new URLSearchParams(raw).get("layout");
  if (layout === "companion" || input.width < 1180) return "companion";
  if (layout === "workspace") return "workspace";
  if (input.canCrop || input.source === "dom" || input.share0) return "workspace";
  return "companion";
}
