"use client";
// Privacy ledger + the mechanism (governor lights, candidate queue, event feed, transcript) in one glass sheet.
// The "What I see" <video> is always mounted (the pipeline draws from it), never display:none; while the sheet is
// closed it sits in a 1 px clipped box. While open and floating over the ERP the sheet registers as an occluder.
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { GlassButton, SourceBadge, useOccluder } from "@/components/glass";
import { glassStyle } from "@/components/glass/GlassSurface";
import { Meter } from "@/components/Meter";
import { describeEvent } from "@/lib/events";
import type { CaptureVM } from "@/components/views/capture.vm";

const H3: CSSProperties = { fontSize: 13, fontWeight: 600, color: "#1d1d1f" };
const SMALL: CSSProperties = { fontSize: 12.5, lineHeight: 1.45, color: "#6e6e73" };
const MONO: CSSProperties = { font: "11.5px ui-monospace,Menlo,monospace", color: "#8e8e93", fontVariantNumeric: "tabular-nums" };
const BLOCK: CSSProperties = { padding: "12px 14px", borderRadius: 18, background: "rgba(255,255,255,.62)", boxShadow: "inset 0 0 0 .5px rgba(0,0,0,.07), inset 0 1px 0 #fff" };

export function MechanismSheet({ vm, open, floating }: { vm: CaptureVM; open: boolean; floating: boolean }) {
  const ref = useRef<HTMLElement>(null);
  const [masking, setMasking] = useState(false);
  useOccluder(ref, "capture-mechanism", floating && open);
  const noun = vm.app?.noun ?? "invoice";
  const where = vm.app?.id === "claims" ? "the claims workbench" : "the ERP";

  const closedStyle: CSSProperties = { position: "absolute", width: 1, height: 1, overflow: "hidden", opacity: 0, pointerEvents: "none", clipPath: "inset(50%)" };
  const openStyle: CSSProperties = floating
    ? { ...glassStyle("panel", 24), width: "min(380px, calc(100vw - 480px))", minWidth: 300, maxHeight: "calc(100dvh - 56px)", overflowY: "auto", overscrollBehavior: "contain" }
    : { ...glassStyle("panel", 24), width: "100%" };

  return (
    <aside
      ref={ref}
      aria-label="The mechanism"
      aria-hidden={open ? undefined : true}
      inert={open ? undefined : true}
      data-testid="capture-mechanism"
      className="scroll-thin"
      style={{ boxSizing: "border-box", ...(open ? openStyle : closedStyle) }}
    >
      <div key={open ? "open" : "closed"} style={{ display: "flex", flexDirection: "column", gap: 10, padding: open ? 12 : 0, animation: open ? "tc-rise .45s var(--ease-rise, cubic-bezier(.2,.9,.3,1)) both" : undefined }}>
        {open && (
          <section style={BLOCK}>
            <p style={H3}>Privacy ledger</p>
            <p style={{ ...SMALL, color: "#1d1d1f", marginTop: 4 }}>
              seen {vm.ledger.framesSeen} · kept {vm.ledger.framesKept} · redacted {vm.ledger.entitiesRedacted} · struck {Number(vm.ledger.secondsStruck).toFixed(0)} s
            </p>
            <p style={{ ...SMALL, marginTop: 6 }}>
              {vm.pipeline.piiMode === "dom"
                ? "Personal fields marked by the app are painted out before a frame leaves the browser."
                : "Only the regions you mask are painted out before upload; personal data the model reports is blurred in stored stills."}{" "}
              Tacit&apos;s own card and this sheet are painted out of every captured frame.
            </p>
          </section>
        )}
        <Preview vm={vm} open={open} masking={masking} />
        {open && (
          <>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <GlassButton size={30} onClick={() => setMasking((v) => !v)}>{masking ? "Shrink the preview" : "Enlarge to mask"}</GlassButton>
              {vm.pipeline.masks.length > 0 && <GlassButton size={30} onClick={vm.pipeline.clearMasks}>Clear masks</GlassButton>}
            </div>
            <p style={SMALL}>Kept by this app: the frames above, masked and blurred, plus the transcript. Kept by the voice provider: conversation transcript and audio per the account&apos;s retention settings, not changed by this app.</p>

            <Meter decision={vm.decision} questions={vm.questionsLast10Min} budget={vm.budget} />

            <section style={BLOCK}>
              <p style={H3}>Candidate questions</p>
              <ul style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 5, fontSize: 12.5 }}>
                {vm.queued.slice(0, 5).map((c) => (
                  <li key={c.id} style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
                    <span style={{ ...MONO, color: c.value >= 0.8 ? "#a35f00" : "#8e8e93" }}>{c.value.toFixed(2)}</span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: "#52606d" }}>{c.kind}</span>
                    <span style={{ flex: 1, color: "#3a3a3c" }}>{c.question}</span>
                  </li>
                ))}
                {vm.queued.length === 0 && <li style={SMALL}>queue empty</li>}
              </ul>
              <p style={{ ...SMALL, marginTop: 6 }}>asked {vm.askedCount} · guardrail asked: {vm.guardrailAsked ? "yes" : "not yet"} · to debrief {vm.toDebrief}</p>
            </section>

            <section style={BLOCK}>
              <p style={H3}>Screen events</p>
              <ul style={{ marginTop: 6, display: "flex", flexDirection: "column", fontSize: 12.5 }}>
                {vm.events.length === 0 && <li style={SMALL}>Nothing yet. Open {/^[aeiou]/i.test(noun) ? "an" : "a"} {noun} in {where}.</li>}
                {vm.events.map((e) => {
                  const cand = vm.candidateFor(e.id);
                  return (
                    <li key={e.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0", borderTop: ".5px solid rgba(0,0,0,.06)", color: e.redacted ? "#c9342f" : "#1d1d1f" }}>
                      <span style={MONO}>{e.t.toFixed(1)}s</span>
                      <SourceBadge source={e.source} alsoSeenBy={e.alsoSeenBy} />
                      <span style={{ flex: 1, minWidth: 0, overflowWrap: "anywhere" }}>{e.redacted ? "off the record" : describeEvent(e)}</span>
                      {e.latencyMs != null && <span style={MONO}>{e.latencyMs} ms</span>}
                      {cand && !e.redacted && <span style={{ ...MONO, color: cand.value >= 0.8 ? "#a35f00" : "#8e8e93" }}>{cand.value.toFixed(2)}</span>}
                    </li>
                  );
                })}
              </ul>
              <p style={{ ...SMALL, marginTop: 6 }}>
                events: {vm.source} · frames sent {vm.pipeline.framesSent} · activity {vm.pipeline.activity}
                {vm.pipeline.visionLatency != null ? ` · vision ${vm.pipeline.visionLatency} ms` : ""}
                {vm.synced ? " · synced" : ""}
              </p>
            </section>

            <section style={BLOCK}>
              <p style={H3}>Transcript</p>
              <ul style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 4, fontSize: 12.5 }}>
                {vm.transcript.length === 0 && <li style={SMALL}>Nothing said yet.</li>}
                {vm.transcript.slice(-8).map((s) => (
                  <li key={s.id} style={{ color: s.redacted ? "#c9342f" : s.speaker === "agent" ? "#a35f00" : "#1d1d1f" }}>
                    <span style={MONO}>{s.t.toFixed(0)}s</span> {s.redacted ? "off the record" : s.text}
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}
      </div>
    </aside>
  );
}

