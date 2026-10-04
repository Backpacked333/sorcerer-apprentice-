"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { OccluderProvider, useOccluder } from "@/components/glass/occluders";

export interface WorkspaceFrame {
  /** The live ERP iframe (null until mounted; changes when `reloadKey` remounts it). */
  iframe: HTMLIFrameElement | null;
  /** The stable wrapper around the iframe: the crop target, full width under the overlay. */
  frame: HTMLDivElement | null;
}

const FrameCtx = createContext<WorkspaceFrame>({ iframe: null, frame: null });

/** For overlay and companion code inside a Workspace: measure ERP targets (same-origin iframe). */
export function useWorkspaceFrame(): WorkspaceFrame {
  return useContext(FrameCtx);
}

export interface WorkspaceProps {
  erpSrc: string;
  erpTitle?: string;
  locked?: boolean;
  lockedHint?: string;
  reloadKey?: string | number;
  /** Receives the stable frame wrapper (crop target), e.g. `vm.pipeline.setCropTarget`. */
  onFrameElement?: (el: HTMLElement | null) => void;
  /** Every floating Tacit surface registered through `useOccluder` (forward to `pipeline.setOccluders`). */
  onOccluders?: (els: HTMLElement[]) => void;
  presenter?: boolean;
  /** Over-ERP layer (halo, cable, chips). Pointer-events none. */
  overlay?: ReactNode;
  /** The floating companion, fixed bottom-right. Sizes itself (e.g. CompanionCard). */
  companion?: ReactNode;
  /** Legacy: a full-height side column. Rendered in a floating glass sheet that scrolls internally. */
  children?: ReactNode;
}

const SLOT_GAP = 28;
/** Widest floating card (ask / teach mode) + the slot gap + a 16 px breathing gap. Constant, so the ERP never reflows on a mood change. */
const RESERVE_W = 404 + SLOT_GAP + 16;

/**
 * Keeps the embedded app's content clear of the floating card (same-origin iframe only):
 * `--tacit-reserve-w` lets the lower blocks (queue table, line items, approval) end left of the card, and
 * `--tacit-reserve-h` (card height + gaps) pads the page bottom and sets scroll-padding, so anything still
 * under the card can be scrolled, or focused, clear of it. Growth applies at once; shrinking waits for the
 * height spring to settle, so the page does not jump while the card animates.
 */
function useEmbeddedReserve(iframe: HTMLIFrameElement | null, slot: HTMLElement | null, active: boolean) {
  useEffect(() => {
    if (!iframe || !slot || !active) return;
    let h = 0;
    let shrinkTimer = 0;
    // Injected as a <style> in the embedded <head> (never as attributes on its <html>, which React hydrates).
    const apply = () => {
      try {
        const doc = iframe.contentDocument;
        if (!doc?.head) return;
        let el = doc.getElementById("tacit-reserve");
        if (!el) {
          el = doc.createElement("style");
          el.id = "tacit-reserve";
          doc.head.appendChild(el);
        }
        el.textContent = `:root{--tacit-reserve-w:${RESERVE_W}px;--tacit-reserve-h:${h}px;scroll-padding-bottom:${h}px;scrollbar-gutter:stable}`;
      } catch {
        /* not same-origin: nothing to reserve */
      }
    };
    const measure = () => {
      const next = Math.ceil(slot.getBoundingClientRect().height) + SLOT_GAP + 16;
      if (next >= h) {
        window.clearTimeout(shrinkTimer);
        if (next !== h) {
          h = next;
          apply();
        }
      } else {
        window.clearTimeout(shrinkTimer);
        shrinkTimer = window.setTimeout(() => {
          h = Math.ceil(slot.getBoundingClientRect().height) + SLOT_GAP + 16;
          apply();
        }, 750);
      }
    };
    measure();
    apply();
    iframe.addEventListener("load", apply);
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    ro?.observe(slot);
    return () => {
      window.clearTimeout(shrinkTimer);
      iframe.removeEventListener("load", apply);
      ro?.disconnect();
      try {
        iframe.contentDocument?.getElementById("tacit-reserve")?.remove();
      } catch {
        /* ignore */
      }
    };
  }, [iframe, slot, active]);
}

/**
 * Full-width ERP with Tacit floating over it.
 * Layers: frame (crop target, iframe inside) → lock scrim → overlay → companion slot (fixed).
 */
