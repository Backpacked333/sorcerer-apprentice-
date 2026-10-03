# 📦 LANE D — Experience, Demo & Pitch

> **Your role in one line:** You own HackOS, the screens, the videos and the submission. You play the judge at every checkpoint.

---

## 🧭 HOW TO USE THIS FILE — do these steps in order

| Step | What you do | Who / what it goes to | When |
|---|---|---|---|
| **1** | Setup your machine | you (terminal) | right now |
| **2** | **SEND MESSAGE #1** — the kickoff prompt (Section ③) | 👉 your AI tool, as its **first message, alone** | after setup works |
| **3** | Answer your AI's short report, then let it work. Run the human test scripts it hands you. | you ↔ AI | all night |
| **4** | **SEND MESSAGE #2** — the checkpoint prompt (Section ④) | 👉 your AI tool | at **7:30 PM, 10:30 PM, 1:30 AM, 3:30 AM ET** |
| **5** | **SEND MESSAGE #3** — the review prompt (Section ⑤) | 👉 a **fresh** AI chat, with the branch checked out | before merging anything risky |
| — | Section ⑥ is your task list | **do NOT paste it** — your AI reads it from the repo itself | reference |
| — | Section ⑦ is the team plan | read once (5 min) | before Step 2 |

**Before you start:** Wait for B's message `REPO READY`. Meanwhile do HackOS (step 1b).
**Key times (ET):** 7:30 PM M1 · 10:30 PM M2 · 1:30 AM M3 · **3:30 AM feature freeze** · **7:30 AM submit** · 9:00 AM hard deadline.

---

## ① STEP 1 — Setup (10 min, terminal)

### ▶ STEP 1b — (D only) HackOS, while you wait (10 min)
Log into `app.hack-nation.ai` → make sure all 4 teammates **accepted** the team invite → select **Challenge 01 · The AI Apprentice** → **claim the ElevenLabs + Anthropic credit codes** (first-come, first-served) → read the real submission form → take the **team photo** now.

### ▶ STEP 1c — everyone
1. Free disk: you need **≥ 10 GB**.
2. `git clone <repo link from B>` → `cd` into it → `npm install`
3. `cp .env.example .env.local` → paste the keys B sent you. **Never commit this file** (the repo is public).
4. Check it runs: `npm run typecheck && npm test && npm run seed:session && npm run dev`
5. Open `http://localhost:3000` and click through: `/erp` → `/capture?share=0` → `/map/demo_sabine` → `/teach`.
6. Open your AI coding tool (Claude Code / Cursor / Codex) **at the repo root**. It auto-loads `AGENTS.md` — you don't paste that.

✅ Done when the app runs locally. → go to Step 2.

---

## ② STEP 2 — 📨 SEND MESSAGE #1 to your AI (copy everything inside the box in Section ③, paste as ONE message, nothing else with it)

---

## ③ ✂️ MESSAGE #1 — KICKOFF PROMPT · copy from here ⬇️

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


## ✂️ end of MESSAGE #1 ⬆️

---

## ④ ✂️ MESSAGE #2 — CHECKPOINT PROMPT · paste at 7:30 PM, 10:30 PM, 1:30 AM, 3:30 AM (replace `<M1|…>` and `<A|B|C|D>` with **D**)

# Prompt · Integration checkpoint (every lane, at M1 · M2 · M3 · M4)

Paste this into your orchestrator at each checkpoint time (7:30 PM · 10:30 PM · 1:30 AM · 3:30 AM ET). It takes about ten minutes and ends with a status file the whole team reads.

---

```text
CHECKPOINT <M1|M2|M3|M4> for lane <A|B|C|D>. Stop starting new work. Do the following in order and report tersely.

1. LAND WHAT IS GREEN
   - List every open branch/worktree/PR of this lane with its state.
   - For each that passes `npm run typecheck && npm test`: rebase on origin/main, push, merge. For each that does not: leave it unmerged and say why in one line. Never merge red.
   - Then: git checkout main && git pull && npm install && npm run typecheck && npm test. Paste the tail.

2. PROVE THE CHECKPOINT BAR
   - Read the bar for this checkpoint in docs/04-TEAM-PROTOCOL.md §4 and the "Done when" lines for this checkpoint in docs/lanes/<lane>.md.
   - For each line, state: PASS (with the evidence: a test name, a log line, a metric) | FAIL | NEEDS-HUMAN.
   - For every NEEDS-HUMAN item, write the exact 2-minute script my human must run (URL to open, what to click or say, what they must see or hear). Do not write "verified" for anything only a human can verify.

3. KEYLESS INSURANCE
   - Run the keyless path (seed + smoke, per AGENTS.md §5). If it is broken by this lane's changes since the last checkpoint, the fix is P0 and comes before everything else.

4. CONTRACTS
   - List every contract change this lane made since the last checkpoint (docs/03-CONTRACTS.md). Confirm each is additive and documented. List every contract change this lane is WAITING on from another lane (with the handshake id from docs/01-SPEC.md §8.4).

5. ISSUES
   - `gh issue list -l lane:<lane>` — summarize open P0/P1 issues assigned to this lane. File new issues for anything found above that belongs to another lane (`gh issue create -l lane:<owner> -l P0|P1`).

6. CUT OR KEEP
   - If any P0 work package due at this checkpoint is not done: give an honest estimate, and say which item from the cut list (docs/01-SPEC.md §11) you recommend cutting to protect it. At M4: list everything unmerged and recommend "ship without" for each.

7. WRITE docs/status/<lane>.md (overwrite) with exactly these sections and commit it:
   ## Checkpoint <M?> — <time ET>
   ### Done and merged (WP ids)
   ### Verified live by a human (who, when, what they did)
   ### Not verified yet (and the script to verify)
   ### Blocked on (lane, handshake id, what exactly)
   ### Next 3 things
   ### Risks I see for the demo

Then give me a five-line summary I can paste into the team chat.
```


## ✂️ end of MESSAGE #2 ⬆️

---

## ⑤ ✂️ MESSAGE #3 — PRE-MERGE REVIEW · paste into a FRESH chat before merging something risky (lane = **D**)

# Prompt · Pre-merge review (any lane)

Paste this before merging anything non-trivial, or have your orchestrator run it as a **fresh sub-agent that sees only the diff** (a reviewer that wrote the code will agree with itself).

---

```text
You are reviewing a pull request for the Tacit hackathon repo. You did not write this code. Be skeptical and fast.

Read first: AGENTS.md (the non-negotiables and the ownership table) and docs/03-CONTRACTS.md.

Then review ONLY the diff of the current branch against origin/main:
  git fetch origin && git diff origin/main...HEAD

Report findings in this order, most severe first. For each: file:line, what breaks, the smallest fix.

1. LANE VIOLATIONS — any file changed that is not owned by lane <A|B|C|D> per AGENTS.md §3. (A courtesy PR may touch exactly one foreign file.)
2. CONTRACT BREAKS — any rename, removal or type/meaning change of something in docs/03-CONTRACTS.md; any additive contract change that did not update docs/03-CONTRACTS.md in the same diff.
3. NON-NEGOTIABLES (AGENTS.md §4) — hardcoded invoice ids / thresholds / dialogue; a Quote that is not a verbatim substring of expert speech; a rule created without a stated trigger; the agent able to speak outside a turn; a vision event labeled as dom or vice versa; a struck item that survives somewhere; a tutor/guard/export that loads an unconfirmed map; anything from the private role card (docs/05 §3) encoded into prompts, seed data, or the live path.
4. CORRECTNESS — logic bugs with a concrete failing input. Race conditions around: the mic gate, consent epoch, stale vision responses, tool-result ordering, effects that re-create intervals.
5. KEYLESS MODE — does `npm run seed:session` + the smoke path still work with no keys? Does every new real-service call have a labeled fallback?
6. TESTS — is there a new test file for new logic (not edits to lib/engines.test.ts unless this is lane C)? Do the tests assert the behavior or just execute it?
7. SCOPE — which requirement ID (docs/01-SPEC.md §4) or work package (§8.3) does this serve? If none, say "out of scope".

Run: npm run typecheck && npm test. Paste the tail of the output.

End with exactly one line:
VERDICT: MERGE | FIX-THEN-MERGE (list the must-fix items) | DO-NOT-MERGE (why)
Do not rewrite the code yourself. Do not pad the review with style nits.
```


## ✂️ end of MESSAGE #3 ⬆️

---

## ⑥ 📋 YOUR TASK LIST — reference only, DO NOT PASTE (your AI reads `docs/lanes/D-experience-demo-pitch.md`)

# Lane D — Experience, Demo & Pitch — "the Show"

> **Mission.** Every pixel a juror sees, the sandbox scenario they drive, their path through the live link, and what we submit: three 60-second videos, a team photo, the README, the HackOS form. You are also the team's QA.
> **The human in this lane** has not read the engine code and therefore behaves like a judge: plays Sabine and Lena on the deployed URL at every checkpoint, records the videos, presses "Submit project".
> **Success in one sentence:** a stranger opens the live link in a fresh Chrome profile and, with zero instructions, runs Capture → Map → Teach in one window and understands what they saw — and our three minutes of video show the same thing with the agent's real voice.

Sources: `AGENTS.md`, `docs/01-SPEC.md` (§8.3 is the authoritative WP list), `docs/02-PLATFORM-FACTS.md`, `docs/03-CONTRACTS.md`, `docs/04-TEAM-PROTOCOL.md`, `docs/05-DEMO-AND-SUBMISSION.md`, the Oct 3 audit, and the code on `main` (file:line below refer to the baseline commit). Where audit and code disagree, the code wins and it is said so.

## 0. TL;DR

1. **WD-1 seam split merged by 5:30 PM.** A and C cannot touch the three Clients until it lands. Mechanical, zero behavior change, proven (§4 WD-1).
2. **Fix the sandbox at the source by M1** (WD-13, WD-3, WD-2): one `field_changed` per text edit, `save_intent`, POSTED readable on screen, empty cost center for the new hire, five expert invoices, PII to protect, no spoilers. Three other lanes' beats sit on these.
3. **Workspace mode is the default surface by M2** (WD-11): ERP frame on the left, ~420 px companion on the right with one calm presence element; the ERP wears a light enterprise skin (WD-4); Tacit gets fonts, a type scale and honest states (WD-5, WD-6).
4. **The juror's path works cold by M3** (WD-12, WD-7, WD-8, WD-9): `/` → two doors → Work Map with frame + verbatim quote on every judgment step → tutor catches the wrong code before save → outcome card. You test it on the deployed URL at every checkpoint and keep the 8-beat scoreboard in `docs/status/D.md`.
5. **Submission is three files and three links, not a deck** (WD-10): Demo, Tech, Team video (≤ 60 s each, H.264 MP4, file uploads), team photo, live link, public repo, "Submit project" confirmed by 7:30 AM. Copy by M2, Team video and photo before midnight, raw takes from M3.

Never: role-card reasoning in UI, seed, placeholders or hints · a hook or logic in a `*Client.tsx` · `fetch`, engines or the ElevenLabs SDK in a View · `package.json` · a fake meter or a percentage where a count is honest.

## 1. What you own, what you never touch

| You own (only lane D edits) | Notes |
|---|---|
| `app/globals.css`, `app/layout.tsx`, `app/page.tsx`, `app/icon.svg`, `public/` | design tokens are a hotspot inside the lane: one sub-agent at a time |
| `app/erp/**`, `components/InvoiceForm.tsx`, `components/ErpHeader.tsx` | ERP UI. The ERP server and guard (`lib/erp.ts`, `app/api/erp/**`, `app/api/teach/**`) are C's |
| `lib/erp-model.ts` | scenario data = contract §8: every change is announced `CONTRACT:` and updates `docs/03` §8 + `docs/05` §3 in the same PR |
| `components/views/*View.tsx`, `components/ui/**`, `components/WorkMapView.tsx`, `components/Meter.tsx`, `components/TeachStart.tsx` | all presentational JSX |
| `app/demo/**`, `README.md`, `docs/05-DEMO-AND-SUBMISSION.md`, `docs/status/D.md`, videos, photo, finalist deck | |

**Files this lane creates** (add each to `docs/04` §2 in the PR that creates it; ask B to mirror in `CODEOWNERS`): `components/views/{Capture,Map,Teach}View.tsx` · `components/views/{capture,map,teach}.vm.ts` (**created by D in WD-1, owned by A / C / C from the moment it merges**) · `components/ui/{Button,Tag,Panel,Presence,Stat,Stepper,QuoteCard,GuardrailCard,FrameThumb,AppShell,Drawer,Banner,EmptyState,PersonaCard,OpenErpButton,SessionList,BrowserCheck,Workspace}.tsx`, `components/ui/{usePresenter,useLayoutMode}.ts` · `components/erp/{PiiPublisher,ResetQueueButton,EmbedAware}.tsx` · `components/demo/HealthStrip.tsx` · `app/erp/layout.tsx`, `app/erp/erp.css` · `app/error.tsx`, `app/not-found.tsx` · `app/demo/page.tsx` · `lib/erp-ui.ts`, `lib/ui/{presence,layout,mapview,teachview,landing}.ts` (pure helpers so they can be unit-tested: vitest only runs `lib/**/*.test.ts` in a node environment) and their `*.test.ts` · `lib/erp-model.scenario.test.ts`, `lib/ui-copy.spoilers.test.ts`, `lib/views.seam.test.ts` · `scripts/d-shots.mjs` · `docs/pitch/{captions,readme-draft,hackos-fields,deck}.md`.

**Never touch** (issue `gh issue create -l lane:<owner> -l P0|P1`, or a ≤ 15-line courtesy PR the owner merges): the three `*Client.tsx` after WD-1 and the three `*.vm.ts` after WD-1 (A: capture; C: map, teach) · `components/voice.tsx`, `lib/governor.ts`, `lib/curiosity.ts`, `agents/**`, `app/capture/` (A) · `components/useScreenPipeline.ts`, `lib/events.ts`, `lib/telemetry.ts`, `lib/redact.ts`, `lib/store.ts`, `app/api/{vision,sessions,export,autopilot,health,demo}/**`, `scripts/{seed-session.ts,smoke.mjs}`, `.github/**`, `next.config.ts`, `package.json`, lockfile (B) · `lib/{workmap,compile,teachback,matcher,metrics,erp}.ts`, `lib/engines.test.ts`, `app/map/`, `app/teach/`, `app/api/{compile,teachback,teach,erp}/**` (C).

**Import rules for Views and `components/ui`** (contract §7, made precise): `import type` from anywhere is fine (`Meter.tsx:3` already type-imports `Decision` from `lib/governor`). Value imports allowed only from `react`, `next/link`, `components/ui`, `lib/ui/*`, and the pure display helpers `describeCond` / `describeAct` (`lib/workmap`) and `describeEvent` / `labelField` (`lib/events`). No `fetch(`, no `@elevenlabs/*`, no `lib/{governor,curiosity,matcher,compile,store,erp}` values. View-local `useState` for pure UI (a drawer open, a text draft) is allowed; anything logic reads belongs in the `vm`. A View reads a vm field only once its type is on `main` (no casts to reach a field that does not exist yet; render the empty state until it does). D-owned components that are *not* Views or `components/ui` (`TeachStart`, `InvoiceForm`, `components/erp/*`, `components/demo/*`, `app/demo`, server pages) may call documented HTTP routes and the read functions of `lib/store`.

