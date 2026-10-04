"use client";
// The expert's screen moment: a real captured still (never a video), the verbatim quote,
// and the recording only when one exists. Mounted only while the replay is open.
import { useState } from "react";
import { GlassButton } from "@/components/glass";
import { frameSrc } from "@/lib/ui/mapview";
import { replayCaption } from "@/lib/ui/teachview";
import type { TeachReplay } from "@/components/views/teach.vm";

export function ReplayRow({ replay, expert, onClose }: { replay: TeachReplay; expert: string; onClose: () => void }) {
  const [large, setLarge] = useState(false);
  const src = frameSrc(replay.frame as { dataUrl?: string; url?: string } | undefined);
  const step = replay.step;
  const change = step && "field" in step.action ? `${step.action.from || "empty"} → ${step.action.to}` : null;
  return (
    <section
      style={{
        padding: 10,
        borderRadius: 18,
        background: "rgba(255,255,255,.55)",
        boxShadow: "inset 0 0 0 .5px rgba(0,0,0,.06), inset 0 1px 0 rgba(255,255,255,.8)",
        animation: "tc-rise .5s var(--ease-rise, cubic-bezier(.2,.9,.3,1)) .1s both",
      }}
    >
      <p data-testid="teach-replay" style={{ fontSize: 11.5, fontWeight: 600, color: "#8e8e93", margin: "0 2px 8px" }}>
        {replayCaption(expert, step?.screenMoment.t)}
      </p>
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <button
          type="button"
          onClick={() => setLarge((v) => !v)}
          aria-label={large ? "Shrink the still" : "Enlarge the still"}
          aria-expanded={large}
          disabled={!src}
          style={{
            position: "relative",
            width: 96,
            height: 58,
            flex: "none",
            padding: 0,
            border: 0,
            borderRadius: 11,
            overflow: "hidden",
            background: "#f4f6f8",
            boxShadow: "0 0 0 .5px rgba(0,0,0,.1)",
            cursor: src ? "zoom-in" : "default",
          }}
        >
          {src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          ) : (
            <span style={{ fontSize: 10.5, color: "#8e8e93" }}>No still</span>
          )}
        </button>
        <div style={{ minWidth: 0 }}>
          {replay.quote ? (
            <p style={{ fontSize: 13.5, lineHeight: 1.35, fontWeight: 500, margin: 0, textWrap: "pretty" }}>“{replay.quote}”</p>
          ) : (
            <p style={{ fontSize: 13, color: "#6e6e73", margin: 0 }}>No words recorded for this moment.</p>
          )}
          <p style={{ fontSize: 11.5, color: "#8e8e93", margin: "3px 0 0" }}>
            {step ? `What ${expert} did: ${step.title}${change ? ` · ${change}` : ""}` : `${expert}, in their own words`}
          </p>
        </div>
      </div>
      {large && src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={`${expert}'s screen at this moment, captured still`}
          style={{ display: "block", width: "100%", marginTop: 10, borderRadius: 12, boxShadow: "0 0 0 .5px rgba(0,0,0,.1)", animation: "tc-rise .45s var(--ease-rise, cubic-bezier(.2,.9,.3,1)) both" }}
        />
      ) : null}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 8 }}>
        {replay.audioUrl ? (
          <audio controls autoPlay src={replay.audioUrl} style={{ height: 30, flex: 1, minWidth: 0 }} />
        ) : (
          <span style={{ fontSize: 11.5, color: "#8e8e93" }}>No recording of this moment — the tutor reads the quote</span>
        )}
        <GlassButton size={30} onClick={onClose}>Close</GlassButton>
      </div>
    </section>
  );
}
