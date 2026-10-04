"use client";
import { MOODS, type OrbMood } from "@/lib/ui/moods";

/** Kind eyebrow ("WHY · COST CENTER"): 10.5/700/.11em, coloured by mood (design §2). */
export function Eyebrow(p: { text: string; mood: OrbMood }) {
  return (
    <div
      className="tc-eyebrow"
      style={{
        fontSize: 10.5,
        fontWeight: 700,
        letterSpacing: ".11em",
        textTransform: "uppercase",
        lineHeight: 1.3,
        color: (MOODS[p.mood] ?? MOODS.quiet).kindColor,
        transition: "color .5s",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
      }}
    >
      {p.text}
    </div>
  );
}
