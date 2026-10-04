# Lane D status

Updated on branch `claude/clever-pasteur-449llv` (Liquid Glass redesign). Nothing below is a live human verification unless it says who and when.

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

1. **Self-tab capture, card painted out:** open `/capture` at 1440 wide, consent, Start, choose **This tab**. Open "Show the mechanism". The "What I see" preview should show the companion card area and the contact/IBAN fields black. The ledger should say Tacit's card is painted out.
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
