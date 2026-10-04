"use client";
// Ontology inspector: class / concept / role mode, or rule mode (logic rows, verbatim quotes, path, policy.json).
import { useState } from "react";
import { IridescentRim, Orb } from "@/components/glass";
import type { Ontology, OntNode, OntRule } from "@/lib/platform/types";
import { KIND, MASTERY, PASTEL, PROV, hexA, trunc, when } from "./meta";

type Props = {
  ont: Ontology;
  t: number;
  node: OntNode | null;
  rule: OntRule | null;
  onPickNode: (id: string) => void;
  onTrace: (ruleId: string | null) => void;
  onClose?: () => void;
};

const KIND_LABEL = { object: "Object", concept: "Concept", role: "Role" } as const;

export function OntologyInspector({ ont, t, node, rule, onPickNode, onTrace, onClose }: Props) {
  const nodeName = (id: string) => [...ont.classes, ...ont.concepts].find((n) => n.id === id)?.name ?? id;

  return (
    <aside
      data-panel=""
      aria-label={rule ? `Rule ${rule.displayId}` : node ? node.name : "Inspector"}
      style={{
        position: "relative",
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
      <IridescentRim radius={28} colors={PASTEL} opacity={rule ? 0.9 : 0.4} speed={14} />
      {onClose ? (
        <button type="button" onClick={onClose} aria-label="Close" style={{ position: "absolute", zIndex: 2, top: 16, right: 16, width: 30, height: 30, borderRadius: 15, border: 0, cursor: "pointer", background: "rgba(0,0,0,.05)", color: "#3a3a3c" }}>
          ✕
        </button>
      ) : null}
      <div data-scroll="" key={rule ? `r${rule.id}` : node ? `n${node.id}` : "none"} style={{ position: "relative", flex: 1, minHeight: 0, overflowY: "auto", padding: "20px 20px 18px", animation: "tc-rise .45s var(--ease-rise) both" }}>
        {rule ? <RuleMode ont={ont} rule={rule} t={t} nodeName={nodeName} onPickNode={onPickNode} onTrace={onTrace} /> : node ? (
          <NodeMode ont={ont} node={node} t={t} nodeName={nodeName} onPickNode={onPickNode} onTrace={onTrace} />
        ) : (
          <p style={{ margin: 0, fontSize: 14, color: "#6e6e73", lineHeight: 1.5 }}>{ont.empty ?? "Pick a class, or a decision path, to see what Tacit knows about it."}</p>
        )}
      </div>
    </aside>
  );
}

function Chip({ text, bg, ink, dot }: { text: string; bg: string; ink: string; dot?: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 24, padding: "0 10px", borderRadius: 12, fontSize: 12, fontWeight: 600, color: ink, background: bg }}>
      {dot ? <span aria-hidden style={{ width: 6, height: 6, borderRadius: 3, background: dot }} /> : null}
      {text}
    </span>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginTop: 18 }}>
      <h3 style={{ margin: "0 0 6px", fontSize: 12.5, fontWeight: 600, color: "#6e6e73" }}>{title}</h3>
      {children}
    </section>
  );
}

