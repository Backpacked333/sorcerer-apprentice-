"use client";
// Decorative orb that cycles the canonical glows (landing closer). Static under reduced motion.
import { useEffect, useState } from "react";
import { Orb } from "@/components/glass";
import type { OrbMood } from "@/lib/ui/moods";

const CYCLE: OrbMood[] = ["quiet", "notice", "asking", "listening", "understood"];

export function CyclingOrb({ size = 84 }: { size?: number }) {
  const [i, setI] = useState(CYCLE.length - 1);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setI(0);
    const id = window.setInterval(() => {
      if (!document.hidden) setI((n) => (n + 1) % CYCLE.length);
    }, 2600);
    return () => window.clearInterval(id);
  }, []);
  return <Orb mood={CYCLE[i]} size={size} full rippleKey={i} />;
}