## 2. Where the baseline stands in this lane

**Works keyless (verified by the audit run):** every page renders under `next start`; the ERP reads, patches and resets; the three modules run end to end with `?share=0`, typed answers and browser speech; 24/24 unit tests; `scripts/smoke.mjs` is deterministic only with the browser recognizer stubbed (it grabs the real microphone otherwise) and needs `CHROME_PATH` or `npx playwright install chromium`.

**Has never rendered or run:** a real JPEG still in `WorkMapView` or the replay (seed frames are 6 KB hand-drawn SVGs) · an audio clip on a quote · Scribe captions, agent-mode status chips, vision counters · any layout at companion width (only `lg:` two-column breakpoints exist: `CaptureClient.tsx:399`, `MapClient.tsx:226`, `TeachClient.tsx:275`) · the ERP inside a frame · the deployed URL.

**Design level:** tidy engineering console. 10–13 px text (`globals.css:23,30,35`), Inter and JetBrains Mono named but never loaded (`globals.css:15-16`, `layout.tsx:9-15`), no `:disabled` or `:focus-visible` styles (`globals.css:30-34`), no `error.tsx`, and the ERP wears the same dark amber skin as Tacit (`ErpHeader.tsx:5`, `InvoiceForm.tsx:74,100`), so on video the two apps read as one.

**Top defects this lane fixes (blunt):**

| # | Defect | Where | WP |
|---|---|---|---|
| 1 | Every keystroke in Asset number and Note posts a `field_changed` (96 junk question candidates in the audit replay; "would stop here" on the first character in Teach) | `InvoiceForm.tsx:114`, `:135` via `change()` `:38-45` | WD-3 |
| 2 | No telemetry when the save-confirm opens; `save_clicked` only after a 200, so "before save" means "after the 409" | `InvoiceForm.tsx:139-141`, `:66` | WD-3 |
| 3 | The screen never says POSTED: save sends `approved`; hold is a red outline; the button says "Save and post" even when holding; two ways to approve | `InvoiceForm.tsx:52`, `:126-131`, `:140`, `:144` | WD-3 |
| 4 | `save()` ignores `res.ok`: a 500 sets `inv` to `undefined` and crashes; a non-JSON body leaves "Saving…" forever | `InvoiceForm.tsx:54-55`, `:63` | WD-3 |
| 5 | 4490 arrives prefilled with the wrong code, so "reaches for opex" is not an action; three expert invoices cannot carry three questions; invoices dated in the future; no personal data on screen to protect | `lib/erp-model.ts:43-52` | WD-13 |
| 6 | The UI hands the judge the answers: rule list with conditions before Teach starts, per-invoice hints, "Open invoice 4490", "Rules in play", the scripted correction as a placeholder, "Asset number (capex only)" | `TeachClient.tsx:245-249`, `:257`, `:353`, `:364-373`; `MapClient.tsx:313`; `InvoiceForm.tsx:113` | WD-2, WD-8 |
| 7 | No guidance where it is needed: no link to the ERP (`CaptureClient.tsx:380`, `TeachClient.tsx:257`), header "Queue" always goes to the expert queue (`ErpHeader.tsx:15`), nothing says the queue is done, every tab is titled "Tacit · the AI Apprentice" | as cited; `layout.tsx:5` | WD-2, WD-3 |
| 8 | Teach defaults to the newest map, usually empty or unconfirmed, and lets you start on it | `TeachStart.tsx:8`, `:39` | WD-2 |
| 9 | The apprentice lives in a tab hidden behind the ERP: lights, question and the three controls are unreachable; pause needs a held mouse button | `CaptureClient.tsx:543` | WD-11, WD-6 |
| 10 | A guardrail's text (possibly a paraphrase) is printed in quotation marks; frames render `dataUrl` only; `confirmedBy` duplicates are used as React keys; the View PUTs the map itself | `WorkMapView.tsx:114`, `:67`, `:135`, `:18-21`; `TeachClient.tsx:299` | WD-7, WD-8 |
| 11 | The prediction card prints the expert's quote under the question (the answer is on screen); the header says "guard armed" even on an unconfirmed map | `TeachClient.tsx:359`, `:270` | WD-8 |
| 12 | Hardcoded personas and pronouns: "Lena", "Lena's queue", "Sabine's queue", "Sabine Koch", "her session", "her own words" | `TeachStart.tsx:9,36`; `app/erp/page.tsx:8-9`; `InvoiceForm.tsx:119`; `TeachClient.tsx:240,294,304` | WD-2 |

Audit vs code (code wins): the audit, by reading, expected the smoke to time out waiting for "Mastery card" (`smoke.mjs:169`) because the outcome panel is titled "Session outcome" (`TeachClient.tsx:314`). The run exits 0: the selector matches the End button's own label (`TeachClient.tsx:387`) before the button disappears. So that step proves nothing, and renaming that button breaks the smoke (freeze list, §6). Also wrong in the UI, not in the audit: `app/page.tsx:4` promises "three for the new hire"; the seed has five (`erp-model.ts:47-52`).

## 3. Checkpoint bars for this lane

Consistent with `docs/04` §4. "Deployed" = B's public URL (H10), fresh Chrome profile.

**M0 · 5:30 PM — Done when**
- WD-1 is on `main`; `npm run typecheck && npm test` green; the DOM-snapshot proof (§4 WD-1) shows zero diffs; `MERGED: seam split …` is posted.
- HackOS: all four accepted the invite, Challenge 01 selected, credit codes claimed, the real form's required fields pasted into `docs/05` §11. Team photo taken.
- The human approved the 6-line design direction. "Before" screenshots of every page exist (`scripts/d-shots.mjs --label before`).

**M1 · 7:30 PM — Done when**
- Typing `A-2025-118` then Tab in the ERP produces exactly one `field_changed` in the mechanism feed; the Post button opens a confirm and (once WB-4 is in) one `save_intent`; after Confirm the invoice shows a POSTED badge and banner; a forced 500 shows an inline error and the button recovers.
- Expert queue lists 4470–4474; every new-hire invoice opens with "Select cost center…"; the supplier block shows contact, email, IBAN; all dates are 2025; `CONTRACT:` posted; `npm test` green with `lib/engines.test.ts` untouched.
- Without `?presenter=1` no rule title, condition, invoice hint or scripted placeholder is visible anywhere; `lib/ui-copy.spoilers.test.ts` green. Teach start offers only confirmed, non-empty maps.
- ERP tab title is "MB-ERP · Accounts payable". The keyless smoke passes with the courtesy patch for the new ERP flow merged (§6); every other frozen string is untouched.
- Scoreboard row set "M1" written from a real run on the deployed URL.

**M2 · 10:30 PM — Done when**
- `/capture?share=0` (and every session whose capture can be cropped to the frame, H13) opens in workspace mode at 1440×900: ERP frame ≥ 1000 px wide in the light skin, companion 420 px, no page scroll; an invoice fits without scrolling inside the frame; `?layout=companion` gives the same companion at 480 px.
- Fonts load from the app (no system fallback); companion body text ≥ 14 px; one presence element; five lights only inside the mechanism drawer; Pause is a toggle; disabled, focus, loading, error, degraded states exist.
- A teammate who is not A or C played Sabine unscripted while you watched silently; beats 1–6 scored; every FAIL has an issue.
- `docs/pitch/captions.md`, `readme-draft.md`, `hackos-fields.md` are committed. Team video and photo are recorded (before midnight).

**M3 · 1:30 AM — Done when**
- Work Map: headline counts; clicking any judgment step or guardrail shows a still **and** a verbatim quote or an explicit "not captured" label; teach-back shows the rule diff after a correction; confirm state and "synced to tutor" visible; sample sessions labeled.
- Teach: wrong code on 4490 → tutor line + replay (still, changed field, quote, clip) → fix → outcome card with the four honest labels; no rule text visible to the learner before it is exercised.
- `/` has the two doors and the status strip; `/demo` resets and shows health.
- You played both judges on the deployed URL (beats 1–8 scored) and ran the zero-instruction test (HT-7) with someone who has never seen the UI. Raw takes of beats recorded.

**M4 · 3:30 AM — Done when**
- No open `lane:D` P0. Copy frozen. Raw recordings of every beat exist with the agent audible. The live link passed a full run in a fresh profile. README final except numbers. HackOS form re-read.
- 3:30–6:15 three rehearsals + recording · 6:15–7:15 cut · **7:30 submit** (page reads "Your project is submitted").

## 4. Work packages

Execution order. Titles, priorities, checkpoints and requirement ids are the spec's (§8.3). Handshake ids are the spec's §8.4 (H1–H14).

### WD-1 · Seam split   `[P0 · by M0 · Req —]`

**Why** — three files mix logic and JSX and three lanes would edit them at once (audit hotspots 6–8). Until this merges A and C are frozen out of `CaptureClient`, `MapClient`, `TeachClient`.

**Today** — `CaptureClient.tsx` 576 lines, `MapClient.tsx` 405, `TeachClient.tsx` 398; hooks, effects, handlers and JSX in one component each. All hooks sit above the first `return` in all three (last hook: `CaptureClient.tsx:349`, `MapClient.tsx:177`, `TeachClient.tsx:152-165`), so an unconditional `return <XView vm={vm} />` is safe.

**Build** — one rule decides what moves: *JSX and state that only JSX reads or writes go to the View; everything else stays; nothing is rewritten.* (Choice, in one line: `docs/04` §3 says the Client "keeps every hook", contract §7 gives the vm `submitTypedAnswer(text)` and no draft or toggle fields; the contract wins, so four pure-UI `useState`s move.)

| | Capture | Map | Teach |
|---|---|---|---|
| JSX that moves | pre-start `351-385`, started `387-566`, `Stat` `569-576` | loading `192-201`, main `211-382`, `wordCount` `391-393`, `Stat` `395-402` | loading `223-229`, pre-start `235-262`, started `264-397` |
| State that moves to the View | `answerDraft` `:33`, `showMechanism` `:37`, `drawing` `:38`, `draft` `:39` | `answer` `:31`, `correction` `:34` | none |
| Stays in the Client | everything in `26-349` except those four lines | `23-190`, derived values `203-209` (become `vm.progress`), `diffSentences` `385-389`, re-exports `404-405` | `28-221`, `card`/`missed` `231-232`; the `Replay` interface `20-26` moves into `teach.vm.ts` as `TeachReplay` |
| Loading / pre-start / started | View branches on `vm.started` | View branches on `vm.map === null` (uses `vm.compiling`) | View branches on `!vm.log \|\| !vm.map`, then `vm.started`, and shows the outcome when `vm.ended` |

View-models (D writes them; field names follow contract §7; types by `import type`):

```ts
// Reserved for P-23 (declared in capture.vm.ts and teach.vm.ts): optional, undefined until the owner wires it, so the workspace layout compiles from day one.
export type CropHandle = { setCropTarget?(el: HTMLElement | null): void; surface?: "browser" | "window" | "monitor" };

// components/views/capture.vm.ts — exactly contract §7 plus `source` (needed by the tag at CaptureClient.tsx:368) and the reserved CropHandle
export interface CaptureVM { started: boolean; expertName: string; task: string; consented: boolean;
  setExpertName(v: string): void; setTask(v: string): void; setConsented(v: boolean): void; start(): Promise<void>; endTask(): Promise<void>;
  sessionId: string; source: EventSource;
  voice: Pick<VoiceApi, "mode" | "connected" | "status" | "isSpeaking">; sttEngine: "scribe" | "webspeech" | "none";
  pipeline: Pick<ReturnType<typeof useScreenPipeline>, "videoRef" | "sharing" | "start" | "activity" | "framesSeen" | "framesSent" | "dropped" | "visionLatency" | "visionError" | "masks" | "addMask" | "clearMasks" | "paused"> & CropHandle;
  decision?: Decision; questionsLast10Min: number; budget: number;
  openWindow?: QuestionWindow & { phase: "asking" | "answering" }; partial: string;
  queued: Candidate[]; askedCount: number; guardrailAsked: boolean; toDebrief: number;
  events: ScreenEvent[]; candidateFor(eventId: string): Candidate | undefined; transcript: TranscriptSegment[];
  ledger: { framesSeen: number; framesKept: number; entitiesRedacted: number; secondsStruck: number };
  strike(): void; notNow(): void; holding: boolean; setHolding(b: boolean): void; submitTypedAnswer(text: string): void; synced: number | null; }

// components/views/map.vm.ts
export type MapPhase = "idle" | "asking" | "teachback" | "confirmed";            // moved from MapClient.tsx:21
export interface MapVM { sessionId: string; map: WorkMap | null; frames: Frame[]; compiling: boolean; note: string;
  phase: MapPhase; debriefOn: boolean; currentSlot: Slot | null; heard: string;
  teachback: { text: string; sure: string[]; unsure: string[] } | null; rounds: number;
  progress: { open: number; closed: number; total: number; evidenceOk: boolean; ready: boolean; judgment: number; guardrails: number } | null;
  metrics: ReturnType<typeof computeMetrics> | null; autopilot: AutopilotStep[] | null; autopilotRunning: boolean;
  voice: Pick<VoiceApi, "mode" | "connected" | "status" | "isSpeaking">; sttEngine: "scribe" | "webspeech" | "none";
  startDebrief(): Promise<void>; submitAnswer(text: string): Promise<void>; startTeachback(): void;
  confirm(yes: boolean, correction?: string): Promise<void>; recompile(llm: boolean): Promise<void>; runAutopilot(): Promise<void>; onMapChange(map: WorkMap): void; }

// components/views/teach.vm.ts
export interface TeachReplay { step?: Step; frame?: Frame; quote?: string; audioUrl?: string; rule?: string }
export interface TeachVM { log: SessionLog | null; map: WorkMap | null; started: boolean; ended: boolean; phase: "coached" | "independent"; source: EventSource;
  decisions: (TutorDecision & { t: number })[]; replay: TeachReplay | null; closeReplay(): void;
  card: ReturnType<Matcher["masteryCard"]>; missed: ReturnType<Matcher["masteryCard"]>; flaggedCount: number;
  voice: Pick<VoiceApi, "mode" | "connected" | "status" | "isSpeaking">;
  pipeline: Pick<ReturnType<typeof useScreenPipeline>, "videoRef" | "sharing" | "start" | "activity" | "visionLatency"> & CropHandle;
  currentInvoice?: string; events: ScreenEvent[]; start(): Promise<void>; endSession(): Promise<void>; }
```

Mapping rules the sub-agents apply literally:

1. Capture: `openWindow = openWin && governor.current.window ? { ...openWin, phase: governor.current.window.phase } : undefined`; `questionsLast10Min = governor.current.questionsInLast10Min(nowSecs())`; `budget = governor.current.config.maxPer10Min`; `events` = the memo at `:349`; `transcript = L.transcript` (the View keeps `.slice(-8)`); `ledger = { framesSeen: pipeline.framesSeen, framesKept: L.frames.length, entitiesRedacted: entitiesRedacted.current + pipeline.piiBlurred, secondsStruck: struck }` (line `433` "kept" reads `ledger.framesKept`); `toDebrief` = the filter at `:525`; `candidateFor` = the lookup at `:453`; `strike: () => strike()`; `submitTypedAnswer = (text) => { if (!text.trim() && !openWin?.answerText) return; void closeWindow("answered", { answerText: text.trim() || undefined }); }` (the form at `:482-487`; the View repeats the same guard, calls it, then clears its own draft).
2. Map: `submitAnswer = async (text) => { const slot = currentRef.current; const t = text.trim() || heardRef.current.trim(); if (!slot || !t) return; const m = await fill(slot, t); askNext(m); }` (form `:268-274`); `confirm` in the vm = `(yes, c) => yes ? confirm(true) : (() => { const t = (c ?? "").trim() || heardRef.current.trim(); return t ? confirm(false, t) : Promise.resolve(); })()` (form `:307-311`); `startTeachback = () => { if (map) void startTeachback(map); }`; `onMapChange = setMap`; `frames = session?.frames ?? []`; `progress` = lines `203-209` when `map` exists else `null`. Delete `setAnswer("")` (`:94`) and `setCorrection("")` (`:149`) from the Client; the View resets its drafts with `useEffect(() => setAnswer(""), [vm.map?.revision])` and `useEffect(() => setCorrection(""), [vm.rounds])` (a fill bumps `revision`, a correction bumps `rounds`). These two effects are the only new lines of behavior in the PR.
3. Teach: `events = log.events.filter((e) => e.kind !== "typing").slice(-8).reverse()` (`:378`); `currentInvoice = pipelineState.current.invoice`; `closeReplay = () => setReplay(null)`; `flaggedCount = log.flagged?.length ?? 0`; `card`/`missed` computed before the vm is built.
4. Every View starts with `"use client"`. Each Client's function body ends with `const vm: XVM = { … }; return <XView vm={vm} />;`. `VoiceProvider` wrappers (`CaptureClient.tsx:16-23` and equivalents) stay.
5. No copy, class name, element or attribute changes. No `data-testid` (that is the next PR). No reformatting of untouched lines.

**Zero-behavior-change proof** (all five, pasted into the PR body):
1. `npm run typecheck && npm test` → 24/24 before and after.
2. `git diff --stat origin/main` → exactly 3 files modified, 6 created.
3. `lib/views.seam.test.ts` (new): each Client source contains `return <CaptureView vm={vm} />` (resp. Map, Teach) and no `<main`, `<div`, `<button`, `className=`; each View contains no `fetch(`, no `@elevenlabs`, no value import from `@/lib/(governor|curiosity|matcher|compile|store|erp)`.
4. DOM snapshots: `node scripts/d-shots.mjs --dom before` in a clean `origin/main` worktree, `--dom after` on the branch, each against `npm run seed:session` + `npm run dev -- -p 3077` (own port per worktree), 1440×900, keyless, no microphone permission, states: `/capture?share=0` pre-start · started (consent ticked, Start) · started with the mechanism open · `/map/demo_sabine` · `/map/demo_sabine_confirmed` · `/teach?from=demo_sabine_confirmed&share=0` · teach pre-start · teach started · teach ended. Serialize `document.body.innerHTML`, replace `/[st]_[a-z0-9]+/g`, `/\d+(\.\d+)?s\b/g` and counters inside `.mono` with `#`, diff. Bar: empty diff.
5. A fresh reviewer sub-agent (sees only the diff, `docs/prompts/pre-merge-review.md`) lists every line that is not a move or one of the substitutions in rules 1–3.

**Time box: 30 minutes.** 0–3 branch `d/seam-split`, read · 3–18 three sub-agents, one per Client (file-disjoint: `XClient.tsx` + `XView.tsx` + `x.vm.ts`) · 18–25 proofs · 25–30 merge. One PR, three commits (the ≤ 400-line rule is waived for a pure move; say so in the PR body). If one Client fails its proof at minute 25, drop that commit, merge the other two, tell the owning lane its file stays frozen, and land the third within 15 minutes.

**Files** — create the six files above, `lib/views.seam.test.ts`, `scripts/d-shots.mjs`; edit the three Clients (the only time this lane ever does).
**Contracts** — creates contract §7. Additive to the sketch there: `CaptureVM.source`, the optional `CropHandle` (P-23), the full `MapVM` and `TeachVM` above. Post-merge the vm files are A's and C's.
**Acceptance — automated** — `lib/views.seam.test.ts` (above); DOM-snapshot diff empty.
**Acceptance — human** — HT-1 (§7).
**Sub-agents** — `d0-capture`, `d0-map`, `d0-teach` [AUTO], `d0-proof` (runs proofs 1–5) [AUTO]; human posts the hand-off [HUMAN].
**Hand-off message** — `MERGED: seam split (WD-1). Views: components/views/{Capture,Map,Teach}View.tsx. View-models: capture.vm.ts is A's, map.vm.ts and teach.vm.ts are C's from now. A and C may edit the Clients. Rule: a Client builds vm and returns <XView vm={vm} />; no JSX in Clients, no logic in Views. Need something rendered? Add a vm field and ping D.`
**Pitfalls** — moving a hook below a conditional return · re-mounting `<video ref={vm.pipeline.videoRef}>` (the stream is attached once in `useScreenPipeline.start()`, `useScreenPipeline.ts:264-268`; a new element is black and frames stop at `:157`) · passing `pipeline` whole (it is a new object every render; pick fields) · "improving" copy while moving it · letting the smoke run with a live microphone decide the proof (mute the input device; it uses the real mic through `webkitSpeechRecognition`).

### WD-13 · Scenario data hardened   `[P0 · by M1 · Req C3 T2 A5]`

**Why** — spec findings 3, 7, 9 and audit infra #15, #20: three invoices cannot yield three questions; 4490 arrives already wrong so nothing is "reached for"; there is no personal data to protect; invoices are dated after the demo.

**Today** — `lib/erp-model.ts:43-45` three expert invoices; `:47-52` new-hire invoices prefilled (`4490` → `4711`); dates `2026-11-26 … 2026-12-06`; `Invoice` (`:8-28`) has no contact or bank fields; `APPROVERS` (`:38`) is exported and unused and names the expert persona; the comment at `:42` reads "one hidden judgment call each". `actionMatchesRule` (`lib/workmap.ts:227-241`) treats any defined `costCenter`, including `""`, as a decision.

**Build** — one rule above all: **the scenario's business reasoning never appears in the UI, the seed, a placeholder, a comment or a hint. This file holds fields, never reasons.**
1. `Invoice` gains optional `contactName?`, `contactEmail?`, `contactPhone?`, `iban?: string`.
2. Expert queue, in this array order (array order is work order and "Next invoice" order):

| id | Supplier | Entity | Amount | Date | Description | Category | Prefilled cost center | Kind |
|---|---|---|---|---|---|---|---|---|
| 4470 | Schmidt Reinigung GmbH | parent | 640.00 | 2025-11-25 | Office cleaning, November | cleaning | 4300 | routine (new) |
| 4471 | Müller Werkzeugbau GmbH | parent | 7,850.00 | 2025-11-26 | unchanged | equipment | 4711 | unchanged |
| 4472 | Novak Logistik s.r.o. | subsidiary | 2,300.00 | 2025-11-27 | unchanged | freight | 4120 | unchanged |
| 4473 | Bäcker Elektrotechnik GmbH | parent | 1,180.00 | 2025-12-02 | unchanged | maintenance | 4711 | unchanged |
| 4474 | Hartmann Werkzeuge GmbH | parent | 1,460.00 | 2025-11-28 | Bench vise and clamping set, assembly station 3 | equipment | 4711 | routine (new) |

   Routine means: has a PO, known supplier, parent entity, nothing to change. 4470 is a warm-up (the judge learns "open, read, post" on something trivial and the apprentice visibly stays quiet); it also makes the cleaning category and that supplier *seen* before the new hire meets 4491. 4474 gives the governor one more step boundary before Done. Neither encodes a rule: they are fields.
3. New-hire queue 4490–4494: ids, suppliers, amounts, categories, modes unchanged; `costCenter: ""` on all five; dates shift to 2025 (same month and day). Autopilot 4501–4505: order and fields unchanged, year 2025, `assetNumber: "A-2025-117"`.
4. `toInvoiceState`: `costCenter: inv.costCenter || undefined` (so an untouched invoice is "nothing decided yet" for the matcher and the guard, not a contradiction). PII fields never enter `InvoiceState`.
5. Every expert and new-hire invoice gets `contactName`, `contactEmail` (domain ending `.example`), `contactPhone` (`+49 711 555 01xx`), `iban` with check digits `00` (shape-valid, can never be a real account; e.g. `DE00 6005 0101 0000 4471 01`, `CZ00 0800 0000 0000 0044 7201`). Names are invented.
6. Delete `APPROVERS` (confirm with `grep -rn APPROVERS` that nothing imports it). Add `export function sandboxPersonNames(): string[]` (the seeded contact names) for B's name redaction (WB-7).
7. Comments in the file describe queues and ids, never reasons ("expert queue", "new-hire queue: coached", "new-hire queue: independent").
8. Same PR: `docs/03` §8 table (five expert rows, "starts empty" for 4490–4494), `docs/05` §3 (Sabine rows for 4470 and 4474: "nothing to change — post it"; Lena 4490: "pick 4711, the opex code, and go for Post"), §1 beat 7 wording ("picks the opex code"), §4 run of show (0:00–0:30 covers 4470).
9. After merge everyone runs `npm run seed:session` (it calls `resetErp()`); B resets the deploy. Stored `.data/erp.json` keeps the old rows until then.

**Files** — edit `lib/erp-model.ts`, `docs/03-CONTRACTS.md` §8, `docs/05` §1/§3/§4; create `lib/erp-model.scenario.test.ts`.
**Contracts** — §8 (additive rows; changed dates and prefill → `CONTRACT:`); feeds P-24 (PII to mark) and WB-7.
**Acceptance — automated** — `lib/erp-model.scenario.test.ts`: expert queue ids equal `["4470","4471","4472","4473","4474"]` in order · 4471/4472/4473 keep supplier, entity, amount, category, prefilled code · every new-hire invoice has `costCenter === ""` and `toInvoiceState(inv).costCenter === undefined` · every expert and autopilot `costCenter` exists in `COST_CENTERS` · every date matches `/^2025-1[12]-/`, `toInvoiceState(4473).invoiceMonth === 12` · every expert and new-hire invoice has the four PII fields, and `redactText` (`lib/redact`) reports ≥ 1 entity for its `iban` and for its `contactEmail` · no key of `toInvoiceState(inv)` matches `/contact|iban|email|phone/i` · autopilot ids `4501…4505` in order, `4505.knownSupplier === false`. Full `npm test` green with `lib/engines.test.ts` untouched (its matcher tests already use `from: ""` on 4490, `engines.test.ts:215`).
**Acceptance — human** — HT-2 step 1.
**Sub-agents** — `d1-scenario` [AUTO]; the `CONTRACT:` line is posted by the human [HUMAN].
**Pitfalls** — a C test fails: fix the data or file `lane:C` with the failing assertion; never edit `engines.test.ts` · `redactText` misses a seeded IBAN or email: that is a finding for B (WB-7), file it, do not weaken the test · putting a reason in a comment, a description or a field name · renaming Bäcker: only as a `CONTRACT:` with C's OK if spoken correction still fails at M2 (C's tests hard-code the name at `engines.test.ts:204,277`) · forgetting the reseed, then debugging "old data".

### WD-3 · ERP fixes at the source   `[P0 · by M1 · Req C2 T2]`

**Why** — spec findings 4, 7, 8, 17: keystroke events poison Capture, Map and Teach; the tutor cannot speak before Confirm; vision cannot see a save; a failed save kills the form; the share picker cannot tell the ERP from Tacit.

**Today** — see defects 1–4 in §2. Held panel `InvoiceForm.tsx:154-160` prints title, quote, who, never what is missing. `InvoiceForm` is not keyed by id (`app/erp/invoice/[id]/page.tsx:19`).