type Box = { left: number; top: number; width: number; height: number };

/** Content box of an object-fit:contain video inside its element (letterbox math). */
function contentBox(v: HTMLVideoElement): Box {
  const W = v.clientWidth, H = v.clientHeight;
  const vw = v.videoWidth, vh = v.videoHeight;
  if (!vw || !vh || !W || !H) return { left: 0, top: 0, width: W, height: H };
  const s = Math.min(W / vw, H / vh);
  const width = vw * s, height = vh * s;
  return { left: (W - width) / 2, top: (H - height) / 2, width, height };
}

function Preview({ vm, open, masking }: { vm: CaptureVM; open: boolean; masking: boolean }) {
  const video = useRef<HTMLVideoElement | null>(null);
  const [box, setBox] = useState<Box | null>(null);
  const [drawing, setDrawing] = useState<{ x: number; y: number } | null>(null);
  const [draft, setDraft] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const setVideo = (el: HTMLVideoElement | null) => {
    video.current = el;
    const r = vm.pipeline.videoRef as unknown as { current: HTMLVideoElement | null };
    r.current = el;
  };

  useEffect(() => {
    const v = video.current;
    if (!v) return;
    const update = () => setBox(contentBox(v));
    update();
    v.addEventListener("loadedmetadata", update);
    v.addEventListener("resize", update);
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
    ro?.observe(v);
    return () => {
      v.removeEventListener("loadedmetadata", update);
      v.removeEventListener("resize", update);
      ro?.disconnect();
    };
  }, [open, masking]);

  const norm = (e: React.MouseEvent) => {
    const v = video.current;
    if (!v || !box || !box.width || !box.height) return null;
    const r = v.getBoundingClientRect();
    const x = (e.clientX - r.left - box.left) / box.width;
    const y = (e.clientY - r.top - box.top) / box.height;
    return { x: Math.min(1, Math.max(0, x)), y: Math.min(1, Math.max(0, y)) };
  };

  const showSent = open && !masking && !!vm.pipeline.lastSentUrl;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {open && (
        <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".06em", textTransform: "uppercase", color: "#8e8e93" }}>
          {masking ? "What I see · drag to mask" : showSent ? "What I see · last frame sent, after paint-out" : "What I see"}
        </p>
      )}
      <div
        style={{ position: "relative", width: "100%", height: open ? (masking ? 300 : 180) : 1, borderRadius: 14, overflow: "hidden", background: "#0b0e11", cursor: masking ? "crosshair" : "default", transition: "height .4s var(--ease-spring, ease)" }}
        title={masking ? "Drag to mask a sensitive region before it is transmitted" : undefined}
        onMouseDown={(e) => {
          if (!masking) return;
          const p = norm(e);
          if (p) setDrawing(p);
        }}
        onMouseMove={(e) => {
          if (!drawing) return;
          const p = norm(e);
          if (p) setDraft({ x: Math.min(p.x, drawing.x), y: Math.min(p.y, drawing.y), w: Math.abs(p.x - drawing.x), h: Math.abs(p.y - drawing.y) });
        }}
        onMouseUp={() => {
          if (draft && draft.w > 0.01 && draft.h > 0.01) vm.pipeline.addMask({ ...draft, kind: "mask" });
          setDrawing(null);
          setDraft(null);
        }}
      >
        <video ref={setVideo} muted playsInline style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain" }} />
        {showSent && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={vm.pipeline.lastSentUrl!} alt="The last frame sent to the vision model, after paint-out" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain", background: "#0b0e11" }} />
        )}
        {open && masking && box && (
          <div style={{ position: "absolute", left: box.left, top: box.top, width: box.width, height: box.height, pointerEvents: "none" }}>
            {vm.pipeline.masks.map((m, i) => (
              <span key={i} className="mask-box" style={{ position: "absolute", left: `${m.x * 100}%`, top: `${m.y * 100}%`, width: `${m.w * 100}%`, height: `${m.h * 100}%` }} />
            ))}
            {draft && <span className="mask-box mask-draft" style={{ position: "absolute", left: `${draft.x * 100}%`, top: `${draft.y * 100}%`, width: `${draft.w * 100}%`, height: `${draft.h * 100}%` }} />}
          </div>
        )}
        {open && !vm.pipeline.sharing && (
          <p style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", fontSize: 12.5, color: "rgba(255,255,255,.7)", textAlign: "center", padding: 12 }}>
            {vm.share0 ? "No screen is shared in this session" : "No screen shared yet"}
          </p>
        )}
      </div>
    </div>
  );
}
