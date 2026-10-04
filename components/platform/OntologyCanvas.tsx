"use client";
// Ontology (platform report §1.4): classes (with fields), concepts and roles on a pannable world; edges with verbs,
// cardinalities, provenance colours and rule badges; Graph | Schema; find box; Decision paths; trace a rule.
// Provenance is drawn honestly: seen (vision) and erp (ERP telemetry) differ in border and colour.
import Link from "next/link";
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Orb, SegmentedControl, usePlayhead } from "@/components/glass";
import type { Ontology, OntEdge, OntNode, Provenance } from "@/lib/platform/types";
import { DecisionPaths } from "./DecisionPaths";
import { Dock } from "./Dock";
import { OntologyInspector } from "./OntologyInspector";
import { SidebarToggle, useShell } from "./PlatformShell";
import { fitBox, useCamera, type Box } from "./useCamera";
import { AVATAR, EDGE_GRAD, KIND, PASTEL, PROV, hexA, initials, lastBeads, stepIndex } from "./meta";

type Mode = "graph" | "schema";
const WORLD = { w: 1800, h: 1180 };
const ROW = 26;

function nodeSize(n: OntNode, mode: Mode, knownFields: number): { w: number; h: number } {
  if (n.kind === "object") {
    const head = 52;
    return mode === "schema" ? { w: 264, h: head + (knownFields ? knownFields * ROW + 12 : 0) } : { w: 178, h: head };
  }
  return { w: 186, h: 44 + (mode === "schema" && n.def ? 30 : 0) };
}

function border(prov: Provenance): React.CSSProperties {
  switch (prov) {
    case "said":
      return { border: "1.5px solid transparent" };
    case "described":
      return { border: "1.5px dashed rgba(0,0,0,.28)" };
    case "inferred":
      return { border: "1.5px dashed rgba(143,123,255,.75)" };
    case "teachback":
      return { border: "1.5px dashed rgba(34,180,94,.6)" };
    case "erp":
      return { border: "1px solid rgba(74,100,136,.4)" };
    default:
      return { border: "1px solid rgba(0,0,0,.09)" };
  }
}

const BG = {
  object: "linear-gradient(180deg,rgba(255,255,255,.98),rgba(250,250,252,.94))",
  role: "linear-gradient(180deg,rgba(241,247,255,.98),rgba(226,237,255,.9))",
  concept: "linear-gradient(180deg,rgba(255,250,238,.98),rgba(255,242,215,.9))",
};
const IRI = "conic-gradient(from 200deg,#ffb8d9,#ffe2a8,#b9f0d3,#b5dcff,#d4c6ff,#ffb8d9)";