export function Workspace({
  erpSrc,
  erpTitle = "Sandbox ERP",
  locked = false,
  lockedHint = "Start the session to begin",
  reloadKey = "erp",
  onFrameElement,
  onOccluders,
  presenter,
  overlay,
  companion,
  children,
}: WorkspaceProps) {
  const [frame, setFrame] = useState<HTMLDivElement | null>(null);
  const [iframe, setIframe] = useState<HTMLIFrameElement | null>(null);
  const frameRef = useCallback(
    (el: HTMLDivElement | null) => {
      setFrame(el);
      onFrameElement?.(el);
    },
    [onFrameElement],
  );
  const ctx = useMemo<WorkspaceFrame>(() => ({ iframe, frame }), [iframe, frame]);
  const legacy = companion == null && children != null;
  const [slot, setSlot] = useState<HTMLDivElement | null>(null);
  useEmbeddedReserve(iframe, slot, !legacy);

  return (
    <OccluderProvider onChange={onOccluders}>
      <FrameCtx.Provider value={ctx}>
        <div
          className={`workspace workspace-float${presenter ? " presenter" : ""}`}
          style={{ display: "block", position: "relative", height: "100dvh", overflow: "hidden", background: "#f2f4f7" }}
        >
          <div
            ref={frameRef}
            className="workspace-frame"
            inert={locked || undefined}
            style={{ position: "absolute", inset: 0, isolation: "isolate" }}
          >
            <iframe
              key={reloadKey}
              ref={setIframe}
              src={erpSrc}
              title={erpTitle}
              style={{ display: "block", width: "100%", height: "100%", border: 0, background: "#f2f4f7" }}
            />
          </div>

          {locked && (
            <div
              className="workspace-scrim"
              data-testid="workspace-lock"
              style={{
                position: "absolute",
                inset: 0,
                zIndex: 3,
                display: "grid",
                placeItems: "center",
                background: "rgba(244,244,247,.42)",
                backdropFilter: "blur(3px) saturate(1.15)",
                WebkitBackdropFilter: "blur(3px) saturate(1.15)",
                cursor: "not-allowed",
              }}
            >
              <span
                className="inline-flex items-center gap-2"
                style={{
                  height: 44,
                  padding: "0 20px 0 16px",
                  borderRadius: 22,
                  fontSize: 14,
                  fontWeight: 500,
                  color: "#3a3a3c",
                  background: "linear-gradient(180deg,rgba(255,255,255,.86),rgba(255,255,255,.64))",
                  boxShadow: "inset 0 1px 0 #fff, 0 0 0 .5px rgba(0,0,0,.07), 0 10px 30px rgba(15,23,42,.08)",
                  animation: "tc-rise .55s var(--ease-rise, cubic-bezier(.2,.9,.3,1)) both",
                }}
              >
                <svg aria-hidden width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#8e8e93" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="5" y="11" width="14" height="10" rx="2" />
                  <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                </svg>
                {lockedHint}
              </span>
            </div>
          )}

          <div className="workspace-overlay" aria-hidden style={{ position: "absolute", inset: 0, zIndex: 4, pointerEvents: "none" }}>
            {overlay}
          </div>

          <CompanionSlot legacy={legacy} presenter={!!presenter} onElement={setSlot}>
            {legacy ? children : companion}
          </CompanionSlot>
        </div>
      </FrameCtx.Provider>
    </OccluderProvider>
  );
}

function CompanionSlot({ legacy, presenter, onElement, children }: { legacy: boolean; presenter: boolean; onElement?: (el: HTMLDivElement | null) => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  // The slot is a Tacit surface over the ERP: always painted out of captured frames.
  useOccluder(ref, "workspace-companion");
  useEffect(() => {
    onElement?.(ref.current);
    return () => onElement?.(null);
  }, [onElement]);
  const width = legacy ? (presenter ? 500 : 404) : undefined;
  return (
    <div
      ref={ref}
      className="workspace-companion"
      data-legacy={legacy ? "true" : undefined}
      style={{
        position: "fixed",
        bottom: SLOT_GAP,
        zIndex: 5,
        width: width ? `min(${width}px, calc(100vw - 32px))` : undefined,
        maxHeight: `calc(100dvh - ${SLOT_GAP * 2}px)`,
        ...(legacy
          ? {
              height: `calc(100dvh - ${SLOT_GAP * 2}px)`,
              display: "flex",
              flexDirection: "column" as const,
              overflow: "auto",
              overscrollBehavior: "contain" as const,
              borderRadius: 30,
              background: "linear-gradient(180deg,rgba(255,255,255,.86),rgba(250,250,252,.74))",
              backdropFilter: "blur(30px) saturate(1.9)",
              WebkitBackdropFilter: "blur(30px) saturate(1.9)",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,.95), 0 0 0 .5px rgba(0,0,0,.07), 0 1px 2px rgba(15,23,42,.05), 0 20px 50px rgba(15,23,42,.11)",
            }
          : { display: "flex", flexDirection: "column" as const, justifyContent: "flex-end" }),
      }}
    >
      {children}
    </div>
  );
}