**Build**
1. Pure helpers in `lib/erp-ui.ts`: `decisionOf(inv): "post" | "hold"` · `commitStatus(inv): "posted" | "hold"` · `canCommit(inv): { ok: true } | { ok: false; field: "costCenter"; message: string }` (posting needs a cost center; holding does not) · `proposedState(inv): InvoiceState` (= `toInvoiceState({ ...inv, status: commitStatus(inv) })`) · `textCommit(field, before, after): { from: string; to: string } | null` (null when unchanged after trim; for `notes` both values become `""` or `"(note, N chars)"` so free text is never broadcast) · `statusBadge(status): { label: "OPEN" | "ON HOLD" | "POSTED"; tone }` (`approved` renders as POSTED for old rows).
2. Text inputs (asset number, note): local draft; while typing post `{ kind: "typing", invoice, field }` at most once per 400 ms; on blur, on Enter (asset number) and before any save intent post **one** `field_changed` from `textCommit` with `from` = the value at focus.
3. Decision control replaces the three status buttons: a two-option segmented control **Post** (default; draft status stays `open`) and **Hold** (posts `status_changed` `open → hold`; switching back posts `hold → open`). Primary button label follows it: "Post invoice" or "Save as held".
4. Status badge top-right of the document, text not color: `OPEN`, `ON HOLD`, `POSTED` (≥ 14 px bold, 28 px tall). After a successful post: a full-width banner `POSTED · INV-4471 · cost center 0400 · single approval`, fields disabled, "Next invoice →" becomes primary. Held invoices stay editable.
5. Primary button → `canCommit`; if not ok show the message under the field and focus it, no telemetry. If ok: flush pending text commits, open the confirm strip ("Post INV-4471 to cost center 0400, single approval?"), post `save_intent` with `state: proposedState(inv)`, `mode`, `queue` (needs WB-4; land the rest first, then this as a 10-line PR). Confirm is enabled 600 ms after the strip opens (double-click guard; applies to every queue).
6. `save()`: `try { res = await fetch(...); data = await res.json().catch(() => null) } catch { … } finally { setSaving(false) }`. 409 + `data.blocked` → held panel + `save_blocked` (payload as today with `state: proposedState(inv)`, plus `queue`). `!res.ok` or no `data.invoice` → inline error "Could not save (HTTP 500). Nothing was changed." and the form stays intact. 200 → `setInv(data.invoice)`, `save_clicked` with `boundary: true`. The PATCH body sends `status: commitStatus(inv)`.
7. Held panel: first line keeps the words "Not posted" (C's Teach copy and the smoke both look for them), then the rule title; `Missing: {data.missing}` when present (P-16); the quote in quotation marks when present; "Check with {who}" only when `who` is present. No expert name is hardcoded.
8. Every `postTelemetry` call carries `queue: inv.queue` (P-14, after WB-4). When B lands the hello handshake, subscribe with B's exported helper and re-post `invoice_opened` on hello; do not open a second `BroadcastChannel` with a guessed message shape.
9. P-24: wrap contact name, email, phone, IBAN in elements with `data-pii="name|email|phone|iban"`; `components/erp/PiiPublisher.tsx` posts `{ at, rects }` on `BroadcastChannel("tacit-erp-pii")` on mount, after layout changes, on scroll and resize (rects normalized to the ERP document's viewport; B applies the frame offset). Type `PiiRegion` by `import type` from `lib/redact`.
10. Labels: "Asset number" (no hint, placeholder `A-2025-000`); route options "Single approval" and "Second approval (Group Controlling)" (no person names in the select; personal data lives only in the supplier block). The cost-center `<select>` stays the first `<select>` in DOM order and gets a disabled first option "Select cost center…".
11. `app/erp/layout.tsx`: `metadata.title = "MB-ERP · Accounts payable"`. `app/erp/invoice/[id]/page.tsx`: `<InvoiceForm key={inv.id} … queue={inv.queue} queueProgress={{ position, total, remainingOpen }} />`.
12. `data-testid` on every control (table in §6).

What the ERP posts after this WP (tell A, B, C; this is H1 + H2):

| User action | Telemetry | Notes |
|---|---|---|
| opens an invoice | `invoice_opened` | `state`, `mode`, `queue` |
| picks a cost center / route | `field_changed` / `route_changed` | `from`, `to`, `state` (cost center `from` is `""` on new-hire invoices) |
| Hold / back to Post | `status_changed` | `open → hold` / `hold → open` |
| types in asset number or note | `typing` ≤ 1 per 400 ms | `field` only |
| leaves the text field changed | one `field_changed` | note content never sent |
| presses Post invoice / Save as held (valid) | `save_intent` | proposed `state` with `status: "posted" \| "hold"` |
| Confirm → 200 | `save_clicked` | `boundary: true`, committed `state` |
| Confirm → 409 | `save_blocked` | `blocked { ruleId, title, quote, who }` |
| leaves the invoice | `invoice_closed` | unchanged (400 ms debounce) |

**Files** — edit `components/InvoiceForm.tsx`, `app/erp/invoice/[id]/page.tsx`; create `lib/erp-ui.ts`, `lib/erp-ui.test.ts`, `components/erp/PiiPublisher.tsx`, `app/erp/layout.tsx`.
**Contracts** — P-11 (D posts `save_intent`), P-14 (D sends `queue`, answers hello), P-16 (renders `missing`, optional `who`), P-24 (marks + publisher). Behavior change to announce: a normal save now commits `status: "posted"`; the "approved" button is gone.
**Acceptance — automated** — `lib/erp-ui.test.ts`: `textCommit` returns null for unchanged or whitespace-only edits; one object for `"" → "A-2025-118"` with `from: ""`; notes never contain the typed text · `commitStatus` is `"hold"` only for a held draft · `canCommit` rejects an empty cost center when posting and accepts it when holding · `proposedState` carries the commit status and no PII key · `statusBadge("approved").label === "POSTED"`. `scripts/d-shots.mjs --erp`: type 10 characters in asset number, Tab → exactly one `field_changed` and ≥ 1 `typing` on the channel (listener injected in a second page); Post on a new-hire invoice with no cost center → no network request; mocked 500 → error text visible and button enabled.
**Acceptance — human** — HT-2.
**Sub-agents** — `d2-form` (`InvoiceForm.tsx`, `lib/erp-ui.*`, `PiiPublisher.tsx`) [AUTO]; `d3-erp-shell` adds the layout title and the page props (shared with WD-2) [AUTO]; the `save_intent` + `queue` follow-up waits for B's `CONTRACT:` [AUTO after H1].
**Pitfalls** — the smoke (`scripts/smoke.mjs:137,149-159`) clicks an "approved" button, the text "Save and post" and the placeholder `A-2026-000`: this WP changes that flow, so it merges together with the courtesy smoke patch (§6, H7) · posting `save_intent` on every re-render instead of once per open · committing text on unmount (do it on blur and before intent) · leaving `setSaving(false)` outside `finally` · sending note text in telemetry.

### WD-2 · Judge-proof flow   `[P0 · by M1 · Req N5 A4]`

**Why** — spec finding 13 and audit infra gaps 3, 8: the UI gives away the answers and gives no guidance where a stranger needs it; a judge who can read the rules cannot make an honest mistake, and Apprentice Test 4 looks staged.

**Today** — defects 6, 7, 8, 12 in §2. `app/erp/page.tsx:77` resets through a GET link with a developer tooltip; only the id cell is clickable (`:49`); the footer says "Month-end close is in two days" (`:69`).

**Build**
1. `components/ui/usePresenter.ts`: true when the URL has `?presenter=1`; remembered in `sessionStorage["tacit.presenter"]`; `?presenter=0` clears it. Presenter-only blocks never render otherwise.
2. Remove spoilers (replacement in brackets): `TeachClient.tsx:245-249` rule list [one line: "Loaded {n} rules from {expert}'s confirmed Work Map", list only in presenter mode] · `:257` hints [deleted] · `:353` "Open invoice 4490" ["Watching. Open the first invoice in your queue."] · `:364-373` "Rules in play" [WD-8 rule visibility] · `MapClient.tsx:313` placeholder ["Correct one detail (say it or type it)" — the smoke selects `placeholder^="Correct one detail"`] · `InvoiceForm.tsx:113` (done in WD-3) · `app/page.tsx:4` wrong counts [fixed copy; full page in WD-12].
3. Persona cards on the Tacit side only (`components/ui/PersonaCard.tsx`), shown on the Capture and Teach pre-start screens. Expert: "You are {name}, the experienced one. Work the invoices the way you would and say what you are thinking. The apprentice stays silent while you work and asks short questions when you pause. Say 'scratch that' to strike anything. Use the role card you were handed — or your own rules: it learns what you actually say." New hire: "You are new here. Nobody told you the rules. Work the queue and do what seems right. The tutor only speaks when {expert} would have stopped." **The cards never contain a rule.** The role card stays a document handed to a human (`docs/05` §3).
4. Neutral copy: names come from `vm.expertName`, `map.expert.name`, `log.expertName`; "their", never "her/she"; queue labels "Invoice queue · expert", "Invoice queue · new hire", "Routine queue · agent". `TeachStart.tsx:9` default name becomes `""` with placeholder "Your first name" (send "New hire" if blank).
5. Pre-start checklist in `CaptureView` and `TeachView` (three lines, each with a state): browser check (`components/ui/BrowserCheck.tsx`: Chromium desktop and `navigator.mediaDevices.getDisplayMedia` present, else a labeled blocker) · headphones reminder · what to pick in the share dialog (workspace mode: "choose **This tab**"; two-window mode: "pick the tab named **MB-ERP**").
6. `components/ui/OpenErpButton.tsx` (two-window mode and `/demo`): `window.open("/erp?queue=" + queue, "tacit-erp", "popup=yes,left=…,top=…,width=…,height=…")` sized to the left 65 % of `screen.availWidth`; if it returns null render a plain `<a target="tacit-erp">`. Relative URL only (same origin is mandatory for the telemetry channel).
7. ERP header `ErpHeader({ title, queue })`: "Queue" links to `/erp?queue=${queue}`; queue tabs only in presenter mode; the "Tacit" link gets class `erp-external-nav` (hidden when framed, WD-11).
8. ERP queue page: whole row is the link (stretched link on the id cell), a primary "Open next invoice →" (first `open`), a count "2 of 5 processed", and when none is open a banner "Queue complete. Return to the Tacit panel to finish." `components/erp/ResetQueueButton.tsx` (POST `/api/erp/reset?queue=`, then `router.refresh()`), shown when at least one invoice is processed, labeled "Start this queue fresh (sandbox data)". The footer sentence at `:69` is replaced by "Posting period 12/2025".
9. Invoice page after the last post: same "Queue complete" banner instead of "Next invoice".
10. Pickers: `TeachStart` shows only maps with `confirmed && steps > 0`, newest first, default the newest (ignore `preselect` unless it is confirmed), option label "{expert} · {date, time} · {steps} steps · {rules} rules"; no confirmed map → `EmptyState` linking to `/map`. Start is impossible on an unconfirmed map. `/map` index is C's file: create `components/ui/SessionList.tsx` and send C a courtesy PR (≤ 15 lines in `app/map/page.tsx`) that hides sessions with no events and shows time, counts and a "sample" tag.

**Files** — edit `components/views/{Capture,Teach,Map}View.tsx` (pre-start and the cited lines only), `components/TeachStart.tsx`, `components/ErpHeader.tsx`, `app/erp/page.tsx`, `app/page.tsx`; create the `components/ui` and `components/erp` files named above, `lib/ui-copy.spoilers.test.ts`. Requests: C — courtesy PR for `/map` index (H8); A — default expert name `""` with a placeholder instead of `useState("Sabine")` (`CaptureClient.tsx:28`), and reset the expert queue at `start()` as C does for Teach (H8, P1); C — neutral strings in logic (`TeachClient.tsx:106`, `lib/matcher.ts` "her/she"), already in WC-7.
**Contracts** — none.
**Acceptance — automated** — `lib/ui-copy.spoilers.test.ts` reads every D-owned UI source file and asserts zero matches for `/capex only/i`, `/over the threshold/i`, `/another supplier\)/i`, `/e\.g\. only/i`, `/Open invoice \d{4}/`, `/hidden judgment/i`, `/Sabine Koch/`, `/(Lena|Sabine)(&apos;|')s queue/`, and (after stripping comments) `/\b(her|she)\b/i`. `scripts/d-shots.mjs`: `/teach` without presenter contains no element whose text equals a rule title of the selected map; with `?presenter=1` it does.
**Acceptance — human** — HT-3.
**Sub-agents** — `d3-erp-shell` (`ErpHeader.tsx`, `app/erp/page.tsx`, `ResetQueueButton.tsx`) [AUTO] · `d4-tacit-flow` (Views' pre-start blocks, `TeachStart.tsx`, `app/page.tsx`, ui files, spoiler test) [AUTO] · courtesy PR to C [ASK FIRST: the human pings C].
**Pitfalls** — writing a "helpful" persona card that restates the role card · hiding spoilers with CSS (they must not be in the DOM) · absolute URLs in `window.open` · a presenter flag that leaks into the ERP frame's URL (it lives in `sessionStorage`, per tab).

### Design direction (binding for WD-11, WD-4 … WD-8, WD-12; the human approves a 6-line summary of it at kickoff [ASK FIRST])

**Two products on one screen.** Tacit is dark, calm, warm. The sandbox ERP is light, square, corporate: on video it must read as someone else's business application, and black text on white at ≥ 14 px is what the vision model reads best.

| | Tacit (companion, Map, Teach, landing) | Sandbox ERP (`.erp` scope, `app/erp/erp.css`) |
|---|---|---|
| Fonts (`next/font`, self-hosted at build) | Inter 400/500/600 → `--font-inter`; JetBrains Mono 400/500 → `--font-jbmono` | IBM Plex Sans 400/500/600 → `--font-plex` |
| Background / surface / line | `#0B0E11` / `#12171C` / `#26323D` (`panel-2` `#19212A`) | `#F2F4F7` / `#FFFFFF` / `#D0D7DE`; header bar `#16324F` with white text |
| Text / muted | `#E8EDF2` / `#93A1AE` | `#17202A` / `#52606D` |
| Accent | amber `#F5A623` = the apprentice speaking, primary action | blue `#0A5FB4` = primary action |
| Semantic | green `#3DDC84` listening, filled, confirmed · red `#FF5D5D` off record, stop, blocked — nothing else · blue `#5AA9FF` seen by vision, informational | OPEN `#EEF1F4`/`#3A4753` · ON HOLD `#FFF1CC`/`#7A4B00` · POSTED `#DFF5E7`/`#0B5D33` · blocked `#FDECEC`/`#A32020` (background/text, each with a 1 px darker border) |
| Type scale (px / line) | display 40/44 · h1 28/34 · h2 20/28 · body 16/24 · small 14/20 · meta 12/16 uppercase, tracking .12em, labels only · mono 13 tabular. **Companion surface minimum 14**; 12 only inside the drawer | body 16/24 · label 14/20 medium, sentence case · table 15 · amount 32/36 semibold tabular · badge 14 bold uppercase. **Nothing under 14** |
| Radius / elevation | panel 12 · button 8 · tag pill; no shadows, 1 px lines | 4 everywhere; one shadow under the header bar |
| `color-scheme` | `dark` | `light` |

**Spacing** 4-pt grid: 4 · 8 · 12 · 16 · 24 · 32 · 48. Panel padding 16 in the companion, 24 on wide pages. Hit targets ≥ 40 px (44 for the companion controls). **Motion** 150–200 ms ease-out; the presence breath is 2.4 s; honor `prefers-reduced-motion`.

**Implementation rules.** Tokens stay in `@theme` in `app/globals.css` under the existing names (`--color-bg`, `--color-panel`, … `globals.css:5-16`) so every current utility keeps working; `--font-sans: var(--font-inter), …`, `--font-mono: var(--font-jbmono), …`. Component styling is plain classes in `globals.css` (as today: `.btn`, `.tag`, `.panel`) plus `.t-display … .t-meta`; `components/ui/*` wrap them. The ERP scope overrides the same variables inside `.erp { … }` (Tailwind 4 utilities resolve through the variables — check one in devtools before relying on it) and adds `.erp-*` component classes; WD-4 removes Tacit classes from ERP markup. Read `node_modules/next/dist/docs` (fonts, layouts, `error.tsx`) and `node_modules/tailwindcss/theme.css` before using a `next/font` option or a new `@theme` namespace: this is Next 16 and Tailwind 4, do not write either from memory.

**Component inventory (`components/ui`)** — all presentational, props only, no fetch:

| Component | Props (essentials) | States |
|---|---|---|
| `Button` | `variant: "primary" \| "secondary" \| "danger" \| "ghost"`, `size`, `loading`, `pressed` | hover · focus-visible (2 px accent ring, 2 px offset) · disabled (50 % opacity, `not-allowed`, no hover) · loading (spinner + label kept) · pressed (toggle) |
| `Tag` | `tone: "neutral" \| "amber" \| "green" \| "red" \| "blue"` | — |
| `Panel` | `title?`, `tone?`, `footer?` | default · emphasized (accent border) · degraded (amber strip + reason text) |
| `Presence` | `state`, `label`, `sub` | quiet · listening · asking · off record (below) |
| `Stat` | `label`, `value`, `hint?` | value is a count or a time, never a percentage |
| `Stepper` | `current: 1 \| 2 \| 3`, `links` | done · current · locked (with the reason on hover) |
| `QuoteCard` | `text`, `speaker`, `source`, `t`, `audioSrc?`, `translation?`, `evidence?` | verbatim in quotation marks, attribution line, play button if audio, "described, not demonstrated" badge |
| `GuardrailCard` | `kind`, `text`, `quote?`, `evidence?` | kind chip (Limit · Exception · Stop and ask); `text` plain, **never in quotation marks**; the quote inside a `QuoteCard` |
| `FrameThumb` | `src` (`frame.url ?? frame.dataUrl`), `t`, `blurred`, `region?`, `size` | loaded · missing ("No still kept for this step") · highlight box when `region` exists; caption always says "captured still" |
| `AppShell`, `Drawer`, `Banner`, `EmptyState` | shell with `Stepper`; collapsible drawer; info / degraded / error banner with an action; one sentence + one next action | — |

**The presence element** (one per companion; replaces the five-light Meter as the default surface): a 56 px mark, a 20 px state word, a 14 px reason line, `aria-live="polite"`.

| State | When (pure function `presenceOf` in `lib/ui/presence.ts`) | Mark | Word · reason line |
|---|---|---|---|
| off record | `holding`, or a strike in the last 4 s | red hatched ring (the existing `.strike-band` pattern) | "Paused" · "Nothing is being sent" / "Struck from the record" |
| asking | `openWindow.phase === "asking"` | amber, pulsing | "Asking" |
| listening | `openWindow.phase === "answering"` | solid green, slow breath | "Listening to your answer" |
| quiet | otherwise | hollow ring, dim | "Quiet while you work" · if candidates are queued: "Waiting — {decision.reasons[0]}" (the governor's own words: "expert talking", "typing", "screen moving", "reading a new invoice", "cooldown"; `lib/governor.ts:87-92`) · if no screen is shared: "Not watching — no screen shared" |

Priority top to bottom. The five lights (`Meter.tsx:23-29`) move into the mechanism drawer unchanged; presenter mode opens the drawer by default. This keeps A1 a visible mechanism (the reason line is the governor speaking in plain words) without a dashboard in the expert's face.

**Layouts.** Workspace at 1440×900: `grid-template-columns: minmax(0,1fr) 420px; height: 100dvh` — ERP frame left, companion right, each scrolls on its own, no page scroll; presenter mode widens the companion to 560 px. Companion alone (two-window mode, `?layout=companion`, any width under 900 px): the same column, fluid 360–520 px. Map and landing: full width, single column under 900 px. Exactly one `<video>` and one ERP frame element per page, in a fixed place in the tree; placement changes by CSS only.

**States every screen has:** empty (what to do next, one sentence) · loading (skeleton or spinner, never a frozen button) · error (inline banner, the action that recovers) · degraded (labeled: "Browser voice (fallback)", "Vision is behind: 12 frames skipped", "Transcript offline — not asking") · disabled (with the reason on hover or beside it).

**Do not:** show a confidence meter or the word "confidence" as a score (render `confirmedBy` chips, and for `confidence: "low"` the sentence "No quote backs this yet") · show a percentage where a count is honest ("3 of 5 answered by Sabine", never "60 %") · animate "thinking" when nothing is happening · draw a waveform not driven by audio · put a paraphrase in quotation marks · call a still a video or seeded data live · use red for anything but off record, stop, blocked · add emoji, gradients or glow.

### WD-11 · Workspace mode is the default surface   `[P0 · by M2 · Req N2 N5 C1]`

**Why** — the brief says "the agent listens in a side panel"; today it lives in a hidden tab (audit capture #6, #16), where timers drop to one tick per second and the judge sees neither lights nor question. A juror on the live link gets one window or gets lost.

**Today** — `CaptureClient.tsx:380` and `TeachClient.tsx:257` tell the user to open the ERP "in another tab". No frame, no layout switch.

**Build**
1. `lib/ui/layout.ts`: `layoutMode({ search, width, canCrop, source, share0 }): "workspace" | "companion"` → `companion` if `layout=companion` or `width < 1180`; `workspace` if `layout=workspace`; otherwise `workspace` only when the capture can be confined to the frame (`canCrop`) or no frames are sent (`source === "dom"` or `share=0`); else `companion`. `components/ui/useLayoutMode.ts` evaluates it once on mount and freezes it when the session starts.
2. `components/ui/Workspace.tsx`: `{ erpSrc: string; locked: boolean; lockedHint: string; reloadKey: string | number; onFrameElement?(el: HTMLElement | null): void; children }`. Left cell: a wrapper `<div ref={onFrameElement}>` (the crop target, stable for the whole session) containing `<iframe src={erpSrc} title="Sandbox ERP" key={reloadKey}>` at 100 % × 100 %. While `locked`, a translucent overlay with `lockedHint` blocks pointer and keyboard. Right cell: `children` (the companion).
3. `CaptureView`: workspace → `<Workspace erpSrc="/erp?queue=expert" locked={!vm.started} lockedHint="Start the session to begin" reloadKey={vm.started ? "live" : "idle"} onFrameElement={vm.pipeline.setCropTarget}>…companion…</Workspace>`; companion → the companion alone plus `OpenErpButton`. `TeachView`: same with `queue=newhire`. Map stays full width.
4. `components/erp/EmbedAware.tsx` (mounted in `app/erp/layout.tsx`): when `window.self !== window.top`, add class `erp-embedded` to `<html>`; CSS hides `.erp-external-nav`.
5. The `<video>` preview stays mounted as a 120×68 thumbnail labeled "What I see" in the privacy ledger. In workspace mode it shows only the ERP region, which is the visible proof that the companion is not captured.
6. `canCrop = typeof vm.pipeline.setCropTarget === "function"` (the reserved `CropHandle` from WD-1). Until A and C wire it, real-vision sessions fall back to the companion layout with a one-line notice ("Open the ERP in its own window"); keyless and `?share=0` sessions already use the workspace.

**Files** — create `lib/ui/layout.ts` + test, `components/ui/{Workspace.tsx,useLayoutMode.ts}`, `components/erp/EmbedAware.tsx`; edit `components/views/{CaptureView,TeachView}.tsx`, `app/erp/layout.tsx`. Requests (H13): B — P-23 `start({ mode: "workspace", cropTo })` and `surface`; A and C — populate `pipeline.setCropTarget` and `pipeline.surface` in their vm (the slots exist since WD-1), and the Client passes `{ mode: "workspace", cropTo }` to `start()` when a target was registered; C — `vm.ready` (queue reset and guard armed) so the frame reloads at the right moment (until then reload 1.5 s after `started`).
**Contracts** — P-23 (D supplies the element through the vm), P-24 (rect offset is B's).
**Acceptance — automated** — `lib/ui/layout.test.ts`: the five branches above. `scripts/d-shots.mjs`: at 1440×900 `/capture?share=0` → frame width ≥ 1000, companion width 420, `scrollHeight === innerHeight`; changing the cost center inside the frame makes an event row appear in the companion's drawer (BroadcastChannel across the frame); `/capture?layout=companion` at 480×900 → no frame, no horizontal scroll; inside the frame the "Tacit" link is not displayed.
**Acceptance — human** — HT-4.
**Sub-agents** — `e-ws` (`lib/ui/layout.*`, `Workspace.tsx`, `useLayoutMode.ts`, `TeachView.tsx` wrapper) [AUTO] · the `CaptureView` wrapper is done by WD-6's agent (`e-cap`) · `EmbedAware.tsx` and its mount in `app/erp/layout.tsx` are done by WD-4's agent (`e-erp`) · share-dialog behavior with B's capture [HUMAN, with B].
**Pitfalls** — re-mounting the wrapper `div` or the `<video>` when layout or `started` changes · Chrome's sharing bar changes the viewport height when capture starts: the grid must be fluid (`100dvh`), never fixed pixels · a second ERP tab left open posts into the same session (B scopes by queue, P-14; say "close other ERP tabs" in the checklist) · Region Capture is **not** among the verified facts in `docs/02`; B verifies it and owns the paint-out fallback — this lane only hands over an element · Document Picture-in-Picture is cut-list item 5: do not build it here.

### WD-4 · The ERP gets its own identity   `[P0 · by M2 · Req N5 C2]`

**Why** — audit infra gap 14: the ERP is visually identical to Tacit, so the video does not read as "an apprentice watching someone else's application"; small low-contrast text and a status shown only by button styling are hard for the vision model (audit, real-path problem 4).

**Today** — ERP markup uses Tacit's classes (`panel`, `btn`, `tag`, `panel-title`: `ErpHeader.tsx:5-16`, `app/erp/page.tsx:31-63`, `InvoiceForm.tsx:74-166`); the invoice grid needs ≥ 1024 px to be two columns (`InvoiceForm.tsx:72`), so in a 1020 px frame it stacks and the decisions fall below the fold.

**Build**
1. `app/erp/erp.css` (imported by `app/erp/layout.tsx`, which wraps children in `<div className="erp">` with the Plex variable): the ERP column of the design table; `.erp-header`, `.erp-card`, `.erp-table`, `.erp-field`, `.erp-btn`, `.erp-btn-primary`, `.erp-badge-{open,hold,posted,blocked}`, `.erp-banner`, `.erp-seg` (segmented control).
2. Header bar: product mark, "MB-ERP", company, "Posting period 12/2025", queue name; no Tacit colors.
3. Queue table: Invoice · Supplier (description beneath, muted) · Date · Amount · Status badge; rows 48 px; whole row clickable.
4. Invoice page: two columns from 820 px (`document | coding and approval`). **At 1020×852 and at 936×800 the whole invoice, the decision controls and the primary button are visible without scrolling** — every frame then carries the complete state.
5. Vision-legibility rules: every decision-relevant value is text next to a text label ("Cost center", "Approval route", "Status"); the status badge is a word; ids are always `INV-4471`; placeholders are visibly placeholders; no information by color alone.
6. Supplier block: "Contact", "Email", "Phone", "Bank (IBAN)" with the `data-pii` marks from WD-3.
7. Remove every Tacit class from ERP files. When merged, tell B: `MERGED: ERP skin final — safe to regenerate seed frames from real screenshots (WB-9).`

**Files** — create `app/erp/erp.css`; edit `app/erp/layout.tsx`, `app/erp/page.tsx`, `app/erp/invoice/[id]/page.tsx`, `components/ErpHeader.tsx`, `components/InvoiceForm.tsx` (classes only; behavior was WD-3).
**Contracts** — none. H7: seed frames and B's `vision-eval` screenshots depend on this skin being final.
**Acceptance — automated** — `scripts/d-shots.mjs --erp`: at 1020×852 and 936×800 the invoice page has no vertical overflow; computed `font-size` of every visible text node under `.erp` ≥ 14 px; the badge text is one of `OPEN | ON HOLD | POSTED`; `getComputedStyle(body).backgroundColor` differs between `/erp` and `/capture`; contrast of label text ≥ 4.5:1.
**Acceptance — human** — HT-5 step 1; B's `vision-eval` on the new skin ≥ 9/10 (B runs it; you ask at M2).
**Sub-agents** — `e-erp` [AUTO; looks at both screenshots and critiques them before reporting].
**Pitfalls** — restyling before WD-3's behavior PR merges (same file: sequence them) · moving the cost-center select so it is no longer the first `<select>` · dark-mode native controls (`color-scheme: light` on `.erp`) · changing copy the smoke still selects by text.

### WD-5 · Tacit design pass 1   `[P0 · by M2 · Req N5 A1]`

**Why** — audit infra #18 and N5: fonts never load, the Start button looks enabled when it is not, nothing shows focus, failed fetches leave dead buttons, and the surface is a 10–13 px console.

**Today** — `globals.css:15-16` names fonts nobody loads; `:30-34` has no disabled or focus style; `layout.tsx:9-15` is bare; no `app/error.tsx`; `Meter.tsx` is the only "state" element.

**Build**
1. `app/layout.tsx`: load Inter and JetBrains Mono with `next/font`, put their variables on `<html>`, `color-scheme: dark` on `<body>`. No global nav (the ERP shares this layout).
2. `app/globals.css`: the Tacit column of the design table; `.t-*` type classes; `.btn` variants with `:disabled` and `:focus-visible`; inputs with a visible focus ring; `.banner-*`; keep every existing class name working.
3. `components/ui`: the inventory table. Land `Button, Tag, Panel, Stat, Banner, EmptyState, Drawer, AppShell, Stepper, Presence` in the first PR (WD-6 needs them by ~8:30 PM); `QuoteCard, GuardrailCard, FrameThumb` in the second.
4. `AppShell`: mark + "Tacit", `Stepper` (1 Capture · 2 Map · 3 Teach; step 2 links only when a session exists, step 3 only when the map is confirmed; otherwise locked with the reason), right slot for status and a "Presenter" badge.
5. `lib/ui/presence.ts`: `presenceOf(input): { state; label; sub }` exactly as the presence table; `components/ui/Presence.tsx` renders it; `Meter.tsx` becomes the drawer's "Governor" block (same props).
6. `app/error.tsx` ("Something broke on this screen. Your session is saved as you go." + Reload) and `app/not-found.tsx`. Check the Next 16 file conventions in the bundled docs first.
7. Apply `AppShell` to `/` and `TeachStart`.

**Files** — edit `app/globals.css`, `app/layout.tsx`, `components/Meter.tsx`, `app/page.tsx`, `components/TeachStart.tsx`; create `components/ui/*` (inventory), `lib/ui/presence.ts` + test, `app/error.tsx`, `app/not-found.tsx`.
**Contracts** — renders P-9 (`voice.degraded`, `lastError`) and P-26 (`healthy`) when A exposes them.
**Acceptance — automated** — `lib/ui/presence.test.ts`: paused wins over an open window · a strike within 4 s shows off record · `answering` → listening · queued candidates → "Waiting — " + the first governor reason · no screen shared never says "watching". `scripts/d-shots.mjs`: `document.fonts.check("16px Inter")` true; a disabled `.btn` has opacity < 1 and `cursor: not-allowed`; Tab from the top of `/capture` shows a focus ring on the first control; no visible text under 14 px on the companion surface outside the drawer.
**Acceptance — human** — HT-5.
**Sub-agents** — `e-kit` owns `globals.css`, `layout.tsx` and `components/ui` core for the whole wave; nobody else edits those files in wave 2 [AUTO]; design-direction approval [ASK FIRST].
**Pitfalls** — a font package (never `package.json`; `next/font` needs none) · renaming existing classes (other lanes' vm-driven views still use them) · putting the Tacit shell in the root layout (it would wrap the ERP).

### WD-6 · Capture companion view   `[P0 · by M2 · Req A1 A2 A5]`

**Why** — spec §3: the expert sees a session state, one question, captions, a ledger and three controls — not a diagnostics console (audit capture gaps 6–9).

**Today** — `CaptureClient.tsx:387-566`: header chips, video, event feed, Meter, question window, mechanism toggle, candidates, ledger with a hold-to-pause mouse button (`:543`), transcript, Done; "Not now" exists only inside an open window (`:497`); the paused overlay claims "nothing is transmitted or kept" (`:427`).

**Build** — companion column, top to bottom (the wrapper is WD-11's `Workspace`):
1. **Header** (48 px): shell mark, step "1 Capture", three status dots with words — voice ("ElevenAgents" / "Browser voice (fallback)" / "Voice offline"), ears ("Scribe v2" / "Browser STT (fallback)" / "No transcript"), eyes ("Seeing the ERP" / "No screen" + Share button / "Vision degraded: {visionError}" / "{dropped} frames skipped"). Source truth: `vm.voice.mode`, `vm.sttEngine`, `vm.pipeline.*`; P-9 and P-26 fields when present.
2. **Presence** (WD-5).
3. **Question card** — only while a window is open: kind chip (why → "Why", counterfactual → "What if", limit → "Where's the limit", stop → "When to stop", who → "Who decides"), the question at 20/28, the live caption (`openWindow.answerText` in ink, `vm.partial` muted), phase line ("asking…" / "mic open — recording your answer"), **Not now**. Fallback voice + answering: the typed-answer input and Log. No window: one quiet line ("{n} questions waiting for a pause" / "Nothing to ask yet"). When A exposes `reasonHeard`, a chip "Reason heard — not asking: “{quote}”".
4. **Struck band**: for 4 s after `ledger.secondsStruck` grows, a red hatched band "Struck from the record". Redacted events and transcript lines render as tombstones (`e.redacted`, `s.redacted`).
5. **Controls** (sticky bottom, 44 px): **Not now** (enabled only with an open window) · **Scratch that** (danger outline) · **Pause** (toggle; `onClick={() => vm.setHolding(!vm.holding)}`, or `vm.togglePause` once A ships it; pressed label "Paused — resume"; key `P`). Below, full width: **Done · start the debrief** (frozen string, §6).
6. **Privacy ledger**: one row "seen {n} · kept {n} · redacted {n} · struck {n} s" with the "What I see" thumbnail; expanded: the two sentences from `:538` (what this app keeps; what the voice provider keeps per account retention) and the mask tool (drag on the enlarged preview; `vm.pipeline.addMask`, `clearMasks`).
7. **Mechanism drawer** ("Show the mechanism"): Governor lights (`Meter`), candidate queue (top 5: value, kind, question; "asked {n} · guardrail asked: yes/not yet · to debrief {n}"), screen events with the honest badges exactly as today (`seen`, `seen ✓`, `erp`; `:457`) and `latencyMs` when present (P-8), transcript tail, vision counters.
8. **Pre-start**: persona card, the three-line checklist (WD-2), consent text (keep all three facts of `:372`: what is captured, what is kept, what the provider keeps), name and task inputs, Start disabled until consent with the reason beside it.
9. Paused copy until A confirms WA-6 is merged: "Paused — the screen is not sent and speech is ignored". After A's `MERGED: WA-6`: "Paused — nothing is sent or heard".

**Files** — edit `components/views/CaptureView.tsx`. Requests (H8, names as in lane A's doc): `reasonHeard`, `togglePause`, `paused`, `lastStrike`, `deferred`, `noisy`, `voice.degraded`, `voice.lastError`, `stt`, and `pipeline.setCropTarget`.
**Contracts** — reads contract §7 `CaptureVM`; P-8, P-9, P-26 when present. No new state in the Client.
**Acceptance — automated** — `scripts/d-shots.mjs` at 420 and 480 px: presence, controls and Done visible without scrolling at 900 px height; with the drawer closed there is no `.light` element; Pause toggles `aria-pressed`; Not now is disabled with no window; redacted rows contain no original text.
**Acceptance — human** — HT-6.
**Sub-agents** — `e-cap` (`CaptureView.tsx` only; starts when `e-kit`'s first PR is in) [AUTO build] · legibility and "does it feel calm" [HUMAN].
**Pitfalls** — merging before B's smoke switch: the smoke waits for the text "Governor" right after Start (`smoke.mjs:39`) and this view puts it in a closed drawer; this PR lands after the switch, or after the courtesy PR you send at 9:00 PM if B has not done it · hiding the `<video>` (`display:none` is forbidden; keep the thumbnail) · claiming more than is true about pause · showing the question text while phase is still "asking" *and* the agent failed to speak (keep the phase line honest) · a drawer that pushes the controls off screen.

### WD-7 · Work Map view   `[P0 · by M3 · Req M3 A3]`

**Why** — the Required box: every step and guardrail links to a screen moment and the expert's own words. Today it is an annotated event log of instance steps (audit map gaps 4–6) with shallow edits and a quoted paraphrase.

**Today** — `WorkMapView.tsx:42-59` flat list of every instance step; `:67` `frame.dataUrl`; `:114` guardrail text in quotation marks; `:134` "confidence" tag; `:135` duplicate keys; `:18-21` the View PUTs the map. `MapClient.tsx:229-249` "Gaps closed" bar with lights; `:218` recompile always enabled; `:294-328` teach-back with the spoiler placeholder; `:330-375` metrics and autopilot panels.

**Build**
1. **Header**: step 2, "{expert}'s Work Map · {task}", `Sample` tag when `sessionId.startsWith("demo_")`, "rev {n}", how it was compiled (`vm.note`; P-27 `llm`), state chip: "Draft — not confirmed" / "Confirmed by {expert} · rev {n}", "Synced to tutor" when C exposes `vm.knowledge`. Primary action "3 · Teach →" only when confirmed.
2. **Understanding card** (titled "Gaps closed" until B's smoke switch): a segmented bar, one segment per slot (filled green, open amber, skipped gray), label "{closed} of {total} answered by {expert}" — no percentage; the readiness lines from `vm.progress`; "Ready to teach" only when `progress.ready`.
3. **Debrief card**: Start button; the current question at 20/28 with the heard caption; typed fallback; the slot list (filled → check and struck through, skipped → "skipped").
4. **Teach-back card**: text at 18/28; "{words} words · about {round(words / 2.4)} s"; after a correction, the sentences that changed are highlighted (the View keeps the previous text) and the **rule diff** lists `before → after` per patched rule (P-5; ask C for render-ready strings `vm.lastPatch: { ruleTitle, before, after }[]`); buttons "Yes, that is how it works" and "Correct" (both disabled while a request is pending, once C exposes `vm.pending`); the correction input keeps the placeholder from WD-2. Confirmed: lock mark, "Confirmed · rev {n}".
5. **Headline counts** (`lib/ui/mapview.ts` `headlineCounts`): "{steps} steps · {judgment} judgment calls · {guardrails} guardrails" from `vm.canonical` when present; until P-20 lands, from `map.steps` labeled "{n} recorded steps".
6. **Canonical timeline**: a row of nodes on wide screens, a list under 900 px; each node: index, title, a judgment mark, guardrail count, a small `FrameThumb`. Instance steps of a canonical step appear under its detail.
7. **Step detail**: `FrameThumb` (large; caption "Captured still · {t} s · {n} regions blurred"; highlight when `screenMoment.region` exists) · Decision + `field: from → to` in mono · `QuoteCard` for `step.reason` (source "live answer" / "narration" / "debrief", time, audio when `audioId`, translation when present) or "Not yet explained — the debrief will ask" · `GuardrailCard`s (badge `quote.evidence ?? (quote.source === "debrief" ? "described" : "demonstrated")`, P-6) · **rule box** "Rule the tutor will run": title, "When … → …" via `describeCond` / `describeAct`, "unless …", stop-and-ask line ("who" only when named; otherwise "who to ask is still open"), `confirmedBy` chips de-duplicated, and for `confidence: "low"` the sentence "No quote backs this yet".
8. **Evidence matrix** (when `vm.matrix` exists): one row per decision; columns exactly Reason · Trigger rule · Replay-verified · Limit · Who · Confirmed; each cell an icon **and** a word ("yes", "open", "described", "—"); clicking a filled cell selects the step and scrolls to the quote.
9. "Cases described, not demonstrated" (`map.notes`) as `QuoteCard`s with the described badge.
10. Editing controls render only before confirmation and only if the vm provides callbacks (`removeQuote`, `removeGuardrail`, `removeStep`); `WorkMapView` stops calling `fetch` and reports through `onChange` (ask C to persist in `onMapChange`). "Recompile" and "Measured" sit in a presenter-only drawer; the agent-ready export panel stays, below the map.
11. No frame for a judgment step, or no quote: say so in place ("No still kept for this step"); never a blank area.

**Files** — edit `components/WorkMapView.tsx`, `components/views/MapView.tsx`; create `lib/ui/mapview.ts` + test. Requests (H8) to C: `vm.canonical`, `vm.matrix` (P-20), `vm.lastPatch` (P-5), `vm.knowledge`, `vm.llm` (P-27), `vm.pending`, the remove callbacks, PUT inside `onMapChange`.
**Contracts** — renders P-1, P-5, P-6, P-7, P-16, P-20, P-27. No schema change.
**Acceptance — automated** — `lib/ui/mapview.test.ts`: `headlineCounts` on a fixture map; evidence badge falls back from `evidence` to `source`; `confirmedBy` de-duplicated; a low-confidence rule yields the sentence, not a score. `scripts/d-shots.mjs` on `/map/demo_sabine_confirmed`: every judgment step's detail contains an `<img>` or the text "No still kept" and a `QuoteCard` or "Not yet explained"; no `%` character in the understanding card; no guardrail `text` inside quotation marks; zero React key warnings in the console.
**Acceptance — human** — HT-8.
**Sub-agents** — `f-map` (`WorkMapView.tsx`, `MapView.tsx`, `lib/ui/mapview.*`) [AUTO build]; "can I find her words for every decision in ten seconds" [HUMAN].
**Pitfalls** — inventing the shape of `canonical` / `matrix` (read C's types on `main`; render nothing until they exist) · quoting LLM-written guardrail text · a matrix of colored dots with no words · losing the typed-answer path the smoke uses.

### WD-8 · Teach view   `[P0 · by M3 · Req T1 T3]`

**Why** — the Required box and the brief's last beat: caught before save, explained in the expert's reasoning, her screen moment replayed. Today the learner can read the rules first (finding 13), the prediction card shows the answer and the header claims a guard that may not exist (finding 17).

**Today** — `TeachClient.tsx:291-310` replay (still via `dataUrl`, quote, `<audio autoPlay>`, "her own words"); `:349-363` every tutor decision listed with its quote, including predictions; `:364-373` all rule titles; `:270` "tutor silent, guard armed"; `:312-345` outcome list; `:385-388` "End session · show the mastery card".

**Build**
1. **Header**: step 3, "{learner} learning from {expert}", phase chip "Coached" / "On your own — the tutor stays quiet". No mention of the guard.
2. **Presence**: "Watching" / "Speaking" (`vm.voice.isSpeaking`) / "Listening" (when C exposes `vm.tutorState`); never infer listening.
3. **Tutor line**: the latest decision only, at 20/28, with a kind word (predict → "Before you decide", intervene → "Hold on", stop → "Stop and ask", praise → "Good", novel → "Not taught yet"). `lib/ui/teachview.ts` `tutorLine(d)` hides `d.quote` for `predict`; for intervene, stop and praise the quote is a `QuoteCard`. Earlier lines collapse under "Earlier".
4. **Replay panel** — the emotional beat. Opens when `vm.replay` is set, full width of the companion, 200 ms scale-in: label "{expert}'s screen, {t} s into their session — captured still"; `FrameThumb` (`url ?? dataUrl`, highlight on `step.screenMoment.region`); "What {expert} did": step title, decision, a chip `field: from → to`; the quote at 22/30, "{expert}, in their own words"; the clip with a visible play control and progress (`autoPlay` kept) or, without audio, "No recording of this moment — the tutor reads the quote"; footer "Fix it when you are ready" and Close.
5. **Rules**: "Rules from {expert}'s map: {n}"; a row (title + status) only for rules already exercised (`status !== "untested"`); the rest as "{k} not yet encountered". Full list in presenter mode. `visibleRules(card, presenter)` in `lib/ui/teachview.ts`.
6. **Pre-start**: persona card; "Loaded {expert}'s confirmed Work Map, rev {n}" (no titles); unconfirmed map → Start disabled with "Only a confirmed map teaches" and a link to the map.
7. **End**: button "End session · show the mastery card" (frozen, §6; becomes "End session — show what I learned" after B's switch). **Outcome card** (`data-testid="teach-outcome"`): "What {learner} can do alone"; per rule the label exactly as the matcher gives it (*correct without help · correct after a hint · corrected after intervention · not tested*), the title, the independent badge, the detail; flagged cases "sent to {expert}'s map as open questions"; "Practice next" list, and a "Practice this" button only when C provides `vm.practice(ruleId)` (P-19). No score, no percentage.
8. Recent events and counters move into a mechanism drawer. Workspace wrapper from WD-11.

**Files** — edit `components/views/TeachView.tsx`; create `lib/ui/teachview.ts` + test. Requests (H8) to C: `vm.tutorState`, `vm.practice`, `vm.ready`, `pipeline.setCropTarget`; (H5) frames with `url`.
**Contracts** — renders P-1, P-16 (`missing` in the tutor line for a stop), P-19.
**Acceptance — automated** — `lib/ui/teachview.test.ts`: `tutorLine` returns no quote for predict and the quote for intervene; `visibleRules` hides untested titles unless presenter; the four labels pass through unchanged. `scripts/d-shots.mjs` (keyless, `share=0`): before any event no rule title is in the DOM; after choosing a wrong code on 4490 the tutor line and then the replay appear; the header never contains "guard".
**Acceptance — human** — HT-9.
**Sub-agents** — `f-teach` [AUTO build]; "did the replay land" [HUMAN].
**Pitfalls** — the smoke looks for "Sabine would stop here", "needed the guard", "independent: correct without help" and the End button text: keep the freeze list (§6) · two audio sources at once (A guarantees TTS and clip do not overlap; do not add a second player) · a pronoun.

### WD-12 · Juror landing page   `[P0 · by M3 · Req N2 N5]`

**Why** — the jury opens the live link (spec §13, N2): a juror must understand in ten seconds and reach a finished Work Map in one click. First-round review is asynchronous and fast.

**Today** — `/` is four equal link cards with wrong counts (`app/page.tsx:3-8`), no starting point, no status, cards open in the same tab, and "3 · Teach" can start the tutor on an empty map (`TeachStart.tsx:8`).

**Build**
1. One sentence: "Tacit sits beside an expert while they work, asks why at the pauses, and turns what it learns into a tutor that stops a new hire before a wrong decision is saved."
2. **Door 1 — "See a finished Work Map and try the tutor"** (one click, no setup): the page is a server component (`force-dynamic`) that reads `listSessions()` / `getMap()` (`lib/store`, read-only, the same calls `app/teach/page.tsx:8-12` makes) and picks the sample with `pickSample` (`lib/ui/landing.ts`: newest session whose id starts with `demo_` and whose map has `confirmedAt`); links "Open the Work Map" → `/map/<id>` and "Be the new hire" → `/teach?from=<id>`. No sample → the door says so, disabled.
3. **Door 2 — "Run it yourself"** (5 minutes, microphone and Chrome): → `/capture` (workspace mode). Under it: "You will play the expert. Headphones recommended."
4. **Status strip** (`components/demo/HealthStrip.tsx`, reads `GET /api/health`, P-10): "Voice: ElevenAgents live" / "Voice: browser fallback" · "Vision: live model" / "Vision: ERP telemetry only" · "Sample data: present / missing". Words, not just dots. Before `/api/health` exists: "Status unavailable".
5. Below the fold: the five Apprentice Test one-liners (`docs/05` §5), each naming where to look; links to the repo and, once uploaded, the videos. `BrowserCheck` at the top if not Chromium desktop.

**Files** — edit `app/page.tsx`; create `lib/ui/landing.ts` + test (and use `HealthStrip` from WD-10).
**Contracts** — P-10 (reads), P-25 (the sample must be visible in every visitor's workspace, and `listSessions` may gain a workspace argument: ask B, H14).
**Acceptance — automated** — `lib/ui/landing.test.ts`: `pickSample` returns the newest confirmed `demo_` session, `undefined` when none. `scripts/d-shots.mjs`: both doors visible at 1440×900 and 390×844 without scrolling; door 1 links resolve to 200.
**Acceptance — human** — HT-7 starts here.
**Sub-agents** — `f-landing` [AUTO]; copy read aloud once by the human [HUMAN].
**Pitfalls** — a hardcoded session id · promising "live" when the strip says fallback · a wall of text.

### WD-10 · `/demo` presenter control room · three 60-second videos · team photo · README · HackOS submission   `[P0 · by M3 → submit · Req N6 P1]`

**Why** — first-round judging is three one-minute videos, the live link, the repo and a photo, reviewed asynchronously (spec §13). "Communication" is a third of the criteria. A reset that needs a terminal (audit infra gap 15) ruins a second take.

**Today** — no `/demo` route; resetting means `npm run seed:session` in a terminal plus two GET URLs (`docs/05` §2), and neither clears the guard. No video, caption or form copy exists. `README.md` is the starter's, with stale claims (`README.md:74` "19 tests", `:98` "four functions").

**Build**
1. `/demo` (`app/demo/page.tsx`, client): **Preflight** — `HealthStrip`, commit, store, same-origin note (the origin shown in large type: use only this one). **Reset** — one button → `POST /api/demo/reset` (P-18, H12); until it lands: `POST /api/erp/reset?queue=expert|newhire|autopilot` + `POST /api/teach/guard {action:"disarm"}` and the note "samples are reseeded with `npm run seed:session`". **Launch** — Capture (workspace) · Capture (two-window: `OpenErpButton` + `/capture?layout=companion`) · latest session's map · Teach on the latest confirmed map · sample map; each with a `?presenter=1` twin. **Cue card** — the one-liners of `docs/05` §4 and §5. Never the role card.
2. **Copy by M2** (`docs/pitch/`): `captions.md` (every burned-in caption and the three storyboards from `docs/05` §7.1–7.3 turned into shot lists with seconds), `readme-draft.md`, `hackos-fields.md` (title, ≤ 100-word description, the five one-liners, whatever the real form asks), `deck.md` (seven slides of `docs/05` §6 as copy; slide 7 is the closing frame of the Demo and Tech videos — build it as a 1920×1080 image in `public/`).
3. **Team video + photo before midnight** (record during the M2 ritual, when all four are stopped): four faces, one sentence each, one shared line, the moonshot.
4. **Raw takes from M3**: 1080p, system audio **and** mic, workspace mode, browser zoom 110–125 %; one take per beat; file names `beat-<n>-take-<k>.mov`. At M4 every beat has a usable take.
5. **3:30–6:15** three rehearsals with a different teammate as each judge, recorded. **6:15–7:15** cut Demo and Tech to ≤ 60.0 s each (leave 0.5 s of margin), captions burned in, H.264 MP4, check each file plays and is under 1 GB.
6. **README final** (≤ 2 screens, `docs/05` §10): what it is · live link · the three videos (links to the files or an unlisted mirror, plus the uncut run) · 30-second keyless run · keys table · the five answers · architecture · honest limits (what is sandbox-only, what the provider retains) · team. Delete the stale claims (19 tests, four store functions).
7. **7:30 AM** HackOS per `docs/05` §11: three files, link, repo (public), photo, text fields; **Submit project**; screenshot "Your project is submitted". Then nobody pushes or redeploys.

**Files** — create `app/demo/page.tsx`, `components/demo/HealthStrip.tsx`, `docs/pitch/*`, `public/moonshot.png`; edit `README.md`, `docs/05`.
**Contracts** — P-10, P-18 (reads). H12.
**Acceptance — automated** — `scripts/d-shots.mjs`: `/demo` renders with and without `/api/health`; Reset shows a success or a labeled failure. `ffprobe` on each final file: duration ≤ 60.0, codec h264, size < 1 GB (run by the human's agent on the files).
**Acceptance — human** — HT-10, HT-11.
**Sub-agents** — `f-demo` (`app/demo/page.tsx`, `components/demo/HealthStrip.tsx`) [AUTO] · `copy` (`docs/pitch/*`, `README.md`, `docs/05`) [AUTO draft, HUMAN edit] · recording, cutting, submitting [HUMAN].
**Pitfalls** — a 61-second file · a silent agent in the recording (check the audio track of the first take before doing ten more) · a private repo · "Save project" instead of "Submit project" · a redeploy after submission.

### WD-9 · Judge QA   `[P0 · every M · Req all]`

**Why** — nothing that touches a real service has ever run (spec §8.1); agents cannot hear. The scoreboard is the team's only truthful view of the eight beats.

**Today** — `docs/status/D.md` is an empty template; no beat has been run by a human on a deployed URL; the only end-to-end evidence is a keyless smoke with typed answers.

**Build — the protocol, every checkpoint**
1. Ten minutes before: read `docs/status/{A,B,C}.md`; ask B "is the deploy on latest `main`?"; open `/demo`, Preflight green, Reset.
2. Run the judge script (`docs/05` §4) on the **deployed URL**, fresh Chrome profile, headphones, real voice. M1: beat 1 only. M2: a teammate who is not A or C plays Sabine with the role card but their own words; you watch and score beats 1–6. M3 and M4: you play both judges, beats 1–8 and the "+" beat.
3. A beat is **PASS** only if you saw and heard it on the deployed URL. "PASS (local)" is allowed and counts as not passed for the checkpoint bar. **FAIL** needs an issue. **NOT YET** = the feature is not merged.
4. Every failure → `gh issue create -t "[beat 3] 'scratch that' ignored outside a window" -l lane:A -l P0 -l demo-blocker -b "<URL, steps, expected, actual, session id, console errors, time>"`. Owner per the "Owner if it fails" column of `docs/05` §1.
5. Write `docs/status/D.md`: the seven sections `docs/prompts/checkpoint.md` requires, **then** the scoreboard (format below). Paste the five-line summary in chat.

```markdown
## Scoreboard — M2 · 10:41 PM ET · commit abc1234 · https://<deploy> · judge: <name> (Sabine), <name> (observer)
| # | Beat | Result | Evidence (session id · what was seen or heard) | Owner | Issue |
|---|---|---|---|---|---|
| 1 | Pause → grounded "why" | PASS | s_k3f9 · asked 3.1 s after my last word, named 4471 and 4711→0400 | A/B | — |
| 2 | Guardrail question | FAIL | s_k3f9 · no limit/stop question in 6 min | A | #41 |
| 3 | "Scratch that" → red band, ledger | NOT YET | — | A/B | #37 |
| 4 | Debrief ≥ 3 new questions | … | | C/A | |
| 5 | Teach-back corrected, confirmed | … | | C/A | |
| 6 | Work Map: frame + quote on every judgment step | … | | C/D/B | |
| 7 | 4490 caught before save, replay | … | | C/A/B | |
| 8 | 4491 quiet → independent → outcome card | … | | C | |
| + | policy.json → agent halts | … | | B | |
### Apprentice Test visible on screen? A1 … A5: yes/no + where
### Zero-instruction (N5): seconds to first question · times the driver asked "what now?" · where
### Numbers for the Tech video (copied from the Map page "Measured")
```

**Files** — `docs/status/D.md`. **Contracts** — none.
**Acceptance — automated** — none (this WP is the human check). **Acceptance — human** — the scoreboard exists for M1–M4 with evidence in every PASS row.
**Sub-agents** — `qa-scribe` turns the human's spoken notes into issues and the scoreboard [AUTO]; the run itself [HUMAN].
**Pitfalls** — testing on localhost and calling it done · using the role card's sentences word for word (vary them: that is the test) · helping the teammate who plays Sabine · writing "verified" for something nobody heard.

## 5. Wave plan

| Wave | Clock (ET) | WPs in parallel | Sub-agent scopes (file-disjoint) | The human meanwhile |
|---|---|---|---|---|
| 0 | 5:00–5:30 PM → **M0** | WD-1 | `d0-capture`: `CaptureClient.tsx`, `views/CaptureView.tsx`, `views/capture.vm.ts` · `d0-map`: `MapClient.tsx`, `views/MapView.tsx`, `views/map.vm.ts` · `d0-teach`: `TeachClient.tsx`, `views/TeachView.tsx`, `views/teach.vm.ts` · `d0-proof`: `lib/views.seam.test.ts`, `scripts/d-shots.mjs` | HackOS (team, challenge, credits, read the form), team photo, approves the design direction, posts `MERGED: seam split` |
| 1 | 5:30–7:30 PM → **M1** | WD-13, WD-3, WD-2 | `d1-scenario`: `lib/erp-model.ts`, `lib/erp-model.scenario.test.ts`, `docs/03` §8, `docs/05` · `d2-form`: `InvoiceForm.tsx`, `lib/erp-ui.*`, `components/erp/PiiPublisher.tsx` · `d3-erp-shell`: `ErpHeader.tsx`, `app/erp/page.tsx`, `app/erp/invoice/[id]/page.tsx`, `app/erp/layout.tsx`, `components/erp/ResetQueueButton.tsx` · `d4-tacit-flow`: the three Views (pre-start and cited lines), `TeachStart.tsx`, `app/page.tsx`, `components/ui/{usePresenter,PersonaCard,OpenErpButton,SessionList,BrowserCheck}`, `lib/ui-copy.spoilers.test.ts` · `d5-tooling`: `scripts/d-shots.mjs`, `docs/status/D.md`. Order: `d1` merges first (types), then `d2`; `d2` and `d3` agree on the props `queue`, `queueProgress` | HT-2, HT-3; posts `CONTRACT:` (scenario) and the smoke request to B; M1 judge run (beat 1) |
| 2 | 7:45–10:30 PM → **M2** | WD-5, WD-11, WD-4, WD-6, copy | `e-kit`: `app/globals.css`, `app/layout.tsx`, `components/ui` core, `Meter.tsx`, `app/error.tsx`, `app/not-found.tsx`, `lib/ui/presence.*` (first PR by 8:30) · `e-ws`: `lib/ui/layout.*`, `components/ui/{Workspace,useLayoutMode}`, `views/TeachView.tsx` · `e-erp`: `app/erp/erp.css`, `app/erp/**`, `ErpHeader.tsx`, `InvoiceForm.tsx`, `components/erp/EmbedAware.tsx` · `e-cap`: `views/CaptureView.tsx` (after `e-kit` PR 1) · `copy`: `docs/pitch/*` | HT-4, HT-5, HT-6; watches the M2 run silently and scores; records Team video + photo before midnight |
| 3 | 10:45 PM–1:30 AM → **M3** | WD-7, WD-8, WD-12, WD-10 (`/demo`) | `f-map`: `WorkMapView.tsx`, `views/MapView.tsx`, `lib/ui/mapview.*` · `f-teach`: `views/TeachView.tsx`, `lib/ui/teachview.*` · `f-demo`: `app/demo/page.tsx`, `components/demo/HealthStrip.tsx` (lands first) · `f-landing`: `app/page.tsx`, `lib/ui/landing.*` · `copy`: `README.md`, `docs/pitch/*`, `docs/05` | HT-8, HT-9; M3 run as both judges on the deploy; HT-7 with an outsider; first raw takes |
| 4 | 1:45–3:30 AM → **M4** | fixes from M3 and HT-7; copy freeze | one agent per open `lane:D` issue, one file each | raw takes of every beat; re-reads the HackOS form; M4 run |
| 5 | 3:30–6:15 AM | rehearse ×3, record | `qa-scribe` only; bug fixes behind the freeze rule | drives or observes each rehearsal; README final |
| 6 | 6:15–7:30 AM | cut, submit | — | cuts three videos, `ffprobe`, uploads, **Submit project**, screenshot |

Rules for every sub-agent brief: WP id and goal · the exact files and "nothing else" · the vm fields it may read · the acceptance check · verification = `npm run typecheck && npm test` + `scripts/d-shots.mjs` screenshots at 1440×900 **and** at a 480 px companion (and the ERP at 1020×852), which the sub-agent opens, looks at and critiques in its report. One sub-agent = one worktree = one branch `d/<task>` = one PR ≤ ~400 lines.

## 6. Handshakes

**What this lane owes**

| Id | What | To | Due | Chat message |
|---|---|---|---|---|
| — (`04` §3) | Seam split | A, C | M0 | see WD-1 hand-off |
| H2 | Typing fixed at the source | A, C | M1 | `MERGED: WD-3 — ERP text inputs post "typing" while typing and ONE field_changed on blur (notes content is never sent). Your defensive handling stays; the junk candidates should be gone. Pull.` |
| H1 | `save_intent` posted from the ERP | C (after B's types) | types M0+1h, D's part M1, end to end M2 | `MERGED: save_intent (P-11) is posted when the save-confirm opens, with the proposed state (status "posted" or "hold"), mode and queue. C: the matcher can intervene on it.` |
| H7 | Scenario | C, B | M1 | `CONTRACT: scenario (docs/03 §8 updated) — expert queue is 4470,4471,4472,4473,4474 (4470, 4474 routine); new-hire 4490–4494 start with costCenter "" (toInvoiceState omits it); all dates are 2025; Invoice gains contactName/contactEmail/contactPhone/iban (never in InvoiceState); a normal save commits status "posted"; the "approved" button is gone. Everyone: npm run seed:session. B: reset the deploy.` |
| H7 | Smoke follows the ERP | B | with WD-3 | `B: WD-3/WD-13 change what scripts/smoke.mjs clicks (lines 137, 149–159). Courtesy PR #__ switches those steps to data-testid and the new flow (pick a cost center on 4491/4494, erp-save, erp-confirm, erp-posted-banner). Please merge right after #__.` |
| H13 | `data-pii` marks + rect publisher (P-24); the crop element | B (and A, C for the vm) | M2 | `MERGED: ERP publishes PII rects on "tacit-erp-pii" (P-24) and the workspace hands its frame element to vm.pipeline.setCropTarget when that field exists. A, C: please add pipeline.setCropTarget(el) + pipeline.surface to the vm and pass { mode: "workspace", cropTo } to start() (P-23).` |
| H7 | ERP skin final | B | M2 | see WD-4 step 7 |

**Smoke freeze list.** `scripts/smoke.mjs` (B's) selects by text. Until B's testid switch merges, these strings stay byte-identical (restyle and move freely): "Start session and share the ERP tab", "Governor", "Show the mechanism", "mic open, recording the answer", placeholder "Type the answer…", "Log", "Scratch that", "Done · start the debrief", "Gaps closed", "Start the spoken debrief", "Yes, that is how it works", placeholder starting "Correct one detail", "Correct", "confirmed by {name}", "Start and share the ERP tab", "Tutor", "Replay", "End session · show the mastery card", "Sabine would stop here", "needed the guard", "independent: correct without help", "Not posted", "Prove it: load policy.json", "halted". Every D PR in wave 1 adds these test ids without changing text: `capture-consent, capture-start, capture-presence, capture-mechanism-toggle, capture-question, capture-window-phase, capture-answer-input, capture-answer-log, capture-not-now, capture-strike, capture-pause, capture-done · map-progress, map-start-debrief, map-answer-input, map-answer-log, map-confirm-yes, map-correct-input, map-correct-submit, map-confirmed, map-autopilot-run · teach-start, teach-begin, teach-tutor, teach-replay, teach-end, teach-outcome · erp-cost-center, erp-asset-number, erp-route, erp-decision-post, erp-decision-hold, erp-note, erp-save, erp-confirm, erp-cancel, erp-status-badge, erp-posted-banner, erp-held-panel, erp-next, erp-row-<id>`. Then ask B (issue with the mapping, due M1) to move the smoke to them; after that merge, copy is free. **WD-6, WD-7 and WD-8 change frozen strings ("Governor" moves into a closed drawer, the End button, the "Gaps closed" title): they merge only after B's switch. If B has not merged it by 9:00 PM, send the selector swap as a courtesy PR and have your human ping B.** Note for B: the smoke's wait for "Mastery card" (`smoke.mjs:169`) matches the End button's own label, not the outcome panel ("Session outcome", `TeachClient.tsx:314`); point it at `teach-outcome`.

**What this lane is owed**

| Id | What | From | Needed by | If late |
|---|---|---|---|---|
| H1 / P-11, P-14 | `EventKind "save_intent"`, `TelemetryMessage.queue`, the hello helper | B | M0+1h | `BLOCKED: D needs EventKind "save_intent" + TelemetryMessage.queue (WB-4) to post them from InvoiceForm — ETA?` Everything else in WD-3 ships without them |
| H10 | Deployed URL on latest `main`, env set | B | M0, then every checkpoint | QA runs on localhost and every PASS is marked "(local)"; raise `BROKEN:` if the link is down after M2 |
| H8 | vm fields: A — `reasonHeard`, `togglePause`, `paused`, `lastStrike`, `deferred`, `noisy`, `voice.degraded`, `voice.lastError`, `stt`, `pipeline.setCropTarget`, `pipeline.surface` · C — `canonical`, `matrix`, `lastPatch`, `knowledge`, `llm`, `pending`, remove callbacks, `tutorState`, `practice`, `ready`, `pipeline.setCropTarget` | A, C | as each lands (M2 / M3) | the View renders the empty state; nothing breaks. Request line: `REQUEST (H8) lane:C — map.vm.ts: lastPatch: { ruleTitle, before, after }[] (render-ready strings) so the teach-back shows the rule diff.` |
| H5 / P-1 | `Frame.url`, frames endpoint | B | M2 | Views already render `url ?? dataUrl` |
| H13 / P-23 | Workspace capture cropped to the frame, `surface` | B | M2 | workspace stays the default only for keyless sessions; real-vision sessions use the companion layout |
| H12 / P-18 | `POST /api/demo/reset` | B | M3 | `/demo` uses the three existing reset calls |
| P-10 | `GET /api/health` | B | M0–M1 | status strip says "Status unavailable" |
| P-16, P-19, P-20, P-27 | `SaveVerdict.missing`, practice invoice, `canonicalSteps` / `evidenceMatrix`, `llm` + `note` | C | M3 | panels omit the missing part |
| H14 / P-25 | Per-visitor workspace id | B → C | M3 | when C changes `listInvoices` / `getInvoice` to take the workspace id, D's two ERP pages must pass it in the same merge window: pre-approve C touching `app/erp/page.tsx` and `app/erp/invoice/[id]/page.tsx` for that change only, or land a D PR within 10 minutes of C's `CONTRACT:` |

## 7. Human test scripts

Each ≤ 2 minutes unless marked. Chrome, headphones. Record the result in `docs/status/D.md` ("verified live: yes, by <name>, <time>").

- **HT-1 · Seam split sanity.** `npm run seed:session && npm run dev`. Open `/capture?share=0`: tick consent, Start, "Show the mechanism". Open `/erp/invoice/4471` in a second tab, change the cost center: the event appears. Open `/map/demo_sabine`, start the debrief, type one answer, Log: the input clears and the next question shows. Open `/teach?from=demo_sabine_confirmed&share=0`, press Start on the picker, then Start on the session page. Nothing looks or behaves differently from the "before" screenshots.
- **HT-2 · ERP at the source.** (1) `/erp?queue=expert` lists 4470–4474, dates in 2025; open 4471: contact, email, IBAN visible. (2) With `/capture?share=0` started and the mechanism open: type an asset number slowly, press Tab → exactly one event row, no questions about half-typed text. (3) Press "Post invoice" → a confirm strip; Confirm → a POSTED badge and banner, fields locked. (4) `/erp?queue=newhire` → 4490 shows "Select cost center…"; "Post invoice" without choosing → a message under the field, nothing saved. (5) The browser tab is titled "MB-ERP · Accounts payable".
- **HT-3 · No answers on screen.** Open `/teach`: only confirmed maps are offered; no rule text, no invoice hints. Start: the panel says "Open the first invoice in your queue". Add `?presenter=1`: the rule list appears. Open the Map page mid teach-back: the correction box says "Correct one detail (say it or type it)" and names no supplier. Search the screen for "Sabine", "Lena", "her": only where a name was typed in.
- **HT-4 · Workspace.** Open `/capture` at full width: ERP on the left (dimmed, "Start the session to begin"), companion on the right. Start: the share dialog offers this tab; pick it. Work 4470 in the frame: the companion never scrolls away, the "What I see" thumbnail shows only the ERP. Click "Queue" inside the frame: still the expert queue, no Tacit page inside the frame. Open `/capture?layout=companion` in a 480 px window: same companion, an "Open the ERP" button.
- **HT-5 · Two products.** Put ERP and companion side by side: could a stranger mistake them for one application? Read the invoice amount, cost center and status from two metres. Press Tab through the companion: a visible ring on every control. The Start button before consent looks disabled and says why.
- **HT-6 · Calm companion.** During a real capture with voice: is there exactly one thing to look at (the presence)? Does its reason line match what you are doing ("typing", "expert talking")? When a question is asked, can you read it and your own caption at arm's length? Press Pause, speak, press again: the paused state is obvious and the copy claims nothing that the network tab contradicts. Say or press "Scratch that": a red band, the ledger ticks.
- **HT-7 · Zero-instruction usability test (10 minutes, the important one).** Recruit someone who has never seen the app (a friend on a call sharing their screen is fine). Hand them the role card for Sabine. Say exactly: "This is a tool that learns a job by watching. Please try it. I can't help." Send the deployed URL. Stay silent. Measure and write down: seconds from landing to a running capture · whether they picked the right thing in the share dialog first try · every pause longer than 5 s (which screen, what they were looking for) · every "what do I do now?" · whether they found Done within 15 s of finishing the queue · then, as the new hire: whether they reached an intervention, and whether they can say in one sentence what the outcome card means. **Pass:** capture running in ≤ 90 s, at most one "what now?", right share target first try, Done found, outcome explained. Every miss becomes a `lane:D` issue with the screen named; P0 if it stopped them.
- **HT-8 · Work Map.** After a real session: read the three headline numbers aloud; do they match what you did? Click each judgment step: a still of your screen and your own sentence, word for word? Play one quote. Find one guardrail and its badge. During the teach-back, correct one detail: is the changed sentence marked and the rule diff readable? Say yes: does the page show confirmed and synced?
- **HT-9 · Teach.** As the new hire on 4490: choose the opex code. Did the tutor line appear before you could confirm a save? Does the replay show the expert's screen, the changed field, their sentence, and play their voice? Fix it. On the next invoice, is the panel quiet? End: can you tell from the card which rule you got alone and which you were rescued on? Was any rule readable before you met it?
- **HT-10 · Video preflight.** Record ten seconds of a capture with the question being asked. Play it back on another device: is the agent's voice audible, is the ERP text readable at 1080p, are captions inside the safe area, is the file H.264 MP4?
- **HT-11 · Submission dry run (5:30 AM).** In HackOS, fill every field from `docs/pitch/hackos-fields.md`, upload a placeholder video file, press Save: does anything get rejected (length, format, size)? Open the live link and the repo in a private window: no login, public. Do not press Submit until 7:30.
- **Checkpoint run (6 minutes, M1–M4).** The run of show in `docs/05` §4 on the deployed URL; fill the scoreboard.

## 8. If you are behind

Cut in this order (lane view of spec §11; say it in chat before you cut):

1. Document-PiP, the popup geometry of `OpenErpButton` (plain link is enough), any layout beyond workspace + companion (spec cut 5).
2. Evidence matrix and canonical timeline visuals → the instance timeline with headline counts (they depend on WC-8, a P1).
3. Audio control polish in the replay → the still, the quote, the tutor reading it (spec cut 6).
4. Map editing controls before confirm → hidden; correction by voice stays (spec cut 7).
5. Outcome-card polish → a plain per-rule list with the four labels (spec cut 8).
6. `/demo` beyond Reset + health + five links. The finalist deck beyond slide 7.
7. ERP skin depth → keep the light background, the type size, the status badge and the no-scroll invoice; drop table and header polish.
8. Presence animation → a static mark and the two text lines.
9. Landing below the fold.

**Never cut:** WD-1 · one `field_changed` per text edit, `save_intent`, POSTED on screen, `res.ok` · empty new-hire cost center, five expert invoices, PII fields · spoilers out of the DOM · workspace mode for keyless and sample sessions, companion legible at 420 px · frame + verbatim quote (or an explicit "not captured") on every judgment step · the replay panel · the two doors on `/` · the judge run and scoreboard at every checkpoint · the three videos with the agent audible and the moonshot as closing frame, the team photo, the README, the public repo check, "Submit project" confirmed.

## 9. Stretch

Only after M3 is green on the deployed URL, in this order:

1. **Replay before/after**: two stills (before and at the decision) with a 3-second crossfade and the changed field highlighted — needs B/C to store the earlier frame; pure View work on this side.
2. **Document Picture-in-Picture companion** for two-window mode. Verified feasible on Chrome/Edge 116+ (`docs/02` §8): one window per tab, needs its own click, styles copied by hand, and it closes when the opener navigates — so only for `/capture`, never across the jump to `/map`.
3. **X2 captions**: `QuoteCard` and the replay show `quote.translation` under the original (P-7) if A and C ship the language stretch.
4. **X4 view**: a two-column divergence list if C builds the two-experts diff.
5. **Practice loop**: after "Practice this", reload the frame on the new invoice and return to the tutor.


---

## ⑦ 🗺️ TEAM PLAN — read once

# 00 · Start here — Tacit, the AI Apprentice

**Hack-Nation 7th Global AI Hackathon · Challenge 01 (ElevenLabs) · team of four · submit by Sun Oct 4, 7:30 AM ET (hard deadline 9:00 AM).**

You are one of four people. Each of you drives an AI coding swarm. All four swarms push to this repo at once. This page tells you what to read, what to paste, and what happens in the next 30 minutes.

---

## The package (what each file is for)

| File | For | Read time |
|---|---|---|
| **`docs/00-START-HERE.md`** | You, now | 3 min |
| **`docs/01-SPEC.md`** | Everyone. What we are building, how it works, what the audit found, every work package | 20 min (skim §1–§4, read §8) |
| `docs/02-PLATFORM-FACTS.md` | Verified ElevenLabs / AI SDK / hosting / browser facts, the known SDK mismatches in our code, snippets. Mostly for your AI; lanes A and B should skim §1 | reference |
| `docs/03-CONTRACTS.md` | The typed seams between lanes. Mostly for your AI; look at it when you change a shared type | reference |
| **`docs/04-TEAM-PROTOCOL.md`** | Everyone. Who owns which file, git rules, checkpoints | 8 min |
| `docs/05-DEMO-AND-SUBMISSION.md` | The show: demo beats, role cards, the three 60-second videos, submission checklist (lane D owns it; everyone reads §1, §4, §11) | 8 min |
| **`docs/lanes/<your lane>.md`** | Your task list with acceptance tests and human test scripts | 15 min |
| **`docs/prompts/<your lane>-kickoff.md`** | The first message you paste into your AI tool | paste |
| `docs/prompts/checkpoint.md` | Paste at 7:30 PM, 10:30 PM, 1:30 AM, 3:30 AM | paste |
| `docs/prompts/pre-merge-review.md` | Paste (or let your orchestrator run it) before risky merges | paste |
| `AGENTS.md` (+ `CLAUDE.md`, which imports it) | The priming document every AI tool loads automatically: rules, ownership, commands | your AI reads it |
| `.github/CODEOWNERS`, `.github/workflows/ci.yml` | Ownership notifications and the CI gate | — |

## Pick your lane

| Lane | You are the one who… | Best fit |
|---|---|---|
| **A · Voice & Timing** | wears the headset and talks to the agent all night; tunes when it speaks and how it sounds | strongest front-end / real-time person; patient ear |
| **B · Eyes, Trust & Platform** | owns the repo, CI, keys, deploy, the vision pipeline and the privacy mechanics | most infra-minded; comfortable with deploys and browser media APIs |
| **C · Map & Teach Brain** | owns the Work Map, the compiler, the debrief logic, the tutor's rule matcher | strongest on data modeling, TypeScript, LLM structured output |
| **D · Experience, Demo & Pitch** | owns every screen, the sandbox scenario, the judge QA, the three videos, the submission | product-minded; the person who pitches |

Write the four names into `docs/04-TEAM-PROTOCOL.md` §1 and `.github/CODEOWNERS` (replace `@LANE_A…D`).

## The first 30 minutes (kickoff → M0)

| Min | Who | Does |
|---|---|---|
| 0–5 | **B** | Creates the **public** GitHub repo from this folder (public is required at submission; there are no secrets in it), pushes `main`, sets branch protection + labels (`docs/04` §5.2), invites the team. Hands out `ELEVENLABS_API_KEY` and `AI_GATEWAY_API_KEY` privately. |
| 0–5 | **D** | Logs into HackOS (`app.hack-nation.ai`): everyone accepts the team invite, selects Challenge 01, **claims the ElevenLabs / Anthropic credit codes** (first-come), reads the real submission form. Takes the team photo. |
| 0–5 | everyone else | Reads this page and `docs/04-TEAM-PROTOCOL.md`. |
| 5–10 | everyone | `git clone`, `npm install`, create `.env.local` from `.env.example`, `npm run typecheck && npm test`, `npm run seed:session`, `npm run dev`, click through `/erp` → `/capture?share=0` → `/map/demo_sabine` → `/teach` once so you have seen the thing. |
| 10 | everyone | Opens their AI tool at the repo root and pastes `docs/prompts/<lane>-kickoff.md`. |
| 10–30 | **D** | Seam split PR (the only thing blocking A and C from editing the three `*Client.tsx` files). Posts `MERGED: seam split`. |
| 10–30 | **A** | Creates the two ElevenAgents agents; first live round trip on `/voice-check`. |
| 10–30 | **B** | Contract types PR (`save_intent`, `deferred`, store signatures); deploy skeleton → posts the URL. |
| 10–30 | **C** | Runs the LLM compile with the real key on the seeded session; starts the flat-schema + replay-validation path. |
| 30 | all | **M0 check**: CI green on `main`, agents exist, seam split merged, a deployed URL exists, HackOS team complete. |

## The night at a glance (ET)

```
5:00 PM  kickoff ──► 5:30 M0 wired
7:30 PM  M1  real voice asks one grounded question about a change the vision model saw
10:30 PM M2  a teammate plays Sabine unscripted: 3 live questions, debrief, corrected teach-back, Work Map
1:30 AM  M3  D plays both judges on the deployed URL: tutor catches the mistake before save
3:30 AM  M4  FEATURE FREEZE ── bugs and copy only
3:30–6:15    three rehearsals · record raw takes · README
6:15–7:15    cut the three 60-second videos (demo · tech · team)
7:30 AM  SUBMIT on HackOS: 3 videos + live link + public repo + team photo ── nobody pushes or redeploys after this
9:00 AM  deadline
```

## Five rules that keep four swarms from colliding

1. **One lane writes each file.** Need something in someone else's file? Issue or a ≤ 15-line courtesy PR. Never "fix it while you're there."
2. **Small PRs, short branches, auto-merge on green CI.** One sub-agent = one worktree = one branch = one PR.
3. **Contracts change additively**, in the owner's PR, with a `CONTRACT:` line in chat.
4. **A human verifies anything with a voice or a screen.** Your AI cannot hear. It will hand you 2-minute test scripts; run them and tell it the truth.
5. **Main is always demoable and keyless mode always works.** Break it → revert first.

## What the jury actually receives

Three **60-second** videos (demo, tech, team — file uploads), a **live deployed link** they will open, a **public GitHub repo**, and a team photo. Criteria: creativity, communication, technical depth. First-round review is asynchronous and fast, so the videos and the first 30 seconds on the live link carry most of the score. No deck is submitted; the moonshot is the closing frame of the videos (`docs/05` §7, `docs/01-SPEC.md` §13).

## What we are *not* doing

No rewrite of the stack. No simulator, case generator, knowledge graph or vector DB. No stretch goals before M3 is green. No hardcoding anything from the role card to make a beat pass — if the expert did not say it, the map keeps an open slot, and that is the product working.