function NodeMode({ ont, node, t, nodeName, onPickNode, onTrace }: { ont: Ontology; node: OntNode; t: number; nodeName: (id: string) => string; onPickNode: (id: string) => void; onTrace: (id: string) => void }) {
  const tl = ont.timeline;
  const pv = PROV[node.prov];
  const rels = ont.edges.filter((e) => e.from === node.id || e.to === node.id);
  const rules = ont.rules.filter((r) => r.path.includes(node.id));
  const fields = node.fields ?? [];
  const instances = node.instances ?? [];
  const alsoIn = node.kind !== "object" ? node.alsoIn ?? [] : [];
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", paddingRight: 40 }}>
        <Chip text={KIND_LABEL[node.kind]} bg="rgba(0,0,0,.05)" ink="#3a3a3c" />
        <Chip text={pv.label} bg={pv.bg} ink={pv.ink} dot={pv.color} />
        <span style={{ marginLeft: "auto" }}><Orb mood="quiet" size={30} follow={false} /></span>
      </div>
      <h2 style={{ margin: "14px 0 2px", fontSize: 24, fontWeight: 700, letterSpacing: "-.02em" }}>{node.name}</h2>
      <div style={{ fontSize: 13, color: "#6e6e73" }}>
        {node.at <= t ? "First learned" : "Learned"} {when(tl, node.at, node.approx)}
        {node.firstSession ? ` · ${node.firstSession}` : ""}
      </div>
      {node.def ? <p style={{ margin: "12px 0 0", fontSize: 14.5, lineHeight: 1.5 }}>{node.def}</p> : null}
      {node.defQuote ? <p style={{ margin: "8px 0 0", fontSize: 14, lineHeight: 1.5, color: "#3a3a3c" }}>“{node.defQuote}”</p> : null}

      {fields.length ? (
        <Section title="Fields and values">
          {fields.map((f) => {
            const fp = PROV[f.prov];
            const known = f.at <= t;
            return (
              <div key={f.name} title={fp.label} style={{ display: "grid", gridTemplateColumns: "8px 104px 1fr auto", gap: 10, alignItems: "baseline", padding: "7px 0", borderTop: ".5px solid rgba(0,0,0,.06)", opacity: known ? 1 : 0.38, transition: "opacity .4s" }}>
                <span aria-hidden style={{ width: 6, height: 6, borderRadius: 3, background: fp.color, alignSelf: "center" }} />
                <span style={{ fontSize: 13.5 }}>{f.name}</span>
                <span style={{ fontSize: 13, color: "#6e6e73", minWidth: 0, overflowWrap: "anywhere" }}>{trunc(f.value, 140)}</span>
                <span style={{ fontSize: 11.5, color: "#aeaeb2", whiteSpace: "nowrap" }}>{when(tl, f.at, f.approx)}</span>
              </div>
            );
          })}
        </Section>
      ) : null}

      {rels.length ? (
        <Section title="Relationships">
          {rels.map((e) => {
            const out = e.from === node.id;
            const other = out ? e.to : e.from;
            return (
              <button
                key={e.id}
                type="button"
                onClick={() => onPickNode(other)}
                className="hover:bg-[rgba(0,0,0,.035)]"
                style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "7px 8px", margin: "0 -8px", border: 0, borderRadius: 10, background: "transparent", cursor: "pointer", font: "inherit", color: "inherit", textAlign: "left", opacity: e.at <= t ? 1 : 0.38 }}
              >
                <span aria-hidden style={{ color: "#8e8e93", fontSize: 12 }}>{out ? "→" : "←"}</span>
                <span style={{ fontSize: 13, color: "#6e6e73" }}>{e.verb}</span>
                <span style={{ fontSize: 13.5, fontWeight: 600, flex: 1, minWidth: 0 }}>{nodeName(other)}</span>
                <span aria-hidden title={PROV[e.prov].label} style={{ width: 6, height: 6, borderRadius: 3, background: PROV[e.prov].color, flex: "none" }} />
              </button>
            );
          })}
        </Section>
      ) : null}

      {rules.length ? (
        <Section title="Rules that run through it">
          {rules.map((r) => (
            <button key={r.id} type="button" onClick={() => onTrace(r.id)} className="hover:bg-[rgba(0,0,0,.035)]" style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "7px 8px", margin: "0 -8px", border: 0, borderRadius: 10, background: "transparent", cursor: "pointer", font: "inherit", color: "inherit", textAlign: "left", opacity: r.at <= t ? 1 : 0.38 }}>
              <RuleDot rule={r} />
              <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 600 }}>{r.title}</span>
              <span style={{ fontSize: 12, color: "#a35f00", whiteSpace: "nowrap" }}>trace →</span>
            </button>
          ))}
        </Section>
      ) : null}

      {instances.length ? (
        <Section title={node.prov === "erp" ? "Values from the ERP" : "Seen on screen"}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {instances.map((i) => (
              <span key={i} style={{ fontFamily: "var(--font-mono)", fontSize: 12, padding: "4px 9px", borderRadius: 10, background: "rgba(0,0,0,.045)", color: "#3a3a3c" }}>{i}</span>
            ))}
          </div>
        </Section>
      ) : null}

      {alsoIn.length ? (
        <Section title="Also part of these roles">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {alsoIn.map((a) => <Chip key={a} text={`${a} · not captured`} bg="rgba(59,130,246,.1)" ink="#1f5fcf" />)}
          </div>
        </Section>
      ) : null}
    </>
  );
}

