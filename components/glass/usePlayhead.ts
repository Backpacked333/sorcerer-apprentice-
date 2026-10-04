"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { prefersReducedMotion } from "@/lib/ui/motion";

export type Playhead = {
  t: number;
  /** Set t directly (drag / keyboard). Cancels a running play. */
  setT: (t: number) => void;
  playing: boolean;
  /** Play from the current t (or from the start when at the end) to the end; pauses when playing. */
  toggle: () => void;
  stop: () => void;
};

/**
 * rAF-driven playhead over [a, b]. Starts at the end ("today"). A full sweep takes `ms`.
 * Under prefers-reduced-motion, toggle() jumps straight to the end.
 */
export function usePlayhead(range: [number, number], ms = 7000): Playhead {
  const [a, b] = range;
  const [t, setTState] = useState(b);
  const [playing, setPlaying] = useState(false);
  const raf = useRef(0);
  const tRef = useRef(b);
  const prevEnd = useRef(b);

  const cancel = useCallback(() => {
    if (raf.current) cancelAnimationFrame(raf.current);
    raf.current = 0;
  }, []);

  const write = useCallback((v: number) => {
    tRef.current = v;
    setTState(v);
  }, []);

  // Range changes (data loaded / refreshed): follow the end if we were at it, otherwise clamp.
  useEffect(() => {
    const wasAtEnd = tRef.current >= prevEnd.current;
    prevEnd.current = b;
    const next = wasAtEnd ? b : Math.min(b, Math.max(a, tRef.current));
    if (next !== tRef.current) write(next);
  }, [a, b, write]);

  useEffect(() => cancel, [cancel]);

  const stop = useCallback(() => {
    cancel();
    setPlaying(false);
  }, [cancel]);

  const setT = useCallback(
    (v: number) => {
      cancel();
      setPlaying(false);
      write(Math.min(b, Math.max(a, v)));
    },
    [a, b, cancel, write],
  );

  const toggle = useCallback(() => {
    if (raf.current) {
      stop();
      return;
    }
    if (b <= a || prefersReducedMotion()) {
      setPlaying(false);
      write(b);
      return;
    }
    const start = tRef.current >= b ? a : tRef.current;
    const duration = Math.max(1, ms * ((b - start) / (b - a)));
    const t0 = performance.now();
    setPlaying(true);
    write(start);
    const step = (now: number) => {
      const p = Math.min(1, (now - t0) / duration);
      write(start + (b - start) * p);
      if (p < 1) raf.current = requestAnimationFrame(step);
      else {
        raf.current = 0;
        setPlaying(false);
      }
    };
    raf.current = requestAnimationFrame(step);
  }, [a, b, ms, stop, write]);

  return { t, setT, playing, toggle, stop };
}
