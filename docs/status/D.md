# Lane D status

Updated 2026-10-03 on `d/human-knowledge-ui`. This is a focused presentation pass, not the full Lane D implementation.

## Done and merged (WP ids)

Not merged. Implemented on this branch:
- WD-5 / N5: warmer tokens, loaded Inter and JetBrains Mono, visible keyboard focus, reduced-motion support; removed decorative glow and repeating animation.
- WD-12 / N5: knowledge-first landing with Work Maps as the primary destination; existing Capture, Teach and ERP paths retained; keyless mode explicitly labeled.
- WD-6 / A1: a small expressive dot driven by the existing governor state, with native expandable timing details. No voice, microphone or privacy-state inference from the dot.
- WD-7 / M3: decision and literal expert reasoning before screenshots; evidence counts rather than confidence labels; draft/confirmed state; guardrail summaries separated from verbatim `quote.text`; missing evidence disclosed.
- New D-owned server-rendered presentation regression tests. No controllers, runtime contracts, dependencies or engine logic changed.

## Verified live by a human (who, when, what they did)

None. No live-provider, deployed, voice or screen-sharing verification claimed.

## Not verified yet (and the script to verify)

- Automated: typecheck, full Vitest suite, production build and diff whitespace check passed on this branch before the final main update; rerun before push. No lint script is configured.
- Browser/keyless smoke not run in this session; UI testing needs approval.
- UI check: open home at desktop and narrow widths; follow Work Maps/Capture/Practice/ERP links; tab to controls; open governor details; inspect a map's decision, literal reason, guardrail source and missing-frame state; verify the selected step is apparent; enable reduced motion.
- Human check: share a real ERP surface, answer a natural-pause question, use Pause/Scratch that, and confirm those controls still behave correctly. The dot is only a governor-state presentation, not proof of microphone/capture activity.

## Blocked on (lane, handshake id, what exactly)

- No publication blocker: Roy explicitly authorized this design to take precedence over overlapping UI changes.
- PR #18 (`d/experience`) independently changes these same surfaces and adds the controller seam. Reconcile shared CSS, WorkMapView and Presence interfaces before both changes land; do not silently replace this direction.
- Full compact companion/workspace and frame-URL handling still need the A/C seam and B contracts. This PR does not claim those work packages complete.

## Next 3 things

1. Review and merge-order coordination for the overlapping D presentation work; no automatic merge.
2. Approved browser/keyless smoke plus the human voice/privacy check above.
3. Continue the remaining Lane D acceptance work on the reconciled seam without changing the knowledge-first, nonintrusive direction.

## Risks I see for the demo

- Shared tokens affect existing ERP and controller layouts; responsive browser regression testing is outstanding.
- Existing controllers still show technical information outside the meter. This is not yet the full minimal observation layout.
- No deployed/live-success claim, submission action, or completed scenario/judge-flow claim is implied by this visual pass.
