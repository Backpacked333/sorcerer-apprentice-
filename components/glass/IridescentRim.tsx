"use client";
// Iridescent hairline rim (design §3.3): a conic gradient rotating via the registered
// `--tc-a` angle, masked to a 1.25px ring. `filled` gives the blurred glow disc instead.
import type { CSSProperties } from "react";
import { PASTEL } from "@/lib/ui/moods";

export function IridescentRim(p: {
  radius: number | string;
  colors?: string[];
  opacity?: number;
  /** Hue period in seconds (default 9). */
  speed?: number;
  filled?: boolean;
  blur?: number;
  inset?: number;
}) {
  const { radius, colors = PASTEL, opacity = 1, speed = 9, filled = false, blur, inset = 0 } = p;
  const ring: CSSProperties = {
    position: "absolute",
    inset: 0,
    borderRadius: radius,
    padding: filled ? 10 : 1.25,
    boxSizing: "border-box",
    background: `conic-gradient(from var(--tc-a, 0deg),${colors.join(",")})`,
    animation: `tc-hue ${speed}s linear infinite`,
    pointerEvents: "none",
    ...(filled
      ? {}
      : {
          WebkitMask: "linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0)",
          WebkitMaskComposite: "xor",
          maskComposite: "exclude",
        }),
  };
  return (
    <div
      aria-hidden
      className="iri-rim-wrap"
      style={{
        position: "absolute",
        inset,
        borderRadius: radius,
        opacity,
        filter: blur ? `blur(${blur}px)` : undefined,
        pointerEvents: "none",
        transition: "opacity .8s",
      }}
    >
      <div style={ring} />
    </div>
  );
}
