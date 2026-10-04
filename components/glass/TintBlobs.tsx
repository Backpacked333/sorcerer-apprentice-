"use client";
// Two drifting tint blobs inside the companion glass (design §3.5), cross-faded on mood change.
import { useEffect, useState } from "react";
import { MOODS, type OrbMood } from "@/lib/ui/moods";

function Pair({ tint, visible }: { tint: [string, string]; visible: boolean }) {
  return (
    <div style={{ position: "absolute", inset: 0, opacity: visible ? 1 : 0, transition: "opacity .6s" }}>
      <div
        style={{
          position: "absolute",
          width: 300,
          height: 300,
          left: -110,
          top: -150,
          borderRadius: "50%",
          background: `radial-gradient(circle,${tint[0]},rgba(255,255,255,0) 65%)`,
          animation: "tc-drift 9s ease-in-out infinite",
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 300,
          height: 300,
          right: -120,
          bottom: -170,
          borderRadius: "50%",
          background: `radial-gradient(circle,${tint[1]},rgba(255,255,255,0) 65%)`,
          animation: "tc-drift 12s ease-in-out infinite reverse",
        }}
      />
    </div>
  );
}

export function TintBlobs(p: { mood: OrbMood }) {
  const tint = (MOODS[p.mood] ?? MOODS.quiet).tint;
  const key = tint.join("|");
  const [s, setS] = useState({ a: tint, b: tint, front: "a" as "a" | "b" });
  useEffect(() => {
    setS((l) => {
      const cur = l.front === "a" ? l.a : l.b;
      if (cur.join("|") === key) return l;
      return l.front === "a" ? { a: l.a, b: tint, front: "b" } : { a: tint, b: l.b, front: "a" };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return (
    <div aria-hidden style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden", borderRadius: "inherit" }}>
      <Pair tint={s.a} visible={s.front === "a"} />
      <Pair tint={s.b} visible={s.front === "b"} />
    </div>
  );
}
