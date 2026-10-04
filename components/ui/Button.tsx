"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "danger" | "ghost";

export function Button({
  variant = "secondary",
  loading,
  pressed,
  className = "",
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; loading?: boolean; pressed?: boolean; children?: ReactNode }) {
  const tone = variant === "primary" ? "btn btn-primary" : variant === "danger" ? "btn btn-danger" : variant === "ghost" ? "btn btn-ghost" : "btn";
  const { disabled, ...restProps } = rest;
  return (
    <button {...restProps} className={`${tone} ${className}`} aria-pressed={pressed} aria-busy={loading || undefined} disabled={!!loading || !!disabled}>
      {loading ? <span className="btn-spin" aria-hidden /> : null}
      {children}
    </button>
  );
}
