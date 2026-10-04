import React, { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, expect, it, vi } from "vitest";
import { POST } from "@/app/api/compile/route";
import { MapView } from "@/components/views/MapView";
import type { MapVM } from "@/components/views/map.vm";
import { emptySession } from "./events";

const { getSession, saveCompiledMap } = vi.hoisted(() => ({ getSession: vi.fn(), saveCompiledMap: vi.fn() }));
vi.mock("./store", () => ({ getSession, saveCompiledMap }));
vi.mock("@/components/ui/AppShell", () => ({ AppShell: ({ children }: { children: ReactNode }) => createElement("div", null, children) }));
afterEach(() => { vi.resetAllMocks(); vi.unstubAllGlobals(); });

it("rejects a concurrent session change without saving stale output", async () => {
  const session = emptySession("conflict", "capture", "Review shipments", "Expert");
  getSession.mockResolvedValue(session);
  saveCompiledMap.mockResolvedValue(false);
  const response = await POST(new Request("http://localhost/api/compile", { method: "POST", body: JSON.stringify({ sessionId: session.id, llm: false }) }));
  expect(response.status).toBe(409);
  expect(saveCompiledMap).toHaveBeenCalledWith(expect.objectContaining({ sessionId: session.id }), session);
});

it("shows a recoverable compile error instead of only a loading screen", () => {
  vi.stubGlobal("React", React);
  const vm = { map: null, compiling: false, note: "Session changed during compilation. Retry with the latest evidence." } as MapVM;
  const html = renderToStaticMarkup(createElement(MapView, { vm }));
  expect(html).toContain('role="alert"');
  expect(html).toContain(vm.note);
  expect(html).toContain("Retry compilation");
});
