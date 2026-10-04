"use client";
// Company Map (platform report §1.2): role bubbles on a pannable / zoomable world, department halos, hand-off edges
// with rule labels, the right inspector, "Tacit suggests" and the "Watch it grow" dock. Everything time-dependent
// is a pure function of the playhead t, memoised on the index of the last passed threshold.
import Link from "next/link";
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Orb, SegmentedControl, usePlayhead } from "@/components/glass";
import { seriesAt, type PlatformData, type RoleEdge, type RoleNode } from "@/lib/platform/types";
import { Dock } from "./Dock";
import { RoleInspector } from "./RoleInspector";
import { SidebarToggle, useShell } from "./PlatformShell";
import { SuggestCard } from "./SuggestCard";
import { fitBox, useCamera, type Box } from "./useCamera";
import { AVATAR, EDGE_GRAD, hexA, initials, PROV, stepIndex } from "./meta";
import { CANVAS_CSS } from "./meta";

type Lens = "knowledge" | "risk" | "handoffs";
const WORLD = { w: 2000, h: 1300 };
const RISK_C = { critical: ["rgba(240,100,47,.55)", "#e5484d"], high: ["rgba(245,140,60,.45)", "#f0642f"], watch: ["rgba(245,190,80,.4)", "#f5a623"] } as const;

