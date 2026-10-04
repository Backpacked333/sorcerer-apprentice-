# Lane D status

Updated 2026-10-04 on `d/human-knowledge-ui`, with main `bf29290` integrated. This remains a focused presentation pass, not a claim of full Lane D acceptance.

## Simon branding · WD-2 / WD-5 / WD-10 / WD-12 / P1

- Merged on main and retained: visible branding is Simon in metadata, landing copy, shared app header, ERP links/banners, README, demo/submission copy and moonshot frame. The knowledge-first landing keeps its layout and direct confirmed-sample path with Simon's name and monogram.
- Technical identifiers, infrastructure names, team references and voice-agent configuration remain unchanged.
- Prior branding work reported 462 tests, typecheck, build and an agent production-build visual spot-check. That is not visual verification of this integrated revision; no human/live verification is claimed.
- No deployment or external submission changes are included.

## Done and merged (WP ids)

Already on main and retained here:
- WD-1: Capture/Map/Teach controller–View seams; logic remains with A/C.
- WD-13 / WD-3 / WD-4: scenario data, ERP field/save events, confirm strip, light ERP skin and PII marks.
- WD-2 / WD-5 / WD-11: presenter mode, personas, UI kit, error pages and workspace/companion layouts, including their shared CSS and ERP font.
- WD-10: demo room, README, pitch copy and moonshot frame.

Not yet merged. Implemented on this branch:
- WD-5 / N5: warmer tokens, loaded Inter and JetBrains Mono, visible keyboard focus, reduced-motion support; removed decorative glow and repeating animation.
- WD-12 / N5: knowledge-first landing with Work Maps as the primary destination; existing Capture, Teach and ERP paths retained; keyless mode explicitly labeled.
- WD-12 / N2 review follow-up: dynamically select the newest confirmed, nonempty `demo_` capture map through read-only store calls. The landing page links straight to that map and preselects it for Teach. Without an eligible sample, retain main's explicit **Load the sample Work Map** server action and synthetic-evidence disclosure; seeding happens only on submission with `ifMissing: true`, never during rendering. Real captures are not promoted as public samples.
- WD-6 / A1: a small expressive dot driven by the existing governor state, with native expandable timing details. No voice, microphone or privacy-state inference from the dot.
- WD-7 / M3: decision and literal expert reasoning before screenshots; evidence counts rather than confidence labels; draft/confirmed state; guardrail summaries separated from verbatim `quote.text`; missing evidence disclosed.
- Integration: the companion keeps its state/label/privacy copy and uses the quiet dot; the Work Map keeps frame URLs, regions, translations and the optional evidence matrix. Editing calls the existing `onMapChange` callback, which now persists in the controller, rather than sending a duplicate PUT from the view. The demo room uses the same safe sample selector as the landing page.
- New D-owned server-rendered presentation regression tests. No additional controller, runtime-contract, dependency or engine changes beyond main.

## Verified live by a human (who, when, what they did)

None. No live-provider, deployed, voice or screen-sharing verification claimed.

## Not verified yet (and the script to verify)

- Automated with main `bf29290` integrated: typecheck, all 565 tests (63 files, including 31 D presentation/selection cases), production build and diff whitespace check passed. Coverage includes Simon branding, URL-only frames, explicit sample-loading submission and no redirect when seeding fails. Build output confirms `/` and `/demo` render dynamically. No lint script is configured. A non-failing Vite config warning remains.
- Browser/keyless smoke not run in this session; UI testing needs approval.
- Prior `d/experience` status reported a keyless smoke pass and a capture hydration warning. That result is not verification of this integrated revision.
- UI check: open home at desktop and narrow widths; follow Work Maps/Capture/Practice/ERP links; tab to controls; open governor details; inspect a map's decision, literal reason, guardrail source and missing-frame state; verify the selected step is apparent; enable reduced motion.
- Human check: share a real ERP surface, answer a natural-pause question, use Pause/Scratch that, and confirm those controls still behave correctly. The dot is only a governor-state presentation, not proof of microphone/capture activity.

## Blocked on (lane, handshake id, what exactly)

- No publication blocker: Roy explicitly authorized this design to take precedence over overlapping UI changes.
- A/C: optional view-model fields from docs/03 §7 (`setCropTarget`, `tutorState`, `lastPatch`, `matrix`, etc.). Views tolerate absent fields.
- Main's durable-workspace, media, health and sample-loading contracts are retained. Deployed storage and fresh-workspace behavior are not verified in this presentation pass.
- Human: real voice/screen sharing, deployment QA, HackOS access, photo, three videos and submission remain outstanding.

## Next 3 things

1. Review this integrated presentation pass; no automatic merge.
2. Approved browser/keyless smoke plus the human voice/privacy check above.
3. Continue the remaining Lane D acceptance work on the reconciled seam without changing the knowledge-first, nonintrusive direction.

## Risks I see for the demo

- Shared tokens affect existing ERP and controller layouts; responsive browser regression testing is outstanding.
- Real-vision sessions retain companion layout until `setCropTarget` exists; keyless and `?share=0` retain the workspace.
- The map index still cannot hide empty sessions based on event count, which `listSessions` does not supply.
- No deployed/live-success claim, submission action, or completed scenario/judge-flow claim is implied by this visual pass.
