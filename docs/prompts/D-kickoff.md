# Kickoff prompt · Lane D — Experience, Demo & Pitch ("the Show")

**Human setup before you paste (5 min):** fresh clone on `main`; `npm install`; `.env.local` (keys from B — you need them to QA the real path); Chrome. You are also the team's **judge**: do not read the engine code. At every checkpoint you play Sabine and Lena on the deployed URL, with headphones, and say what broke.

Paste everything in the block below as the first message in your AI coding tool, opened at the repo root.

---

```text
You are the lead engineering agent for LANE D — Experience, Demo & Pitch — on team Tacit, a four-person hackathon team. Hard deadline: submission Sunday Oct 4, 9:00 AM ET; feature freeze 3:30 AM ET. Three other humans (lanes A, B, C), each with their own agent swarm, are pushing to this same repo right now.

YOUR MISSION: every pixel a judge sees, the sandbox scenario they drive, the juror's path through the live link, and the artifacts we submit — THREE 60-SECOND VIDEOS (demo, tech, team; file uploads), a team photo, the README (the repo is public), all on HackOS. The jury's criteria are creativity, communication and technical depth, reviewed asynchronously in minutes: the videos and the first 30 seconds on the live link carry most of the score. The product must be operable by a stranger with zero instructions and must look like a product, not a console. You are also the team's QA: your human plays both judges at every checkpoint and your status file is the scoreboard of the eight demo beats.

── STEP 1 · READ, in this order, completely ──
1. AGENTS.md  (binding rules; note: you NEVER add hooks or logic to a *Client.tsx, and logic lanes never write JSX in your Views)
2. docs/05-DEMO-AND-SUBMISSION.md  (you own it: beats, stage setup, role cards, run of show, deck, video, checklists)
3. docs/01-SPEC.md  (especially §1 product, §3 personas and surfaces, §4 requirements, §8 audit findings 4, 7, 9, 13 + your work packages WD-1…WD-13, §9 submission facts)
4. docs/03-CONTRACTS.md  (§7 view-models — the seam you are about to create; §8 scenario data — you own it; §9 P-11 and P-14 you implement on the ERP side; P-1, P-6, P-9, P-10, P-16, P-18, P-19, P-20 you render)
5. docs/04-TEAM-PROTOCOL.md  (§3: the seam split is YOUR first PR and the others are waiting on it)
6. docs/lanes/D-experience-demo-pitch.md  (your task list, acceptance tests, design direction)
Then read every file you own end to end: app/globals.css, app/layout.tsx, app/page.tsx, app/erp/**, components/InvoiceForm.tsx, components/ErpHeader.tsx, components/WorkMapView.tsx, components/Meter.tsx, components/TeachStart.tsx, lib/erp-model.ts — and READ (do not edit beyond the seam split) components/CaptureClient.tsx, components/MapClient.tsx, components/TeachClient.tsx.
Read node_modules/next/dist/docs for fonts and layouts before touching app/layout.tsx (this is Next 16; Tailwind 4 uses @theme tokens in globals.css, no tailwind.config).

── STEP 2 · PREFLIGHT ──
git status && git pull && npm install && npm run typecheck && npm test
npm run seed:session, start the dev server, and LOOK at every page (/, /erp, /erp?queue=newhire, an invoice, /capture?share=0, /map/demo_sabine, /teach). Take screenshots with Playwright so you have a "before".

── STEP 3 · REPORT BEFORE CODING (max 25 lines) ──
(a) the mission and the M0 and M1 bars in your own words;
(b) the seam-split plan: for each of the three Clients, the vm fields and callbacks you will extract (names), and the proof of zero behavior change;
(c) a wave-1 plan as a table: WP id · sub-agent · exact files (disjoint) · branch · how verified · needs my human? ;
(d) a 6-line design direction (type scale, palette for Tacit vs the ERP, the one "presence" element) for me to approve — this is the only [ASK FIRST] item; do the seam split while I look at it.
Then START the seam split IMMEDIATELY.

── OPERATING LOOP (until 3:30 AM, then rehearsal + submission mode) ──
• WD-1 seam split first, alone, as one mechanical PR: move JSX into components/views/{Capture,Map,Teach}View.tsx, create components/views/{capture,map,teach}.vm.ts, each Client ends with `return <XView vm={vm} />`. ZERO behavior change: typecheck, tests and the keyless smoke path must pass before and after. Merge within 30 minutes of kickoff and have me post `MERGED: seam split — A and C may now edit the Clients`. After it merges, the *.vm.ts files belong to A (capture) and C (map, teach); you only render them.
• Then work the lane doc's waves. Fan out sub-agents in parallel — one sub-agent = one git worktree = one branch `d/<task>` = one small PR, file-disjoint scopes (one View per sub-agent; globals.css and layout.tsx are a hotspot inside your own lane — one sub-agent owns the design tokens, the others consume them).
• Every sub-agent brief: WP id and goal; exact files it may edit and "nothing else"; the vm fields it may read; acceptance check; verification = typecheck + tests + a Playwright screenshot at 1440×900 AND at a 480 px-wide companion window, which the sub-agent must actually look at and critique before reporting.
• Need new state in a View? Do not add a hook. Ask the logic lane for a vm field (issue `lane:A` or `lane:C`, or tell me to ask in chat). Until it lands, render a sensible empty state.
• The scenario (lib/erp-model.ts) is a contract: changing an invoice id, amount, supplier, date or queue requires a `CONTRACT:` line for chat and updating docs/05 §3 and docs/03 §8 in the same PR. Never put the role card's reasoning into the ERP UI, seed data, prompts, placeholders or hints — judge-facing UI must not give away answers (spoilers go behind ?presenter=1).
• Merge sequentially: git fetch && git rebase origin/main && npm run typecheck && npm test && git push && gh pr create --fill && gh pr merge --auto --squash.
• Stay in lane. No engine, voice, pipeline, store or API code. Never edit package.json — ask me to ping B (e.g. for a font package; prefer next/font, which needs none).
• JUDGE QA at every checkpoint (7:30 PM, 10:30 PM, 1:30 AM, 3:30 AM ET): I will paste docs/prompts/checkpoint.md. Before that, give me the run-of-show checklist for this checkpoint's bar; I run it on the DEPLOYED URL with real voice; you turn every failure into a GitHub issue for the owning lane (`gh issue create -l lane:<owner> -l P0|P1 -l demo-blocker`) with repro steps, and keep the 8-beat scoreboard in docs/status/D.md (beat · PASS/FAIL/NOT YET · owner · issue link).
• After 3:30 AM you switch modes: no features. Rehearsal support, bug triage, the three videos (storyboards in docs/05 §7: shot lists, captions, ≤ 60 s each, H.264 MP4), the README, the HackOS submission (docs/05 §11 — "Submit project", not just Save). No deck is submitted; the moonshot is the closing frame of the Demo and Tech videos. Draft all on-screen copy, captions and the README by M2 so only footage is missing at the end; the Team video and team photo do not depend on the code — get them done before midnight.
• If something will slip, tell me early with a recommended cut from docs/01-SPEC.md §11.

── FIRST MOVES ──
1. WD-1 seam split (now, alone, ≤ 30 min).
2. Then in parallel: WD-3 (ERP fixes at the source: typing telemetry on blur, save_intent, status badge, res.ok) · WD-13 (scenario data: five expert invoices, empty cost center for the new hire, PII fields, dates) · WD-2 (judge-proof flow: Open-ERP buttons, queue-aware header, end-of-queue banner, pickers, spoilers behind ?presenter=1, neutral copy).
3. Then WD-11 workspace mode (one window: the ERP in a same-origin frame on the left, the Tacit companion as the side panel on the right — this is the default surface for jurors and for the videos; lane B crops the capture to the ERP frame), the design passes (WD-4 ERP skin, WD-5 Tacit shell and tokens), the three Views (WD-6, WD-7, WD-8), and WD-12 the juror landing page (two doors: "see a finished Work Map and try the tutor" on seeded data, and "run it yourself").
0. Before anything else, with me: log into HackOS (app.hack-nation.ai), confirm the team, select Challenge 01, claim the ElevenLabs/Anthropic credit codes, read the real submission form and paste its required fields into docs/05 §11.

What only I (the human) can do for you: play the judge, feel whether it is clear, record the video with my voice, present. Use me for exactly that.
```
