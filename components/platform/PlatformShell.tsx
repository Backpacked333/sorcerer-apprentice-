"use client";
// Shared platform chrome: page wash, DEMO banner (demo mode only), the glass sidebar (platform report §1.1) and
// the content area that slides right when the sidebar is pinned open. Sidebar default open state is measured in
// a layout effect (server renders it closed), so there is no hydration mismatch.
import Link from "next/link";
import { createContext, useCallback, useContext, useLayoutEffect, useMemo, useState, type ReactNode } from "react";
import { DemoBanner } from "@/components/glass";
import type { PlatformData, RoleNode } from "@/lib/platform/types";

export type ShellActive = { page: "map" | "memory" | "ontology" | "sessions"; roleId?: string | null };

type ShellCtx = { open: boolean; toggle: () => void; narrow: boolean; mode: PlatformData["mode"]; base: string };
const Ctx = createContext<ShellCtx>({ open: false, toggle: () => {}, narrow: false, mode: "real", base: "/platform" });
export const useShell = () => useContext(Ctx);

const WASH: Record<string, string> = {
  map: "none",
  memory:
    "radial-gradient(45% 40% at 30% 20%,rgba(255,205,230,.35),transparent),radial-gradient(40% 40% at 80% 60%,rgba(185,220,255,.38),transparent),radial-gradient(30% 30% at 60% 100%,rgba(255,232,180,.3),transparent)",
  ontology:
    "radial-gradient(45% 40% at 35% 35%,rgba(255,205,230,.3),transparent),radial-gradient(40% 40% at 75% 70%,rgba(185,220,255,.34),transparent),radial-gradient(30% 30% at 85% 12%,rgba(255,232,180,.3),transparent)",
  sessions:
    "radial-gradient(45% 40% at 30% 20%,rgba(255,205,230,.3),transparent),radial-gradient(40% 40% at 80% 60%,rgba(185,220,255,.32),transparent)",
};

const SIDEBAR_W = 240;

export function PlatformShell({
  data,
  active,
  openAt = 1600,
  scroll = false,
  children,
}: {
  data: PlatformData;
  active: ShellActive;
  /** viewport width from which the sidebar starts pinned open */
  openAt?: number;
  /** true: the content area scrolls (Role Memory, Sessions); false: fixed canvas */
  scroll?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [narrow, setNarrow] = useState(false);
  const base = data.mode === "demo" ? "/platform/demo" : "/platform";

  useLayoutEffect(() => {
    const w = window.innerWidth;
    setNarrow(w < 900);
    setOpen(w >= openAt);
    const onResize = () => setNarrow(window.innerWidth < 900);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [openAt]);

  const toggle = useCallback(() => setOpen((v) => !v), []);
  const ctx = useMemo(() => ({ open, toggle, narrow, mode: data.mode, base }), [open, toggle, narrow, data.mode, base]);
  const pinned = open && !narrow;

  return (
    <Ctx.Provider value={ctx}>
      <div style={{ position: "fixed", inset: 0, display: "flex", flexDirection: "column", background: "#f4f4f7", color: "#1d1d1f", overflow: "hidden" }}>
        {data.mode === "demo" ? <DemoBanner text={`Demo data — ${data.company.name}. Nothing here was learned by Tacit.`} href="/platform" /> : null}
        <div style={{ position: "relative", flex: 1, minHeight: 0 }}>
          <div aria-hidden style={{ position: "absolute", inset: 0, background: WASH[active.page], pointerEvents: "none" }} />
          <div
            data-scroll={scroll ? "" : undefined}
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              right: 0,
              left: pinned ? SIDEBAR_W + 24 : 0,
              transition: "left .4s cubic-bezier(.3,1,.4,1)",
              overflowY: scroll ? "auto" : "hidden",
              overflowX: "hidden",
            }}
          >
            {children}
          </div>
          {open && narrow ? (
            <div aria-hidden onClick={toggle} style={{ position: "absolute", inset: 0, zIndex: 19, background: "rgba(20,20,30,.12)", animation: "tc-fade .25s both" }} />
          ) : null}
          <Sidebar data={data} active={active} open={open} base={base} onNavigate={narrow ? toggle : undefined} />
        </div>
      </div>
    </Ctx.Provider>
  );
}

