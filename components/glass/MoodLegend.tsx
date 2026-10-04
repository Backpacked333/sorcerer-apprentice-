"use client";

import { Orb } from "./Orb";
import type { OrbMood } from "@/lib/ui/moods";

type Entry = { mood: OrbMood; name: string; copy: string; skin: string; shadow: string };

// The five canonical glows with Redesign copy (design §5.2, RD:16-22).
const ENTRIES: Entry[] = [
  {
    mood: "quiet",
    name: "Quiet",
    copy: "Pearl. Watching, saying nothing while you type, read or talk.",
    skin:
      "radial-gradient(90% 140% at 0% 50%,rgba(214,220,232,.5),rgba(255,255,255,0) 60%) padding-box,linear-gradient(180deg,rgba(255,255,255,.92),rgba(255,255,255,.72)) padding-box,linear-gradient(135deg,#ffffff,#d2d9e3 45%,#f4f6fa 75%,#d2d9e3) border-box",
    shadow: "0 0 0 6px rgba(120,130,160,.06),0 0 30px rgba(160,170,200,.3),0 10px 30px rgba(15,23,42,.08)",
  },
  {
    mood: "asking",
    name: "Asking",
    copy: "Amber. A pause was found; one question about something on screen.",
    skin:
      "radial-gradient(90% 140% at 0% 50%,rgba(255,206,120,.45),rgba(255,255,255,0) 60%) padding-box,linear-gradient(180deg,rgba(255,255,255,.92),rgba(255,255,255,.72)) padding-box,linear-gradient(135deg,#ffd27a,#f5a623 45%,#fff3d6 75%,#f5a623) border-box",
    shadow: "0 0 0 6px rgba(245,166,35,.1),0 0 36px rgba(245,166,35,.45),0 10px 30px rgba(120,70,0,.12)",
  },
  {
    mood: "listening",
    name: "Listening",
    copy: "Green. Mic open; your words become the reason on the map.",
    skin:
      "radial-gradient(90% 140% at 0% 50%,rgba(143,240,182,.45),rgba(255,255,255,0) 60%) padding-box,linear-gradient(180deg,rgba(255,255,255,.92),rgba(255,255,255,.72)) padding-box,linear-gradient(135deg,#8ff0b6,#22b45e 45%,#e3fbec 75%,#22b45e) border-box",
    shadow: "0 0 0 6px rgba(34,180,94,.1),0 0 36px rgba(34,180,94,.4),0 10px 30px rgba(10,80,40,.12)",
  },
  {
    mood: "off",
    name: "Off the record",
    copy: "Struck. Nothing is sent; the last exchange and its frames are gone.",
    skin:
      "repeating-linear-gradient(135deg,rgba(255,93,93,.14) 0 6px,rgba(255,93,93,.04) 6px 12px) padding-box,linear-gradient(180deg,rgba(255,255,255,.92),rgba(255,255,255,.72)) padding-box,linear-gradient(135deg,#ff9b9b,#e5484d 45%,#ffe0e0 75%,#e5484d) border-box",
    shadow: "0 0 0 6px rgba(229,72,77,.08),0 0 30px rgba(229,72,77,.3),0 10px 30px rgba(120,20,20,.1)",
  },
  {
    mood: "step",
    name: "Steps in",
    copy: "Ember. Teach mode only: a guardrail is about to be broken.",
    skin:
      "radial-gradient(90% 140% at 0% 50%,rgba(255,179,107,.45),rgba(255,255,255,0) 60%) padding-box,linear-gradient(180deg,rgba(255,255,255,.92),rgba(255,255,255,.72)) padding-box,linear-gradient(135deg,#ffb36b,#f0642f 45%,#ffe3cf 75%,#f0642f) border-box",
    shadow: "0 0 0 6px rgba(240,100,47,.1),0 0 36px rgba(240,100,47,.4),0 10px 30px rgba(120,40,0,.12)",
  },
];

/** Legend of the five canonical companion glows. */
export function MoodLegend() {
  return (
    <ul
      aria-label="What the glow means"
      style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: "22px 18px" }}
    >
      {ENTRIES.map((e) => (
        <li key={e.mood} style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 12, minWidth: 0 }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 12,
              height: 56,
              padding: "0 20px 0 10px",
              borderRadius: 28,
              border: "1.5px solid transparent",
              background: e.skin,
              boxShadow: e.shadow,
              boxSizing: "border-box",
            }}
          >
            <Orb mood={e.mood} size={36} follow={false} />
            <span style={{ fontSize: 14, fontWeight: 600, color: "#1d1d1f", whiteSpace: "nowrap" }}>{e.name}</span>
          </span>
          <span style={{ fontSize: 13, lineHeight: 1.45, color: "#6e6e73", paddingLeft: 4, textWrap: "pretty" }}>{e.copy}</span>
        </li>
      ))}
    </ul>
  );
}
