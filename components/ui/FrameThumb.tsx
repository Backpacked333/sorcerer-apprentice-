export function FrameThumb({ src, t, blurred, region, size = "sm" }: { src?: string; t?: number; blurred?: number; region?: { x: number; y: number; w: number; h: number }; size?: "sm" | "lg" }) {
  if (!src) return <p className="t-small text-muted">No still kept for this step</p>;
  return (
    <figure className={size === "lg" ? "frame-lg" : "frame-sm"}>
      <div className="relative">
        <img src={src} alt="captured still" />
        {region && <span className="frame-region" style={{ left: `${region.x * 100}%`, top: `${region.y * 100}%`, width: `${region.w * 100}%`, height: `${region.h * 100}%` }} />}
      </div>
      <figcaption className="t-small text-muted">captured still{t != null ? ` · ${t.toFixed(0)} s` : ""}{blurred != null ? ` · ${blurred} regions blurred` : ""}</figcaption>
    </figure>
  );
}
