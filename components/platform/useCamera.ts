"use client";
// Pan / zoom camera for the platform canvases (port of tacit-ui.js camera()).
// The camera lives in a ref and is written straight to ONE transform on the world div (plus the dot-grid
// background), so pan, wheel and fly never re-render React. Only a quantised counter-scale (`ss`) and a
// "zoomed in" flag are React state, so labels re-layout a handful of times during a zoom, not per frame.
import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { prefersReducedMotion } from "@/lib/ui/motion";

export type Cam = { x: number; y: number; k: number };
export type Box = { x: number; y: number; w: number; h: number };

export type CameraOpts = {
  viewRef: RefObject<HTMLDivElement | null>;
  worldRef: RefObject<HTMLDivElement | null>;
  /** dot grid spacing in world px (0 = no grid) */
  grid?: number;
  minK?: number;
  maxK?: number;
  /** counter-scale for overlays: ss = clamp(ssBase / k, 1, ssMax) */
  ssBase?: number;
  ssMax?: number;
  /** k above which labels show */
  labelK?: number;
  onBgClick?: () => void;
};

const ease = (x: number) => 1 - Math.pow(1 - x, 3);

export function fitBox(box: Box, view: Box, pad = 60, maxK = 1.2, minK = 0.05): Cam {
  const w = Math.max(1, box.w), h = Math.max(1, box.h);
  const k = Math.max(minK, Math.min(maxK, (view.w - pad * 2) / w, (view.h - pad * 2) / h));
  return { k, x: view.x + view.w / 2 - (box.x + w / 2) * k, y: view.y + view.h / 2 - (box.y + h / 2) * k };
}

export function useCamera(o: CameraOpts) {
  const { viewRef, worldRef, grid = 28, minK = 0.25, maxK = 2.2, ssBase = 0.75, ssMax = 2.2, labelK = 0.9 } = o;
  const cam = useRef<Cam>({ x: 0, y: 0, k: 0.5 });
  const fly = useRef(0);
  const bgClick = useRef(o.onBgClick);
  bgClick.current = o.onBgClick;
  const [ss, setSs] = useState(1);
  const [zoomedIn, setZoomedIn] = useState(false);
  const [k, setK] = useState(0.5);

  const apply = useCallback(() => {
    const c = cam.current;
    const w = worldRef.current;
    if (w) w.style.transform = `translate3d(${c.x.toFixed(2)}px,${c.y.toFixed(2)}px,0) scale(${c.k.toFixed(4)})`;
    const v = viewRef.current;
    if (v && grid) {
      v.style.backgroundSize = `${(grid * c.k).toFixed(2)}px ${(grid * c.k).toFixed(2)}px`;
      v.style.backgroundPosition = `${c.x.toFixed(1)}px ${c.y.toFixed(1)}px`;
    }
    const nextSs = Math.round(Math.min(ssMax, Math.max(1, ssBase / c.k)) * 20) / 20;
    setSs((p) => (p === nextSs ? p : nextSs));
    const zi = c.k > labelK;
    setZoomedIn((p) => (p === zi ? p : zi));
    const kq = Math.round(c.k * 50) / 50;
    setK((p) => (p === kq ? p : kq));
  }, [worldRef, viewRef, grid, ssBase, ssMax, labelK]);

  const set = useCallback((c: Cam) => {
    cam.current = c;
    apply();
  }, [apply]);

  const cancel = useCallback(() => {
    if (fly.current) cancelAnimationFrame(fly.current);
    fly.current = 0;
  }, []);

  const view = useCallback((): Box => {
    const el = viewRef.current;
    return { x: 0, y: 0, w: el?.clientWidth ?? 1200, h: el?.clientHeight ?? 800 };
  }, [viewRef]);

  const flyTo = useCallback((target: Cam, ms = 700) => {
    cancel();
    if (ms <= 0 || prefersReducedMotion()) {
      set(target);
      return;
    }
    const from = { ...cam.current };
    const t0 = performance.now();
    const step = (now: number) => {
      const p = Math.min(1, (now - t0) / ms);
      const e = ease(p);
      set({ x: from.x + (target.x - from.x) * e, y: from.y + (target.y - from.y) * e, k: from.k + (target.k - from.k) * e });
      fly.current = p < 1 ? requestAnimationFrame(step) : 0;
    };
    fly.current = requestAnimationFrame(step);
  }, [cancel, set]);

  const zoom = useCallback((f: number, inView?: Box) => {
    const v = inView ?? view();
    const c = cam.current;
    const cx = v.x + v.w / 2, cy = v.y + v.h / 2;
    const nk = Math.max(minK, Math.min(maxK, c.k * f));
    flyTo({ k: nk, x: cx - ((cx - c.x) * nk) / c.k, y: cy - ((cy - c.y) * nk) / c.k }, 300);
  }, [flyTo, view, minK, maxK]);

  // Wheel zoom around the cursor (native listener: React's wheel handler is passive and cannot preventDefault).
  useEffect(() => {
    const el = viewRef.current;
    if (!el) return;
    const onWheel = (ev: WheelEvent) => {
      if ((ev.target as HTMLElement | null)?.closest?.("[data-scroll]")) return;
      ev.preventDefault();
      cancel();
      const r = el.getBoundingClientRect();
      const c = cam.current;
      const mx = ev.clientX - r.left, my = ev.clientY - r.top;
      const dy = ev.deltaMode === 1 ? ev.deltaY * 16 : ev.deltaY;
      const nk = Math.max(minK, Math.min(maxK, c.k * Math.exp(-dy * 0.0015)));
      set({ k: nk, x: mx - ((mx - c.x) * nk) / c.k, y: my - ((my - c.y) * nk) / c.k });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [viewRef, cancel, set, minK, maxK]);

  // Cancel any fly on unmount.
  useEffect(() => cancel, [cancel]);

  /** Background drag = pan. Nodes, buttons, links and inputs opt out (data-node or interactive). */
  const onPointerDown = useCallback((ev: React.PointerEvent<HTMLDivElement>) => {
    if (ev.button !== 0 && ev.pointerType === "mouse") return;
    const target = ev.target as HTMLElement;
    if (target.closest("[data-node],button,a,input,textarea,select,[data-panel]")) return;
    cancel();
    const c0 = { ...cam.current };
    const x0 = ev.clientX, y0 = ev.clientY;
    let moved = false;
    const el = ev.currentTarget;
    const id = ev.pointerId;
    try {
      el.setPointerCapture(id);
    } catch {
      /* best-effort */
    }
    const mv = (e2: PointerEvent) => {
      if (e2.pointerId !== id) return;
      if (!moved && Math.hypot(e2.clientX - x0, e2.clientY - y0) < 4) return;
      moved = true;
      set({ ...c0, x: c0.x + e2.clientX - x0, y: c0.y + e2.clientY - y0 });
    };
    const up = (e2: PointerEvent) => {
      if (e2.pointerId !== id) return;
      el.removeEventListener("pointermove", mv);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
      if (!moved) bgClick.current?.();
    };
    el.addEventListener("pointermove", mv);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
  }, [cancel, set]);

  return { cam, set, fly: flyTo, zoom, view, cancel, onPointerDown, ss, zoomedIn, k };
}
