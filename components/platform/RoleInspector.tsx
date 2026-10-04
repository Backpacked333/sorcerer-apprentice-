"use client";
// Right-hand glass inspector for the selected role on the Company Map.
import Link from "next/link";
import { CountRing, IridescentRim, Pill } from "@/components/glass";
import { seriesAt, type PlatformData, type RoleNode } from "@/lib/platform/types";
import { AVATAR, KIND, PROV, PASTEL, hexA, initials, trunc } from "./meta";

const STATUS_TONE: Record<RoleNode["status"], "green" | "amber" | "violet" | "blue" | "neutral"> = {
  captured: "green",
  in_debrief: "amber",
  capturing: "amber",
  mentioned: "amber",
  inferred: "violet",
  seen: "blue",
  not_captured: "neutral",
  mapped: "neutral",
};

const RISK_LABEL = { critical: "Critical knowledge risk", high: "High knowledge risk", watch: "Knowledge risk" } as const;

export function RoleInspector({
  role,
  data,
  t,
  onSelect,
  showRisk,
  onClose,
  width,
}: {
  role: RoleNode;
  data: PlatformData;
  t: number;
  onSelect: (id: string) => void;
  /** demo only: risk chips and retirement chips */
  showRisk: boolean;
  onClose?: () => void;
  width: number | string;
}) {
  const byId = new Map(data.roles.map((r) => [r.id, r]));
  const dept = data.departments.find((d) => d.id === role.dept);
  const cov = seriesAt(role.coverage, t);
  const rules = seriesAt(role.rules, t)?.n ?? 0;
  const sessions = seriesAt(role.sessions, t)?.n ?? 0;
  const mentions = seriesAt(role.mentions, t)?.n ?? 0;
  const known = role.at <= t;
  const rels = data.edges.filter((e) => e.from === role.id || e.to === role.id);
  const captured = role.coverage.length > 0;
  const isMain = role.isMain || role.status === "captured" || role.status === "in_debrief";

  return (
    <aside
      data-panel=""
      aria-label={`Role: ${role.title}`}
      style={{
        position: "relative",
        width,
        height: "100%",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        borderRadius: 28,
        background: "linear-gradient(180deg,rgba(255,255,255,.97),rgba(255,255,255,.9))",
        backdropFilter: "blur(28px) saturate(1.8)",
        WebkitBackdropFilter: "blur(28px) saturate(1.8)",
        boxShadow: "inset 0 1px 0 #fff,0 0 0 .5px rgba(0,0,0,.07),0 18px 50px rgba(15,23,42,.1)",
      }}
    >
      <IridescentRim radius={28} colors={PASTEL} opacity={0.45} speed={14} />
      <div data-scroll="" key={role.id} style={{ position: "relative", flex: 1, minHeight: 0, overflowY: "auto", padding: "20px 20px 18px", display: "flex", flexDirection: "column", animation: "tc-rise .45s var(--ease-rise) both" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", paddingRight: onClose ? 36 : 0 }}>
          {dept ? (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 24, padding: "0 10px", borderRadius: 12, fontSize: 12, fontWeight: 600, color: "#3a3a3c", background: "rgba(0,0,0,.045)" }}>
              <span aria-hidden style={{ width: 7, height: 7, borderRadius: 4, background: dept.color }} />
              {dept.name}
              {role.team ? ` · ${role.team}` : ""}
            </span>
          ) : null}
          {role.onet ? <Pill tone="neutral" title={role.onet.occupation}>{`O*NET ${role.onet.code}`}</Pill> : null}
          <Pill tone={STATUS_TONE[role.status]} dot>{role.statusLabel}</Pill>
          {showRisk && role.risk ? (
            <Pill tone={role.risk.level === "critical" ? "red" : "amber"} dot pulse>{RISK_LABEL[role.risk.level]}</Pill>
          ) : null}
        </div>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{ position: "absolute", top: 16, right: 16, width: 30, height: 30, borderRadius: 15, border: 0, cursor: "pointer", background: "rgba(0,0,0,.05)", color: "#3a3a3c", fontSize: 14 }}
          >
            ✕
          </button>
        ) : null}

        <h2 style={{ margin: "14px 0 2px", fontSize: 24, fontWeight: 700, letterSpacing: "-.02em", lineHeight: 1.15 }}>{role.title}</h2>
        <div style={{ fontSize: 13, color: "#6e6e73" }}>
          {role.people.length ? `${role.people.length} ${role.people.length === 1 ? "person" : "people"}` : "No people known yet"}
          {!known ? " · not known yet at this point in time" : ""}
        </div>

        <div style={{ display: "flex", gap: 14, alignItems: "center", marginTop: 16, padding: 14, borderRadius: 20, background: "rgba(255,255,255,.75)", boxShadow: "inset 0 0 0 .5px rgba(0,0,0,.06)" }}>
          {captured ? (
            <CountRing value={cov?.n ?? 0} total={cov?.of ?? 0} size={64} label="Decisions explained" />
          ) : (
            <div aria-hidden style={{ width: 64, height: 64, flex: "none", borderRadius: 32, boxShadow: "inset 0 0 0 4px rgba(0,0,0,.05)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 700, color: "#a35f00" }}>
              {mentions || "—"}
            </div>
          )}
          <div style={{ minWidth: 0 }}>
            {captured ? (
              <>
                <div style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.3 }}>
                  {cov ? `${cov.n} of ${cov.of} decisions explained` : "Nothing explained yet"}
                </div>
                <div style={{ fontSize: 12.5, color: "#6e6e73", marginTop: 3, lineHeight: 1.4 }}>
                  {rules} rule{rules === 1 ? "" : "s"} · {sessions} session{sessions === 1 ? "" : "s"} · {role.openGaps} open gap{role.openGaps === 1 ? "" : "s"}
                  {role.learners ? ` · ${role.learners} learning` : ""}
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.3 }}>
                  {mentions ? `Named in ${mentions} rule${mentions === 1 ? "" : "s"}` : "Nothing captured yet"}
                </div>
                <div style={{ fontSize: 12.5, color: "#6e6e73", marginTop: 3, lineHeight: 1.4 }}>
                  {showRisk && role.risk ? role.risk.note : role.note ?? "Capture someone in this role, or wait until an expert names it."}
                </div>
              </>
            )}
          </div>
        </div>

        {role.people.length ? (
          <Section title="People in this role">
            {role.people.map((p) => {
              const av = AVATAR[p.avatar];
              const ret = showRisk && p.retiresInMonths != null ? p.retiresInMonths : null;
              return (
                <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0" }}>
                  <span aria-hidden style={{ width: 34, height: 34, flex: "none", borderRadius: 17, background: av.bg, color: av.ink, fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 0 .5px rgba(0,0,0,.08)" }}>
                    {initials(p.name)}
                  </span>
                  <span style={{ minWidth: 0, flex: 1 }}>
                    <span style={{ display: "block", fontSize: 14, fontWeight: 600 }}>{p.name}</span>
                    <span style={{ display: "block", fontSize: 12, color: "#6e6e73" }}>{p.descriptor}</span>
                  </span>
                  {ret != null ? (
                    <span style={{ flex: "none", fontSize: 11.5, fontWeight: 600, padding: "3px 8px", borderRadius: 10, color: ret <= 12 ? "#c9342f" : "#a35f00", background: ret <= 12 ? "rgba(229,72,77,.12)" : "rgba(245,166,35,.14)" }}>
                      retires in {ret} mo
                    </span>
                  ) : null}
                </div>
              );
            })}
          </Section>
        ) : null}

        {rels.length ? (
          <Section title="Relationships">
            {rels.map((e) => {
              const out = e.from === role.id;
              const other = byId.get(out ? e.to : e.from);
              const pv = PROV[e.prov];
              return (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => other && onSelect(other.id)}
                  className="hover:bg-[rgba(0,0,0,.035)]"
                  style={{ display: "flex", alignItems: "flex-start", gap: 10, width: "100%", padding: "8px 8px", margin: "0 -8px", border: 0, borderRadius: 12, background: "transparent", cursor: "pointer", textAlign: "left", font: "inherit", color: "inherit", opacity: e.at <= t ? 1 : 0.4, transition: "opacity .3s" }}
                >
                  <span aria-hidden style={{ color: "#6e6e73", fontSize: 13, marginTop: 1 }}>{out ? "→" : "←"}</span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: 14, fontWeight: 600 }}>{other?.title ?? "Unknown role"}</span>
                    <span style={{ display: "block", fontSize: 12.5, color: "#6e6e73", lineHeight: 1.35 }}>{e.label}</span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, marginTop: 4, fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 10, color: pv.ink, background: pv.bg }}>
                      <span aria-hidden style={{ width: 5, height: 5, borderRadius: 3, background: pv.color }} />
                      {pv.label}
                    </span>
                  </span>
                </button>
              );
            })}
          </Section>
        ) : null}

        {role.topRules.length ? (
          <Section title={isMain ? "What this role knows" : "Rules that hand work to this role"}>
            {role.topRules.map((r) => {
              const k = KIND[r.kind];
              const body = (
                <>
                  <span aria-hidden style={{ width: 22, height: 22, flex: "none", borderRadius: 11, background: k.color, color: "#fff", fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 0 8px ${hexA(k.color, 0.45)}` }}>
                    {r.displayId}
                  </span>
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: 13.5, fontWeight: 600, lineHeight: 1.3 }}>{r.title}</span>
                    <span style={{ display: "block", fontSize: 12.5, color: "#6e6e73", lineHeight: 1.4, marginTop: 1 }}>
                      {r.quote ? `“${trunc(r.quote, 80)}”` : "Confirmed in the teach-back, not in the expert's words"}
                    </span>
                  </span>
                </>
              );
              const st: React.CSSProperties = { display: "flex", gap: 10, alignItems: "flex-start", padding: "7px 0", color: "inherit", textDecoration: "none" };
              return r.href ? (
                <Link key={r.id} href={r.href} style={st} className="hover:opacity-80">{body}</Link>
              ) : (
                <div key={r.id} style={st}>{body}</div>
              );
            })}
          </Section>
        ) : null}

        <div style={{ marginTop: "auto", paddingTop: 18, display: "flex", flexWrap: "wrap", gap: 8 }}>
          {role.memoryHref ? (
            <Link href={role.memoryHref} style={cta(true)}>Open role memory</Link>
          ) : role.captureHref ? (
            <Link href={role.captureHref} style={cta(true)}>Capture someone in this role</Link>
          ) : null}
          {role.ontologyHref ? <Link href={role.ontologyHref} style={cta(false)}>Ontology</Link> : null}
        </div>
      </div>
    </aside>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginTop: 18 }}>
      <h3 style={{ margin: "0 0 4px", fontSize: 12.5, fontWeight: 600, color: "#6e6e73" }}>{title}</h3>
      {children}
    </section>
  );
}

function cta(primary: boolean): React.CSSProperties {
  return primary
    ? { flex: "1 1 auto", display: "inline-flex", alignItems: "center", justifyContent: "center", height: 44, padding: "0 18px", borderRadius: 22, fontSize: 14, fontWeight: 600, textDecoration: "none", color: "#6b3f00", background: "linear-gradient(180deg,rgba(255,222,160,.9),rgba(255,196,95,.62))", boxShadow: "inset 0 1px 0 rgba(255,255,255,.8),inset 0 0 0 .5px rgba(200,120,0,.25)" }
    : { flex: "0 1 auto", display: "inline-flex", alignItems: "center", justifyContent: "center", height: 44, padding: "0 18px", borderRadius: 22, fontSize: 14, fontWeight: 600, textDecoration: "none", color: "#1d1d1f", background: "rgba(255,255,255,.9)", boxShadow: "inset 0 0 0 .5px rgba(0,0,0,.1),0 1px 3px rgba(0,0,0,.08)" };
}
