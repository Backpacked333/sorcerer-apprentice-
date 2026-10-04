"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { GlassButton, type GlassButtonSize, type GlassButtonVariant } from "@/components/glass/GlassButton";

type Variant = "primary" | "secondary" | "danger" | "ghost";

const TO_GLASS: Record<Variant, GlassButtonVariant> = {
  primary: "amber",
  secondary: "glass",
  danger: "danger",
  ghost: "ghost",
};

/**
 * Backwards-compatible button: same props as before (`variant`, `loading`, `pressed`, native props),
 * rendered as a light glass pill. `loading` still disables the button and sets `aria-busy`.
 * `glass` lets a caller pick a GlassButton variant directly (e.g. "green"); `size` defaults to 40.
 */
export function Button({
  variant = "secondary",
  glass,
  size = 40,
  loading,
  pressed,
  className = "",
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  glass?: GlassButtonVariant;
  size?: GlassButtonSize;
  loading?: boolean;
  pressed?: boolean;
  children?: ReactNode;
}) {
  const { disabled, ...restProps } = rest;
  return (
    <GlassButton
      {...restProps}
      variant={glass ?? TO_GLASS[variant]}
      size={size}
      pressed={pressed}
      loading={loading}
      disabled={!!loading || !!disabled}
      className={className}
    >
      {children}
    </GlassButton>
  );
}