export function RuleDot({ rule, size = 24 }: { rule: Pick<OntRule, "kind" | "displayId">; size?: number }) {
  const c = KIND[rule.kind].color;
  return (
    <span aria-hidden style={{ width: size, height: size, flex: "none", borderRadius: size / 2, background: `radial-gradient(circle at 35% 30%,${hexA(c, 0.75)},${c})`, color: "#fff", fontSize: size * 0.42, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center", boxShadow: `0 0 8px ${hexA(c, 0.45)}` }}>
      {rule.displayId}
    </span>
  );
}

function RuleMode({ ont, rule, t, nodeName, onPickNode, onTrace }: { ont: Ontology; rule: OntRule; t: number; nodeName: (id: string) => string; onPickNode: (id: string) => void; onTrace: (id: string | null) => void }) {
  const tl = ont.timeline;
  const [policyOpen, setPolicyOpen] = useState(false);
  const k = KIND[rule.kind];
  const known = rule.at <= t;
  const corrected = rule.correction && rule.correction.at <= t;
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", paddingRight: 40 }}>
        <Chip text={`${k.label} · ${rule.displayId}`} bg={hexA(k.color, 0.14)} ink={k.color === "#8e8e93" ? "#6e6e73" : k.color} dot={k.color} />
        {corrected ? <Chip text="corrected in the debrief" bg="rgba(245,166,35,.14)" ink="#a35f00" /> : null}
        {!known ? <Chip text={`not known until ${when(tl, rule.at, rule.approx)}`} bg="rgba(0,0,0,.05)" ink="#6e6e73" /> : null}
      </div>
      <h2 style={{ margin: "14px 0 0", fontSize: 22, fontWeight: 700, letterSpacing: "-.02em", lineHeight: 1.2 }}>{rule.title}</h2>
      <div style={{ fontSize: 12.5, color: "#6e6e73", marginTop: 3 }}>Learned {when(tl, rule.at, rule.approx)}</div>

      {rule.logic.length ? (
        <div style={{ marginTop: 14, padding: 12, borderRadius: 18, background: "rgba(255,255,255,.8)", boxShadow: "inset 0 0 0 .5px rgba(0,0,0,.06)", display: "flex", flexDirection: "column", gap: 7 }}>
          {rule.logic.map((l, i) => (
            <div key={i} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, animation: `tc-rise .45s var(--ease-rise) ${i * 0.06}s both` }}>
              <span style={{ width: 54, flex: "none", fontFamily: "var(--font-mono)", fontSize: 10.5, fontWeight: 700, letterSpacing: ".04em", color: l.key === "THEN" ? "#1b8a4b" : l.key === "UNLESS" || l.key === "NOT" ? "#b4501f" : "#6a55d8" }}>{l.key}</span>
              {l.entity ? (
                <span style={{ fontSize: 12.5, fontWeight: 600, padding: "2px 8px", borderRadius: 9, color: l.entityIsRole ? "#1f5fcf" : "#3a3a3c", background: l.entityIsRole ? "rgba(59,130,246,.1)" : "rgba(0,0,0,.05)" }}>{l.entity}</span>
              ) : null}
              {l.attr ? <span style={{ fontSize: 13 }}>{l.attr}</span> : null}
              {l.op ? <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "#6e6e73" }}>{l.op}</span> : null}
              {l.value ? <span style={{ fontSize: 12.5, fontWeight: 600, padding: "2px 8px", borderRadius: 9, color: "#a35f00", background: "rgba(245,166,35,.12)" }}>{l.value}</span> : null}
            </div>
          ))}
        </div>
      ) : null}

      <Section title="In the expert's words">
        {rule.quotes.length ? (
          rule.quotes.map((q, i) => (
            <div key={i} style={{ padding: "8px 0", borderTop: i ? ".5px solid rgba(0,0,0,.06)" : "none" }}>
              <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.5 }}>“{q.text}”</p>
              <div style={{ fontSize: 12, color: "#8e8e93", marginTop: 3 }}>{q.source}{q.t && q.t !== "—" ? ` · ${q.t}` : ""}</div>
            </div>
          ))
        ) : (
          <p style={{ margin: 0, fontSize: 13.5, color: "#6e6e73", fontStyle: "italic" }}>{rule.noQuoteLabel}</p>
        )}
        {corrected && rule.correction ? (
          <div style={{ marginTop: 10, padding: 12, borderRadius: 16, background: "linear-gradient(180deg,rgba(255,240,214,.9),rgba(255,228,180,.6))" }}>
            {rule.correction.before ? <p style={{ margin: "0 0 4px", fontSize: 13, color: "#8e8e93", textDecoration: "line-through" }}>{rule.correction.before}</p> : null}
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.45 }}>“{rule.correction.text}”</p>
            <div style={{ fontSize: 12, color: "#a35f00", marginTop: 3 }}>corrected {when(tl, rule.correction.at, rule.correction.approx)}</div>
          </div>
        ) : null}
      </Section>

      {rule.path.length ? (
        <Section title="Path through the data">
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
            {rule.path.map((id, i) => (
              <span key={id} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                {i ? <span aria-hidden style={{ color: "#aeaeb2" }}>→</span> : null}
                <button type="button" onClick={() => onPickNode(id)} style={{ border: 0, cursor: "pointer", font: "inherit", fontSize: 12.5, fontWeight: 600, padding: "4px 10px", borderRadius: 11, background: "rgba(255,255,255,.9)", boxShadow: "inset 0 0 0 .5px rgba(0,0,0,.1)", color: "#1d1d1f" }}>
                  {nodeName(id)}
                </button>
              </span>
            ))}
          </div>
        </Section>
      ) : null}

      {rule.learners.length ? (
        <Section title="Learning it">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {rule.learners.map((l) => <Chip key={l.name} text={`${l.name} · ${l.label}`} bg={hexA(MASTERY[l.label].color, 0.14)} ink={MASTERY[l.label].ink} dot={MASTERY[l.label].color} />)}
          </div>
        </Section>
      ) : null}

      <Section title="Agent-ready">
        {rule.policy ? (
          <>
            <button type="button" onClick={() => setPolicyOpen((v) => !v)} aria-expanded={policyOpen} style={{ border: 0, cursor: "pointer", font: "inherit", fontSize: 13, color: "#a35f00", background: "transparent", padding: 0 }}>
              {policyOpen ? "Hide policy.json" : "Show what an agent loads (policy.json)"}
            </button>
            {policyOpen ? (
              <pre data-scroll="" style={{ margin: "8px 0 0", padding: 12, borderRadius: 14, background: "rgba(29,29,31,.92)", color: "#e8edf2", fontFamily: "var(--font-mono)", fontSize: 11.5, lineHeight: 1.5, overflow: "auto", maxHeight: 260, animation: "tc-rise .35s var(--ease-rise) both" }}>{rule.policy}</pre>
            ) : null}
          </>
        ) : (
          <p style={{ margin: 0, fontSize: 13, color: "#6e6e73" }}>{rule.policyNote ?? "Not agent-ready until the expert confirms the map."}</p>
        )}
      </Section>

      <button type="button" onClick={() => onTrace(null)} style={{ marginTop: 18, height: 38, padding: "0 16px", borderRadius: 19, border: 0, cursor: "pointer", font: "inherit", fontSize: 13.5, fontWeight: 600, color: "#1d1d1f", background: "rgba(255,255,255,.9)", boxShadow: "inset 0 0 0 .5px rgba(0,0,0,.1),0 1px 3px rgba(0,0,0,.06)" }}>
        Clear path
      </button>
    </>
  );
}