/** 44×44 round sidebar toggle; pages put it first in their top bar. */
export function SidebarToggle() {
  const { open, toggle } = useShell();
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={open ? "Hide sidebar" : "Show sidebar"}
      aria-expanded={open}
      className="glass-nav flex-none cursor-pointer active:scale-[.94] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgba(245,166,35,.75)]"
      style={{ width: 44, height: 44, borderRadius: 22, display: "inline-flex", alignItems: "center", justifyContent: "center", color: "#1d1d1f", transition: "scale .25s var(--ease-press)" }}
    >
      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="2" y="3" width="14" height="12" rx="3" />
        <path d="M7 3v12" />
      </svg>
    </button>
  );
}

function dotStyle(r: RoleNode, riskLens: boolean): React.CSSProperties {
  const ring = (c: string) => ({ background: "#fff", boxShadow: `inset 0 0 0 1.5px ${c}` });
  if (riskLens && r.risk && r.status !== "captured") return { background: "#f0642f", animation: "tc-dotpulse 1.8s ease-in-out infinite" };
  switch (r.status) {
    case "captured":
      return { background: "#22b45e", boxShadow: "0 0 6px rgba(34,180,94,.6)" };
    case "in_debrief":
      return { background: "#f5a623" };
    case "capturing":
      return { background: "#f5a623", animation: "tc-dotpulse 1.8s ease-in-out infinite" };
    case "mentioned":
      return ring("#f5a623");
    case "inferred":
      return ring("#8f7bff");
    default:
      return ring("#aeaeb2");
  }
}

function roleOrder(r: RoleNode): number {
  if (r.isMain) return 0;
  return { captured: 1, in_debrief: 2, capturing: 3, mentioned: 4, inferred: 5, seen: 6, not_captured: 7, mapped: 8 }[r.status] ?? 9;
}

