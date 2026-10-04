"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";

export type GlassButtonVariant = "glass" | "amber" | "green" | "danger" | "ghost";
export type GlassButtonSize = 30 | 34 | 40 | 44;

export type GlassButtonProps = {
  variant?: GlassButtonVariant;
  size?: GlassButtonSize;
  pressed?: boolean;
  loading?: boolean;
} & ButtonHTMLAttributes<HTMLButtonElement>;

const SIZE: Record<GlassButtonSize, { h: number; px: number; fs: number }> = {
  30: { h: 30, px: 13, fs: 12.5 },
  34: { h: 34, px: 14, fs: 12.5 },
  40: { h: 40, px: 16, fs: 13 },
  44: { h: 44, px: 18, fs: 13.5 },
};

// Exact recipes from design §1.5 / §3.2 / §6. Backgrounds live in classes so :hover can swap them.
const VARIANT: Record<GlassButtonVariant, string> = {
  glass:
    "text-[#1d1d1f] font-medium bg-[rgba(255,255,255,.45)] shadow-[inset_0_0_0_.5px_rgba(0,0,0,.07)] hover:bg-[rgba(255,255,255,.85)] enabled:hover:-translate-y-px",
  amber:
    "text-[#6b3f00] font-semibold bg-[linear-gradient(180deg,rgba(255,222,160,.75),rgba(255,196,95,.5))] shadow-[inset_0_1px_0_rgba(255,255,255,.8),inset_0_0_0_.5px_rgba(200,120,0,.18)] enabled:hover:-translate-y-px enabled:hover:shadow-[inset_0_1px_0_rgba(255,255,255,.8),inset_0_0_0_.5px_rgba(200,120,0,.25),0_6px_16px_rgba(245,166,35,.28)]",
  green:
    "text-[#0d4a2b] font-semibold bg-[linear-gradient(180deg,rgba(196,244,216,.9),rgba(140,226,178,.62))] shadow-[inset_0_1px_0_rgba(255,255,255,.8),inset_0_0_0_.5px_rgba(20,130,70,.2)] enabled:hover:-translate-y-px enabled:hover:shadow-[inset_0_1px_0_rgba(255,255,255,.8),inset_0_0_0_.5px_rgba(20,130,70,.28),0_6px_16px_rgba(34,180,94,.26)]",
  danger:
    "text-[#c9342f] font-medium bg-[rgba(255,255,255,.5)] shadow-[inset_0_0_0_.5px_rgba(0,0,0,.07)] hover:bg-[rgba(255,236,236,.9)] enabled:hover:-translate-y-px",
  ghost: "text-[#3a3a3c] font-medium bg-transparent hover:bg-[rgba(0,0,0,.05)]",
};

const PRESSED: Record<GlassButtonVariant, string> = {
  glass: "bg-[rgba(255,255,255,.92)] shadow-[inset_0_0_0_.5px_rgba(0,0,0,.1),0_1px_3px_rgba(0,0,0,.1)]",
  amber: "shadow-[inset_0_1px_0_rgba(255,255,255,.8),inset_0_0_0_1px_rgba(200,120,0,.35)]",
  green: "shadow-[inset_0_1px_0_rgba(255,255,255,.8),inset_0_0_0_1px_rgba(20,130,70,.35)]",
  danger: "bg-[rgba(255,236,236,.95)] shadow-[inset_0_0_0_.5px_rgba(201,52,47,.3)]",
  ghost: "bg-[rgba(0,0,0,.07)]",
};

const BASE =
  "relative inline-flex items-center justify-center gap-1.5 whitespace-nowrap select-none cursor-pointer " +
  "active:scale-95 disabled:active:scale-100 disabled:opacity-50 disabled:cursor-not-allowed " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a35f00]";

const TRANSITION =
  "scale .25s var(--ease-press, cubic-bezier(.3,1.6,.5,1)), translate .25s var(--ease-press, cubic-bezier(.3,1.6,.5,1)), background-color .2s, box-shadow .2s, opacity .2s";

/** Liquid-glass pill button. No infinite animation on the button itself (smoke actionability). */
export const GlassButton = forwardRef<HTMLButtonElement, GlassButtonProps>(function GlassButton(
  { variant = "glass", size = 34, pressed, loading, className, style, type, children, disabled, ...rest },
  ref,
) {
  const s = SIZE[size];
  return (
    <button
      ref={ref}
      type={type ?? "button"}
      aria-pressed={pressed === undefined ? undefined : pressed}
      aria-busy={loading || undefined}
      disabled={disabled}
      className={`${BASE} ${VARIANT[variant]} ${pressed ? PRESSED[variant] : ""} ${className ?? ""}`}
      style={{ height: s.h, minHeight: s.h, padding: `0 ${s.px}px`, borderRadius: s.h / 2, fontSize: s.fs, lineHeight: 1, transition: TRANSITION, ...style }}
      {...rest}
    >
      {loading ? (
        <span
          aria-hidden
          style={{
            width: 11,
            height: 11,
            flex: "none",
            borderRadius: "50%",
            border: "1.75px solid currentColor",
            borderRightColor: "transparent",
            opacity: 0.7,
            animation: "tc-spin .8s linear infinite",
            pointerEvents: "none",
          }}
        />
      ) : null}
      {children}
    </button>
  );
});
