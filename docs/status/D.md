# Lane D status

## Responsive Capture / Teach browser regressions · N5 / M3

- Done: preserve the desktop Liquid Glass companion/left-hand mechanism layout; at narrow widths, stack and scroll them vertically. A responsive Capture-only inset accommodates the sheet plus non-overlay scrollbar at 320px. The preview stays mounted and the floating/occluder registrations are unchanged.
- Done: reserve horizontal space beside the embedded ERP only at 1024px and above. At smaller widths, keep the existing vertical clearance so invoice fields can scroll above the tutor rather than collapsing inside a 2px-wide card. Capture/Teach logic and business rules are unchanged.
- Done: wrap narrow ERP headings without changing column widths. Keep the ended Teach mastery sheet and tutor in a scrollable single column below 901px, retaining their desktop positioning and occluder registrations.
- Agent verification: recorded local/keyless testing reproduced the layout failures. Capture passes 320px/390px, 667px landscape, 780/781px breakpoint, desktop resize-back, separate companion layout and preview-node identity checks. Desktop sample → Work Map → before-save guidance → replay → corrected posting/mastery and platform/claims/demo checks passed. Mobile Teach corrected/coached and independent saves persisted with distinct mastery labels; 1024px headings and 1440px resize-back passed. Final mobile mastery, Ontology and fresh Capture retest are pending.
- Automated verification: typecheck, 821 tests across 91 files, production build and whitespace checks pass. CI on 9b1c3ab passed typecheck/tests but failed inside the unchanged IBM Plex Sans next/font compilation; the same build command passes locally and a fresh CI run is pending. No lint script is configured.
- Verified live by a human: not yet. Provider voice, microphone quality, real screen sharing and deployed QA remain unverified; local synthetic evidence is not live-provider proof.
- Next: finish mobile mastery/Ontology/Capture retest and settle CI on PR #65. No manual deployment or submission performed.
- Blocked on: final browser retest and CI rerun pending.

## Liquid Glass compatibility safeguards

- Direction: Roy clarified that Claude owns the design, UX, flows and added functionality. Preserve the Liquid Glass implementation rather than restoring the earlier knowledge-first layout or quiet dot; only functional safeguards and regression tests carry forward.
- Done: landing and demo entry select only confirmed, nonempty `demo_` capture maps; explicit sample loading re-reads eligibility after `seedDemo({ ifMissing: true })` and never redirects to a draft or empty map. The landing retains its platform mini-map, two doors, companion tour and company-map links.
- Done: the existing Teach replay's expand/shrink UX and glass styling are retained, with a region highlight aligned to the naturally sized expanded still. The redesigned Work Map's responsive aspect-ratio wrapper and evidence ordering are unchanged. The governor stays inside the mechanism sheet and reports unavailable state honestly before a decision exists.
- Verification: `npm run typecheck`, `npm test` (82 files, 757 tests), `npm run build`, and `git diff --check` pass. Presentation tests now exercise Claude's components and flows, not the superseded UI. No lint script or active pre-commit hook is configured; the existing non-failing Vite config warning remains.
- Verified live by a human: not yet. Browser/keyless smoke, real voice, screen sharing and deployed QA have not been rerun for this integration. Rendered markup tests do not prove browser geometry or interaction.
- Next: review the functional safeguards, then run browser and human verification against the redesigned flows. No deployment or submission performed.
- Blocked on: no automated-check blocker; live verification remains outstanding.

## Simon branding · WD-2 / WD-5 / WD-10 / WD-12 / P1

- Done: renamed visible product branding to Simon in page metadata, landing copy, shared app header, ERP return links/completion banners, README, demo/submission copy and moonshot frame.
- Scope: technical identifiers, infrastructure names, team references and voice-agent configuration remain unchanged.
- Verification: `npm run typecheck`, `npm test` (462 tests) and `npm run build` passed. Agent visual spot-check of the production build confirmed Simon on the landing page/tab title, Capture header, ERP return link and moonshot frame. No lint script is configured.
- Verified live by a human: not yet.
- Next: review and merge the branding PR; no deployment or external submission changes are included.
- Blocked on: none for the copy change.

## Liquid Glass redesign

Updated on branch `claude/clever-pasteur-449llv` (Liquid Glass redesign). Nothing below is a live human verification unless it says who and when.

