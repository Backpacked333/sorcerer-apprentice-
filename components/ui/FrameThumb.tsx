export function FrameThumb({ src, t, blurred, region, size = "sm" }: { src?: string; t?: number; blurred?: number; region?: { x: number; y: number; w: number; h: number }; size?: "sm" | "lg" }) {
  if (!src) return <p className="text-[13px] text-[#6e6e73]">No still kept for this step</p>;
  const lg = size === "lg";
  return (
    <figure className={lg ? "frame-lg" : "frame-sm"} style={{ margin: 0, maxWidth: lg ? undefined : 120 }}>
      <div
        className="relative overflow-hidden"
        style={{ borderRadius: lg ? 14 : 11, boxShadow: "0 0 0 .5px rgba(0,0,0,.1), 0 4px 14px rgba(15,23,42,.08)", background: "#f4f6f8" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- data: or same-origin still */}
        <img src={src} alt="captured still" className="block w-full" style={{ border: 0, borderRadius: 0 }} />
        {region && (
          <span
            aria-hidden
            className="frame-region pointer-events-none absolute"
            style={{
              left: `${region.x * 100}%`,
              top: `${region.y * 100}%`,
              width: `${region.w * 100}%`,
              height: `${region.h * 100}%`,
              border: "1.5px solid #f5a623",
              borderRadius: 4,
              boxShadow: "0 0 10px rgba(245,166,35,.7)",
            }}
          />
        )}
      </div>
      <figcaption className="mt-1 text-[12px] text-[#6e6e73]">captured still{t != null ? ` · ${t.toFixed(0)} s` : ""}{blurred != null ? ` · ${blurred} regions blurred` : ""}</figcaption>
    </figure>
  );
}
