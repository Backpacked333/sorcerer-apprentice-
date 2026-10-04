"use client";
// Role Memory (platform report §1.3): what Tacit understands about one role, as of the playhead t.
// Counts only ("7 of 8 explained"), never a percentage. Quotation marks only around verbatim expert words.
import Link from "next/link";
import { useState } from "react";
import { CountRing, IridescentRim, Orb, usePlayhead } from "@/components/glass";
import { seriesAt, type MasteryLabel, type RoleMemory, type Timeline } from "@/lib/platform/types";
import { AskRole } from "./AskRole";
import { Dock } from "./Dock";
import { KnowledgeChart } from "./KnowledgeChart";
import { SidebarToggle, useShell } from "./PlatformShell";
import { AVATAR, KIND, MASTERY, PASTEL, hexA, initials, lastBeads, when } from "./meta";

const card: React.CSSProperties = {
  position: "relative",
  padding: 20,
  borderRadius: 28,
  background: "linear-gradient(180deg,rgba(255,255,255,.84),rgba(255,255,255,.6))",
  boxShadow: "inset 0 1px 0 #fff,0 0 0 .5px rgba(0,0,0,.07),0 12px 34px rgba(15,23,42,.06)",
};

export function RoleMemoryView({ role }: { role: RoleMemory }) {
  const { base } = useShell();
  const tl = role.timeline;
  const ph = usePlayhead([tl.start, tl.today], 7000);
  const t = ph.t;
  const cov = seriesAt(role.coverage, t);
  const { last, prev } = lastBeads(tl.beads, t);
  const isNew = (at: number) => !!last && at <= last.at && (!prev || at > prev.at);
  const knownRules = role.items.filter((i) => i.learnedAt <= t).length;
  const sessions = tl.beads.filter((b) => b.type !== "planned" && b.at <= t).length;
  const openQ = role.openQuestions.filter((q) => q.openedAt <= t && !(q.closedAt != null && q.closedAt <= t)).length;

  return (
    <div style={{ position: "relative", maxWidth: 1180, margin: "0 auto", padding: "16px clamp(12px,3vw,24px) 60px", display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <SidebarToggle />
        <nav aria-label="Breadcrumb" style={{ fontSize: 13, color: "#6e6e73", minWidth: 0, flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {role.breadcrumb.join(" › ")}
        </nav>
        <div style={{ display: "flex", gap: 8 }}>
          {role.ontologyHref ? <Link href={role.ontologyHref} style={topPill}>Ontology →</Link> : null}
          {role.mapHref ? <Link href={role.mapHref} style={topPill}>Work map</Link> : null}
          <Link href={`${base}?role=${encodeURIComponent(role.roleId)}`} style={topPill}>Company map</Link>
        </div>
      </div>

      <header style={{ display: "flex", gap: 24, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: "none" }}>
          <div aria-hidden style={{ position: "absolute", inset: -10, borderRadius: "50%", background: "conic-gradient(#ffb8d9,#ffd27a,#9be7c4,#8fd3ff,#b7a6ff,#ffb8d9)", filter: "blur(18px)", opacity: 0.35 + (cov && cov.of ? (cov.n / cov.of) * 0.4 : 0), animation: "tc-glow 4s ease-in-out infinite", pointerEvents: "none" }} />
          <div style={{ position: "relative", padding: 8, borderRadius: "50%", background: "rgba(255,255,255,.75)", boxShadow: "inset 0 0 0 .5px rgba(0,0,0,.06)" }}>
            <CountRing value={cov?.n ?? 0} total={cov?.of ?? 0} size={100} label="Decisions explained" />
          </div>
        </div>
        <div style={{ minWidth: 0, flex: "1 1 320px" }}>
          <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: ".08em", color: role.confirmed ? "#1b8a4b" : "#a35f00" }}>
            ROLE MEMORY · {role.statusLabel.toUpperCase()}
            {role.revision != null ? ` · REV ${role.revision}` : ""}
          </div>
          <h1 style={{ margin: "6px 0 4px", fontSize: "clamp(26px,3.4vw,40px)", fontWeight: 700, letterSpacing: "-.03em", lineHeight: 1.1 }}>{role.title}</h1>
          <div style={{ fontSize: 13.5, color: "#6e6e73", marginBottom: 10 }}>
            {cov ? `${cov.n} of ${cov.of} explained` : "Nothing explained yet"}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {role.people.map((p) => {
              const av = AVATAR[p.avatar];
              return (
                <span key={p.id} style={{ display: "inline-flex", alignItems: "center", gap: 8, height: 30, padding: "0 12px 0 4px", borderRadius: 15, background: "rgba(255,255,255,.8)", boxShadow: "inset 0 0 0 .5px rgba(0,0,0,.07)", fontSize: 13 }}>
                  <span aria-hidden style={{ width: 22, height: 22, borderRadius: 11, background: av.bg, color: av.ink, fontSize: 10, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{initials(p.name)}</span>
                  <b style={{ fontWeight: 600 }}>{p.name}</b>
                  <span style={{ color: "#6e6e73" }}>{p.descriptor}</span>
                </span>
              );
            })}
          </div>
        </div>
      </header>

      <div style={{ position: "sticky", top: 8, zIndex: 5 }}>
        <Dock
          timeline={tl}
          ph={ph}
          counts={`${knownRules} rule${knownRules === 1 ? "" : "s"} · ${sessions} session${sessions === 1 ? "" : "s"} · ${openQ} open question${openQ === 1 ? "" : "s"}`}
          playLabel="Watch it learn"
          before="Before the first capture"
        />
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 20, alignItems: "flex-start" }}>
        <div style={{ flex: "1.65 1 520px", minWidth: 0, display: "flex", flexDirection: "column", gap: 20 }}>
          <Synopsis role={role} t={t} playing={ph.playing} isNew={isNew} />
          <section style={card} aria-label="Knowledge over time">
            <h2 style={h2}>Knowledge over time</h2>
            <div style={{ marginTop: 10 }}>
              <KnowledgeChart knowledge={role.knowledge} timeline={tl} t={t} />
            </div>
          </section>
          {role.tasks.length ? (
            <section aria-label="Tasks it has watched" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <h2 style={{ ...h2, padding: "0 4px" }}>Tasks it has watched</h2>
              {role.tasks.map((task) => <TaskCardView key={task.id} task={task} t={t} tl={tl} />)}
            </section>
          ) : null}
          <MemoryList role={role} t={t} isNew={isNew} />
        </div>

        <div style={{ flex: "1 1 300px", minWidth: 0, display: "flex", flexDirection: "column", gap: 20 }}>
          <AskRole asks={role.asks} empty={role.asksEmpty} timeline={tl} t={t} playing={ph.playing} />
          <Dimensions role={role} t={t} />
          <MasteryGrid role={role} t={t} />
          <OpenQuestions role={role} t={t} />
        </div>
      </div>
    </div>
  );
}

function Synopsis({ role, t, playing, isNew }: { role: RoleMemory; t: number; playing: boolean; isNew: (at: number) => boolean }) {
  const s = role.synopsis;
  const visible = s.sentences.filter((x) => x.at <= t && !(x.until != null && x.until <= t));
  return (
    <section style={{ ...card, padding: 24 }} aria-label="What Simon understands about this role">
      <IridescentRim radius={28} colors={PASTEL} opacity={0.55} speed={14} />
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Orb mood={playing ? "reading" : visible.length ? "understood" : "quiet"} size={34} follow={false} />
        <div>
          <h2 style={h2}>What Simon understands about this role</h2>
          <div style={{ fontSize: 12.5, color: "#6e6e73" }}>Rewritten after every session · underlined = new since the last one</div>
        </div>
      </div>
      {s.draftBanner ? (
        <div style={{ marginTop: 14, padding: "8px 12px", borderRadius: 12, fontSize: 13, color: "#a35f00", background: "rgba(245,166,35,.12)" }}>{s.draftBanner}</div>
      ) : null}
      {visible.length === 0 ? (
        <p style={{ margin: "16px 0 0", fontSize: 15, color: "#6e6e73", lineHeight: 1.55 }}>
          {s.empty ?? (s.sentences.length ? "Nothing learned yet at this point in time." : "Nothing yet. Nobody has been captured in this role.")}
        </p>
      ) : (
        <p style={{ margin: "16px 0 0", fontSize: "clamp(16px,1.5vw,19px)", lineHeight: 1.62, color: "#1d1d1f" }}>
          {visible.map((x) => {
            const fresh = isNew(x.at);
            return (
              <span key={x.id} style={{ animation: "tc-rise .7s var(--ease-rise) both" }}>
                <span
                  style={{
                    color: x.described ? "#3a3a3c" : undefined,
                    fontStyle: x.described ? "italic" : undefined,
                    backgroundImage: "linear-gradient(90deg,#ffb8d9,#ffd27a,#9be7c4,#8fd3ff,#b7a6ff)",
                    backgroundRepeat: "no-repeat",
                    backgroundPosition: "0 100%",
                    backgroundSize: fresh ? "100% 2px" : "0% 2px",
                    transition: "background-size .6s var(--ease-rise)",
                  }}
                >
                  {x.text}
                </span>
                {x.corrected && x.corrected.at <= t ? (
                  <span style={{ display: "inline-block", margin: "0 6px", padding: "1px 8px", borderRadius: 10, fontSize: 11.5, fontWeight: 600, fontStyle: "normal", color: "#a35f00", background: "rgba(245,166,35,.15)", verticalAlign: "2px" }}>
                    corrected by {x.corrected.by}
                  </span>
                ) : null}{" "}
              </span>
            );
          })}
        </p>
      )}
    </section>
  );
}

function TaskCardView({ task, t, tl }: { task: RoleMemory["tasks"][number]; t: number; tl: Timeline }) {
  const [open, setOpen] = useState(false);
  const seen = task.at <= t;
  const canOpen = seen && (task.steps.length > 0 || !!task.described?.length);
  return (
    <div style={{ ...card, padding: 0, borderRadius: 24, opacity: seen ? 1 : 0.4, transition: "opacity .4s" }}>
      <button
        type="button"
        disabled={!canOpen}
        aria-expanded={open && canOpen}
        onClick={() => setOpen((v) => !v)}
        style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "14px 16px", border: 0, background: "transparent", font: "inherit", textAlign: "left", color: "inherit", cursor: canOpen ? "pointer" : "default", borderRadius: 24 }}
      >
        <span aria-hidden style={{ width: 34, height: 34, flex: "none", borderRadius: 11, display: "flex", alignItems: "center", justifyContent: "center", background: task.watched ? "rgba(245,166,35,.16)" : "rgba(0,0,0,.05)", color: task.watched ? "#a35f00" : "#8e8e93", fontSize: 15 }}>
          {task.watched ? "◉" : "✎"}
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "block", fontSize: 15, fontWeight: 600 }}>{task.title}</span>
          <span style={{ display: "block", fontSize: 12.5, color: "#6e6e73" }}>{seen ? `${when(tl, task.at, task.approx)} · ${task.sub}` : `Not seen yet — ${when(tl, task.at, task.approx)}`}</span>
        </span>
        {canOpen ? (
          <span style={{ flex: "none", fontSize: 12.5, color: "#6e6e73" }}>{open ? "Hide steps ⌃" : `${task.steps.length} step${task.steps.length === 1 ? "" : "s"} ⌄`}</span>
        ) : null}
      </button>
      {open && canOpen ? (
        <div style={{ padding: "0 16px 14px" }}>
          {task.steps.map((s, i) => (
            <div key={s.n} style={{ display: "grid", gridTemplateColumns: "22px 52px 1fr auto", gap: 8, alignItems: "center", padding: "6px 0", borderTop: ".5px solid rgba(0,0,0,.06)", animation: `tc-rise .4s var(--ease-rise) ${i * 0.03}s both` }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "#6e6e73" }}>{s.n}</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "#6e6e73" }}>{s.t}</span>
              <span style={{ fontSize: 13.5, fontWeight: s.judgment ? 600 : 400 }}>{s.title}</span>
              {s.rule ? (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, color: "#3a3a3c" }}>
                  <span aria-hidden style={{ width: 16, height: 16, borderRadius: 8, background: KIND[s.rule.kind].color, color: "#fff", fontSize: 8.5, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{s.rule.displayId}</span>
                  {KIND[s.rule.kind].label}
                </span>
              ) : <span />}
            </div>
          ))}
          {task.described?.map((d) => (
            <div key={d.question} style={{ padding: "8px 0", borderTop: ".5px solid rgba(0,0,0,.06)" }}>
              <div style={{ fontSize: 13, color: "#6e6e73" }}>{d.question}</div>
              <div style={{ fontSize: 14, marginTop: 2 }}>“{d.quote}”</div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function MemoryList({ role, t, isNew }: { role: RoleMemory; t: number; isNew: (at: number) => boolean }) {
  const tl = role.timeline;
  const known = role.items.filter((i) => i.learnedAt <= t).length;
  const firstTeach = role.mastery.columns.length ? Math.min(...role.mastery.columns.map((c) => c.at)) : Infinity;
  return (
    <section style={card} aria-label="Everything it knows">
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
        <h2 style={h2}>Everything it knows</h2>
        <span style={{ fontSize: 12.5, color: "#6e6e73" }}>{known} of {role.items.length} as of {when(tl, t)}</span>
      </div>
      {role.items.length === 0 ? <p style={{ margin: "12px 0 0", fontSize: 13.5, color: "#6e6e73" }}>No rules yet.</p> : null}
      <div style={{ marginTop: 6 }}>
        {role.items.map((it) => {
          const k = KIND[it.kind];
          const isKnown = it.learnedAt <= t;
          const corrected = it.correction && it.correction.at <= t;
          const fresh = isKnown && isNew(it.learnedAt);
          const inner = (
            <>
              <span aria-hidden style={{ width: 26, height: 26, borderRadius: 13, background: k.color, color: "#fff", fontSize: 10.5, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: fresh ? `0 0 0 3px ${hexA(k.color, 0.2)},0 0 12px ${hexA(k.color, 0.55)}` : "none", transition: "box-shadow .5s" }}>
                {it.displayId}
              </span>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 14.5, fontWeight: 600, lineHeight: 1.35 }}>{it.title}</span>
                {isKnown ? (
                  <>
                    <span style={{ display: "block", fontSize: 13.5, color: "#3a3a3c", lineHeight: 1.45, marginTop: 2 }}>
                      {corrected && it.correction ? `“${it.correction.text}”` : it.quote ? `“${it.quote}”` : <i style={{ color: "#6e6e73" }}>{it.noQuoteLabel}</i>}
                    </span>
                    <span style={{ display: "block", fontSize: 12, color: "#6e6e73", marginTop: 3 }}>
                      {it.source} · {when(tl, it.learnedAt, it.approx)}
                      {corrected && it.correction ? ` · corrected ${when(tl, it.correction.at, it.correction.approx)}` : ""}
                    </span>
                  </>
                ) : (
                  <span style={{ display: "block", fontSize: 13, color: "#6e6e73", marginTop: 2 }}>Not known yet. Learned {when(tl, it.learnedAt, it.approx)}</span>
                )}
              </span>
              <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 10, color: k.color === "#8e8e93" ? "#6e6e73" : k.color, background: hexA(k.color, 0.12), whiteSpace: "nowrap" }}>{k.label}</span>
                {it.mastery && t >= firstTeach ? (
                  <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 10, color: MASTERY[it.mastery.label].ink, background: hexA(MASTERY[it.mastery.label].color, 0.14), whiteSpace: "nowrap" }}>
                    {it.mastery.person} · {it.mastery.label}
                  </span>
                ) : null}
              </span>
            </>
          );
          const rowStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "30px 1fr auto", gap: 10, alignItems: "flex-start", padding: "12px 0", borderTop: ".5px solid rgba(0,0,0,.06)", opacity: isKnown ? 1 : 0.38, transition: "opacity .4s", color: "inherit", textDecoration: "none" };
          return it.href ? (
            <Link key={it.id} href={it.href} style={rowStyle} className="hover:bg-[rgba(255,255,255,.5)]">{inner}</Link>
          ) : (
            <div key={it.id} style={rowStyle}>{inner}</div>
          );
        })}
      </div>
    </section>
  );
}

