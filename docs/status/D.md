# Lane D status

## Roy-authorized profile integration (M2)
- Work Map has a collapsible proposed-role-profile view with literal quotes and timestamps.
  It explicitly distinguishes draft relationships from executable, confirmed tutor rules.
- Automated keyless regression checks only; no human visual/voice acceptance claimed.
- Failed initial compiles now show an error and retry action, rather than an endless
  loading state. Static-render regression passes; interactive acceptance remains open.

Updated on branch `d/experience`. Not merged. Nothing below is a live human verification.

## Done on this branch (not merged)

- WD-1 seam: `CaptureClient`, `MapClient` and `TeachClient` build a view-model and return the view. Views are presentational.
- WD-13 scenario: expert 4470–4474, new-hire cost centers start empty, dates in 2025, contact fields on the invoice only.
- WD-3 / WD-4 ERP: one `field_changed` per text edit, `save_intent`, confirm strip, POSTED, light ERP skin, PII marks and `tacit-erp-pii`.
- WD-2: presenter flag, persona cards, queue labels, Teach starts only on a confirmed map.
- WD-5: tokens, Inter and JetBrains Mono, IBM Plex on the ERP, UI kit, `error.tsx` uses `retry`.
- WD-11 / WD-6 / WD-7 / WD-8: workspace layout, capture, map and teach views. Freeze strings the smoke selects are still in the DOM. The mechanism drawer starts closed, so the smoke opens it before it looks for Governor.
- WD-12 landing and WD-10 `/demo`, README, pitch copy, moonshot frame.

## Verified live by a human (who, when, what they did)

NOT YET. No human has driven voice, the share dialog, or a judge run on this branch.

## Not verified yet (and the script to verify)

NEEDS-HUMAN. Voice timing, interruption, echo and phrasing cannot be checked from here.

- HT-2 ERP: `/erp?queue=expert` lists 4470–4474. Open 4471 and read the contact block. On `/capture?share=0`, open the mechanism, type an asset number, Tab, and confirm one `field_changed`. Post, confirm, and read the POSTED banner. On a new-hire invoice, Post with no cost center and confirm nothing is saved.
- HT-4 workspace: `/capture` at full width shows the ERP frame and the companion. `/capture?layout=companion` at 480 px has no frame.
- HT-6 capture: presence, Pause, Scratch that, and the consent line. Say whether the question waited for a pause.
- HT-8 map: every judgment step shows a still or "No still kept", and a quote or "Not yet explained".
- HT-9 teach: wrong code on 4490 speaks before save and opens the replay. 4491 stays quiet. The header does not say guard. The mastery card is the outcome panel.
- HackOS login, credit codes, team photo, the three videos, and Submit project are NEEDS-HUMAN. Do not mark them done.

## Blocked on

- A and C: the view-model fields listed in docs/03 §7 (`setCropTarget`, `tutorState`, `lastPatch`, `matrix`, and the rest). The views render without them.
- B: `POST /api/demo/reset`, `GET /api/health`, frame `url`, and the hello helper. `/demo` falls back to the three queue resets plus disarm. The health strip says "Status unavailable" until `/api/health` exists.
- B: merge the courtesy edits in `scripts/smoke.mjs`, `lib/events.ts` and `lib/telemetry.ts`. This branch does not auto-merge.
- C: merge the courtesy edits in `app/map/page.tsx` and `app/teach/page.tsx` if they should land separately. They are in this branch so the index and the teach date label work.

## Next 3 things

1. Human: run the scripts above and write the result here. Do not write "verified" for voice until someone has heard it.
2. Human: post the seam hand-off and the scenario `CONTRACT:` after merge.
3. Human: HackOS, photo, videos, Submit project. Feature freeze 3:30 AM ET, submit by 7:30 AM ET, Sunday Oct 4, 2026.

## Risks I see for the demo

- `node scripts/smoke.mjs` against `npm run dev -- -p 3077` on this branch passed: the question window opened, the tutor intervened, the guard held 4494, and the independent success was recorded. A capture hydration warning was logged (the voice provider's first render). The 409 on invoice 4494 is the guard, and the page shows "Not posted". Voice, the share dialog, and a human judge run are still NEEDS-HUMAN.
- Real vision sessions stay in the companion layout until `setCropTarget` exists. Keyless and `?share=0` use the workspace.
- `listSessions` does not include an event count, so the map index cannot hide empty sessions.
- The meter text inside the drawer is 12 px. Companion text outside the drawer is on the 14 px scale.
