"use client";
// Library › Sessions: every capture and teach session in the store (real mode only).
import Link from "next/link";
import { formatAt } from "@/lib/platform/types";
import { SidebarToggle } from "./PlatformShell";

type Row = { id: string; mode: string; task: string; expertName: string; startedAt: number; endedAt?: number | null };

export function SessionsView({ sessions, failed }: { sessions: Row[]; failed: boolean }) {
  return (
    <div style={{ maxWidth: 920, margin: "0 auto", padding: "16px clamp(12px,3vw,24px) 60px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <SidebarToggle />
        <span style={{ fontSize: 13, color: "#8e8e93" }}>Library › Sessions</span>
      </div>
      <h1 style={{ margin: "22px 0 4px", fontSize: "clamp(26px,3.2vw,36px)", fontWeight: 700, letterSpacing: "-.03em" }}>Sessions</h1>
      <p style={{ margin: "0 0 18px", fontSize: 14, color: "#6e6e73" }}>Every capture and teach session Tacit has stored. Times are UTC.</p>
      {failed ? <p style={{ fontSize: 13.5, color: "#a35f00" }}>Some session files could not be read and are left out.</p> : null}
      {sessions.length === 0 ? (
        <div style={{ padding: 20, borderRadius: 24, background: "rgba(255,255,255,.8)", boxShadow: "inset 0 0 0 .5px rgba(0,0,0,.07)", fontSize: 14, color: "#6e6e73" }}>
          No sessions yet. <Link href="/capture" style={{ color: "#a35f00" }}>Start a capture</Link>.
        </div>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 6, borderRadius: 24, background: "linear-gradient(180deg,rgba(255,255,255,.84),rgba(255,255,255,.6))", boxShadow: "inset 0 1px 0 #fff,0 0 0 .5px rgba(0,0,0,.07),0 12px 34px rgba(15,23,42,.05)" }}>
          {sessions.map((s, i) => {
            const teach = s.mode === "teach";
            const href = teach ? `/teach/${s.id}` : `/map/${s.id}`;
            return (
              <li key={s.id} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "6px 12px", padding: "12px 12px", borderTop: i ? ".5px solid rgba(0,0,0,.07)" : "none", animation: `tc-rise .4s var(--ease-rise) ${Math.min(i, 12) * 0.03}s both` }}>
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".06em", padding: "3px 8px", borderRadius: 9, color: teach ? "#1b8a4b" : "#a35f00", background: teach ? "rgba(34,180,94,.12)" : "rgba(245,166,35,.14)" }}>{teach ? "TEACH" : "CAPTURE"}</span>
                <time style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, color: "#8e8e93" }}>{formatAt(s.startedAt, "minute", true)}</time>
                <span style={{ flex: "1 1 240px", minWidth: 0, fontSize: 14 }}>
                  <b style={{ fontWeight: 600 }}>{s.expertName}</b> · {s.task}
                  {s.endedAt ? null : <span style={{ color: "#8e8e93" }}> · not ended</span>}
                </span>
                {s.id.startsWith("demo_") ? <span style={{ fontSize: 11.5, color: "#6e6e73", padding: "2px 8px", borderRadius: 9, background: "rgba(0,0,0,.05)" }}>sample</span> : null}
                <Link href={href} style={{ display: "inline-flex", alignItems: "center", height: 34, padding: "0 14px", borderRadius: 17, fontSize: 13, fontWeight: 600, color: "#6b3f00", textDecoration: "none", background: "linear-gradient(180deg,rgba(255,222,160,.85),rgba(255,196,95,.6))" }}>Open</Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