function Dimensions({ role, t }: { role: RoleMemory; t: number }) {
  if (!role.dimensions.length) return null;
  return (
    <section style={card} aria-label="Understanding by dimension">
      <h2 style={h2}>Understanding by dimension</h2>
      <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 12 }}>
        {role.dimensions.map((d) => {
          const v = seriesAt(d.series, t)?.n ?? 0;
          return (
            <div key={d.label}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 13 }}>
                <span>{d.label}</span>
                <span style={{ color: "#6e6e73", fontVariantNumeric: "tabular-nums" }}>{d.max != null ? `${v} of ${d.max}` : v}</span>
              </div>
              {d.max != null ? (
                <div aria-hidden style={{ marginTop: 5, height: 6, borderRadius: 3, background: "rgba(0,0,0,.06)", overflow: "hidden" }}>
                  <div style={{ height: "100%", borderRadius: 3, background: "linear-gradient(90deg,#ffb8d9,#ffd27a,#9be7c4,#8fd3ff,#b7a6ff)", transformOrigin: "left center", transform: `scaleX(${d.max > 0 ? Math.min(1, v / d.max) : 0})`, transition: "transform .6s cubic-bezier(.3,1,.4,1)" }} />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function MasteryGrid({ role, t }: { role: RoleMemory; t: number }) {
  const m = role.mastery;
  const labels = Object.keys(MASTERY) as MasteryLabel[];
  return (
    <section style={card} aria-label="New-hire mastery">
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
        <h2 style={h2}>{m.learner ? `${m.learner}, learning it` : "New-hire mastery"}</h2>
        <span style={{ fontSize: 12, color: "#6e6e73" }}>a hint is not the same as mastery</span>
      </div>
      {m.empty || !m.columns.length ? (
        <p style={{ margin: "12px 0 0", fontSize: 13.5, color: "#6e6e73" }}>{m.empty ?? "No new hire has trained on this map yet."}</p>
      ) : (
        <>
          <div data-scroll="" style={{ overflowX: "auto", marginTop: 10 }}>
            <div style={{ display: "grid", gridTemplateColumns: `40px repeat(${m.columns.length}, minmax(76px,1fr))`, gap: "6px 8px", alignItems: "center", minWidth: 40 + m.columns.length * 84 }}>
              <span />
              {m.columns.map((c) => (
                <span key={c.id} style={{ fontSize: 11.5, color: "#6e6e73", textAlign: "center", lineHeight: 1.3 }}>
                  {c.href ? <Link href={c.href} style={{ color: "inherit" }}>{c.label}</Link> : c.label}
                </span>
              ))}
              {m.rows.map((r) => (
                <MasteryRow key={r.ruleId} row={r} columns={m.columns} t={t} />
              ))}
            </div>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 12px", marginTop: 12 }}>
            {labels.map((l) => (
              <span key={l} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, color: "#6e6e73" }}>
                <span aria-hidden style={{ width: 9, height: 9, borderRadius: 3, background: MASTERY[l].color }} />
                {l}
              </span>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function MasteryRow({ row, columns, t }: { row: RoleMemory["mastery"]["rows"][number]; columns: RoleMemory["mastery"]["columns"]; t: number }) {
  return (
    <>
      <span title={row.title} style={{ fontSize: 12, fontWeight: 700, color: "#3a3a3c" }}>{row.displayId}</span>
      {columns.map((c, i) => {
        const label = row.cells[i];
        const shown = c.at <= t && label;
        return (
          <span key={c.id} style={{ display: "flex", justifyContent: "center" }}>
            <span
              title={shown ? `${row.displayId} · ${label}` : undefined}
              aria-label={shown ? `${row.displayId}: ${label}` : `${row.displayId}: not yet`}
              style={{ height: 24, minWidth: 24, padding: "0 7px", borderRadius: 12, fontSize: 10.5, fontWeight: 600, display: "inline-flex", alignItems: "center", justifyContent: "center", background: shown ? hexA(MASTERY[label].color, label === "not tested" ? 0.25 : 0.9) : "rgba(0,0,0,.04)", color: shown ? (label === "not tested" ? "#6e6e73" : "#fff") : "transparent", transition: "background .35s, color .35s" }}
            >
              {shown ? MASTERY[label].short : "·"}
            </span>
          </span>
        );
      })}
    </>
  );
}

function OpenQuestions({ role, t }: { role: RoleMemory; t: number }) {
  const tl = role.timeline;
  const qs = role.openQuestions.filter((q) => q.openedAt <= t);
  const open = qs.filter((q) => !(q.closedAt != null && q.closedAt <= t)).length;
  return (
    <section style={card} aria-label="Open questions">
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <h2 style={h2}>Open questions</h2>
        <span style={{ fontSize: 12.5, color: "#6e6e73" }}>{open} open</span>
      </div>
      {qs.length === 0 ? <p style={{ margin: "12px 0 0", fontSize: 13.5, color: "#6e6e73" }}>No questions yet.</p> : null}
      <div style={{ marginTop: 6 }}>
        {qs.map((q) => {
          const closed = q.closedAt != null && q.closedAt <= t;
          return (
            <div key={q.id} style={{ display: "flex", gap: 10, padding: "9px 0", borderTop: ".5px solid rgba(0,0,0,.06)", animation: "tc-rise .4s var(--ease-rise) both" }}>
              <span aria-hidden style={{ width: 8, height: 8, borderRadius: 4, marginTop: 6, flex: "none", background: closed ? (q.status === "skipped" ? "#aeaeb2" : "#22b45e") : "#f5a623", boxShadow: closed ? "none" : "0 0 8px rgba(245,166,35,.6)", transition: "background .4s" }} />
              <span style={{ minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 13.5, color: closed ? "#8e8e93" : "#1d1d1f", textDecoration: closed ? "line-through" : "none", lineHeight: 1.4 }}>{q.question}</span>
                <span style={{ display: "block", fontSize: 12, color: "#6e6e73" }}>
                  {closed ? `${q.how} · ${when(tl, q.closedAt!, q.approx)}` : q.status === "open" ? q.how : "open"}
                </span>
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/** Real mode, unknown role id: an honest empty state instead of a 404. */
export function RoleEmpty({ title, href }: { title: string; href: string }) {
  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "16px clamp(12px,3vw,24px)" }}>
      <SidebarToggle />
      <div style={{ ...card, marginTop: 40, textAlign: "center", padding: 32 }}>
        <div style={{ display: "flex", justifyContent: "center" }}><Orb mood="quiet" size={38} follow={false} /></div>
        <h1 style={{ margin: "14px 0 6px", fontSize: 22, fontWeight: 700 }}>{title}</h1>
        <p style={{ margin: "0 0 16px", fontSize: 14, color: "#6e6e73", lineHeight: 1.5 }}>Only roles Simon has captured or heard named appear here.</p>
        <Link href={href} style={topPill}>Back to the company map</Link>
      </div>
    </div>
  );
}

const h2: React.CSSProperties = { margin: 0, fontSize: 16, fontWeight: 600 };
const topPill: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  height: 36,
  padding: "0 14px",
  borderRadius: 18,
  fontSize: 13.5,
  fontWeight: 500,
  color: "#1d1d1f",
  textDecoration: "none",
  background: "rgba(255,255,255,.85)",
  boxShadow: "inset 0 0 0 .5px rgba(0,0,0,.08),0 1px 3px rgba(0,0,0,.06)",
};

