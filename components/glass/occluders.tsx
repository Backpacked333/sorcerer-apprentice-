"use client";
// Every floating Tacit surface over the ERP registers here so its rectangle can be painted
// out of each captured frame (user decision 2). The provider reports the live element list.
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, type ReactNode, type RefObject } from "react";

interface OccluderApi {
  set(id: string, el: HTMLElement | null): void;
}

const Ctx = createContext<OccluderApi | null>(null);

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

export function OccluderProvider(p: { onChange?: (els: HTMLElement[]) => void; children: ReactNode }) {
  const map = useRef(new Map<string, HTMLElement>());
  const onChange = useRef(p.onChange);
  useIsoLayoutEffect(() => {
    onChange.current = p.onChange;
  });
  const set = useCallback((id: string, el: HTMLElement | null) => {
    const cur = map.current.get(id);
    if (el ? cur === el : cur === undefined) return;
    if (el) map.current.set(id, el);
    else map.current.delete(id);
    onChange.current?.(Array.from(map.current.values()));
  }, []);
  const api = useMemo(() => ({ set }), [set]);
  return <Ctx.Provider value={api}>{p.children}</Ctx.Provider>;
}

/** Registers `ref.current` under `id` while `active` (default true). No-op without a provider. */
export function useOccluder(ref: RefObject<HTMLElement | null>, id: string, active = true): void {
  const api = useContext(Ctx);
  useIsoLayoutEffect(() => {
    if (!api || !active) return;
    const el = ref.current;
    if (!el) return;
    api.set(id, el);
    return () => api.set(id, null);
  }, [api, id, active, ref]);
}