Merged with `origin/main` (CaptureLoop voice turns, durable store, Simon branding): main's logic kept, the glass companion renders main's new state (sync errors). Visible product name is Simon throughout, including the redesign's new pages.

## Done on this branch

- **Design system** (`app/globals.css`, `components/glass/**`, `lib/ui/moods.ts`, `lib/ui/geometry.ts`): light Liquid Glass tokens, `tc-*` keyframes, orb with 13 moods derived only from real state, companion card with a measured height spring, overlays (field halo, connector cable, Noticed chip), timeline scrubber. One global reduced-motion rule; every one-shot animation ends on its correct state.
- **Capture**: full-width ERP with the companion floating bottom-right. Onboarding, capsule, ask, understood, struck, mechanism sheet and privacy ledger, all in glass. The card's rectangle is painted out of the diff thumbnail, vision frame and still before any read or encode (`lib/capture-frame.ts`), but only on a verified self-tab capture. The ledger says which case applies. Over-ERP overlays render only when no real frame capture is live.
- **Work Map / debrief / teach-back**: step rail, gaps bar, open questions, step detail with still and verbatim quote, floating debrief and teach-back card, export and Teach gated on `confirmedAt`.
- **Teach**: full-width new-hire ERP with the floating tutor card, replay row, history, mastery sheet (T3 labels, counts not percentages).
- **MB-ERP skin**: navy sidebar, bill page, confirm popover. Telemetry, guard and smoke selectors are unchanged.
- **Claims workbench** (`/claims`, fictional Kestrel Bay Mutual): a second sandbox app. Vision-only and labelled as such; the vision route takes `app: "claims"`; claim events get their own steps.
- **Platform** (`/platform/**`): company map, role memory, ontology and sessions, derived only from stored sessions and confirmed maps.
- **Demo mode**: `/demo/companion` (scripted glow-state tour plus a gallery of every state) and `/platform/demo/**`. Fictional Larkspur Telecom data, persistent "Demo data — fictional" banner, never imported by live modules (tested).
- **Landing**: the mockup's sections, with the two doors kept under the hero and a health strip that tells the truth.
- **Checks run by agents**:
  - `npm run typecheck` is clean and `npm test` passes 61 files, 623 tests.
  - `node scripts/smoke.mjs` passes. It now also sweeps every new route for status 200 and zero console errors.
  - Adversarial review: 1 blocker and 4 major findings, all fixed (`scratchpad` REVIEW.md).

## Verified live by a human (who, when, what they did)

NOT YET.

## Not verified yet: 2-minute human script (needs real Chrome, mic, headphones)

1. **Self-tab capture, card painted out:** open `/capture` at 1440 wide, consent, Start, choose **This tab**. Open "Show the mechanism". The "What I see" preview should show the companion card area and the contact/IBAN fields black. The ledger should say Simon's card is painted out.
2. **Governor still asks with the card on screen:** re-code 4471 4711 → 0400, then stop talking and typing. The companion should go quiet → pausing → asking, and the question should name the invoice and the change. Record the pause-to-first-word time.
3. **Wrong surface:** start again but share a different window. The UI should say the surface is not this tab, and the network tab should show no `/api/vision` requests in workspace mode.
4. **Mechanism toggle keeps vision alive:** during a real share, toggle "Show/Hide the mechanism" three times. The preview should keep updating.
5. **Scratch that:** say "…scratch that" mid-answer. The red band should appear, the ledger should tick, and the struck text must not appear on the Work Map.
6. **Teach before save:** on `/teach/<id>`, open 4490, pick 4711, reach for Post. The tutor should speak before the save and the replay row should open. 4491 should stay quiet.
7. **Claims vision (with an AI key):** on `/capture?app=claims`, share this tab and change the cause of loss on a claim. Expect a `seen` event with the claim id and no ERP badge.
8. **Motion feel:** watch the card's mood changes, the cable and the halo during steps 2–6. Note any jump, flicker or stutter.

## Blocked on

- Real voice, share picker and timing: NEEDS-HUMAN (above).
- The Capture Handle API in Chrome on a self-capture is unverified. If Chrome reports no handle, the workspace falls back to the aspect check by design. A plain tab-mode share is never treated as self.

## Next 3 things

1. A human runs the script above and records the result here.
2. Record the demo, tech and team videos on the deployed build.
3. HackOS submission (NEEDS-HUMAN).
