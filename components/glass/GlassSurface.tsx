"use client";
// Liquid-glass surfaces (design §3.2). Recipes live in app/globals.css (.glass-*);
// GLASS mirrors them for callers that need inline values.
import { createElement, type CSSProperties, type JSX, type ReactNode } from "react";
import { IridescentRim } from "./IridescentRim";

export type GlassVariant = "companion" | "panel" | "inspector" | "sidebar" | "nav" | "chip" | "dock";

interface Recipe {
  background: string;
  backdrop?: string;
  shadow: string;
  radius: number;
}

export const GLASS: Record<GlassVariant, Recipe> = {
  companion: {
    background: "linear-gradient(180deg,rgba(255,255,255,.62),rgba(255,255,255,.4))",
    backdrop: "blur(30px) saturate(1.9)",
    shadow: "inset 0 1px 0 rgba(255,255,255,.95),inset 0 -.5px 0 rgba(255,255,255,.5),0 1px 2px rgba(15,23,42,.05),0 20px 50px rgba(15,23,42,.11)",
    radius: 30,
  },
  panel: {
    background: "linear-gradient(180deg,rgba(255,255,255,.8),rgba(255,255,255,.55))",
    backdrop: "blur(20px)",
    shadow: "inset 0 1px 0 #fff,0 0 0 .5px rgba(0,0,0,.06),0 12px 36px rgba(15,23,42,.05)",
    radius: 24,
  },
  inspector: {
    background: "linear-gradient(180deg,rgba(255,255,255,.7),rgba(255,255,255,.45))",
    backdrop: "blur(20px)",
    shadow: "inset 0 1px 0 #fff,0 0 0 .5px rgba(0,0,0,.06),0 20px 50px rgba(15,23,42,.08)",
    radius: 28,
  },
  sidebar: {
    background: "linear-gradient(180deg,rgba(244,245,248,.95),rgba(238,240,244,.85))",
    shadow: "inset 0 1px 0 #fff,0 0 0 .5px rgba(0,0,0,.07)",
    radius: 24,
  },
  nav: {
    background: "linear-gradient(180deg,rgba(255,255,255,.72),rgba(255,255,255,.5))",
    backdrop: "blur(24px) saturate(1.8)",
    shadow: "inset 0 1px 0 #fff,0 0 0 .5px rgba(0,0,0,.07),0 10px 30px rgba(15,23,42,.06)",
    radius: 26,
  },
  chip: {
    background: "rgba(255,255,255,.7)",
    backdrop: "blur(14px) saturate(1.8)",
    shadow: "inset 0 1px 0 #fff,0 0 0 .5px rgba(0,0,0,.08),0 8px 20px rgba(15,23,42,.12)",
    radius: 14,
  },
  dock: {
    background: "linear-gradient(180deg,rgba(255,255,255,.7),rgba(255,255,255,.45))",
    backdrop: "blur(20px) saturate(1.8)",
    shadow: "inset 0 1px 0 #fff,0 0 0 .5px rgba(0,0,0,.08),0 8px 24px rgba(15,23,42,.08)",
    radius: 22,
  },
};

/** Inline style for a glass recipe (for callers that cannot use the component). */
export function glassStyle(variant: GlassVariant, radius?: number | string): CSSProperties {
  const g = GLASS[variant];
  return {
    background: g.background,
    backdropFilter: g.backdrop,
    WebkitBackdropFilter: g.backdrop,
    boxShadow: g.shadow,
    borderRadius: radius ?? g.radius,
  };
}

type GlassSurfaceProps = {
  variant: GlassVariant;
  radius?: number | string;
  rim?: { colors?: string[]; opacity?: number; speed?: number } | false;
  as?: keyof JSX.IntrinsicElements;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
} & { [k: `data-${string}`]: string | undefined };

export function GlassSurface(p: GlassSurfaceProps) {
  const { variant, radius, rim, as = "div", className, style, children, ...rest } = p;
  const r = radius ?? GLASS[variant].radius;
  const data: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(rest)) if (k.startsWith("data-")) data[k] = v as string | undefined;
  return createElement(
    as,
    {
      ...data,
      className: [`glass-${variant}`, className].filter(Boolean).join(" "),
      // Recipe comes from the .glass-* class in app/globals.css (keeps its no-backdrop fallback).
      style: { position: "relative", borderRadius: r, ...style },
    },
    children,
    rim ? <IridescentRim key="__rim" radius={r} colors={rim.colors} opacity={rim.opacity} speed={rim.speed} /> : null,
  );
}
