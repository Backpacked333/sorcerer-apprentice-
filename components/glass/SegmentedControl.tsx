"use client";

import { useCallback, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";

export type SegmentedControlProps = {
  options: { value: string; label: string; dot?: string }[];
  value: string;
  onChange: (v: string) => void;
  ariaLabel: string;
};

type Ind = { x: number; w: number } | null;

/** Glass segmented control (dock tabs) with a sliding white indicator. */
export function SegmentedControl({ options, value, onChange, ariaLabel }: SegmentedControlProps) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const btnRefs = useRef(new Map<string, HTMLButtonElement>());
  const [ind, setInd] = useState<Ind>(null);
  const [animate, setAnimate] = useState(false);

  const measure = useCallback(() => {
    const b = btnRefs.current.get(value);
    if (!b) return setInd(null);
    setInd((prev) => (prev && prev.x === b.offsetLeft && prev.w === b.offsetWidth ? prev : { x: b.offsetLeft, w: b.offsetWidth }));
  }, [value]);

  useLayoutEffect(() => {
    measure();
  }, [measure, options]);

  useLayoutEffect(() => {
    if (!ind || animate) return;
    // Enable the slide only after the first placement, so the indicator never flies in from 0.
    const id = requestAnimationFrame(() => setAnimate(true));
    return () => cancelAnimationFrame(id);
  }, [ind, animate]);

  useLayoutEffect(() => {
    const el = trackRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => measure());
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure]);

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = options.findIndex((o) => o.value === value);
    let n = -1;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") n = (i + 1) % options.length;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") n = (i - 1 + options.length) % options.length;
    else if (e.key === "Home") n = 0;
    else if (e.key === "End") n = options.length - 1;
    if (n < 0 || !options[n]) return;
    e.preventDefault();
    onChange(options[n].value);
    btnRefs.current.get(options[n].value)?.focus();
  };

  return (
    <div
      ref={trackRef}
      role="radiogroup"
      aria-label={ariaLabel}
      onKeyDown={onKey}
      style={{ position: "relative", display: "inline-flex", padding: 3, borderRadius: 17, background: "rgba(0,0,0,.05)", maxWidth: "100%" }}
    >
      <span
        aria-hidden
        style={{
          position: "absolute",
          top: 3,
          left: 0,
          height: 30,
          width: ind?.w ?? 0,
          borderRadius: 15,
          background: "#fff",
          boxShadow: "0 1px 3px rgba(0,0,0,.12),0 0 0 .5px rgba(0,0,0,.05)",
          transform: `translateX(${ind?.x ?? 0}px)`,
          opacity: ind ? 1 : 0,
          transition: animate ? "transform .45s var(--ease-spring, cubic-bezier(.2,1.12,.3,1)), width .45s var(--ease-spring, cubic-bezier(.2,1.12,.3,1))" : "none",
          pointerEvents: "none",
        }}
      />
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            ref={(el) => {
              if (el) btnRefs.current.set(o.value, el);
              else btnRefs.current.delete(o.value);
            }}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(o.value)}
            className="focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#a35f00]"
            style={{
              position: "relative",
              zIndex: 1,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              height: 30,
              padding: "0 13px",
              borderRadius: 15,
              fontSize: 13,
              fontWeight: 500,
              lineHeight: 1,
              whiteSpace: "nowrap",
              cursor: "pointer",
              color: active ? "#1d1d1f" : "#3a3a3c",
              // Until the indicator is measured, the active tab paints its own white so SSR never looks unselected.
              background: active && !ind ? "#fff" : "transparent",
              boxShadow: active && !ind ? "0 1px 3px rgba(0,0,0,.12),0 0 0 .5px rgba(0,0,0,.05)" : "none",
              transition: "color .3s",
            }}
          >
            {o.dot ? <span aria-hidden style={{ width: 7, height: 7, borderRadius: "50%", background: o.dot, flex: "none" }} /> : null}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
