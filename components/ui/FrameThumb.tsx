export function FrameThumb({ src, t, blurred, region, width, height, size = "sm" }: { src?: string; t?: number; blurred?: number; region?: { x: number; y: number; w: number; h: number }; width?: number; height?: number; size?: "sm" | "lg" }) {
  if (!src) return <p className="t-small text-muted">No still kept for this step</p>;
  const maxWidth = size === "lg" && width && height && width > 0 && height > 0 && Number.isFinite(width / height) ? 420 * width / height : undefined;
  return (
    <figure className={size === "lg" ? "frame-lg" : "frame-sm"}>
      <div className="relative" style={{ maxWidth }}>
        <img src={src} width={width} height={height} alt="captured still" />
        {region && <span className="frame-region" style={{ left: `${region.x * 100}%`, top: `${region.y * 100}%`, width: `${region.w * 100}%`, height: `${region.h * 100}%` }} />}
      </div>
      <figcaption className="t-small text-muted">captured still{t != null ? ` · ${t.toFixed(0)} s` : ""}{blurred != null ? ` · ${blurred} regions blurred` : ""}</figcaption>
    </figure>
  );
}