export function CompanyMapCanvas({ data, initialRoleId }: { data: PlatformData; initialRoleId?: string | null }) {
  const { narrow } = useShell();
  const tl = data.timeline;
  const ph = usePlayhead([tl.start, tl.today], 7000);
  const viewRef = useRef<HTMLDivElement | null>(null);
  const worldRef = useRef<HTMLDivElement | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [lens, setLens] = useState<Lens>("knowledge");
  const [edit, setEdit] = useState(false);
  const [pos, setPos] = useState<Record<string, { x: number; y: number }>>({});
  const [ready, setReady] = useState(false);
  const [vw, setVw] = useState(1200);
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");

  const cam = useCamera({ viewRef, worldRef, minK: 0.15, onBgClick: () => (narrow ? setSel(null) : undefined) });
  const ss = cam.ss;

  const roles = useMemo(() => data.roles.map((r) => (pos[r.id] ? { ...r, ...pos[r.id] } : r)), [data.roles, pos]);
  const byId = useMemo(() => new Map(roles.map((r) => [r.id, r])), [roles]);

  const inspW = vw < 1050 ? 320 : 370;
  const showInspector = !!sel && byId.has(sel);
  const inspDocked = !narrow;

  const viewBox = useCallback((): Box => {
    const v = cam.view();
    // called from effects/handlers only; the shell's `narrow` lags one layout pass on first mount
    const n = narrow || window.innerWidth < 900;
    const right = !n && data.roles.length ? inspW + 32 : 0;
    const top = n ? 190 : 76;
    const bottom = 126;
    // leave room for the open "Tacit suggests" card on wide canvases
    const left = !n && data.suggestions.length && v.w - right > 900 ? 330 : 0;
    return { x: left, y: top, w: Math.max(200, v.w - right - left), h: Math.max(200, v.h - top - bottom) };
  }, [cam, inspDocked, inspW, narrow, data.roles.length, data.suggestions.length]);

  const worldBox = useMemo((): Box => {
    if (!data.roles.length) return { x: 0, y: 0, w: WORLD.w, h: WORLD.h };
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const r of data.roles) {
      x0 = Math.min(x0, r.x - r.r - 90);
      x1 = Math.max(x1, r.x + r.r + 90);
      y0 = Math.min(y0, r.y - r.r - 30);
      y1 = Math.max(y1, r.y + r.r + 60);
    }
    return { x: x0, y: y0, w: Math.max(600, x1 - x0), h: Math.max(400, y1 - y0) };
  }, [data.roles]);

  const fitAll = useCallback((ms = 700) => {
    const box = worldBox;
    const c = { x: box.x + box.w / 2, y: box.y + box.h / 2 };
    const b = box.w < 600 || box.h < 400 ? { x: c.x - 300, y: c.y - 200, w: 600, h: 400 } : box;
    cam.fly(fitBox(b, viewBox(), 10, 1, 0.18), ms);
  }, [cam, viewBox, worldBox]);

  // Initial layout after mount (server renders the world hidden): measure, select, fit.
  useLayoutEffect(() => {
    const el = viewRef.current;
    if (!el) return;
    setVw(el.clientWidth);
    const wide = window.innerWidth >= 900;
    const start = initialRoleId && data.roles.some((r) => r.id === initialRoleId) ? initialRoleId : wide ? data.mainRoleId : null;
    setSel(start ?? null);
    fitAll(0);
    setReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the picture centred while the canvas resizes (sidebar slide, window resize).
  useEffect(() => {
    const el = viewRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    let last = el.clientWidth;
    let lastH = el.clientHeight;
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth, h = el.clientHeight;
      if (w === last && h === lastH) return;
      const c = cam.cam.current;
      cam.set({ ...c, x: c.x + (w - last) / 2, y: c.y + (h - lastH) / 2 });
      last = w;
      lastH = h;
      setVw(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [cam]);

  const focus = useCallback((id: string) => {
    const r = byId.get(id);
    if (!r) return;
    const v = viewBox();
    const k = Math.max(cam.cam.current.k, 0.7);
    const vy = narrow ? v.y + v.h * 0.3 : v.y + v.h / 2;
    cam.fly({ k, x: v.x + v.w / 2 - r.x * k, y: vy - r.y * k }, 750);
  }, [byId, cam, viewBox, narrow]);

  const select = useCallback((id: string, fly = true) => {
    setSel(id);
    if (fly) focus(id);
  }, [focus]);

  // ----- time: memoise on the index of the last passed threshold
  const times = useMemo(() => {
    const s = new Set<number>();
    for (const r of data.roles) {
      s.add(r.at);
      for (const p of [...r.coverage, ...r.rules, ...r.mentions, ...r.sessions]) s.add(p.at);
    }
    for (const e of data.edges) s.add(e.at);
    return [...s].sort((a, b) => a - b);
  }, [data.roles, data.edges]);
  const step = stepIndex(times, ph.t);
  const tk = step > 0 ? times[step - 1] : -Infinity;

  const visEdges = useMemo(() => data.edges.filter((e) => e.at <= tk && byId.has(e.from) && byId.has(e.to)), [data.edges, tk, byId]);
  const related = useMemo(() => {
    const s = new Set<string>();
    if (!sel) return s;
    s.add(sel);
    for (const e of visEdges) {
      if (e.from === sel) s.add(e.to);
      if (e.to === sel) s.add(e.from);
    }
    return s;
  }, [sel, visEdges]);
  const focusing = !!sel && lens !== "risk";
  const riskOn = data.features.riskLens && lens === "risk";

  const counts = useMemo(() => {
    const vis = data.roles.filter((r) => r.at <= tk);
    const cap = vis.filter((r) => r.status === "captured" || r.status === "in_debrief").length;
    const men = vis.filter((r) => r.status === "mentioned").length;
    const risk = vis.filter((r) => r.risk).length;
    return `${vis.length} role${vis.length === 1 ? "" : "s"} · ${cap} captured · ${men} mentioned${data.features.riskLens ? ` · ${risk} at risk` : ""}`;
  }, [data.roles, tk, data.features.riskLens]);

  // ----- node drag (edit mode, demo only; positions are not saved)
  const nodeDown = (r: RoleNode) => (ev: React.PointerEvent<HTMLElement>) => {
    if (!edit) return;
    ev.preventDefault();
    const k = cam.cam.current.k;
    const x0 = ev.clientX, y0 = ev.clientY, ox = r.x, oy = r.y;
    let moved = false;
    const el = ev.currentTarget;
    const id = ev.pointerId;
    try { el.setPointerCapture(id); } catch { /* best-effort */ }
    const mv = (e2: PointerEvent) => {
      if (!moved && Math.hypot(e2.clientX - x0, e2.clientY - y0) < 4) return;
      moved = true;
      setPos((p) => ({ ...p, [r.id]: { x: ox + (e2.clientX - x0) / k, y: oy + (e2.clientY - y0) / k } }));
    };
    const up = () => {
      el.removeEventListener("pointermove", mv);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
      if (!moved) select(r.id, false);
    };
    el.addEventListener("pointermove", mv);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
  };

  const nodes = useMemo(() => roles.map((r) => {
    const vis = r.at <= tk;
    const dept = data.departments.find((d) => d.id === r.dept);
    const deptC = dept?.color ?? "#8e8e93";
    const cov = seriesAt(r.coverage, tk);
    const nRules = seriesAt(r.rules, tk)?.n ?? 0;
    const captured = r.coverage.length > 0 && !!cov;
    const isSel = sel === r.id;
    const dim = focusing && !related.has(r.id) ? 0.32 : 1;
    const tint = hexA(deptC, captured ? 0.16 : 0.08);
    const retire = Math.min(...r.people.map((p) => p.retiresInMonths ?? Infinity));
    const frac = riskOn ? (r.risk && Number.isFinite(retire) ? Math.max(0, 1 - retire / 24) : 0) : captured && cov && cov.of > 0 ? cov.n / cov.of : 0;
    const arcC = riskOn ? (r.risk ? RISK_C[r.risk.level][1] : "#d0d0d6") : captured ? `url(#covg${uid})` : "#f5a623";
    const showHalo = data.features.riskLens && r.risk && (riskOn || r.risk.level === "critical");
    const flat = !captured && r.status !== "mentioned" && r.status !== "inferred";
    const avs = Math.max(20, Math.min(30, r.r * 0.62));
    const d = r.r * 2;
    const shadow = isSel
      ? "0 0 0 3px rgba(181,220,255,.75),0 18px 40px rgba(120,110,255,.22)"
      : captured
        ? "0 14px 34px rgba(150,130,255,.22),inset 0 1px 0 #fff"
        : "0 8px 22px rgba(15,23,42,.08),inset 0 1px 0 #fff";
    return (
      <div
        key={r.id}
        data-node=""
        style={{ position: "absolute", left: r.x - r.r, top: r.y - r.r, width: d, height: d, transform: `scale(${ss})`, zIndex: isSel ? 6 : captured ? 4 : 3, pointerEvents: vis ? "auto" : "none" }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            opacity: vis ? dim : 0,
            transform: vis ? "none" : "translateY(14px) scale(.6)",
            transition: "opacity .5s, transform .7s var(--ease-spring)",
          }}
        >
          {showHalo && r.risk ? (
            <div aria-hidden style={{ position: "absolute", inset: -14, borderRadius: "50%", background: `radial-gradient(closest-side,${RISK_C[r.risk.level][0]},transparent)`, animation: "tc-pulse 2.6s ease-in-out infinite", pointerEvents: "none" }} />
          ) : null}
          <button
            type="button"
            aria-label={`${r.title}, ${r.statusLabel}`}
            aria-pressed={isSel}
            tabIndex={vis ? 0 : -1}
            onClick={() => { if (!edit) select(r.id); }}
            onPointerDown={nodeDown(r)}
            className="hover:scale-[1.06] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[rgba(245,166,35,.75)]"
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: "50%",
              border: 0,
              padding: 0,
              cursor: edit ? "move" : "pointer",
              background: `radial-gradient(circle at 35% 28%,rgba(255,255,255,.98),${tint} 75%)`,
              boxShadow: shadow,
              transition: "box-shadow .35s, scale .35s cubic-bezier(.3,1.5,.5,1)",
              touchAction: edit ? "none" : "manipulation",
            }}
          >
            <svg aria-hidden viewBox="0 0 100 100" width="100%" height="100%" style={{ position: "absolute", inset: 0, transform: "rotate(-90deg)", overflow: "visible" }}>
              <circle cx="50" cy="50" r="47" fill="none" stroke={flat ? "rgba(0,0,0,.14)" : "rgba(0,0,0,.07)"} strokeWidth={2} strokeDasharray={flat ? "3 4" : undefined} />
              <circle
                cx="50" cy="50" r="47" fill="none" stroke={arcC} strokeWidth={captured ? 5 : 3.5} strokeLinecap="round" pathLength={100}
                strokeDasharray={`${(frac * 100).toFixed(2)} 100`}
                style={{ transition: "stroke-dasharray .6s cubic-bezier(.3,1,.4,1), stroke .4s" }}
              />
            </svg>
            <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
              {r.people.slice(0, 3).map((p, i) => {
                const av = AVATAR[p.avatar];
                return (
                  <span key={p.id} style={{ width: avs, height: avs, marginLeft: i ? -avs * 0.35 : 0, borderRadius: "50%", background: av.bg, color: av.ink, fontSize: avs * 0.42, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 0 1.5px #fff,0 1px 3px rgba(0,0,0,.1)" }}>
                    {initials(p.name)}
                  </span>
                );
              })}
              {r.people.length === 0 ? <span style={{ fontSize: 12, color: "#aeaeb2" }}>?</span> : null}
            </span>
          </button>
          {lens === "knowledge" && nRules > 0 ? (
            <span aria-hidden key={`b${nRules}`} style={{ position: "absolute", top: d * 0.06, right: d * 0.06, minWidth: 20, height: 20, padding: "0 5px", borderRadius: 10, background: "#8f7bff", color: "#fff", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 0 2px #fff,0 0 10px rgba(143,123,255,.55)", animation: "tc-pop .45s var(--ease-spring) both", pointerEvents: "none" }}>
              {nRules}
            </span>
          ) : null}
          <div style={{ position: "absolute", top: "100%", left: "50%", width: 230, marginLeft: -115, marginTop: 8, textAlign: "center", pointerEvents: "none" }}>
            <div style={{ fontSize: r.isMain ? 15 : 13.5, fontWeight: 600, lineHeight: 1.25, color: "#1d1d1f", textShadow: "0 1px 0 rgba(255,255,255,.9)" }}>{r.title}</div>
            <div style={{ fontSize: 11.5, color: captured ? "#1b8a4b" : "#8e8e93", marginTop: 1 }}>
              {r.team ?? r.statusLabel}
              {r.people.length ? ` · ${r.people.length}` : ""}
            </div>
          </div>
        </div>
      </div>
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [roles, tk, sel, focusing, related, riskOn, lens, ss, edit, uid, data.departments, data.features.riskLens]);

  const geo = useMemo(() => data.edges.map((e, i) => edgeGeo(e, i, byId, ss)).filter((g): g is EdgeGeo => !!g), [data.edges, byId, ss]);

  const edgeSvg = useMemo(() => (
    <svg aria-hidden width={WORLD.w} height={WORLD.h} style={{ position: "absolute", left: 0, top: 0, overflow: "visible", pointerEvents: "none" }}>
      <defs>
        <linearGradient id={`covg${uid}`} x1="0" y1="0" x2="1" y2="1">
          {["#ffb8d9", "#ffd27a", "#9be7c4", "#8fd3ff", "#b7a6ff"].map((c, j) => <stop key={c} offset={j / 4} stopColor={c} />)}
        </linearGradient>
        {geo.map((g) => g.e.prov === "said" || g.e.prov === "teachback" ? (
          <linearGradient key={g.e.id} id={`lg${uid}${g.i}`} gradientUnits="userSpaceOnUse" x1={g.p0.x} y1={g.p0.y} x2={g.p1.x} y2={g.p1.y}>
            {EDGE_GRAD.map((c, j) => <stop key={c} offset={j / 4} stopColor={c} />)}
          </linearGradient>
        ) : null)}
      </defs>
      {geo.map((g) => {
        const vis = g.e.at <= tk;
        if (!vis) return null;
        const on = !sel || g.e.from === sel || g.e.to === sel;
        const grad = g.e.prov === "said" || g.e.prov === "teachback";
        const col = grad ? `url(#lg${uid}${g.i})` : PROV[g.e.prov].color;
        const dash = g.e.prov === "inferred" ? "6 7" : g.e.prov === "mapped" ? "2 6" : g.e.prov === "described" ? "5 5" : null;
        const w = ((grad ? 2 : 1.5) + g.e.ruleIds.length * 0.9 + (lens === "handoffs" ? 1 : 0)) * ss;
        return (
          <g key={g.e.id} style={{ opacity: on ? 1 : 0.18, transition: "opacity .5s" }}>
            {grad && on ? <path d={g.d} stroke={col} strokeWidth={w + 7} fill="none" opacity={0.22} style={{ filter: "blur(4px)" }} /> : null}
            {dash ? (
              <path d={g.d} stroke={col} strokeWidth={w} fill="none" strokeLinecap="round" strokeDasharray={dash} style={{ animation: "tc-fade .6s both" }} />
            ) : (
              <path d={g.d} stroke={col} strokeWidth={w} fill="none" strokeLinecap="round" pathLength={1} strokeDasharray="1" style={{ animation: "tc-draw .8s var(--ease-rise) both" }} />
            )}
            <polygon points={g.tip} fill={grad ? "#b7a6ff" : col} style={{ animation: "tc-fade .5s .45s both" }} />
            {grad || lens === "handoffs" ? (
              <path d={g.d} stroke="#fff" strokeWidth={w + 1.2} fill="none" strokeLinecap="round" pathLength={1} strokeDasharray=".035 .965" style={{ animation: `tc-flow ${3 + (g.i % 4) * 0.6}s linear infinite` }} />
            ) : null}
          </g>
        );
      })}
    </svg>
  ), [geo, tk, sel, lens, ss, uid]);

  const labels = geo.filter((g) => g.e.at <= tk && (lens === "handoffs" || (sel && (g.e.from === sel || g.e.to === sel)) || cam.zoomedIn)).map((g) => {
    const on = !sel || g.e.from === sel || g.e.to === sel;
    return (
      <div
        key={`lb${g.e.id}`}
        aria-hidden
        style={{ position: "absolute", left: g.m.x, top: g.m.y, transform: `translate(-50%,-50%) scale(${ss})`, display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap", maxWidth: 320, fontSize: 11.5, fontWeight: 500, color: "#3a3a3c", padding: "3px 9px", borderRadius: 10, background: "rgba(255,255,255,.9)", boxShadow: "0 0 0 .5px rgba(0,0,0,.07)", opacity: on ? 1 : 0.25, pointerEvents: "none", zIndex: 5, transition: "opacity .4s" }}
      >
        {g.e.ruleIds.length ? <span style={{ color: "#6a55d8", fontWeight: 600 }}>{g.e.ruleIds.length} rule{g.e.ruleIds.length === 1 ? "" : "s"}</span> : null}
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", animation: "tc-rise .35s var(--ease-rise) both" }}>{g.e.label}</span>
      </div>
    );
  });

  const clouds = data.departments.map((dpt) => {
    const n = data.roles.filter((r) => r.dept === dpt.id).length;
    const anyRel = !sel || riskOn || data.roles.some((r) => r.dept === dpt.id && related.has(r.id));
    return (
      <div key={dpt.id} aria-hidden style={{ opacity: anyRel ? 1 : 0.45, transition: "opacity .5s" }}>
        <div style={{ position: "absolute", left: dpt.x - dpt.rx, top: dpt.y - dpt.ry, width: dpt.rx * 2, height: dpt.ry * 2, borderRadius: "50%", background: `radial-gradient(closest-side,${dpt.cloudA},${dpt.cloudB} 60%,rgba(255,255,255,0))`, animation: "tc-drift 14s ease-in-out infinite", pointerEvents: "none" }} />
        <div style={{ position: "absolute", left: dpt.x, top: dpt.y - dpt.ry + 26, transform: `translate(-50%,-50%) scale(${ss})`, display: "flex", alignItems: "center", gap: 6, height: 28, padding: "0 11px", borderRadius: 14, fontSize: 13, fontWeight: 600, color: dpt.color, background: "rgba(255,255,255,.75)", whiteSpace: "nowrap", pointerEvents: "none" }}>
          <span style={{ width: 7, height: 7, borderRadius: 4, background: dpt.color }} />
          {dpt.name}
          <span style={{ color: "#8e8e93", fontWeight: 500 }}>{n} role{n === 1 ? "" : "s"}</span>
        </div>
      </div>
    );
  });

  const selRole = sel ? byId.get(sel) ?? null : null;
  const suggestions = data.suggestions.filter((s) => s.at == null || s.at <= ph.t);
  const lensOpts = [
    { value: "knowledge", label: "Knowledge", dot: "#b7a6ff" },
    ...(data.features.riskLens ? [{ value: "risk", label: "Retirement risk", dot: "#f0642f" }] : []),
    { value: "handoffs", label: "Hand-offs", dot: "#8fd3ff" },
  ];
  const dockRight = inspDocked && data.roles.length ? inspW + 32 : 16;

  return (
    <div data-pcanvas="" style={{ position: "absolute", inset: 0 }}>
      <style>{CANVAS_CSS}</style>
      <div
        ref={viewRef}
        onPointerDown={cam.onPointerDown}
        style={{ position: "absolute", inset: 0, overflow: "hidden", cursor: "grab", touchAction: "none", backgroundImage: "radial-gradient(rgba(60,60,90,.08) 1px,transparent 1.3px)", backgroundSize: "14px 14px" }}
      >
        <div
          ref={worldRef}
          style={{ position: "absolute", left: 0, top: 0, width: WORLD.w, height: WORLD.h, transformOrigin: "0 0", transform: "translate3d(0,0,0) scale(.5)", opacity: ready ? 1 : 0, transition: "opacity .5s", willChange: "transform" }}
        >
          {clouds}
          {edgeSvg}
          {labels}
          {nodes}
        </div>
      </div>

      {data.empty ? (
        <div style={{ position: "absolute", left: 0, right: 0, top: "38%", display: "flex", justifyContent: "center", pointerEvents: "none" }}>
          <div data-panel="" className="glass-panel" style={{ pointerEvents: "auto", maxWidth: 380, margin: "0 16px", padding: "22px 24px", borderRadius: 24, textAlign: "center", animation: "tc-rise .5s var(--ease-rise) both" }}>
            <div style={{ display: "flex", justifyContent: "center" }}><Orb mood="quiet" size={38} follow={false} /></div>
            <h2 style={{ margin: "12px 0 6px", fontSize: 18, fontWeight: 700 }}>{data.empty.title}</h2>
            <p style={{ margin: "0 0 14px", fontSize: 13.5, color: "#6e6e73", lineHeight: 1.45 }}>Only roles Tacit has captured or heard named appear here.</p>
            <Link href={data.empty.cta.href} style={{ display: "inline-flex", alignItems: "center", height: 40, padding: "0 18px", borderRadius: 20, fontSize: 14, fontWeight: 600, color: "#6b3f00", textDecoration: "none", background: "linear-gradient(180deg,rgba(255,222,160,.9),rgba(255,196,95,.62))" }}>
              {data.empty.cta.label}
            </Link>
          </div>
        </div>
      ) : null}

      {/* top bar */}
      <div style={{ position: "absolute", top: 16, left: 16, right: inspDocked && showInspector ? inspW + 32 : 16, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, pointerEvents: "none" }}>
        <div style={{ pointerEvents: "auto", display: "contents" }}>
          <SidebarToggle />
        </div>
        <div className="glass-nav" style={{ pointerEvents: "auto", display: "flex", flexDirection: "column", justifyContent: "center", height: 44, padding: "0 16px", borderRadius: 22, minWidth: 0, maxWidth: narrow ? "calc(100% - 54px)" : 340 }}>
          <span style={{ fontSize: 11.5, color: "#8e8e93", lineHeight: 1.2 }}>Company map</span>
          <span style={{ fontSize: 14.5, fontWeight: 600, lineHeight: 1.25, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{data.company.name}</span>
        </div>
        {data.roles.length ? (
          <div style={{ pointerEvents: "auto" }}>
            <SegmentedControl ariaLabel="Lens" options={lensOpts} value={lens} onChange={(v) => setLens(v as Lens)} />
          </div>
        ) : null}
        {data.features.editMap ? (
          <button
            type="button"
            onClick={() => setEdit((v) => !v)}
            aria-pressed={edit}
            className="glass-nav cursor-pointer active:scale-[.96]"
            style={{ pointerEvents: "auto", height: 38, padding: "0 14px", borderRadius: 19, border: 0, fontSize: 13.5, fontWeight: 500, color: edit ? "#fff" : "#1d1d1f", background: edit ? "#1d1d1f" : undefined, transition: "scale .25s var(--ease-press), background .25s" }}
          >
            {edit ? "Done" : "Edit map"}
          </button>
        ) : null}
        {edit ? <span style={{ fontSize: 12.5, color: "#6e6e73", pointerEvents: "none" }}>Drag roles to arrange · not saved (demo)</span> : null}
      </div>

      {data.orgNote || data.unreadable ? (
        <div style={{ position: "absolute", top: narrow ? 170 : 72, left: 16, maxWidth: "min(380px, calc(100% - 32px))", display: "flex", flexDirection: "column", gap: 6, pointerEvents: "none" }}>
          {data.orgNote ? <Note text={data.orgNote} /> : null}
          {data.unreadable ? <Note text={`${data.unreadable} session file${data.unreadable === 1 ? "" : "s"} could not be read and ${data.unreadable === 1 ? "is" : "are"} left out.`} /> : null}
        </div>
      ) : null}

      {/* zoom rail */}
      {data.roles.length ? (
        <div data-panel="" className="glass-nav" style={{ position: "absolute", top: narrow ? 128 : 76, right: dockRight, width: 44, padding: "4px 0", borderRadius: 22, display: narrow ? "none" : "flex", flexDirection: "column", alignItems: "center" }}>
          <RailBtn label="Zoom in" onClick={() => cam.zoom(1.25, viewBox())}>+</RailBtn>
          <RailBtn label="Zoom out" onClick={() => cam.zoom(0.8, viewBox())}>−</RailBtn>
          <RailBtn label="Fit to screen" onClick={() => fitAll(700)}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden><path d="M1 5V1h4M9 1h4v4M13 9v4H9M5 13H1V9" /></svg>
          </RailBtn>
        </div>
      ) : null}

      {/* suggestions */}
      {data.roles.length && !(narrow && showInspector) ? (
        <div style={{ position: "absolute", left: 16, bottom: 126, maxHeight: narrow ? "40%" : "calc(100% - 300px)", display: "flex", alignItems: "flex-end", maxWidth: "calc(100% - 32px)" }}>
          <SuggestCard key={narrow ? "n" : "w"} items={suggestions} onFocusRole={(id) => select(id)} defaultOpen={!narrow} />
        </div>
      ) : null}

      {/* inspector */}
      {showInspector && selRole ? (
        inspDocked ? (
          <div style={{ position: "absolute", top: 16, right: 16, bottom: 16, width: inspW }}>
            <RoleInspector role={selRole} data={data} t={ph.t} onSelect={(id) => select(id)} showRisk={data.features.riskLens} width="100%" />
          </div>
        ) : (
          <div style={{ position: "absolute", left: 8, right: 8, bottom: 118, height: "min(56%, 460px)", zIndex: 8, animation: "tc-rise .4s var(--ease-rise) both" }}>
            <RoleInspector role={selRole} data={data} t={ph.t} onSelect={(id) => select(id)} showRisk={data.features.riskLens} width="100%" onClose={() => setSel(null)} />
          </div>
        )
      ) : null}

      {/* dock */}
      <div data-panel="" data-dock="" style={{ position: "absolute", left: narrow ? 8 : 16, right: narrow ? 8 : dockRight, bottom: narrow ? 8 : 16 }}>
        <Dock timeline={tl} ph={ph} counts={counts} playLabel="Watch it grow" before="Before the first capture" />
      </div>
    </div>
  );
}

function Note({ text }: { text: string }) {
  return (
    <div className="glass-chip" style={{ padding: "8px 12px", borderRadius: 14, fontSize: 12.5, lineHeight: 1.4, color: "#3a3a3c", animation: "tc-rise .4s var(--ease-rise) both" }}>{text}</div>
  );
}

function RailBtn({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="cursor-pointer hover:bg-[rgba(0,0,0,.05)] active:scale-[.92]"
      style={{ width: 36, height: 36, margin: "2px 0", borderRadius: 18, border: 0, background: "transparent", color: "#1d1d1f", fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center", transition: "scale .2s var(--ease-press)" }}
    >
      {children}
    </button>
  );
}

type EdgeGeo = { e: RoleEdge; i: number; d: string; tip: string; m: { x: number; y: number }; p0: { x: number; y: number }; p1: { x: number; y: number } };

function edgeGeo(e: RoleEdge, i: number, byId: Map<string, RoleNode>, ss: number): EdgeGeo | null {
  const A = byId.get(e.from), B = byId.get(e.to);
  if (!A || !B) return null;
  const len = Math.hypot(B.x - A.x, B.y - A.y) || 1;
  const nx = -(B.y - A.y) / len, ny = (B.x - A.x) / len;
  const c = { x: (A.x + B.x) / 2 + nx * len * 0.1, y: (A.y + B.y) / 2 + ny * len * 0.1 };
  const cl = (P: RoleNode, r: number) => {
    const dx = c.x - P.x, dy = c.y - P.y, dd = Math.hypot(dx, dy) || 1;
    return { x: P.x + (dx / dd) * (r + 12), y: P.y + (dy / dd) * (r + 12) };
  };
  const p0 = cl(A, A.r * ss), p1 = cl(B, B.r * ss);
  const d = `M${p0.x.toFixed(1)} ${p0.y.toFixed(1)} Q ${c.x.toFixed(1)} ${c.y.toFixed(1)} ${p1.x.toFixed(1)} ${p1.y.toFixed(1)}`;
  const ang = Math.atan2(p1.y - c.y, p1.x - c.x), ah = 10 * ss, aw = 5 * ss;
  const tip = `${p1.x},${p1.y} ${p1.x - ah * Math.cos(ang) + aw * Math.sin(ang)},${p1.y - ah * Math.sin(ang) - aw * Math.cos(ang)} ${p1.x - ah * Math.cos(ang) - aw * Math.sin(ang)},${p1.y - ah * Math.sin(ang) + aw * Math.cos(ang)}`;
  const m = { x: 0.25 * p0.x + 0.5 * c.x + 0.25 * p1.x, y: 0.25 * p0.y + 0.5 * c.y + 0.25 * p1.y };
  return { e, i, d, tip, m, p0, p1 };
}