export function OntologyCanvas({ ont, initialRule }: { ont: Ontology; initialRule?: string | null }) {
  const { narrow, base } = useShell();
  const tl = ont.timeline;
  const ph = usePlayhead([tl.start, tl.today], 7500);
  const viewRef = useRef<HTMLDivElement | null>(null);
  const worldRef = useRef<HTMLDivElement | null>(null);
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const [mode, setMode] = useState<Mode>("schema");
  const [selNode, setSelNode] = useState<string | null>(null);
  const [rule, setRule] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [labelsOn, setLabelsOn] = useState(true);
  const [badgesOn, setBadgesOn] = useState(true);
  const [ready, setReady] = useState(false);
  const [vw, setVw] = useState(1200);
  const [sheet, setSheet] = useState(false);

  const nodes = useMemo<OntNode[]>(() => [...ont.classes, ...ont.concepts], [ont.classes, ont.concepts]);
  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const activeRule = rule ? ont.rules.find((r) => r.id === rule) ?? null : null;
  const inspW = vw < 1050 ? 320 : 370;

  const clearAll = useCallback(() => {
    setRule(null);
    if (narrow) setSheet(false);
  }, [narrow]);
  const cam = useCamera({ viewRef, worldRef, minK: 0.2, ssBase: 0, ssMax: 1, labelK: 0.42, onBgClick: clearAll });

  const viewBox = useCallback((): Box => {
    const v = cam.view();
    const right = narrow ? 0 : inspW + 32;
    const left = narrow || v.w - right < 900 ? 0 : 300;
    const top = narrow ? 124 : 76;
    return { x: left, y: top, w: Math.max(200, v.w - right - left), h: Math.max(200, v.h - top - 126) };
  }, [cam, narrow, inspW]);

  // ----- time
  const times = useMemo(() => {
    const s = new Set<number>();
    for (const n of nodes) {
      s.add(n.at);
      for (const f of n.fields ?? []) s.add(f.at);
    }
    for (const e of ont.edges) s.add(e.at);
    for (const r of ont.rules) s.add(r.at);
    return [...s].sort((a, b) => a - b);
  }, [nodes, ont.edges, ont.rules]);
  const step = stepIndex(times, ph.t);
  const tk = step > 0 ? times[step - 1] : -Infinity;
  const { last, prev } = lastBeads(tl.beads, ph.t);
  const isNew = useCallback((at: number) => !!last && at <= last.at && (!prev || at > prev.at), [last, prev]);

  const sizes = useMemo(() => {
    const m = new Map<string, { w: number; h: number }>();
    for (const n of nodes) m.set(n.id, nodeSize(n, mode, (n.fields ?? []).filter((f) => f.at <= tk).length));
    return m;
  }, [nodes, mode, tk]);

  const fitAll = useCallback((ms = 700) => {
    let box: Box = { x: 0, y: 0, w: WORLD.w, h: WORLD.h };
    if (nodes.length) {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const n of nodes) {
        const s = nodeSize(n, mode, (n.fields ?? []).length);
        x0 = Math.min(x0, n.x - s.w / 2); x1 = Math.max(x1, n.x + s.w / 2);
        y0 = Math.min(y0, n.y - s.h / 2); y1 = Math.max(y1, n.y + s.h / 2);
      }
      box = { x: x0 - 20, y: y0 - 20, w: x1 - x0 + 40, h: y1 - y0 + 40 };
    }
    const v = viewBox();
    cam.fly(fitBox(box, v, 10, 1.1, v.w >= 700 ? 0.55 : 0.2), ms);
  }, [cam, nodes, mode, viewBox]);

  const traceTo = useCallback((id: string | null, fly = true) => {
    setRule(id);
    if (!id) return;
    setSelNode(null);
    if (narrow) setSheet(true);
    const r = ont.rules.find((x) => x.id === id);
    if (!r || !fly) return;
    const pts = r.path.map((p) => byId.get(p)).filter((n): n is OntNode => !!n);
    if (!pts.length) return;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const n of pts) {
      const s = sizes.get(n.id) ?? { w: 180, h: 50 };
      x0 = Math.min(x0, n.x - s.w / 2); x1 = Math.max(x1, n.x + s.w / 2);
      y0 = Math.min(y0, n.y - s.h / 2); y1 = Math.max(y1, n.y + s.h / 2);
    }
    cam.fly(fitBox({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 }, viewBox(), 70, 1.05, 0.2), 800);
  }, [ont.rules, byId, sizes, cam, viewBox, narrow]);

  const pickNode = useCallback((id: string) => {
    setRule(null);
    setSelNode(id);
    if (narrow) setSheet(true);
    const n = byId.get(id);
    if (!n) return;
    const v = viewBox();
    const k = Math.max(cam.cam.current.k, 0.7);
    cam.fly({ k, x: v.x + v.w / 2 - n.x * k, y: v.y + v.h / 2 - n.y * k }, 700);
  }, [byId, cam, viewBox, narrow]);

  // Initial layout after mount: measure, choose mode, default selection, fit (or trace ?rule=).
  useLayoutEffect(() => {
    const el = viewRef.current;
    if (!el) return;
    setVw(el.clientWidth);
    const isNarrow = window.innerWidth < 900;
    if (isNarrow) setMode("graph");
    const biggest = [...ont.classes].sort((a, b) => b.fields.length - a.fields.length)[0];
    if (!isNarrow && biggest) setSelNode(biggest.id);
    fitAll(0);
    setReady(true);
    if (initialRule && ont.rules.some((r) => r.id === initialRule || r.displayId === initialRule)) {
      const r = ont.rules.find((x) => x.id === initialRule || x.displayId === initialRule)!;
      requestAnimationFrame(() => traceTo(r.id));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-fit when the mode changes node sizes; keep centre on resize.
  const firstMode = useRef(true);
  useEffect(() => {
    if (firstMode.current) { firstMode.current = false; return; }
    if (!rule) fitAll(600);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);
  useEffect(() => {
    const el = viewRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    let lw = el.clientWidth, lh = el.clientHeight;
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth, h = el.clientHeight;
      if (w === lw && h === lh) return;
      const c = cam.cam.current;
      cam.set({ ...c, x: c.x + (w - lw) / 2, y: c.y + (h - lh) / 2 });
      lw = w; lh = h;
      setVw(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [cam]);

  // Playing clears a trace (mockup behaviour).
  useEffect(() => {
    if (ph.playing) setRule(null);
  }, [ph.playing]);

  // ----- search
  const q = query.trim().toLowerCase();
  const match = useMemo(() => {
    if (!q) return null;
    const s = new Set<string>();
    for (const n of nodes) if (n.name.toLowerCase().includes(q) || (n.fields ?? []).some((f) => f.name.toLowerCase().includes(q))) s.add(n.id);
    return s;
  }, [q, nodes]);

  const pathSet = useMemo(() => new Set(activeRule?.path ?? []), [activeRule]);
  const hotEdges = useMemo(() => new Set(activeRule?.edgeIds ?? []), [activeRule]);

  const counts = useMemo(() => {
    const c = ont.classes.filter((n) => n.at <= tk);
    const f = c.reduce((s, n) => s + n.fields.filter((x) => x.at <= tk).length, 0);
    const e = ont.edges.filter((x) => x.at <= tk).length;
    const r = ont.rules.filter((x) => x.at <= tk).length;
    return `${c.length} class${c.length === 1 ? "" : "es"} · ${f} field${f === 1 ? "" : "s"} · ${e} relation${e === 1 ? "" : "s"} · ${r} rule${r === 1 ? "" : "s"}`;
  }, [ont, tk]);

  // ----- edge geometry
  const geo = useMemo(() => ont.edges.map((e, i) => {
    const A = byId.get(e.from), B = byId.get(e.to);
    if (!A || !B) return null;
    const sa = sizes.get(A.id)!, sb = sizes.get(B.id)!;
    const len = Math.hypot(B.x - A.x, B.y - A.y) || 1;
    const nx = -(B.y - A.y) / len, ny = (B.x - A.x) / len;
    const c = { x: (A.x + B.x) / 2 + nx * len * 0.08, y: (A.y + B.y) / 2 + ny * len * 0.08 };
    const p0 = clipRect(A, sa, c), p1 = clipRect(B, sb, c);
    const d = `M${p0.x.toFixed(1)} ${p0.y.toFixed(1)} Q ${c.x.toFixed(1)} ${c.y.toFixed(1)} ${p1.x.toFixed(1)} ${p1.y.toFixed(1)}`;
    const m = { x: 0.25 * p0.x + 0.5 * c.x + 0.25 * p1.x, y: 0.25 * p0.y + 0.5 * c.y + 0.25 * p1.y };
    const ang = Math.atan2(p1.y - c.y, p1.x - c.x);
    const tip = `${p1.x},${p1.y} ${p1.x - 9 * Math.cos(ang) + 4.5 * Math.sin(ang)},${p1.y - 9 * Math.sin(ang) - 4.5 * Math.cos(ang)} ${p1.x - 9 * Math.cos(ang) - 4.5 * Math.sin(ang)},${p1.y - 9 * Math.sin(ang) + 4.5 * Math.cos(ang)}`;
    return { e, i, d, m, nx, ny, p0, p1, tip };
  }).filter((g): g is NonNullable<typeof g> => !!g), [ont.edges, byId, sizes]);

  const dimEdge = (e: OntEdge) => (activeRule ? !hotEdges.has(e.id) : match ? !(match.has(e.from) && match.has(e.to)) : false);

  const edgeSvg = useMemo(() => (
    <svg aria-hidden width={WORLD.w} height={WORLD.h} style={{ position: "absolute", left: 0, top: 0, overflow: "visible", pointerEvents: "none" }}>
      <defs>
        {geo.map((g) => g.e.prov === "said" ? (
          <linearGradient key={g.e.id} id={`og${uid}${g.i}`} gradientUnits="userSpaceOnUse" x1={g.p0.x} y1={g.p0.y} x2={g.p1.x} y2={g.p1.y}>
            {EDGE_GRAD.map((c, j) => <stop key={c} offset={j / 4} stopColor={c} />)}
          </linearGradient>
        ) : null)}
      </defs>
      {geo.map((g) => {
        if (g.e.at > tk) return null;
        const hot = hotEdges.has(g.e.id);
        const said = g.e.prov === "said";
        const col = said ? `url(#og${uid}${g.i})` : g.e.prov === "described" ? "#9a9aa2" : PROV[g.e.prov].color;
        const dash = g.e.prov === "described" || g.e.prov === "inferred" || g.e.prov === "teachback" ? "6 6" : null;
        const w = hot ? 3.4 : said ? 2.2 : 1.5;
        const fresh = isNew(g.e.at);
        const op = dimEdge(g.e) ? (activeRule ? 0.14 : 0.14) : 1;
        return (
          <g key={g.e.id} style={{ opacity: op, transition: "opacity .45s" }}>
            {hot || fresh ? <path d={g.d} stroke={hot ? "#b7a6ff" : "#7fe0b0"} strokeWidth={w + 7} fill="none" opacity={0.28} style={{ filter: "blur(4px)" }} /> : null}
            {dash ? (
              <path d={g.d} stroke={col} strokeWidth={w} fill="none" strokeLinecap="round" strokeDasharray={dash} style={{ animation: "tc-fade .6s both", transition: "stroke-width .35s" }} />
            ) : (
              <path d={g.d} stroke={col} strokeWidth={w} fill="none" strokeLinecap="round" pathLength={1} strokeDasharray="1" style={{ animation: "tc-draw .8s var(--ease-rise) both", transition: "stroke-width .35s" }} />
            )}
            <polygon points={g.tip} fill={said ? "#b7a6ff" : col} style={{ animation: "tc-fade .4s .4s both" }} />
            {said || hot ? (
              <path d={g.d} stroke="#fff" strokeWidth={w + 1} fill="none" strokeLinecap="round" pathLength={1} strokeDasharray=".04 .96" style={{ animation: `tc-flow ${hot ? 1.6 : 3.4 + (g.e.id.length % 5) * 0.4}s linear infinite` }} />
            ) : null}
          </g>
        );
      })}
    </svg>
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [geo, tk, hotEdges, match, activeRule, uid, isNew]);

  const labelEls = geo.filter((g) => g.e.at <= tk && ((labelsOn && cam.zoomedIn) || hotEdges.has(g.e.id))).map((g) => (
    <div
      key={`l${g.e.id}`}
      aria-hidden
      style={{ position: "absolute", left: g.m.x + g.nx * (g.e.ruleIds.length ? 26 : 15), top: g.m.y + g.ny * (g.e.ruleIds.length ? 26 : 15), transform: "translate(-50%,-50%)", whiteSpace: "nowrap", fontSize: 11, color: "#3a3a3c", padding: "2px 7px", borderRadius: 8, background: "rgba(255,255,255,.88)", boxShadow: "0 0 0 .5px rgba(0,0,0,.06)", pointerEvents: "none", opacity: dimEdge(g.e) ? 0.2 : 1, transition: "opacity .4s", zIndex: 2 }}
    >
      {g.e.verb}
      {g.e.card ? <span style={{ fontFamily: "var(--font-mono)", color: "#8e8e93", marginLeft: 5, fontSize: 10.5 }}>{g.e.card}</span> : null}
    </div>
  ));

  const badges = badgesOn ? ont.rules.map((r) => {
    const g = r.badgeEdgeId ? geo.find((x) => x.e.id === r.badgeEdgeId) : null;
    if (!g || r.at > tk) return null;
    const on = rule === r.id;
    const size = on ? 30 : 24;
    const c = KIND[r.kind].color;
    return (
      <button
        key={`b${r.id}`}
        type="button"
        data-node=""
        onClick={() => traceTo(on ? null : r.id)}
        aria-label={`Trace ${r.displayId}: ${r.title}`}
        aria-pressed={on}
        title={r.title}
        style={{ position: "absolute", left: g.m.x - size / 2, top: g.m.y - size / 2, width: size, height: size, borderRadius: size / 2, border: 0, padding: 0, cursor: "pointer", color: "#fff", fontSize: on ? 11.5 : 10, fontWeight: 700, background: `radial-gradient(circle at 35% 30%,${hexA(c, 0.7)},${c})`, boxShadow: `0 0 0 2px #fff,0 0 10px ${c}`, zIndex: 4, opacity: activeRule && !on ? 0.35 : 1, transition: "all .35s cubic-bezier(.3,1.5,.5,1)", animation: "tc-pop .45s var(--ease-spring) both" }}
      >
        {r.displayId}
      </button>
    );
  }) : null;

  const nodeEls = useMemo(() => nodes.map((n, i) => {
    const vis = n.at <= tk;
    const s = sizes.get(n.id)!;
    const kind = n.kind === "object" ? "object" : n.kind;
    const isSel = selNode === n.id && !activeRule;
    const inPath = pathSet.has(n.id);
    const dim = activeRule ? !inPath : match ? !match.has(n.id) : false;
    const fresh = vis && isNew(n.at);
    const fields = (n.fields ?? []).filter((f) => f.at <= tk);
    const said = n.prov === "said";
    const pv = PROV[n.prov];
    const meta = n.kind === "object" ? (mode === "graph" ? `${fields.length} field${fields.length === 1 ? "" : "s"}` : pv.label.toLowerCase()) : `${n.kind} · ${pv.label.toLowerCase()}`;
    const shadow = isSel
      ? "0 0 0 3px rgba(181,220,255,.65),0 18px 44px rgba(120,110,255,.2)"
      : inPath
        ? "0 16px 40px rgba(170,150,255,.28)"
        : fresh
          ? "0 0 0 2px rgba(34,180,94,.35),0 0 22px rgba(34,180,94,.25),0 8px 24px rgba(15,23,42,.08)"
          : "0 8px 24px rgba(15,23,42,.07)";
    const pathIdx = activeRule ? activeRule.path.indexOf(n.id) : -1;
    return (
      <div
        key={n.id}
        data-node=""
        style={{ position: "absolute", left: n.x, top: n.y, width: s.w, height: s.h, marginLeft: -s.w / 2, marginTop: -s.h / 2, zIndex: isSel || inPath ? 3 : 1, pointerEvents: vis ? "auto" : "none", transition: "width .45s cubic-bezier(.3,1.1,.4,1), height .45s cubic-bezier(.3,1.1,.4,1), margin .45s cubic-bezier(.3,1.1,.4,1)" }}
      >
        <div style={{ position: "absolute", inset: 0, opacity: vis ? (dim ? 0.2 : 1) : 0, transform: vis ? "none" : "scale(.6)", transition: "opacity .5s, transform .65s cubic-bezier(.25,1.4,.4,1)" }}>
          {inPath ? (
            <div key={`tr${rule}`} aria-hidden style={{ position: "absolute", inset: -5, borderRadius: kind === "object" ? 22 : 27, animation: `tc-rise .5s var(--ease-rise) ${Math.max(0, pathIdx) * 0.12}s both`, pointerEvents: "none" }}>
              <div style={{ position: "absolute", inset: 0, borderRadius: "inherit", padding: 3, background: `conic-gradient(from var(--tc-a,0deg),${PASTEL.join(",")})`, filter: "blur(8px)", opacity: 0.8, animation: "tc-hue 4s linear infinite" }} />
              <div style={{ position: "absolute", inset: 0, borderRadius: "inherit", padding: 1.6, background: `conic-gradient(from var(--tc-a,0deg),${PASTEL.join(",")})`, WebkitMask: "linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0)", WebkitMaskComposite: "xor", maskComposite: "exclude", animation: "tc-hue 4s linear infinite" }} />
            </div>
          ) : null}
          <button
            type="button"
            onClick={() => pickNode(n.id)}
            aria-label={`${n.name}, ${meta}`}
            aria-pressed={isSel}
            tabIndex={vis ? 0 : -1}
            className="hover:-translate-y-[2px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgba(245,166,35,.75)]"
            style={{
              position: "absolute",
              inset: 0,
              boxSizing: "border-box",
              padding: 0,
              textAlign: "left",
              font: "inherit",
              color: "#1d1d1f",
              cursor: "pointer",
              overflow: "hidden",
              borderRadius: kind === "object" ? 18 : 23,
              ...border(n.prov),
              background: said ? `${BG[kind]} padding-box,${IRI} border-box` : BG[kind],
              boxShadow: shadow,
              transition: "box-shadow .4s, translate .25s",
            }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: 9, height: kind === "object" ? 50 : 42, padding: "0 12px" }}>
              <span aria-hidden style={{ width: 24, height: 24, flex: "none", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, background: kind === "role" ? "rgba(43,95,196,.12)" : kind === "concept" ? "rgba(245,166,35,.18)" : "rgba(0,0,0,.05)", color: kind === "role" ? "#2b5fc4" : kind === "concept" ? "#a35f00" : "#3a3a3c" }}>
                {kind === "role" ? "◎" : kind === "concept" ? "✦" : "▤"}
              </span>
              <span style={{ minWidth: 0, flex: 1 }}>
                <span style={{ display: "block", fontSize: i === 0 && kind === "object" ? 15.5 : 14, fontWeight: 600, lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{n.name}</span>
                <span style={{ display: "block", fontSize: 11, color: "#8e8e93", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{meta}</span>
              </span>
              {fresh ? <span style={{ flex: "none", fontSize: 9.5, fontWeight: 700, letterSpacing: ".06em", color: "#1b8a4b", background: "rgba(34,180,94,.14)", padding: "2px 6px", borderRadius: 7, animation: "tc-pop .4s var(--ease-spring) both" }}>NEW</span> : null}
            </span>
            {mode === "schema" && kind === "object" && fields.length ? (
              <span style={{ display: "block", borderTop: ".5px solid rgba(0,0,0,.06)", padding: "5px 12px 0" }}>
                {fields.map((f) => (
                  <span key={f.name} style={{ display: "grid", gridTemplateColumns: "8px 92px 1fr", gap: 8, alignItems: "center", height: ROW, borderRadius: 6, background: isNew(f.at) ? "rgba(34,180,94,.08)" : "transparent", animation: "tc-rise .5s var(--ease-rise) both" }}>
                    <span aria-hidden title={PROV[f.prov].label} style={{ width: 6, height: 6, borderRadius: 3, background: PROV[f.prov].color }} />
                    <span style={{ fontSize: 12, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{f.name}</span>
                    <span style={{ fontSize: 11.5, color: "#8e8e93", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{f.value}</span>
                  </span>
                ))}
              </span>
            ) : null}
            {mode === "schema" && kind !== "object" && n.def ? (
              <span style={{ padding: "0 12px", fontSize: 11.5, color: "#6e6e73", lineHeight: 1.3, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" } as React.CSSProperties}>{n.def}</span>
            ) : null}
          </button>
        </div>
      </div>
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [nodes, tk, sizes, selNode, activeRule, pathSet, match, mode, isNew, rule]);

  const selected = selNode ? byId.get(selNode) ?? null : null;
  const showInspector = narrow ? sheet && (!!activeRule || !!selected) : true;
  const roleTitle = ont.roleTitle;

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <div
        ref={viewRef}
        onPointerDown={cam.onPointerDown}
        style={{ position: "absolute", inset: 0, overflow: "hidden", cursor: "grab", touchAction: "none", backgroundImage: "radial-gradient(rgba(60,60,90,.09) 1px,transparent 1.3px)", backgroundSize: "14px 14px" }}
      >
        <div ref={worldRef} style={{ position: "absolute", left: 0, top: 0, width: WORLD.w, height: WORLD.h, transformOrigin: "0 0", transform: "translate3d(0,0,0) scale(.5)", opacity: ready ? 1 : 0, transition: "opacity .5s", willChange: "transform" }}>
          {edgeSvg}
          {labelEls}
          {nodeEls}
          {badges}
        </div>
      </div>

      {ont.empty || nodes.length === 0 ? (
        <div style={{ position: "absolute", left: 0, right: narrow ? 0 : inspW + 32, top: "36%", display: "flex", justifyContent: "center", pointerEvents: "none" }}>
          <div className="glass-panel" style={{ pointerEvents: "auto", maxWidth: 380, margin: "0 16px", padding: "22px 24px", borderRadius: 24, textAlign: "center" }}>
            <div style={{ display: "flex", justifyContent: "center" }}><Orb mood="quiet" size={38} follow={false} /></div>
            <p style={{ margin: "12px 0 0", fontSize: 14, color: "#3a3a3c", lineHeight: 1.5 }}>{ont.empty ?? "No classes yet. The ontology grows from what Tacit sees and hears in a capture."}</p>
          </div>
        </div>
      ) : null}

      {/* top bar */}
      <div style={{ position: "absolute", top: 16, left: 16, right: narrow ? 16 : inspW + 32, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, pointerEvents: "none" }}>
        <div style={{ pointerEvents: "auto", display: "contents" }}><SidebarToggle /></div>
        <Link href={`${base}?role=${encodeURIComponent(ont.roleId)}`} className="glass-nav" style={{ pointerEvents: "auto", display: "flex", alignItems: "center", gap: 10, height: 44, padding: "0 16px 0 8px", borderRadius: 22, minWidth: 0, maxWidth: narrow ? "calc(100% - 54px)" : 360, textDecoration: "none", color: "#1d1d1f" }}>
          <span aria-hidden style={{ display: "inline-flex" }}>
            {ont.people.slice(0, 2).map((p, i) => (
              <span key={p.id} style={{ width: 28, height: 28, marginLeft: i ? -8 : 0, borderRadius: 14, background: AVATAR[p.avatar].bg, color: AVATAR[p.avatar].ink, fontSize: 11, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 0 2px #fff" }}>{initials(p.name)}</span>
            ))}
          </span>
          <span style={{ minWidth: 0 }}>
            <span style={{ display: "block", fontSize: 11.5, color: "#8e8e93", lineHeight: 1.2 }}>Ontology of</span>
            <span style={{ display: "block", fontSize: 14.5, fontWeight: 600, lineHeight: 1.25, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{roleTitle}</span>
          </span>
        </Link>
        <div style={{ pointerEvents: "auto" }}>
          <SegmentedControl ariaLabel="View" options={[{ value: "graph", label: "Graph" }, { value: "schema", label: "Schema" }]} value={mode} onChange={(v) => setMode(v as Mode)} />
        </div>
        <label className="glass-nav" style={{ pointerEvents: "auto", display: narrow ? "none" : "flex", alignItems: "center", gap: 8, height: 38, padding: "0 14px", borderRadius: 19, width: 220 }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="#8e8e93" strokeWidth="1.5" aria-hidden><circle cx="6" cy="6" r="4.5" /><path d="m9.5 9.5 3 3" /></svg>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find a class or field" aria-label="Find a class or field" style={{ flex: 1, minWidth: 0, border: 0, outline: "none", background: "transparent", font: "inherit", fontSize: 13.5, color: "#1d1d1f" }} />
        </label>
      </div>

      {/* decision paths */}
      {ready && (ont.rules.length || nodes.length) ? (
        <div style={{ position: "absolute", left: 16, top: narrow ? 72 : 76, bottom: 126, display: "flex", alignItems: "flex-start", maxWidth: "calc(100% - 32px)", pointerEvents: "none" }}>
          <div style={{ pointerEvents: "auto", maxHeight: "100%", display: "flex" }}>
            <DecisionPaths key={narrow ? "n" : "w"} ont={ont} t={ph.t} active={rule} onTrace={(id) => traceTo(id)} defaultOpen={!narrow && vw - inspW - 32 >= 900} />
          </div>
        </div>
      ) : null}

      {/* layer rail */}
      {nodes.length && !narrow ? (
        <div data-panel="" className="glass-nav" style={{ position: "absolute", top: 76, right: inspW + 32, width: 44, padding: "4px 0", borderRadius: 22, display: "flex", flexDirection: "column", alignItems: "center" }}>
          <RailBtn label="Rule badges on relationships" on={badgesOn} onClick={() => setBadgesOn((v) => !v)}><span style={{ fontSize: 12, fontWeight: 700 }}>R</span></RailBtn>
          <RailBtn label="Relationship labels" on={labelsOn} onClick={() => setLabelsOn((v) => !v)}><span style={{ fontSize: 13, fontWeight: 600 }}>Aa</span></RailBtn>
          <span aria-hidden style={{ width: 22, height: 1, background: "rgba(0,0,0,.08)", margin: "4px 0" }} />
          <RailBtn label="Zoom in" onClick={() => cam.zoom(1.25, viewBox())}>+</RailBtn>
          <RailBtn label="Zoom out" onClick={() => cam.zoom(0.8, viewBox())}>−</RailBtn>
          <RailBtn label="Fit to screen" onClick={() => fitAll(700)}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden><path d="M1 5V1h4M9 1h4v4M13 9v4H9M5 13H1V9" /></svg>
          </RailBtn>
        </div>
      ) : null}

      {/* inspector */}
      {showInspector ? (
        narrow ? (
          <div style={{ position: "absolute", left: 8, right: 8, bottom: 118, height: "min(58%, 480px)", zIndex: 8, animation: "tc-rise .4s var(--ease-rise) both" }}>
            <OntologyInspector ont={ont} t={ph.t} node={selected} rule={activeRule} onPickNode={pickNode} onTrace={(id) => traceTo(id)} onClose={() => setSheet(false)} />
          </div>
        ) : (
          <div style={{ position: "absolute", top: 16, right: 16, bottom: 16, width: inspW }}>
            <OntologyInspector ont={ont} t={ph.t} node={selected} rule={activeRule} onPickNode={pickNode} onTrace={(id) => traceTo(id)} />
          </div>
        )
      ) : null}

      <div data-panel="" style={{ position: "absolute", left: narrow ? 8 : 16, right: narrow ? 8 : inspW + 32, bottom: narrow ? 8 : 16 }}>
        <Dock timeline={tl} ph={ph} counts={counts} playLabel="Watch it grow" before="Before the first capture" />
      </div>
    </div>
  );
}

function RailBtn({ label, onClick, on, children }: { label: string; onClick: () => void; on?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={on}
      title={label}
      className="cursor-pointer hover:bg-[rgba(0,0,0,.05)] active:scale-[.92]"
      style={{ width: 36, height: 36, margin: "2px 0", borderRadius: 18, border: 0, background: on ? "rgba(255,255,255,.95)" : "transparent", boxShadow: on ? "0 1px 3px rgba(0,0,0,.1)" : "none", color: "#1d1d1f", fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center", transition: "scale .2s var(--ease-press), background .2s" }}
    >
      {children}
    </button>
  );
}

function clipRect(n: { x: number; y: number }, s: { w: number; h: number }, toward: { x: number; y: number }) {
  const dx = toward.x - n.x, dy = toward.y - n.y;
  const hw = s.w / 2 + 4, hh = s.h / 2 + 4;
  const tx = dx !== 0 ? hw / Math.abs(dx) : Infinity;
  const ty = dy !== 0 ? hh / Math.abs(dy) : Infinity;
  const f = Math.min(tx, ty, 1);
  return { x: n.x + dx * f, y: n.y + dy * f };
}