function Sidebar({ data, active, open, base, onNavigate }: { data: PlatformData; active: ShellActive; open: boolean; base: string; onNavigate?: () => void }) {
  const [showAll, setShowAll] = useState(false);
  const [showExports, setShowExports] = useState(false);
  const roles = useMemo(() => [...data.roles].sort((a, b) => roleOrder(a) - roleOrder(b) || a.at - b.at), [data.roles]);
  const LIMIT = 5;
  const activeIdx = roles.findIndex((r) => r.id === active.roleId);
  const shown = showAll ? roles : roles.slice(0, Math.max(LIMIT, activeIdx + 1));
  const more = roles.length - shown.length;
  const riskLens = data.features.riskLens;

  const item = (activeNow: boolean): React.CSSProperties => ({
    display: "flex",
    alignItems: "center",
    gap: 10,
    minHeight: 40,
    padding: "6px 10px",
    borderRadius: 14,
    textDecoration: "none",
    color: "#1d1d1f",
    background: activeNow ? "rgba(255,255,255,.85)" : "transparent",
    boxShadow: activeNow ? "0 1px 3px rgba(0,0,0,.08),0 0 0 .5px rgba(0,0,0,.05)" : "none",
    transition: "background .2s",
  });

  return (
    <nav
      aria-label="Platform"
      aria-hidden={!open}
      inert={!open}
      style={{
        position: "absolute",
        top: 12,
        left: 12,
        bottom: 12,
        width: SIDEBAR_W,
        zIndex: 20,
        display: "flex",
        flexDirection: "column",
        padding: "18px 12px 14px",
        boxSizing: "border-box",
        borderRadius: 24,
        background: "linear-gradient(180deg,rgba(255,255,255,.86),rgba(255,255,255,.66))",
        backdropFilter: "blur(24px) saturate(1.8)",
        WebkitBackdropFilter: "blur(24px) saturate(1.8)",
        boxShadow: "inset 0 1px 0 #fff,0 0 0 .5px rgba(0,0,0,.07),0 10px 30px rgba(15,23,42,.06)",
        transform: open ? "none" : `translateX(-${SIDEBAR_W + 24}px)`,
        opacity: open ? 1 : 0,
        transition: "transform .4s cubic-bezier(.3,1,.4,1), opacity .3s",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 8px" }}>
        <Link href="/" onClick={onNavigate} style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "#1d1d1f", textDecoration: "none" }}>
          <span aria-hidden style={{ width: 12, height: 12, borderRadius: 3, background: "#f5a623" }} />
          <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-.01em" }}>Tacit</span>
          <span style={{ fontSize: 15, color: "#8e8e93" }}>Platform</span>
        </Link>
        {data.mode === "demo" ? (
          <span style={{ marginLeft: "auto", height: 20, padding: "0 7px", borderRadius: 10, fontSize: 10.5, fontWeight: 700, letterSpacing: ".1em", color: "#6a55d8", background: "rgba(143,123,255,.14)", display: "inline-flex", alignItems: "center" }}>
            DEMO
          </span>
        ) : null}
      </div>

      <div style={{ margin: "14px 0 10px", padding: "7px 10px", borderRadius: 12, background: "rgba(255,255,255,.7)", boxShadow: "inset 0 0 0 .5px rgba(0,0,0,.08)" }}>
        <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{data.company.name}</div>
        <div style={{ fontSize: 11.5, color: "#8e8e93" }}>{data.company.sub}</div>
      </div>

      <div data-scroll="" style={{ flex: 1, minHeight: 0, overflowY: "auto", margin: "0 -4px", padding: "0 4px" }}>
        <Link href={base} onClick={onNavigate} style={item(active.page === "map")} aria-current={active.page === "map" ? "page" : undefined}>
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.4">
            <circle cx="3.5" cy="3.5" r="2" /><circle cx="12.5" cy="3.5" r="2" /><circle cx="8" cy="12.5" r="2" />
            <path d="M5 4.6 7 11M11 4.6 9 11M5.5 3.5h5" />
          </svg>
          <span style={{ fontSize: 14 }}>Company map</span>
        </Link>

        <div style={{ margin: "16px 10px 6px", fontSize: 11, fontWeight: 600, color: "#8e8e93" }}>Roles</div>
        {roles.length === 0 ? (
          <p style={{ margin: "0 10px", fontSize: 12.5, color: "#8e8e93", lineHeight: 1.45 }}>Only roles Tacit has captured or heard named appear here.</p>
        ) : null}
        {shown.map((r) => {
          const isActive = r.id === active.roleId;
          const href = r.memoryHref ?? `${base}?role=${encodeURIComponent(r.id)}`;
          const sub = r.risk && riskLens ? r.risk.note : r.people.length ? r.people.map((p) => p.name).slice(0, 3).join(" · ") : r.statusLabel;
          return (
            <div key={r.id}>
              <Link href={href} onClick={onNavigate} style={{ ...item(isActive && active.page !== "map"), alignItems: "flex-start", minHeight: 44 }}>
                <span aria-hidden style={{ width: 8, height: 8, borderRadius: 4, flex: "none", marginTop: 6, ...dotStyle(r, riskLens) }} />
                <span style={{ minWidth: 0 }}>
                  <span style={{ fontSize: 14, lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" } as React.CSSProperties}>{r.title}</span>
                  <span style={{ display: "block", fontSize: 11.5, color: r.risk && riskLens ? "#b4501f" : "#8e8e93", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{sub}</span>
                </span>
              </Link>
              {isActive && (r.memoryHref || r.ontologyHref) ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 2, margin: "2px 0 4px" }}>
                  {r.memoryHref ? (
                    <Link href={r.memoryHref} onClick={onNavigate} style={subLink(active.page === "memory")} aria-current={active.page === "memory" ? "page" : undefined}>Memory</Link>
                  ) : null}
                  {r.ontologyHref ? (
                    <Link href={r.ontologyHref} onClick={onNavigate} style={subLink(active.page === "ontology")} aria-current={active.page === "ontology" ? "page" : undefined}>Ontology</Link>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
        {more > 0 ? (
          <button type="button" onClick={() => setShowAll(true)} style={{ ...subLink(false), border: 0, background: "transparent", cursor: "pointer", textAlign: "left", width: "100%", paddingLeft: 28 }}>
            {more} more role{more === 1 ? "" : "s"}
          </button>
        ) : null}

        <div style={{ margin: "16px 10px 6px", fontSize: 11, fontWeight: 600, color: "#8e8e93" }}>Library</div>
        {data.mode === "real" ? (
          <Link href="/platform/sessions" onClick={onNavigate} style={item(active.page === "sessions")} aria-current={active.page === "sessions" ? "page" : undefined}>
            <span style={{ fontSize: 14, flex: 1 }}>Sessions</span>
            <span style={{ fontSize: 12, color: "#8e8e93", fontVariantNumeric: "tabular-nums" }}>{data.sessionsCount}</span>
          </Link>
        ) : (
          <div style={item(false)}>
            <span style={{ fontSize: 14, flex: 1 }}>Sessions</span>
            <span style={{ fontSize: 12, color: "#8e8e93", fontVariantNumeric: "tabular-nums" }}>{data.sessionsCount}</span>
          </div>
        )}
        {data.mode === "real" ? (
          <>
            <button
              type="button"
              onClick={() => setShowExports((v) => !v)}
              aria-expanded={showExports}
              style={{ ...item(false), width: "100%", border: 0, cursor: "pointer", font: "inherit", textAlign: "left" }}
            >
              <span style={{ fontSize: 14, flex: 1 }}>Exports for agents</span>
              <span aria-hidden style={{ fontSize: 11, color: "#8e8e93", transform: showExports ? "rotate(180deg)" : "none", transition: "transform .25s" }}>⌄</span>
            </button>
            {showExports ? (
              <div style={{ padding: "2px 10px 6px", animation: "tc-rise .35s var(--ease-rise) both" }}>
                {data.exports.length === 0 ? (
                  <p style={{ margin: 0, fontSize: 12.5, color: "#8e8e93" }}>No confirmed map yet. Exports appear once an expert confirms a map.</p>
                ) : (
                  data.exports.map((x) => (
                    <div key={x.sessionId} style={{ padding: "6px 0", borderTop: ".5px solid rgba(0,0,0,.06)" }}>
                      <div style={{ fontSize: 12.5, color: "#3a3a3c", lineHeight: 1.35 }}>{x.label}</div>
                      <div style={{ display: "flex", gap: 10, marginTop: 3, fontSize: 12.5 }}>
                        <a href={x.policy} style={{ color: "#a35f00" }}>policy.json</a>
                        <a href={x.sop} style={{ color: "#a35f00" }}>SOP</a>
                        <a href={x.prompt} style={{ color: "#a35f00" }}>prompt</a>
                      </div>
                    </div>
                  ))
                )}
              </div>
            ) : null}
          </>
        ) : null}
      </div>

      {data.live ? (
        <Link
          href={data.live.href}
          onClick={onNavigate}
          style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, height: 38, padding: "0 12px", borderRadius: 19, textDecoration: "none", color: "#1d1d1f", fontSize: 13, background: "rgba(255,255,255,.75)", boxShadow: "inset 0 0 0 .5px rgba(0,0,0,.08)" }}
        >
          <span aria-hidden style={{ width: 8, height: 8, borderRadius: 4, background: "#22b45e", animation: "tc-dotpulse 1.8s ease-in-out infinite" }} />
          <span style={{ flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{data.live.label}</span>
          <span aria-hidden style={{ color: "#8e8e93" }}>↗</span>
        </Link>
      ) : null}
    </nav>
  );
}

function subLink(on: boolean): React.CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    minHeight: 30,
    padding: "0 10px 0 36px",
    borderRadius: 10,
    fontSize: 13.5,
    fontWeight: on ? 600 : 400,
    color: on ? "#1d1d1f" : "#6e6e73",
    textDecoration: "none",
    background: on ? "rgba(255,255,255,.7)" : "transparent",
  };
}
