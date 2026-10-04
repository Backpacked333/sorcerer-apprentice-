"use client";
// The mechanism sheet: "Prove it" runs the routine queue against policy.json from the confirmed map,
// and (presenter mode) the capture metrics + recompile.

import { useState } from "react";
import { Drawer } from "@/components/ui/Drawer";
import { Stat } from "@/components/ui/Stat";
import { GlassButton, Pill } from "@/components/glass";
import type { MapVM } from "@/components/views/map.vm";

export function AutopilotSheet({ vm, presenter }: { vm: MapVM; presenter: boolean }) {
  const [tools, setTools] = useState(false);
  const map = vm.map!;
  const name = map.expert.name;
  const confirmed = !!vm.confirmed || !!map.confirmedAt;
  const last = vm.autopilot?.[vm.autopilot.length - 1];
  return (
    <section className="glass-panel flex flex-col gap-3 p-4" style={{ borderRadius: 24 }} aria-label="Agent-ready guardrails">
      <div>
        <p className="text-[12px] font-semibold text-[#8e8e93]">Agent-ready guardrails</p>
        <p className="mt-1 text-[13.5px] leading-[1.45] text-[#3a3a3c]">The Work Map as instructions an agent can load. People keep the judgment calls.</p>
      </div>
      <GlassButton
        variant="amber"
        size={40}
        className="w-full"
        data-testid="map-autopilot-run"
        onClick={() => void vm.runAutopilot()}
        disabled={vm.autopilotRunning || !confirmed}
        loading={vm.autopilotRunning}
        title={confirmed ? "" : "confirm the map first"}
      >
        {vm.autopilotRunning ? "running…" : "Prove it: load policy.json and run the routine queue"}
      </GlassButton>
      {!confirmed && <p className="text-[12px] text-[#8e8e93]">Unlocks once {name} confirms the teach-back.</p>}
      {vm.autopilot && (
        <ul className="m-0 flex list-none flex-col gap-2 p-0 text-[13px]">
          {vm.autopilot.map((s) => (
            <li key={s.invoice} className="flex items-start gap-2" style={{ animation: "tc-rise .5s var(--ease-rise, cubic-bezier(.2,.9,.3,1)) both" }}>
              <Pill tone={s.outcome === "halted" ? "red" : s.outcome === "flagged" ? "blue" : "green"} dot>{s.outcome}</Pill>
              <span className="min-w-0 flex-1 leading-[1.45]">
                <span className="font-mono text-[12px] text-[#8e8e93]">INV-{s.invoice}</span>{" "}
                {s.supplier}, €{Math.abs(s.amount).toLocaleString("en-IE")}: {s.reason}
                {s.quote && <span className="mt-0.5 block text-[#6e6e73]">“{s.quote}”</span>}
              </span>
            </li>
          ))}
          {!vm.autopilotRunning && last?.outcome === "halted" && (
            <li className="text-[13px] font-medium text-[#a35f00]">Stopped where {name} would. The rest of the queue waits for a person.</li>
          )}
        </ul>
      )}
      {presenter && (
        <Drawer open={tools} onToggle={() => setTools((v) => !v)} title="Show the mechanism">
          <GlassButton onClick={() => void vm.recompile(true)} disabled={vm.compiling} loading={vm.compiling}>{vm.compiling ? "compiling…" : "Recompile"}</GlassButton>
          {vm.metrics && (
            <div className="grid grid-cols-2 gap-2">
              <Stat label="live questions" value={vm.metrics.liveQuestions} />
              <Stat label="per 10 min" value={vm.metrics.questionsPer10Min} />
              <Stat label="interrupted typing" value={vm.metrics.interruptionsWhileTyping} />
              <Stat label="pause to first word" value={vm.metrics.medianPauseToFirstWordSecs === null ? "–" : `${vm.metrics.medianPauseToFirstWordSecs}s`} />
              <Stat label="filled live / narration" value={`${vm.metrics.slotsFilledLive} / ${vm.metrics.slotsFilledNarration}`} />
              <Stat label="filled in debrief" value={vm.metrics.slotsFilledDebrief} />
              <Stat label="frames seen / kept" value={`${vm.metrics.framesSeen} / ${vm.metrics.framesKept}`} />
              <Stat label="redacted / struck" value={`${vm.metrics.entitiesRedacted} / ${vm.metrics.secondsStruck}s`} />
            </div>
          )}
        </Drawer>
      )}
    </section>
  );
}
