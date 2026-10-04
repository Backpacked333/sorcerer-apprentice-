"use client";

import { useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

export type ScrubberBead = { at: number; type: string; title: string; color?: string };
export type ScrubberTick = { at: number; label: string };

export type TimelineScrubberProps = {
  range: [number, number];
  t: number;
  onT: (t: number) => void;
  beads: ScrubberBead[];
  ticks: ScrubberTick[];
  today?: number;
  playing: boolean;
  onPlay: () => void;
  /** Bold "As of …" line; also the slider's aria-valuetext. */
  label: string;
  /** Right-aligned counts, e.g. "3 roles · 1 captured". */
  counts?: string;
  /** Play button label (default "Watch it grow"). */
  playLabel?: string;
  /** Optional secondary line after the label, e.g. "Last · Capture · 2 reasons". */
  sub?: string;
};

// Session bead colours (tacit-ui SCOLOR).
const SCOLOR: Record<string, string> = {
  mapped: "#8e8e93",
  capture: "#f5a623",
  debrief: "#8f7bff",
  teach: "#22b45e",
  planned: "#c7c7cc",
};
const FILL = "linear-gradient(90deg,#ffb8d9,#ffd27a,#9be7c4,#8fd3ff,#b7a6ff)";
const X0 = 14;
const MERGE_PX = 12;
const DEFAULT_W = 900; // used until the track is measured (same on server and client → hydration-safe)

type Group = { at: number; beads: ScrubberBead[] };

function colorOf(b: ScrubberBead) {
  return b.color ?? SCOLOR[b.type] ?? "#8e8e93";
}

/** "Watch it grow" dock: play pill, As-of label, counts, and a draggable iridescent track with session beads. */
export function TimelineScrubber({ range, t, onT, beads, ticks, today, playing, onPlay, label, counts, playLabel = "Watch it grow", sub }: TimelineScrubberProps) {
  const [a, b] = range;
  const span = b - a;
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [w, setW] = useState(0);
  const dragging = useRef(false);

  useLayoutEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    setW(el.clientWidth);
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const W = w || DEFAULT_W;
  const SPAN = Math.max(1, W - X0 * 2);
  const frac = (v: number) => (span > 0 ? Math.min(1, Math.max(0, (v - a) / span)) : 1);
  const pos = (v: number) => `calc(${X0}px + (100% - ${X0 * 2}px) * ${frac(v).toFixed(5)})`;

  const groups = useMemo<Group[]>(() => {
    const sorted = [...beads].sort((p, q) => p.at - q.at);
    const out: Group[] = [];
    for (const bead of sorted) {
      const g = out[out.length - 1];
      const px = (v: number) => (span > 0 ? ((v - a) / span) * SPAN : 0);
      if (g && px(bead.at) - px(g.at) < MERGE_PX) g.beads.push(bead);
      else out.push({ at: bead.at, beads: [bead] });
    }
    return out;
  }, [beads, a, span, SPAN]);

  const distinctTimes = useMemo(() => new Set(beads.map((x) => x.at)).size, [beads]);
  const canPlay = distinctTimes >= 2 && span > 0;

  const fromClientX = (clientX: number) => {
    const el = trackRef.current;
    if (!el || span <= 0) return;
    const r = el.getBoundingClientRect();
    const px = clientX - r.left;
    const f = Math.min(1, Math.max(0, (px - X0) / Math.max(1, r.width - X0 * 2)));
    onT(a + f * span);
  };

  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    dragging.current = true;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* capture is best-effort */
    }
    fromClientX(e.clientX);
  };
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (dragging.current) fromClientX(e.clientX);
  };
  const onUp = (e: PointerEvent<HTMLDivElement>) => {
    dragging.current = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
  };
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (span <= 0) return;
    const step = span / 100;
    let next: number | null = null;
    if (e.key === "ArrowRight" || e.key === "ArrowUp") next = t + step;
    else if (e.key === "ArrowLeft" || e.key === "ArrowDown") next = t - step;
    else if (e.key === "PageUp") next = t + step * 10;
    else if (e.key === "PageDown") next = t - step * 10;
    else if (e.key === "Home") next = a;
    else if (e.key === "End") next = b;
    if (next === null) return;
    e.preventDefault();
    onT(Math.min(b, Math.max(a, next)));
  };

  const ft = frac(t);

  return (
    <div
      style={{
        position: "relative",
        boxSizing: "border-box",
        width: "100%",
        height: 94,
        padding: "12px 18px 0",
        borderRadius: 24,
        background: "linear-gradient(180deg,rgba(255,255,255,.78),rgba(255,255,255,.56))",
        backdropFilter: "blur(24px) saturate(1.8)",
        WebkitBackdropFilter: "blur(24px) saturate(1.8)",
        boxShadow: "inset 0 1px 0 #fff,0 0 0 .5px rgba(0,0,0,.07),0 10px 30px rgba(15,23,42,.06)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12, whiteSpace: "nowrap", minWidth: 0 }}>
        <button
          type="button"
          onClick={onPlay}
          disabled={!canPlay}
          aria-pressed={playing}
          title={canPlay ? undefined : "Needs at least two sessions at different times"}
          className="flex-none select-none cursor-pointer active:scale-[.94] disabled:active:scale-100 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a35f00]"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            height: 28,
            padding: "0 12px",
            borderRadius: 14,
            fontSize: 12.5,
            fontWeight: 500,
            lineHeight: 1,
            color: "#1d1d1f",
            background: "rgba(255,255,255,.8)",
            boxShadow: "inset 0 0 0 .5px rgba(0,0,0,.08)",
            transition: "scale .25s var(--ease-press, cubic-bezier(.3,1.6,.5,1)), opacity .2s",
          }}
        >
          {playing ? (
            <svg width="9" height="10" viewBox="0 0 9 10" aria-hidden>
              <rect x="0.5" y="0.5" width="2.6" height="9" rx="1" fill="currentColor" />
              <rect x="5.9" y="0.5" width="2.6" height="9" rx="1" fill="currentColor" />
            </svg>
          ) : (
            <svg width="9" height="10" viewBox="0 0 9 10" aria-hidden>
              <path d="M1 1.1v7.8a.6.6 0 0 0 .9.5l6.4-3.9a.6.6 0 0 0 0-1L1.9.6a.6.6 0 0 0-.9.5Z" fill="currentColor" />
            </svg>
          )}
          {playing ? "Pause" : playLabel}
        </button>
        <span style={{ fontSize: 13.5, fontWeight: 600, color: "#1d1d1f", flex: "none" }}>{label}</span>
        {sub ? (
          <span className="max-sm:hidden" style={{ fontSize: 12.5, color: "#6e6e73", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>
            {sub}
          </span>
        ) : null}
        {counts ? (
          <span style={{ marginLeft: "auto", fontSize: 12, color: "#6e6e73", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", paddingLeft: 8 }}>{counts}</span>
        ) : null}
      </div>

      <div
        ref={trackRef}
        role="slider"
        tabIndex={span > 0 ? 0 : -1}
        aria-label="Timeline"
        aria-valuemin={a}
        aria-valuemax={b}
        aria-valuenow={Math.round(t)}
        aria-valuetext={label}
        aria-disabled={span <= 0 || undefined}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onKeyDown={onKey}
        className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgba(245,166,35,.6)]"
        style={{ position: "relative", height: 46, marginTop: 6, borderRadius: 10, cursor: span > 0 ? "ew-resize" : "default", touchAction: "none", userSelect: "none" }}
      >
        <div aria-hidden style={{ position: "absolute", left: X0, right: X0, top: 14, height: 4, borderRadius: 2, background: "rgba(0,0,0,.07)" }} />
        <div
          aria-hidden
          style={{
            position: "absolute",
            left: X0,
            right: X0,
            top: 14,
            height: 4,
            borderRadius: 2,
            background: FILL,
            boxShadow: "0 0 10px rgba(180,160,255,.45)",
            transformOrigin: "left center",
            transform: `scaleX(${ft.toFixed(5)})`,
          }}
        />
        {today != null && span > 0 ? (
          <div aria-hidden style={{ position: "absolute", left: pos(today), top: 6, width: 1, height: 20, background: "rgba(0,0,0,.2)" }} />
        ) : null}
        {groups.map((g, gi) => {
          const first = g.beads[0];
          const n = g.beads.length;
          const future = g.at > t + 1e-9 && first.type !== "planned";
          const planned = n === 1 && first.type === "planned";
          const title = g.beads.map((x) => x.title).join("\n");
          const size = n > 1 ? 16 : 10;
          return (
            <div
              key={`${g.at}-${gi}`}
              title={title}
              style={{
                position: "absolute",
                left: pos(g.at),
                top: 16 - size / 2,
                width: size,
                height: size,
                marginLeft: -size / 2,
                borderRadius: size / 2,
                background: planned ? "#fff" : colorOf(first),
                boxShadow: planned ? "inset 0 0 0 1.5px #aeaeb2" : "0 0 0 2px #fff",
                opacity: future ? 0.45 : 1,
                transition: "opacity .3s",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 9.5,
                fontWeight: 700,
                lineHeight: 1,
                color: "#fff",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {n > 1 ? n : null}
            </div>
          );
        })}
        {ticks.map((k) => (
          <span key={`${k.at}-${k.label}`} aria-hidden style={{ position: "absolute", left: pos(k.at), top: 28, fontSize: 11, color: "#6e6e73", whiteSpace: "nowrap", pointerEvents: "none" }}>
            {k.label}
          </span>
        ))}
        <div
          aria-hidden
          style={{
            position: "absolute",
            left: pos(t),
            top: 6,
            width: 20,
            height: 20,
            marginLeft: -10,
            borderRadius: "50%",
            background: "rgba(255,255,255,.92)",
            boxShadow: "0 0 0 .5px rgba(0,0,0,.15),0 3px 10px rgba(0,0,0,.18),inset 0 1px 0 #fff",
            pointerEvents: "none",
          }}
        />
      </div>
    </div>
  );
}
