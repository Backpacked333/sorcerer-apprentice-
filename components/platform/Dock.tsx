"use client";
// "Watch it grow" dock: the glass TimelineScrubber wired to a platform Timeline and a usePlayhead.
import { useMemo } from "react";
import { TimelineScrubber, type Playhead } from "@/components/glass";
import type { Timeline } from "@/lib/platform/types";
import { asOfLabel, lastLine, scrubberBeads } from "./meta";

export function Dock({ timeline, ph, counts, playLabel, before }: { timeline: Timeline; ph: Playhead; counts: string; playLabel: string; before: string }) {
  const beads = useMemo(() => scrubberBeads(timeline.beads), [timeline.beads]);
  const range = useMemo<[number, number]>(() => [timeline.start, timeline.end], [timeline.start, timeline.end]);
  // Play is only offered when the data has two distinct session times (Timeline.canPlay).
  const onPlay = timeline.canPlay ? ph.toggle : () => {};
  return (
    <TimelineScrubber
      range={range}
      t={ph.t}
      onT={ph.setT}
      beads={timeline.canPlay ? beads : beads.slice(0, 1).concat(beads.slice(1).filter((b) => b.at !== beads[0]?.at))}
      ticks={timeline.ticks}
      today={timeline.today}
      playing={ph.playing}
      onPlay={onPlay}
      label={asOfLabel(timeline, ph.t)}
      sub={lastLine(timeline.beads, ph.t, before)}
      counts={counts}
      playLabel={playLabel}
    />
  );
}
