# 📦 LANE C — Map & Teach Brain

> **Your role in one line:** You explain things to the compiler in your own words and judge whether the rules it builds are right.

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

**Before you start:** Wait for B's message `REPO READY` + keys.
**Key times (ET):** 7:30 PM M1 · 10:30 PM M2 · 1:30 AM M3 · **3:30 AM feature freeze** · **7:30 AM submit** · 9:00 AM hard deadline.

---

## ① STEP 1 — Setup (10 min, terminal)

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

# Kickoff prompt · Lane C — Map & Teach Brain ("the Knowledge")

**Human setup before you paste (5 min):** fresh clone on `main`; `npm install`; `.env.local` with `AI_GATEWAY_API_KEY` (from B). Your job as the human: be the judge who explains things *in a way the code did not expect* — you will feed the compiler and the debrief paraphrases all night and say whether the resulting rules are right.

Paste everything in the block below as the first message in your AI coding tool, opened at the repo root.

---

```text
You are the lead engineering agent for LANE C — Map & Teach Brain — on team Tacit, a four-person hackathon team. Hard deadline: submission Sunday Oct 4, 9:00 AM ET; feature freeze 3:30 AM ET. Three other humans (lanes A, B, D), each with their own agent swarm, are pushing to this same repo right now.

YOUR MISSION: a free-form human explanation becomes a correct, evidence-linked Work Map with machine-checkable rules; the debrief closes real gaps; the teach-back sounds like a person and can be corrected by voice; and the same rules catch a new hire's wrong decision BEFORE it is saved, explained in the expert's own words. You own Apprentice Test 3 (when it has understood) and 4 (whether the new hire learned). You are the critical path: the audit found that with a judge improvising as the expert, today's regex compiler usually produces zero or one rule — and then Teach has nothing to catch.

── STEP 1 · READ, in this order, completely ──
1. AGENTS.md  (binding rules — the non-negotiables in §4 are mostly about YOUR code: verbatim quotes, no rule without a stated trigger, no hardcoding, only a confirmed map teaches)
2. docs/01-SPEC.md  (especially §5.4 Map, §5.5 Teach, §6.4–6.8 engines, §8 audit findings 1, 2, 7, 11, 14 + your work packages WC-1…WC-12, §9 AI SDK facts, §12 quality gates)
3. docs/03-CONTRACTS.md  (§1 the Work Map — you own it; §3 voice tags you send; §4 your routes; §9 P-5, P-6, P-16, P-17, P-19, P-20 are yours; P-12, P-13 you adopt from A; P-11, P-15, P-21 you consume from B)
4. docs/04-TEAM-PROTOCOL.md
5. docs/lanes/C-map-and-teach-brain.md  (your task list, acceptance tests, the paraphrase corpus)
6. docs/05-DEMO-AND-SUBMISSION.md §1, §3 (the role card: you may read it to build TEST FIXTURES OF PHRASING, but its rules must never be encoded in prompts, compile logic, or defaults)
Then read every file you own end to end: lib/workmap.ts, lib/compile.ts, lib/teachback.ts, lib/matcher.ts, lib/metrics.ts, lib/erp.ts, lib/engines.test.ts, components/MapClient.tsx, components/TeachClient.tsx, app/api/compile, app/api/teachback, app/api/sessions/[id]/{map,slot,confirm}, app/api/teach/guard, app/api/erp/**, app/map/**, app/teach/**.
Then read docs/02-PLATFORM-FACTS.md §1 (fact 9), §4.3 and the snippet "Flat compile wire schema + converters", and the installed AI SDK, not your memory: node_modules/ai (v7: generateText + Output.object; schemas sent to a model must be flat — no recursion, no z.record, no min/max, nullable not optional). The current LLM compile pass almost certainly fails on its recursive schema and silently falls back: confirm `llm: true` in the /api/compile response before believing any result.

── STEP 2 · PREFLIGHT ──
git status && git pull && npm install && npm run typecheck && npm test
Confirm .env.local has AI_GATEWAY_API_KEY set (presence only — NEVER print it).
Do NOT edit components/MapClient.tsx or components/TeachClient.tsx until lane D's seam-split PR (components/views/*) has merged — ask me if it has. Everything in lib/ and app/api/ is yours now.

── STEP 3 · REPORT BEFORE CODING (max 25 lines) ──
(a) the mission and the M1 and M2 bars in your own words;
(b) a wave-1 plan as a table: WP id · sub-agent · exact files (disjoint) · branch · how verified · needs my human? ;
(c) your design for WC-1 in ≤ 10 lines: the flat model-output schema, how it converts to Cond, and the replay-validation rule;
(d) anything in the lane doc that contradicts the code.
Then START IMMEDIATELY.

── OPERATING LOOP (until 3:30 AM) ──
• Work the lane doc's waves in order. Fan out sub-agents in parallel — one sub-agent = one git worktree = one branch `c/<task>` = one small PR (≤ ~400 changed lines), file-disjoint scopes. lib/compile.ts is a hotspot inside your own lane: split it into modules early (e.g. lib/compile/{steps,rules-llm,rules-regex,slots,patch}.ts re-exported from lib/compile.ts) so your own sub-agents stop colliding.
• Every sub-agent brief: WP id and goal; exact files it may edit and "nothing else"; contract sections; acceptance check; verification (`npm run typecheck && npm test` + a NEW test file — only you may edit lib/engines.test.ts, and prefer new files anyway); "report what you changed, ran, and could NOT verify".
• TEST WITH PARAPHRASES, NOT THE SCRIPT. The lane doc contains a corpus of ways a human might explain each rule. Every compile/patch change is judged against it. LLM calls cannot run in CI: record real model outputs as fixtures (clearly labeled, with the model slug and date) and unit-test the validators, the replay check and the patch logic deterministically against them. Keep a `scripts/` runner that hits the real model for me to run locally.
• Read every diff. For anything touching rule validation, slot filling, confirm, the matcher or the save guard, run docs/prompts/pre-merge-review.md as a fresh reviewer sub-agent before merging.
• Merge sequentially: git fetch && git rebase origin/main && npm run typecheck && npm test && git push && gh pr create --fill && gh pr merge --auto --squash.
• You own THE contract (lib/workmap.ts). Additive only; optional fields with defaults so existing stored maps still parse; update docs/03-CONTRACTS.md in the same PR; give me a `CONTRACT: …` line for chat.
• After every merge that changes behavior, give me a HUMAN TEST SCRIPT: what to say or type as the expert (in my own words), and what map/rule/teach-back I should get. Record my results in docs/status/C.md.
• Stay in lane. You do not touch voice.tsx, agents/*.md, the pipeline, or any View. Tutor/debrief wording changes: propose them to lane A (issue or courtesy PR on agents/*.md). Never edit package.json — ask me to ping B.
• Keyless mode keeps working: the deterministic compile stays as the labeled fallback and its tests stay green.
• Checkpoints at 7:30 PM, 10:30 PM, 1:30 AM, 3:30 AM ET: I will paste docs/prompts/checkpoint.md.
• If something will slip, tell me early with a recommended cut from docs/01-SPEC.md §11. Never weaken a non-negotiable to make a beat pass — an open slot is the correct outcome when the expert did not state a trigger.

── FIRST MOVES (wave 0, start now) ──
1. WC-1 spike with the real key: call the model with the current refineWithLLM on the seeded session and see whether the recursive schema is even accepted. Then build the flat-schema + replay-validation path. This is the single highest-leverage task in the whole project.
2. In parallel: WC-5 truthfulness sweep items that are pure deletions/guards (no default "the AP lead", no "petra", describeCond/evalCond total) and the test-file split (new files per engine).
3. In parallel: the paraphrase test harness, so every later change has a scoreboard.

What only I (the human) can do for you: phrase things like a real, slightly sloppy expert; say whether a compiled rule is what I meant; coordinate with A on voice.turn() and with D on the view-models.
```


## ✂️ end of MESSAGE #1 ⬆️

---

## ④ ✂️ MESSAGE #2 — CHECKPOINT PROMPT · paste at 7:30 PM, 10:30 PM, 1:30 AM, 3:30 AM (replace `<M1|…>` and `<A|B|C|D>` with **C**)

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

## ⑤ ✂️ MESSAGE #3 — PRE-MERGE REVIEW · paste into a FRESH chat before merging something risky (lane = **C**)

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

## ⑥ 📋 YOUR TASK LIST — reference only, DO NOT PASTE (your AI reads `docs/lanes/C-map-and-teach-brain.md`)

# Lane C — Map & Teach Brain — "the Knowledge"

> **Mission.** A free-form spoken explanation becomes a correct, evidence-linked Work Map with machine-checkable rules; the debrief closes real gaps; the teach-back sounds like a person and can be corrected by voice; the same rules catch a new hire's wrong decision *before it is saved*, in the expert's words. You own Apprentice Test 3 (understood) and 4 (learned).
> **The human in this lane** is the judge who phrases things weirdly: you feed compile, debrief and teach-back paraphrases all night and say whether the resulting rule is what you meant. You also coordinate `voice.turn()` with A and the view-models with D.
> **Success in one sentence:** a teammate who never saw the role card explains the three decisions their own way, the map holds only rules they actually stated (each replay-verified against their own invoices and linked to a verbatim quote), and the tutor then stops a stranger on the unseen invoice before save, quoting that teammate.

Notation: "Req M1/M2/M3" are the Map requirements of spec §4; "by M0…M4" are checkpoints. File:line references are to `main` at the baseline commit.

## 0. TL;DR

1. **WC-1 is the critical path of the whole project.** Today rules are born from three regexes (`lib/compile.ts:121-198`); a judge improvising yields 0–1 rules and Teach has nothing to catch. Build the LLM "understand" pass with a flat wire schema, prove it with the real key in the first 90 minutes.
2. **Trust anchor = replay validation + verbatim expert quotes.** A rule that does not reproduce her own decisions on her own invoices, or has no expert-spoken quote, does not exist. The fallback is always an open slot (a question), never a guess.
3. **Debrief answers and teach-back corrections must change rules through the same validator** (WC-2/3/4): a spoken "Becker" resolves to the supplier on her screen; a correction that changed nothing says "I did not catch what to change"; "not sure, skip that" is `skipped`, never a guardrail; confirm is refused until every decision has a runnable rule or is explicitly waived.
4. **Teach reacts to the right field and to save intent** (WC-7): a rule is evaluated only when its target field changes or on `save_intent`; start = disarm → reset new-hire queue → arm; replay shown deterministically.
5. **Engineering hygiene that makes 1–4 possible:** split `lib/compile.ts` into modules in the first 30 minutes; every model call sits behind an injected `call` so CI runs on recorded fixtures; the deterministic path stays as the labeled keyless fallback and its tests stay green.

## 1. What you own, what you never touch

| You own (only lane C edits) | Notes |
|---|---|
| `lib/workmap.ts` | THE contract. Additive only, optional fields with defaults, `docs/03-CONTRACTS.md` updated in the same PR, human posts `CONTRACT:` |
| `lib/compile.ts`, `lib/teachback.ts`, `lib/matcher.ts`, `lib/metrics.ts`, `lib/erp.ts`, `lib/engines.test.ts` | `engines.test.ts`: only you edit; still prefer new files |
| `app/api/{compile,teachback,teach,erp}/`, `app/api/sessions/[id]/{map,slot,confirm}/` | thin handlers; logic lives in `lib/` so it is testable (`vitest.config.ts` only includes `lib/**/*.test.ts`) |
| `components/MapClient.tsx`, `components/TeachClient.tsx`, `components/views/{map,teach}.vm.ts`, `app/map/`, `app/teach/` | **not before D's seam split merges**; then hooks/handlers only, no JSX |

**Files this lane creates** (add each to `docs/04-TEAM-PROTOCOL.md` §2 in the PR that creates it): `lib/compile/{steps,rules-regex,rules-llm,schema,numbers,quotes,suppliers,replay,slots,fill,patch,correct,confirm,lock}.ts` · `lib/compile/__fixtures__/**` · `lib/speech.ts` · `lib/debrief.ts` · `lib/teach-flow.ts` · `components/turnCompat.ts` · `lib/*.test.ts` (new files listed per WP) · `scripts/compile-live.ts`, `scripts/record-fixture.ts` (run with `npx tsx`, no `package.json` change) · `docs/status/C.md` · stretch only: `lib/matcher-soft.ts`, `lib/workmap-diff.ts`.

**Never touch:** `components/voice.tsx`, `agents/**`, `lib/governor.ts`, `lib/curiosity.ts` (import `extractThresholds` read-only at most; WC-5 replaces its use), `lib/elevenlabs-sync.ts`, `components/useScreenPipeline.ts`, `lib/events.ts`, `lib/telemetry.ts`, `lib/store.ts`, `lib/export.ts`, `lib/autopilot.ts`, `scripts/seed-session.ts`, `scripts/smoke.mjs`, `package.json`, `.env.example`, every `*View.tsx`, `components/WorkMapView.tsx`, `components/TeachStart.tsx`, `components/InvoiceForm.tsx`, `lib/erp-model.ts` (import `COST_CENTERS`, `seedInvoices`, `toInvoiceState` read-only). A need in one of those is an issue or a courtesy PR tied to a handshake id (§6).

**Signatures other lanes import and that must stay callable:** `compileDeterministic(log)`, `fillSlot(map, slotId, quote)`, `applyCorrection(map, text, t)`, `buildSlots`, `stepRefOf` (B's seed script and tests), `evalCond`, `describeCond`, `describeAct`, `actionMatchesRule`, `openSlots`, `understanding`, `isComplete`, `emptyMap`, `uid`, `saveVerdict(map, proposed, committing)`, `applicableRules`, `stopRules`, `checkSave`, `patchInvoice`, `resetErp`.

## 2. Where the baseline stands in this lane

**Works keyless (verified by the audit):** install, typecheck, 24/24 tests; step building from events (exact); the seeded script compiles to 10 steps / 3 rules / 5 slots; matcher, `saveVerdict`, the 409 guard, outcome card; debrief and confirm through typed answers.

**Has never run:** `refineWithLLM` (no key ever existed), any spoken debrief or teach-back, any Teach session with vision events, the knowledge-base sync.

| # | Defect (blunt) | Where |
|---|---|---|
| 1 | Rules exist only if the wording hits one of three regex archetypes. Probe: 7/13 capex, 4/6 intercompany, 3/6 hold paraphrases give no rule; one gives a wrong rule (invoice's own amount as threshold) | `lib/compile.ts:134-142, 160-162, 175-177`; `lib/curiosity.ts:230-243` |
| 2 | The LLM pass will almost certainly 400: recursive `CondSchema` + `z.record` in the output schema; deprecated `generateObject` has no `timeout`; failure is swallowed into a small note | `lib/compile.ts:272-288, 296, 349-351`; `lib/workmap.ts:47-64` |
| 3 | If it did run: rules replace the draft wholesale, values unchecked (`costCenter: "capex"`), agent lines pass the verbatim check, slots lose `ruleId`, nothing checks a rule against what she did | `lib/compile.ts:311-346` |
| 4 | `fillSlot` never creates a rule; any text (including "skip that") becomes a guardrail; `only (\w+)` regex rewrites the hold rule to `supplier matches /in/` | `lib/compile.ts:355-392` (368, 377-379) |
| 5 | `applyCorrection` knows two patterns, corrupts on others (`/when/`, `/equipment/`), "Becker" kills the rule, threshold branch rewrites every `set` rule; UI says "Understood." when nothing changed | `lib/compile.ts:400-429`; `components/MapClient.tsx:146-148` |
| 6 | A judgment step with a reason but no rule gets no slot: the bar reads "all gaps closed" with zero rules. `understanding()` counts `skipped` as filled | `lib/compile.ts:228-241`; `lib/workmap.ts:251` |
| 7 | Fabricated escalation target ("the AP lead" default, "petra"); narration filler accepted as "her reason" (cue words `so`, `over`, `only`; first hit, not closest) | `lib/compile.ts:156, 182, 382`; `:17, :99-104` |
| 8 | Teach-back reads operators and regex aloud, can cut mid-sentence | `lib/teachback.ts:16-22, 52-58`; `lib/workmap.ts:187-195` |
| 9 | `describeCond` crashes on `in` with a string; `evalCond` `matches` can throw; compile route saves the map before the call that crashes | `lib/workmap.ts:168, 187`; `app/api/compile/route.ts:13-14` |
| 10 | Confirm is ungated (open slots, no rules), unlocked (a correction and a yes can overlap and lose `confirmedAt`), not bound to a revision; "recompile" wipes debrief answers and confirmation | `app/api/sessions/[id]/confirm/route.ts:17-26`; `components/MapClient.tsx:66-73, 218` |
| 11 | Matcher is not field-aware: the first keystroke in asset number or note fires "would stop here" and spends the one intervention | `lib/matcher.ts:118-141` |
| 12 | Stop-and-ask explains with the wrong quote (`rule.quotes[0]`), never says what is missing, books a `missed` on the main rule | `lib/matcher.ts:76-80, 149, 251-254` |
| 13 | Novelty hardcoded to credit note / negative amount / no PO; computed `seenCategories` discarded | `lib/matcher.ts:45-51`; `lib/compile.ts:223-226` |
| 14 | Teach controller: matcher built and events consumed before Start; guard armed without disarm/reset; mic unmuted and never re-muted; replay depends on the LLM calling a tool; no `ruleId` in payloads, `title.includes("")` matches the first rule; log saved only on End; spoiler copy | `components/TeachClient.tsx:64, 115-134, 205, 90, 94, 89, 176, 211-221, 245-257, 353` |
| 15 | Guard is one global file, never expires, not cleared by reset | `lib/erp.ts:26-48, 102-112` |
| 16 | Debrief voice flow: first question on a fixed 2.5 s timer; mic opened before the teach-back is read; next tag sent before the tool result returns; LLM-reworded `reason` stored as a "verbatim" quote; debrief clock starts at page mount | `components/MapClient.tsx:174, 125, 160, 158, 44/89` |

## 3. Checkpoint bars for this lane

**M0 · kickoff + 30 min (5:30 PM)** — Done when:
- `npm run typecheck && npm test` green on a fresh clone; `.env.local` has `AI_GATEWAY_API_KEY` (presence checked, never printed).
- The compile split PR is merged (barrel `lib/compile.ts`, zero behavior change, 24/24, `npm run seed:session` prints the same counts as before).
- `docs/status/C.md` records the spike: what today's `refineWithLLM` returns with the real key (`used`, `note`, the provider's error text).
- The contract PR (all `lib/workmap.ts` additions of §4, optional with defaults) is open, and the `CONTRACT:` line is ready for chat.

**M1 · 7:30 PM** — Done when:
- `POST /api/compile` returns `llm: true` with `compile.accepted ≥ 1` on the seeded session **and** on one session a human captured tonight; every accepted rule has `replay.ok === true` and ≥ 1 verbatim expert quote; `compile.rejected[]` lists reasons.
- The human ran the corpus (appendix) through `scripts/compile-live.ts`: for every phrase the result is the right rule or an open slot; **zero wrong rules**; scoreboard in `docs/status/C.md`.
- ≥ 8 recorded fixtures + the hand-written bad-output fixtures pass in CI; the 24 baseline tests are green; `npm run seed:session` still produces the sample sessions with runnable rules and a confirmed twin (the juror's "try the tutor" door depends on it).
- WC-5 deletions (no default `who`, no "petra", total `evalCond`/`describeCond`) are merged.

**M2 · 10:30 PM** — Done when (a teammate who is not A or C plays the expert, no script):
- From a session with no live answers, the spoken debrief asks 3–5 questions that name the invoice and supplier, and at least one answer creates a rule that was not there before.
- "Not sure, skip that" leaves no guardrail; the bar does not rise for it.
- One spoken correction containing an STT-style supplier name changes exactly one rule; only the changed sentence is re-read; a vague correction yields "I did not catch what to change"; yes locks `confirmedAt` for the current revision; a later correction clears it.
- `POST …/confirm {confirmed:true}` returns 409 while a decision has no runnable rule and is not waived.
- The teach-back is ≤ 130 words, passes the speakability lints, and a human says it sounds like a person.
- The recompile control cannot destroy debrief state. The Map controller calls `voice.turn()` (or the compat shim if H3 slipped); the Teach controller follows in W3 with its rewrite.

**M3 · 1:30 AM** — Done when (D plays both judges on the deployed URL, real voice):
- On the unseen equipment invoice the tutor speaks before the commit; typing in asset number or note triggers nothing; no invalid row is written (guard 409 as backstop); the replay panel opens without a tool call.
- The December invoice from another supplier passes silently; the credit note is either answered with the debrief quote or flagged; independent cases run silent; the outcome card labels each rule honestly.
- The Teach controller speaks only through `voice.turn()`. `canonicalSteps` / `evidenceMatrix` are exposed on the map `vm`; `metrics` reports intervention latency from `spokeAt`.

**M4 · 3:30 AM** — Done when: every lane-C PR is merged or declared dead; fixtures re-recorded with the final prompt; the anti-hardcoding run (§7 HT-8) is recorded in `docs/status/C.md`; keyless seed + smoke pass; on the live link in a fresh Chrome profile the seeded sample map teaches end to end and a fresh capture compiles with `llm: true`.

## 4. Work packages

Execution order: WC-1 → WC-5 → WC-3 → WC-2 → WC-4 → WC-6 → WC-7 → WC-8 → WC-9 → WC-10 → WC-11 → WC-12.

### WC-1 · LLM "understand" pass as the primary path   `[P0 · by M1 · Req M3 N1 N4]`

**Why** — Spec §8.2 finding 1 and the baseline audit of the Map module (defect 1): with a judge improvising, the regex compiler yields 0–1 rules, the map still looks complete, and Module 3 cannot catch anything. Finding 16 and `docs/02-PLATFORM-FACTS.md` §1 fact 9: the existing LLM call sends a recursive schema that Anthropic's native structured output rejects with HTTP 400, and the failure is swallowed.

**Today** — `refineWithLLM` (`lib/compile.ts:290-352`): `generateObject` (deprecated, no `timeout`) with `RefinementSchema` embedding `CondSchema` (`z.lazy`) and `ActSchema` (`z.record`); corpus for the verbatim check includes agent lines and unanswered windows (`:311`); rules replace the draft (`:320, 343`); only check is `evalCond(when, {})` not throwing (`:336-340`). Platform facts used below are from spec §9.2 and `docs/02-PLATFORM-FACTS.md` (§1 fact 9, §4.3, snippet "Flat compile wire schema + converters"); none of it was executed against a live account, so re-check in `node_modules/ai/dist/index.d.ts` and treat the spike as the proof.

**Build**

1. **Split `lib/compile.ts` first, alone, zero behavior change** (W0). Move: `steps.ts` (`:20-104` `stepRefOf`, step building, window quotes, narration) · `rules-regex.ts` (`:121-214`) · `slots.ts` (`:216-268`) · `rules-llm.ts` (`:272-352`) · `fill.ts` (`:355-398`) · `correct.ts` (`:400-429`). `lib/compile.ts` becomes a barrel re-exporting every current export. Do not create `lib/compile/index.ts`.
2. **Spike with the real key** (W0): `npx tsx scripts/compile-live.ts --session demo_sabine --legacy` calls today's `refineWithLLM` and prints `used` and `note`. Write the result into `docs/status/C.md`. Also print `z.toJSONSchema(schema)` of the new wire schema and assert it contains no `$ref`, `oneOf`, `minimum`, `maximum`, and no `additionalProperties` other than `false`.
3. **Deterministic pass changes needed by everything else** (`steps.ts`): (a) stable ids `step_<ref>`, `rule_<ref>`, `slot_<ref>_<kind>` (`<ref>` = the step's `stepRef` with `:` replaced by `_`) instead of `uid()` so a recompile is idempotent; (b) judgment only for `costCenter`, `route`, `status` actions (today `:61` makes asset-number edits judgment steps); (c) accept a window with non-empty `answerText` and `outcome ∈ {answered, timeout}` (today `:80-82` drops timed-out answers); (d) alias candidate refs `<inv>:invoice_opened → <inv>:open`, `<inv>:save_clicked → <inv>:save` (today `:84-87` drops those answers); (e) set `map.seen` (P-17).
4. **Wire schema** — what the model returns. Rules for every LLM-facing schema in this lane: no `z.lazy`, no `z.record`, no `.min/.max/.int/.regex`, `.nullable()` instead of `.optional()`, enums for closed sets, at most 16 union/nullable parameters per request (Anthropic limit). Values are strings and are typed in code; this deliberately drops the `string|number|boolean` union (one fewer union per condition list, and coercion is needed anyway for "5.000"). It is the `docs/02` snippet with three changes: `then` literals come from this session, the model writes no `slots` and no `confidence`, and `matches`/`exists` are not offered to the model.

```ts
// lib/compile/schema.ts
export const FIELDS = ["amount","category","supplier","entity","invoiceMonth","costCenter","hasAssetNumber","knownSupplier","hasPO","route","status"] as const;
export const FIELD_TYPE = { amount:"number", invoiceMonth:"number", hasAssetNumber:"boolean", knownSupplier:"boolean", hasPO:"boolean",
  category:"string", supplier:"string", entity:"string", costCenter:"string", route:"string", status:"string" } as const;
const FlatCondition = z.object({ field: z.enum(FIELDS), op: z.enum([">", ">=", "<", "<=", "==", "!=", "in"]), value: z.string() }); // "in": comma-separated
const FlatStop = z.object({ join: z.enum(["all","any"]), conditions: z.array(FlatCondition), who: z.string() /* "" = nobody named */, quoteText: z.string() });
export function flatSchemaFor(lit: Literals) {            // `then` literals are drawn from THIS session's observed values
  const FlatThen = z.discriminatedUnion("type", [
    z.object({ type: z.literal("set"),    field: z.literal("costCenter"), value: enumOrString(lit.costCenterTo) }),
    z.object({ type: z.literal("route"),  value: enumOrString(lit.routeTo) }),
    z.object({ type: z.literal("status"), value: enumOrString(lit.statusTo) }),
  ]);
  const FlatRule = z.object({
    stepId: z.string(), title: z.string(),
    join: z.enum(["all","any"]), conditions: z.array(FlatCondition),
    then: FlatThen,
    unless: z.array(FlatCondition),           // [] = none; exceptions are OR-ed
    stop: FlatStop.nullable(),                // null = she stated no condition under which she would not post
    quoteTexts: z.array(z.string()),          // verbatim EXPERT fragments that state the trigger
  });
  return z.object({
    rules: z.array(FlatRule),
    stepReasons: z.array(z.object({ stepId: z.string(), quoteText: z.string() })),
    guardrails: z.array(z.object({ stepId: z.string(), kind: z.enum(["limit","exception","escalation"]), text: z.string(), quoteText: z.string() })),
    unclear: z.array(z.object({ stepId: z.string(), what: z.enum(["trigger","limit","who","reason"]), note: z.string() })),
  });
}
```

   Fallback ladder if the spike shows the gateway rejects it: (L2) replace the discriminated union with `{ kind: z.enum(["set","route","status"]), value: z.string() }`; (L3) plain `generateText`, "return only JSON", `JSON.parse` + the same Zod `safeParse` in code. All three feed the same validator.
5. **Call shape** (in `rules-llm.ts`, injected so tests never hit the network):

```ts
export type ModelCall = (req: { instructions: string; prompt: string; schema: z.ZodType; totalMs: number; maxRetries: number; maxOutputTokens: number }) => Promise<unknown>;
export const gatewayCall: ModelCall = async ({ instructions, prompt, schema, totalMs, maxRetries, maxOutputTokens }) => {
  const { output } = await generateText({ model: process.env.COMPILE_MODEL ?? "anthropic/claude-sonnet-5.5",
    instructions, prompt, output: Output.object({ schema }), maxRetries, maxOutputTokens, timeout: { totalMs },
    ...(process.env.COMPILE_MODEL_FALLBACK ? { providerOptions: { gateway: { models: [process.env.COMPILE_MODEL_FALLBACK] } } } : {}) });
  return output;
};
export async function understandWithLLM(log: SessionLog, draft: WorkMap, call: ModelCall = gatewayCall): Promise<UnderstandResult>
```

   Budgets: compile `totalMs 45 000`, `maxRetries 1`, `maxOutputTokens 4 000`; revise (WC-2/4) and teach-back (WC-6) `12 000`, `0`, `1 500`. These are starting points: nobody has measured latency, so log `ms` in the spike and adjust (the `docs/02` snippet uses 90 s; shortened here because a person is waiting on the Map page). Never pass `temperature`. Model per spec §9.2: `anthropic/claude-sonnet-5.5` once the flat schema lands (it only does native structured output, so the old recursive schema can never work with it), fallback `openai/gpt-6.1-sol`; both stay env-configurable. Add `export const maxDuration = 60` to `app/api/compile/route.ts` (check `node_modules/next/dist/docs` for the route segment config first).
6. **Prompt input** — built by `buildUnderstandInput(log, draft): { instructions, prompt, ctx }`, everything from this session:

| Section | Content | Source |
|---|---|---|
| FIELDS | each allowed field, its type, and the literal values seen in this session; for `costCenter` the dropdown options `code · label` | `literalsOf(log)` over non-redacted `event.state/from/to`; labels from `COST_CENTERS` (what the screen shows) |
| CASES | one per invoice she worked: state as it arrived, state as she left it, completed or not | `expertCases(log, steps)` |
| JUDGMENT STEPS | `stepId · invoice · did: <exact then to copy> · state at that moment` | draft steps with `judgment` |
| ANSWERS | answered windows: `[t] Q(kind → stepId): question` / `EXPERT: answer` | `log.windows` (incl. `kind:"debrief"`) |
| TRANSCRIPT | `[t EXPERT] text`; agent lines prefixed `AGENT (context only, never quotable)`; struck ranges and redacted segments omitted | `log.transcript`, `log.offRecord` |

7. **Instructions** (generic; no business rule, supplier, threshold or month may appear in this text): (1) emit a rule only if the expert stated, in her own words, the condition that makes this decision apply; a reason without a distinguishing condition is not a trigger: put it in `stepReasons` and add `unclear`; (2) every `quoteText` is copied character for character from an EXPERT line; (3) use only the listed fields and literals; write numbers as plain digits; (4) a threshold is a number she states as a limit, never the invoice's own amount; "over / above / more than" is `>`, "from / at least / or more / starting at" is `>=`; (5) scope exactly as she scoped it: "they", "them", "this supplier" bind to the supplier of the case on screen; a bare "these" or "this one" names no attribute and is not a trigger; "every / all" removes the condition; never add the converse; (6) `stop` only when she said when she would not post or approve; `who` is the exact words she used for the person or role, else `""`; who releases or signs afterwards is a `guardrail` of kind `escalation`, not a stop; (7) copy `then` from the step's `did`; (8) later statements override earlier ones.
8. **Conversion** — `toCond(join, conditions, ctx)`: one leaf → the leaf, else `{ [join]: leaves }`. Leaf coercion by `FIELD_TYPE`: numbers through `numbersIn()` (handles `5,000`, `5.000`, `5 000`, `5k`, "five thousand", "7.850"); month names → 1..12; booleans from `true/false/yes/no`; `in` → `string[]`. Ops allowed: number fields all seven; boolean `==` (`!=` flipped); string `==`, `!=`, `in`. `supplier` values go through `resolveSupplier()` (WC-4) and become `{ field:"supplier", op:"matches", value: supplierKey }` where `supplierKey` is the first distinctive token of the real supplier name (same convention as `rules-regex.ts`); `!=` becomes `{ not: … }`. `toAct`: `set → { set: { costCenter } }`, `route → { route }`, `status → { status }`.
9. **Validation**, in this order; the first failure rejects the rule with a `Rejection { stepId, title, reason, detail }`:

| # | Check | Reason code |
|---|---|---|
| V1 | Zod parse of the model output | `schema` |
| V2 | `stepId` is a judgment step of the draft | `unknown_step` |
| V3 | 1–4 conditions; op valid for the field type; string literals ∈ this session's literals (folded compare); supplier resolves; a month literal was seen in the session or is named in her words | `field` / `literal` / `supplier_unresolved` |
| V4 | every `quoteText` is located in the expert corpus; ≥ 1 survives; every `amount` literal appears in the surviving quotes (`numbersIn`) and is not the case's own amount | `quote_not_verbatim` / `quote_not_expert` / `no_quote` / `number_not_stated` / `threshold_is_own_amount` |
| V5 | replay R1–R4 (below) | `then_mismatch` / `when_false_on_own_case` / `unless_true_on_own_case` / `fires_on_other_case` |
| V6 | stop: conditions pass V3, stop quote passes V4, `who` is a folded substring of her words (else `who` dropped, stop kept), R5 | stop dropped, rule kept |
| V7 | `evalCond`, `describeCond`, `describeCondSpoken` run on every case state without throwing | `not_total` |

   Verbatim check: `expertCorpus(log): ExpertUtterance[]` = answered windows' `answerText` + transcript segments with `speaker === "expert" && final && !redacted`, minus anything inside `log.offRecord`, minus an utterance whose tokens are ≥ 80 % contained in its own window's `question` (echo defence). `locateQuote(fragment, corpus): Quote | undefined` matches case-insensitively with whitespace collapsed, requires ≥ 3 words, and returns `Quote.text` **sliced from her utterance**, never the model's string; `source` and `audioId` come from the utterance.
10. **Replay validation** (pure, `lib/compile/replay.ts`):

```ts
export interface ExpertCase { invoice: string; initial: InvoiceState; final: InvoiceState; completed: boolean;   // completed = saved, or status left ≠ "open"
  decisions: { stepId: string; act: Act; before: InvoiceState; t: number }[] }                               // judgment steps; `before` = state just before her action
export function expertCases(log: SessionLog, steps: Step[]): ExpertCase[]
export type ReplayReason = "ok"|"no_cases"|"unknown_step"|"then_mismatch"|"when_false_on_own_case"|"unless_true_on_own_case"|"fires_on_other_case";
export interface ReplayResult { ok: boolean; reason: ReplayReason; contradictedBy?: string; stopDropped?: boolean }
export function replayValidate(rule: Pick<Rule,"stepId"|"when"|"then"|"unless"|"stopAndAsk">, cases: ExpertCase[]): ReplayResult
```

   - **R1** `evalCond(rule.when, D.before)` is true for the decision `D` with `D.stepId === rule.stepId`.
   - **R2** `rule.unless` (if present) is false on `D.before`.
   - **R3** `rule.then` equals `D.act` after normalisation (trim, lowercase). A different literal is a rejection, not an auto-correction: it means the rule was attached to the wrong step.
   - **R4** for every other **completed** case `C′`: if `when` holds on `C′.initial` and `unless` does not, then `actionMatchesRule(rule, C′.final)` must be `true`; otherwise she did otherwise on her own invoice → `fires_on_other_case` with `contradictedBy = C′.invoice`.
   - **R5** if `stopAndAsk.when` holds on her own `C.final` and she still approved/posted it, the stop contradicts her behavior: drop the stop, keep the rule, an escalation slot opens.
11. **Merge policy** (`mergeUnderstanding(draft, accepted)`): steps, screen moments and window-attached quotes always come from the deterministic pass. One rule per judgment step, keyed by `stepId`, id preserved. LLM-accepted rule wins; it gets `origin: "llm"`, `replay: { ok: true, checkedAt }`, quotes = union with the draft rule's quotes (dedupe by text). A regex rule survives only where no LLM rule was accepted for that step **and** it passes `replayValidate` and V3's number checks; it gets `origin: "regex"`, `confidence: "low"`. Two accepted rules with the same `then` that evaluate identically on all cases collapse into the first. `stepReasons` fill only steps without a reason. LLM guardrails are kept only with a located quote: `Guardrail.text` = the model's paraphrase, `Guardrail.quote` = her words. **Slots are never taken from the model**: `buildSlots(merged)` rebuilds them; `unclear[]` only boosts ranking (WC-3). Confidence: `high` if a counterfactual or limit quote confirms the boundary, `medium` with an answered-window quote, `low` if narration only or `origin: "regex"`.
12. **Route** `app/api/compile/route.ts`: `compileDeterministic` → `understandWithLLM` (unless `llm:false` or no key) → `mergeUnderstanding` → build teach-back → `saveMap` (today it saves before `generateTeachback` can throw, `:13-14`). Response adds `compile: { via: "llm"|"regex"|"mixed", model?, ms, accepted: number, rejected: Rejection[] }`. `refineWithLLM(log, draft)` stays exported with its `{ map, used, note }` shape and delegates to `understandWithLLM` + `mergeUnderstanding`.
13. **Failure modes and what the expert sees** (all through `vm.compile`, rendered by D):

| Failure | Result | Shown as |
|---|---|---|
| No key | deterministic draft, regex rules that pass replay | "keyless compile (pattern rules only)" |
| HTTP 400 / timeout / unparseable output | same, `note` carries the error class | "LLM compile failed — pattern rules only · Retry" (retry allowed only while no debrief state exists) |
| Some rules rejected | accepted rules kept; each rejected step gets a slot | per step: "no rule yet — the debrief will ask" + reason code in the mechanism drawer |
| All rules rejected / none proposed | zero rules, one slot per decision | "0 of N decisions have a rule yet" (never a green bar) |

14. **Testing without a live model.** Fixtures in `lib/compile/__fixtures__/understand/<name>.json`: `{ meta: { model, recordedAt, promptHash, corpusId }, session, raw }` where `raw` is the real model output, recorded by `npx tsx scripts/record-fixture.ts --corpus <id>` (the script owns the `fs` write; `lib/` stays pure). Hand-written `bad-*.json` fixtures (labeled synthetic) cover: paraphrased quote, agent-line quote, `costCenter: "capex"`, threshold equal to the invoice's own amount, a number she never said, a rule that fires on another of her invoices, unknown `stepId`, invented `who`. Local live runner: `npx tsx scripts/compile-live.ts --say-capex "…" --say-route "…" --say-hold "…"` builds a session from the seeded events with the human's sentences as answers and prints, per decision, the rule in plain words, the replay result, the quote, or the slot question.

**Files** — edit: `lib/compile.ts`, `app/api/compile/route.ts`, `lib/workmap.ts` (additive fields). Create: `lib/compile/{steps,rules-regex,rules-llm,schema,numbers,quotes,replay}.ts`, fixtures, the two scripts. Request to B (H10): `.env.example` gets `COMPILE_MODEL=anthropic/claude-sonnet-5.5` and an optional `COMPILE_MODEL_FALLBACK`.

**Contracts** — P-17 `WorkMap.seen?: { categories; entities; suppliers; flags?: string[] }` (`flags` is an additive extension). New additive, announce `CONTRACT:` — `Rule.origin?: "llm"|"regex"|"debrief"|"correction"`, `Rule.replay?: { ok: boolean; checkedAt: number; contradictedBy?: string }`, `POST /api/compile` response gains `compile`. P-27: the response always carries `llm: boolean` and `note?`, and `vm.compile` exposes them.

**Acceptance — automated** — `lib/compile.numbers.test.ts` (every number form in the appendix parses; "7.850 … above 5.000" yields both numbers) · `lib/compile.schema.test.ts` (JSON schema has none of the forbidden keywords; `toCond`/`toAct` round-trip; bad literal rejected) · `lib/compile.quotes.test.ts` (agent line, struck range, paraphrase, echo rejected; returned text is a substring of the utterance) · `lib/compile.replay.test.ts` (R1–R5, one case each, plus an over-general rule rejected when another completed case contradicts it) · `lib/compile.understand.fixtures.test.ts` (every recorded and bad fixture through the validator against the appendix oracle) · `lib/compile.nohardcode.test.ts` (reads lane-C source files excluding tests and fixtures and fails on any corpus phrase, threshold, supplier name, person or role from the role card).

**Acceptance — human** — §7 HT-1, HT-2, HT-3.

**Sub-agents** — S0 split [AUTO, must merge alone first] · S1 `schema.ts` + `numbers.ts` + `quotes.ts` + their tests [AUTO] · S2 `replay.ts` + test [AUTO] · S3 `rules-llm.ts` + compile route, integrates S1/S2 against the signatures above [AUTO, then HUMAN with the key] · S4 fixtures, harness, scripts [AUTO to build, HUMAN to record and judge] · step 3 lives in `steps.ts` and is done by the same agent as WC-5 step 2 (T2) [AUTO] · contract PR on `lib/workmap.ts` + `docs/03` [ASK FIRST].

**Pitfalls** — Engineering the prompt toward the demo's three rules is hardcoding: the instructions must read the same for any desk task. Do not auto-correct a wrong `then`. Do not let the model write slots or confirm anything. A session with one invoice per decision cannot refute an over-general rule by replay; that is what the limit slot and the teach-back are for. The role card must not leak into fixtures' `session` beyond what a human typed as their own phrasing.

### WC-5 · Truthfulness sweep   `[P0 · by M2 · Req M3 N4]`

**Why** — Spec §8.2 findings 11 and 14, the baseline audit (Map module, defects at `compile.ts:156` and `:99`): the teach-back names "the AP lead" nobody said; filler becomes "her reason"; a sceptical judge reading the repo finds persona vocabulary in the engine.

**Today** — default `who` (`compile.ts:156, 382`), "petra" (`:182`), persona keywords `spindle|press|tool` (`:141`), month-end probe (`:218`), brief's sample question hardcoded (`:265`), category list and unseen cases in the LLM prompt (`:303, 306`), narration cues (`:17, :99-104`), `evalCond`/`describeCond` partial (`workmap.ts:166-168, 187-189`), `saveVerdict` quotes `rule.quotes[0]` for a stop (`matcher.ts:254`).

**Build**
1. `who` only when named: `namedWho(text): string | undefined` returns the verbatim noun phrase (≤ 4 words) after `ask|check with|call|goes (back) to|signs|releases|approves`, cut at punctuation or `and|when|if|before`; no match → `undefined` and an escalation slot stays open. Delete every default and the "petra" mapping.
2. Narration attach (`steps.ts`): a segment qualifies only with a causal cue (`because|since|so that|always|never|unless|must|has to|have to|needs? to|whenever|every time|otherwise|that's why`) **and** a reference to the step (invoice id, the step's from/to value, its field label, or a literal of that case's state: supplier key, category, entity, month name, the amount as digits or words). Pick the closest by `|segment.t − screenMoment.t|` within −20/+25 s. Result: `source: "narration"`, `step.confidence = "low"`.
3. Quotes come only from `expertCorpus` (WC-1 step 9). Guardrails keep paraphrase (`text`) and quote separate; when there is no paraphrase, `text = quote.text`.
4. Totality in `lib/workmap.ts`: `in` coerces a string to `[value]`; `matches` = folded substring test first (diacritics stripped, `ß→ss`, lowercase), regex only inside `try/catch` when the pattern has metacharacters; unknown op → `false`; `normalize()` folds diacritics so a vision-read "Backer" equals "Bäcker"; `describeCond` renders `matches` as `contains "x"` and never throws.
5. Regex fallback de-personalised (`rules-regex.ts`): thresholds from `numbersIn()` preferring a number that follows a comparator and excluding the case's own amount; the category/entity condition is added only when her words contain that case's own `category`/`entity` literal; cost-center labels derived from `COST_CENTERS`, not a local table (`:16`).
6. P-16: `Rule.stopAndAsk` gains `quote?: Quote`, `who` becomes optional; `SaveVerdict` gains `missing?: string` (the true leaves of the stop condition rendered by `describeCondSpoken`, e.g. the absent field). For a stop, `quote = stopAndAsk.quote?.text ?? escalation-guardrail quote ?? primaryQuote(rule)`. For a contradiction, `missing` stays undefined (the tutor asks, it does not reveal).
7. `PUT /api/sessions/:id/map` runs `purgeOrphanQuotes(map)`: a rule quote whose text no longer exists on any step reason, guardrail, filled slot or note is removed; a rule left with no quote is removed and its step gets a `trigger` slot. An edit to steps or rules of a confirmed map clears `confirmedAt`.
8. Neutral copy in logic this lane owns: no "her/she/Lena" in `lib/matcher.ts:103, 138` or in the flagged-slot question at `components/TeachClient.tsx:106`; use `map.expert.name`, the new hire's name from the session, and "their". `app/map/[sessionId]/page.tsx` returns `notFound()` for an unknown session (check `node_modules/next/dist/docs` for the current API).

**Files** — edit `lib/workmap.ts`, `lib/compile/{steps,rules-regex}.ts`, `lib/matcher.ts`, `app/api/sessions/[id]/map/route.ts`, `app/map/[sessionId]/page.tsx`. Requests: B makes the seed honest (no hand-injected stop at `scripts/seed-session.ts:104`; H7 / WB-9) and has `lib/export.ts` skip superseded quotes and include notes (plain issue, WB-10); D renders `guardrail.text` without quotation marks and `guardrail.quote.text` with them (`components/WorkMapView.tsx`), and owns the spoiler and persona copy that moves into `TeachView` with the seam split (`TeachClient.tsx:240-257, 353` today; H8 / WD-2).

**Contracts** — P-16 as above; P-6 `Quote.evidence?: "demonstrated"|"described"` (set `described` for debrief/correction quotes about a case she did not work).

**Acceptance — automated** — `lib/workmap.total.test.ts` (fuzz `evalCond`/`describeCond` with malformed conditions: never throws; folded `matches`) · `lib/compile.narration.test.ts` (the audit's two filler sentences attach nothing; a causal sentence naming the case's value attaches with `low`) · `lib/compile.who.test.ts` (no name → `who` undefined + open escalation slot) · `lib/matcher.verdict.test.ts` (stop verdict carries the stop quote and `missing`).

**Acceptance — human** — on `/map/<id>` after a capture in which you never named a person: no person or role appears anywhere in the map or teach-back.

**Sub-agents** — T1 `lib/workmap.ts` totality (the P-6/P-16 fields already landed in the W0 contract PR) [AUTO] · T2 `steps.ts` (narration + WC-1 step 3) + `rules-regex.ts` [AUTO] · T3 map route + page [AUTO]. `lib/workmap.ts` has exactly one writer per wave.

**Pitfalls** — Changing `matches` semantics silently breaks stored maps if you drop the regex path; keep both. Do not "fix" the seed script yourself.

### WC-3 · Honest slots   `[P0 · by M2 · Req M1 A3]`

**Why** — Spec §8.2 finding 2: a decision with a reason but no rule gets no slot, so the gap is invisible and the bar lies. Audit: "Hmm, I am not sure, skip that one." is stored as an escalation guardrail (`compile.ts:368`); a three-invoice session produces nine questions.

**Today** — `buildSlots` (`compile.ts:228-252`): reason slot only if no reason; limit/escalation per rule; two hardcoded novel questions; month-end generic probes; `Slot.status "skipped"` is never set; `understanding()` counts non-open as done.

**Build**
1. **Slot model.** `Slot.kind` gains `"trigger"`; `Slot.attempts?: number`. Builders, each question built from the step's own invoice, supplier, amount and from→to values:

| Kind | Opens when | Question shape |
|---|---|---|
| `reason` | judgment step with no reason and no rule | "On invoice ‹id› from ‹supplier›, you ‹decision›. What made you do that?" |
| `trigger` | judgment step with a reason but no runnable rule | "On invoice ‹id› you ‹decision›. What is it about an invoice that tells you to do that — the amount, the kind of item, who it is from, the date?" |
| `limit` | rule with no limit/counterfactual/exception quote | numeric condition: "You said "‹fragment›". Is exactly ‹number› already in, or only above it?" · no supplier condition: "Would you do that for every supplier, or only ‹supplier on that invoice›?" · else: "Is there a case where that does not apply?" |
| `escalation` | rule with no stop and no escalation guardrail; or a stop without `who` | "When would you not ‹act› an invoice like ‹id›, and who would you check with?" / "You said "‹stop fragment›". Who do you check with then?" |
| deferred | `SessionLog.deferred[]` (P-15) entries not already answered | the live question as it was phrased; kind mapped `why→reason`, `counterfactual→counterfactual`, `limit→limit`, `stop/who→escalation` |
| `novel` | a case shape the sandbox can present that she did not see (`noveltyOf`, WC-7 step 3, over `seedInvoices()`), max 2 | "I did not see ‹an invoice without a purchase order› today. What do you do when one comes in?" (phrase table keyed by dimension, not by scenario) |
| probe | only to reach three | task-neutral: "What is the most common mistake a new person makes on this task?" etc. |

2. **Ranking and cap.** Score: `reason`(no rule) 100 · `trigger` 95 · deferred guardrail 80 · `limit` 70 · `escalation` without who 60 · `escalation` 50 · `novel` 40 · probe 10; +5 when the model listed the step in `unclear`. Keep every `reason`/`trigger` slot plus the best others up to 5 total; never fewer than 3. Array order is ask order.
3. **Answer classification** (`lib/debrief.ts`, pure): `classifyAnswer(text, ctx): "answer" | "thin" | "skip"`. `skip` when the folded text is ≤ 12 tokens, has no digit, no seen literal, and matches `don't know | not sure | no idea | skip | pass | next | move on | later | have to check | nothing comes to mind`. `thin` (filler such as "That is all.") when it has ≤ 5 words or carries no content signal: no number, no seen literal (supplier, category, entity, month), no named person or role, no condition cue (`because|if|when|unless|only|never|always|every|except|until`). A skip sets `status: "skipped"`, stores no quote, no guardrail; it is logged as a debrief window with `outcome: "aborted"`, `logged: { kind, reason: "skipped" }` so a recompile remembers it. A thin answer is never threaded into the map either (spec §8.2 finding 17: typed filler became policy the tutor quoted).
4. **One adequacy follow-up.** After an answer, re-derive (WC-2). Adequate = `reason`/`trigger`: the step now has a runnable rule · `limit`: the rule changed or a guardrail with her words was added · `escalation`: a stop or a named `who` exists. Not adequate (or `thin`) and `attempts < 1` → slot stays open, `attempts = 1`, question becomes the follow-up ("You said "‹≤ 8-word fragment›". What would have to be different about an invoice for you not to do that?" / "And who would that be?" / "So where exactly is the line?"). After the second answer: adequate → `filled`; a real answer that still yields no rule → `filled`, her words kept as a guardrail with `evidence: "described"` and the step stays unrunnable (readiness shows it); thin again → `skipped` with `logged.reason: "inadequate"`, nothing stored in the map.
5. **Readiness** (`lib/compile/slots.ts`): `readiness(map): { ready, runnable: string[], unrunnable: string[], waived: string[], open: number }`. A step is runnable when it has a rule with `replay?.ok !== false` and ≥ 1 non-superseded quote; waived when its `trigger` slot is `skipped`. `ready = unrunnable.length === 0 && open === 0`.
6. `understanding()` counts only `filled` slots in the numerator; the vm exposes `{ filled, skipped, total }` and `readiness` so D shows "2 decisions explained · 1 skipped · 0 open".
7. Step-less answers (probes, novel) go to `map.notes` with `topic` = `probe:<n>` or the novelty topic.

**Files** — edit `lib/compile/slots.ts`, `lib/workmap.ts` (`understanding` only; the enum value and `attempts` are in the W0 contract PR), `app/api/sessions/[id]/slot/route.ts`; create `lib/debrief.ts`.

**Contracts** — additive: `Slot.kind` value `"trigger"`, `Slot.attempts?`; consumes P-15. `POST …/slot` response gains `{ adequate: boolean, skipped: boolean, patch? }` (P-5).

**Acceptance — automated** — `lib/compile.slots.test.ts` (reason-but-no-rule → `trigger` slot; cap 5, min 3; questions contain the invoice id and supplier; deferred entries first; nothing already answered live is asked) · `lib/debrief.answers.test.ts` (appendix D-rows: non-answers → `skipped`; filler → `thin`, never a guardrail; answers with a digit are never skips) · `lib/compile.readiness.test.ts`.

**Acceptance — human** — §7 HT-4.

**Sub-agents** — one agent for `slots.ts` + tests, one for `lib/debrief.ts` + tests [both AUTO]; the wording of the question shapes needs your ear [HUMAN].

**Pitfalls** — A question that lists the answer is a leak ("…over five thousand?"). The trigger question may list field families only. Do not auto-skip on a mic timeout (that is not the expert declining).

### WC-2 · The debrief can create and change rules   `[P0 · by M2 · Req M1 M2 A3]`

**Why** — Spec §8.2 finding 2 and the baseline audit (Map module, defect at `compile.ts:355`): with no live answers, debrief answers stating all three rules leave `rules = []` with zero open slots. If the governor never found a pause, the debrief cannot rescue Module 3.

**Today** — `fillSlot` threads a quote and applies two regex patches (`compile.ts:355-392`); the slot route is a thin wrapper (`slot/route.ts:15`); debrief answers live only in the map on a different clock (`MapClient.tsx:44, 89`); `/api/compile` overwrites the stored map (`compile/route.ts:11-13`); the recompile button is always live (`MapClient.tsx:218`).

**Build**
1. Slot route, under `withMapLock(sessionId)` (`lib/compile/lock.ts`, an in-process promise chain per map id): load map + session → `classifyAnswer` → append a `QuestionWindow { id, candidateId: slot.id, kind: "debrief", question, stepRef: <step ref | topic>, openedAt, answeredAt, closedAt, outcome, answerText, answerAudioId, logged: { kind: slot.kind } }` to the session (the body may carry `spokeAt`, `askedAt`, `answeredAt`, `closedBy` from the turn result; otherwise `t = (Date.now() − session.startedAt) / 1000`, one clock) → `saveSession` → for an answer: `fillSlot` → `reviseRules`; for a skip: mark the slot `skipped`, no fill, no revise → `saveMap`.
2. `fillSlot(map, slotId, quote)` keeps its signature: marks the slot, threads the quote (reason / guardrail / note), then calls the pure keyless `rederiveRegex(map, stepId)` (regex derivation over all quotes of the step, supplier words resolved against `map.seen.suppliers`). No more `only (\w+)`.
3. `reviseRules` (`lib/compile/patch.ts`) — the one LLM entry point for both debrief answers and corrections:

```ts
export interface ReviseInput { utterance: { text: string; t: number; audioId?: string }; context: "debrief" | "teachback";
  focusStepId?: string; question?: string; map: WorkMap; log: SessionLog }
export interface PatchEntry { ruleId: string; before: RuleView | null; after: RuleView | null }   // RuleView = { title; text /* plain sentence */; when; unless?; stop? }
export async function reviseRules(input: ReviseInput, call?: ModelCall): Promise<{ map: WorkMap; patch: PatchEntry[]; changed: boolean; understood: boolean; via: "llm" | "regex" | "none"; unresolved?: string[] }>
```

   Model output: `{ understood: boolean, rules: (FlatRule & { supersededQuoteTexts: string[] })[], guardrails: […], note: string }` — a full replacement (or creation) per `stepId`, only for steps that change. Validation = WC-1 V1–V7 plus **`not_from_this_answer`**: at least one `quoteText` of a changed rule must be located inside the new utterance. Debrief context restricts changes to `focusStepId`. Rule id is preserved; `origin` becomes `"debrief"`; `confirmedBy` gains `"debrief"` once.
4. Recompile never loses state: because every debrief answer, skip and correction (WC-4 step 2) is a window in the session log, `POST /api/compile` replays the same pipeline over the log. Deterministic pass: after building steps and slots it re-applies debrief windows through `fillSlot` (slot ids are stable, `candidateId` = slot id), skips through `status: "skipped"`, and corrections through `applyCorrectionDeterministic`, in time order. LLM pass: debrief answers and corrections appear in ANSWERS (`Q(debrief → stepId)`, `Q(correction → teachback)`) and instruction 8 makes the latest statement win. Carried from the prior map: `revision` (continues), `superseded` flags by quote text. Deliberately not carried: `confirmedAt`.
5. Guard: `POST /api/compile` returns 409 `{ error: "map_has_debrief_state" }` when the stored map has a filled/skipped slot, a correction or `confirmedAt`, unless `force: true`. `vm.canRecompile` is false once the debrief started; `vm.recompile(llm, { force })` exists for the presenter.
6. `/api/teachback` runs one catch-up `reviseRules` for any judgment step whose newest quote is newer than its rule (covers a revise that timed out during the debrief).
7. **Debrief controller** (`MapClient`, decisions in pure `lib/debrief.ts`): `await voice.connect({ firstMessage, dynamicVariables, sessionStartMs: session.startedAt, context: buildCaptureSummary(session) })` (A's helper), no timer (`MapClient.tsx:174`). Loop: `r = await voice.turn({ tag: "DEBRIEF", text: "slot=<id> <question>", spoken: question, listen: true, timeoutSecs: 20, recordClip: { sessionId } })` → off-record abort (`r.via === "aborted"` with `command: "off_record"`): discard, log nothing, re-ask → `r.heard === ""`: re-ask once, then leave the slot open and move on (Skip / typed controls stay visible) → else `POST …/slot` with `r.heard` and `r.audioId`, awaited before the next turn. Tool handlers on the Map page only return a result (`log_answer` → "logged"; `mark_off_record` → clears the pending text, "struck"; `end_task` → go to the teach-back); they never send the next tag. Typed answers go through `voice.submitTyped(text)` once A ships it.

**Files** — edit `lib/compile/fill.ts`, `app/api/sessions/[id]/slot/route.ts`, `app/api/compile/route.ts`, `components/MapClient.tsx` + `components/views/map.vm.ts` (after the split); create `lib/compile/{patch,lock}.ts`.

**Contracts** — P-5 (`patch` in slot/confirm responses, longer latency); P-27 (`llm`, `note` on the slot response: `llm:false` means the regex path answered); `POST /api/compile` body gains `force?: boolean`.

**Acceptance — automated** — `lib/compile.rederive.test.ts` (session with zero live answers + three debrief answers through recorded revise fixtures → three replay-verified rules; a bad-fixture change citing no words of the answer is rejected) · `lib/compile.recompile.test.ts` (compile → fill two slots → skip one → compile again: same rule ids, same filled/skipped slots, `confirmedAt` cleared, `revision` not reset) · existing `engines.test.ts` debrief test still green through `rederiveRegex`.

**Acceptance — human** — §7 HT-4.

**Sub-agents** — U1 `patch.ts` + `lock.ts` + fixtures [AUTO, HUMAN records] · U2 `fill.ts` + slot route + compile route guard [AUTO] · U3 controller wiring in `MapClient.tsx` [AUTO after the split; HUMAN with voice].

**Pitfalls** — The slot route now takes seconds: the controller must not send the next `[DEBRIEF]` before it resolves (A paces with the agent's "Got it."). `saveSession` from the route races the capture page's sync only if capture is still open; the Map page starts after capture ended.

### WC-4 · Corrections that work by voice   `[P0 · by M2 · Req M2]`

**Why** — The brief's good story has the judge correct one detail. Audit: "No, only when it's Bäcker" → `supplier matches /when/`; "No, only Becker" silently kills the rule; unparsed corrections change nothing while the page says "Understood." (`compile.ts:400-429`, `MapClient.tsx:146-148`); a correction followed quickly by yes lost `confirmedAt` (spec §8.2 finding 17).

**Today** — `applyCorrection` regexes; confirm route sets `confirmedAt` with no checks and no lock (`confirm/route.ts:17-26`); `log_answer`'s LLM-reworded `reason` can become the stored "quote" (`MapClient.tsx:158`).

**Build**
1. **Fuzzy supplier resolution** (`lib/compile/suppliers.ts`): `fold(s)` = NFKD, strip marks, `ß→ss`, lowercase, then `ae/oe/ue → a/o/u`, `ck → k`, non-alphanumerics removed. `resolveSupplier(spoken, seen): { supplier, key, score } | undefined` scores each spoken token against each distinctive token of each seen supplier (legal-form tokens dropped): exact 1.0 · prefix ≥ 4 chars 0.9 · else `1 − DamerauLevenshtein / maxLen`. Accept when best ≥ 0.75 **and** best − second ≥ 0.15. Unresolved → the change is rejected with `supplier_unresolved`, `unresolved` lists the seen supplier short names, and the page asks "Which supplier do you mean — ‹A›, ‹B› or ‹C›?".
2. **Correction flow** in `app/api/sessions/[id]/confirm/route.ts`, under `withMapLock`: `confirmed:false` + `correction` → store the correction as a debrief window (`stepRef: "teachback"`, `logged.kind: "correction"`) → `reviseRules({ context: "teachback" })` with all rules in scope. Keyless or on failure: `applyCorrectionDeterministic(map, text, t): { map, patch }` (seen-supplier mention with `only|just|except|not` narrows or excludes; `every|all|any supplier` widens; a stated number changes the threshold only when exactly one rule has an amount condition and replay still passes). `applyCorrection` stays exported as `(…) => applyCorrectionDeterministic(…).map`. A changed rule gets `origin: "correction"`, `confirmedBy += "teachback"` (deduped), and the correction (her full utterance) as a quote.
3. **Nothing changed** — `understood:false`, zero valid changes, or every change is a structural no-op (`sameCond`): response `{ changed: false, say: "I did not catch what to change. Which part is wrong?" }`; the controller speaks it as `[TEACHBACK]` and stays in the teach-back phase. A change rejected by replay answers specifically: "On invoice ‹id› you did ‹what she did›, so that would not fit. Did I mishear?"
4. **Superseded quotes**: `Quote.superseded?: boolean`. `supersededQuoteTexts` must each equal an existing quote on that rule; they are flagged, not deleted. `primaryQuote(rule)` (exported from `lib/workmap.ts`, added by T1 in W1) = first non-superseded quote from a live/narration/counterfactual source, else first non-superseded. Tutor, teach-back and save verdicts use `primaryQuote`.
5. **Three rounds max** (spec §6.6): after the third unresolved correction, add an open slot `{ kind: "exception", question: "We did not settle this in the teach-back: "‹her words›". What should I change?" }`; confirm stays blocked until it is filled or skipped.
6. **Confirm gate** (`lib/compile/confirm.ts`, pure): `confirmGate(map, body): { ok: true } | { ok: false; status; error; readiness }`.
   - Body: `{ confirmed, correction?, t?, revision?, waive?: string[] }`. `revision` present and ≠ `map.revision` → 409 `stale_revision` (the yes was for an older teach-back). Absent → accepted for scripts, logged.
   - `waive` step ids set (or create) that step's `trigger` slot to `skipped`.
   - `!readiness(map).ready` → 409 `not_ready` with `readiness`; `confirmedAt` untouched. The controller then goes back to the first open slot, or, when only unrunnable decisions remain, says `[TEACHBACK] One decision I still cannot teach: ‹decision›. I will flag it for the new hire instead of guessing. Is that OK?`; a yes re-sends confirm with `waive`.
   - Pass → `confirmedAt = now`, `confirmedBy += "teachback"` (deduped), `medium → high`; knowledge sync raced against 4 s so the response is not held (`knowledge: { synced, note }` goes to the vm).
7. **A yes is her words, not the model's.** The controller locks only when her own words are a yes — A's `classifyConfirmation(turn.heard) === "yes"` from `lib/voice-protocol.ts` once it is on main; until then the equivalent `isYes` in `lib/debrief.ts` (an affirmation as whole words, none of `but|except|only|not|no|actually|instead|wrong`; a bare "mhm" or "ok" is not a yes) — or on the on-screen button. A `confirm_teachback(true)` tool call with no such Scribe evidence triggers one re-ask ("Just to be sure — is that a yes?"). The correction text is `turn.heard`; the tool's `corrections` param and `log_answer`'s `reason` are never stored as a `Quote` (non-negotiable 2); with nothing heard, re-ask or use the typed box.
8. A correction on a confirmed map that changes anything clears `confirmedAt`.

**Files** — edit `lib/compile/correct.ts`, `app/api/sessions/[id]/confirm/route.ts`, `components/MapClient.tsx`, `map.vm.ts`; create `lib/compile/{suppliers,confirm}.ts`. (`Quote.superseded` is part of the W0 contract PR.)

**Contracts** — P-5; P-27 (`llm`, `note` on the confirm response); additive: `Quote.superseded?`, confirm body `revision?`, `waive?`, confirm response `changed`, `say?`, `readiness`, `unresolved?`.

**Acceptance — automated** — `lib/compile.suppliers.test.ts` (appendix STT variants resolve to the on-screen supplier; a name not seen in the session resolves to nothing; near-tie → unresolved) · `lib/compile.correct.test.ts` (appendix K-rows through recorded revise fixtures and through the deterministic fallback: right rule changed, others untouched, replay-violating change rejected with the specific message, no-op → `changed:false`) · `lib/confirm.gate.test.ts` (not ready → 409; stale revision → 409; waive → ready; correction after confirm clears `confirmedAt`; two overlapping calls serialize).

**Acceptance — human** — §7 HT-5.

**Sub-agents** — V1 `suppliers.ts` + test (can start in W1) [AUTO] · V2 `correct.ts` + `confirm.ts` + confirm route + tests [AUTO] · V3 controller: teach-back turn, yes/correction split, rounds [AUTO after split; HUMAN with voice].

**Pitfalls** — Never let a correction change `then` (replay R3 forbids it by construction). Do not match suppliers the expert never saw. Buttons must be disabled while a confirm is pending (`vm.pending`).

### WC-6 · A teach-back that sounds like a person   `[P0 · by M2 · Req M2 A3]`

**Why** — Spec §8.2 finding 11: the teach-back reads `amount > €5,000`, `supplier matches /…/`, `asset number is false` aloud and can end mid-sentence. It is the proof step of Module 2 and it is spoken.

**Today** — template over `describeCond` (`teachback.ts:16-22`), `capWords` cuts mid-sentence (`:52-58`), every call regenerates, nothing is stored, so "re-read only the changed sentence" is a string diff (`MapClient.tsx:385-389`).

**Build**
1. `lib/speech.ts` (pure): `spokenNumber(n)` (5000 → "five thousand"; non-integers → digits) · `spokenCode(code)` (digits spaced so TTS reads them one by one, plus the first word of the sandbox label when one exists) · `describeCondSpoken(cond)` from a per-field phrase table (amount `>` "the amount is over ‹n› euros", `>=` "‹n› euros or more"; `invoiceMonth` "the invoice is dated in ‹month›"; `supplier` "the supplier is ‹name›"; booleans "there is no ‹label›" / "there is a ‹label›"; `all` joined with "and", `any` with "or"); never an operator, slash, underscore or the word "matches" · `spokenAct(act)` · `fragmentOf(quote, maxWords = 10)` = the clause of her quote containing the rule's literal, cut on clause boundaries, always a substring · `spokenRule(rule, step)` = "When ‹cond›‹, unless …›, you ‹act› — you said, "‹fragment›"."
2. **Deterministic spoken teach-back** `spokenTeachback(map): { sentences: { key: string /* "intro" | ruleId | "stop:"+ruleId | "unsure" | "closing" */; text: string }[] }`. Order: intro (counts of routine steps and decisions), rules by confidence then step order, stops ("You hold back and check ‹with who, if named› when ‹stop cond›."), unsure items introduced by "I'm less sure about this one:", closing question. **Budget on sentence boundaries**: add whole sentences until 130 words minus the closing; if over, shorten fragments to ≤ 6 words, then drop fragments after the first rule, then drop the intro detail; with more than five rules speak five and end "There are ‹n› more on screen I would like you to check." Never cut inside a sentence.
3. **LLM spoken version** `teachbackWithLLM(map, call)`. Input facts: expert name, counts, per rule `{ id, spoken: spokenRule(...), confidence, quoteFragments[] }`, stops, unsure ids, open-question count. Instructions: you are the apprentice explaining back what you learned; one sentence per rule in the given order; keep every number and name exactly as given; at most one fragment per rule inside double quotes, unchanged, only from `quoteFragments`; say what you are unsure of; no symbols or field names; add nothing that is not in the facts; end with exactly one question asking whether that is right; at most 120 words. Output: `{ sentences: { key: string; text: string }[] }`.
4. **Lints** (`lintTeachback(sentences, facts)`, any failure → deterministic version, `via: "template"`): ≤ 130 words · every rule id and every stop has a sentence · every number in the text (digits or words) is in the facts, and each rule's numbers appear in its sentence · every quoted span is one of `quoteFragments` verbatim · none of `< > = / _ { } [ ] |`, no `second_approval`-style tokens · no capitalised name (sentence-initial words ignored) that is not the expert, a seen supplier, a month or a named `who` · last sentence ends with `?`.
5. Persist `WorkMap.teachback?: { via, sentences }` when generated. `/api/teachback` saves, then returns `{ text, sure, unsure, sentences, via, revision }` where `revision` is `map.revision` after that save: this is the number the confirm gate compares (WC-4 step 6). After a correction the confirm response carries the new map and its revision; the controller always sends the latest.
6. **Changed-sentence re-read**: after a patch, replace the sentences whose key is a changed rule id with `spokenRule` (deterministic, no second model call) and return `reread = "Understood. " + changed.join(" ") + " Is that right now?"`.

**Example of acceptable output style** (placeholders only; no real rule content belongs in this doc or in any prompt):

> "Here is what I took from watching you. Most of it is routine: you open the invoice, check it, and post it. Three moments were judgment calls. When ‹condition in plain words›, you ‹action›; you said, "‹six to ten of her own words›". When ‹condition›, you ‹action›, because "‹her words›". You hold back and check with ‹the person she named› when ‹stop condition›. One thing I am less sure about: ‹a low-confidence rule, stated as a guess›. Did I get that right?"

**Files** — edit `lib/teachback.ts`, `app/api/teachback/route.ts`; create `lib/speech.ts`. (`WorkMap.teachback` is part of the W0 contract PR.)

**Contracts** — additive: `WorkMap.teachback?: { via: "llm"|"template"; sentences: { key: string; text: string }[] }`; `/api/teachback` response gains `sentences`, `revision`, `via`. Keep `generateTeachback(map): { text, sure, unsure }` (B's exports and the smoke script may call it).

**Acceptance — automated** — `lib/speech.test.ts` (no forbidden character for any condition shape; numbers spoken; fragments are substrings) · `lib/teachback.spoken.test.ts` (≤ 130 words, ends with a question, never ends mid-sentence, covers every rule and stop for 1–6 rules) · `lib/teachback.lint.test.ts` (recorded good output passes; outputs with an invented number, a paraphrased "quote", a slash, a missing rule each fail and fall back).

**Acceptance — human** — §7 HT-6.

**Sub-agents** — Y1 `lib/speech.ts` + test, pulled forward into wave W1 because WC-1 V7 and WC-5 step 6 call `describeCondSpoken` [AUTO] · Y2 `lib/teachback.ts` + route + lints + fixtures [AUTO; HUMAN listens].

**Pitfalls** — The LLM must not see the transcript (it would summarise instead of explaining the map). A fragment cut that changes meaning ("not over five thousand" → "over five thousand") is worse than no fragment: cut only on clause boundaries and keep negations.

### WC-7 · Judge-proof matcher and Teach controller   `[P0 · by M3 · Req T1 T2 T3 A4]`

**Why** — Spec §8.2 findings 4, 7, 8 and the baseline audit of the Teach module: the first character typed in the asset number fires "would stop here"; a judge who just clicks Save is caught only after the commit is rejected; a correct fix is blocked with the wrong quote; a second rehearsal opens an already-fixed queue; the replay depends on the LLM calling a tool.

**Today** — see §2 defects 11–15.

**Build**
1. **Field-aware rule** (`lib/matcher.ts`). `targetFields(rule)` = keys of `then.set` | `{"route"}` | `{"status"}`. `eventField(e)` = `e.field` for `field_changed`, `"route"` for `route_changed`, `"status"` for `status_changed`. Decision table, first match wins:

| Event | Phase | Condition | Decision |
|---|---|---|---|
| `save_blocked` | any | — | contradiction → `intervene`; stop → `stop` with `missing` and the stop quote; ledger `missed` or `stop_hit` |
| any other | independent | — | `none` (ledger only on `save_clicked`) |
| `typing`; field ∈ `{assetNumber, notes}`; `e.invoice ≠ state.invoice` | coached | — | `none` |
| `invoice_opened` | coached | no applicable rule and `noveltyOf(state, map.seen)` | `novel`, once per invoice: a note with that topic → covered (her debrief words, tag `NOVEL_COVERED`); else flag for the expert (tag `NOVEL_FLAG`) |
| `invoice_opened` | coached | an applicable rule whose target field the new hire has not touched on this invoice, predictions on | `predict`, once per invoice |
| field/route/status change | coached | applicable rule `r` with `eventField ∈ targetFields(r)` and `actionMatchesRule === false` | `intervene`, once per (invoice, rule) |
| same | coached | same, `=== true` | `praise`, once; ledger `applied_*` |
| same | coached | `eventField` is no applicable rule's target | `none` (evaluated at save intent) |
| `save_intent` | coached | `saveVerdict(map, e.state, committing)` blocked by contradiction | `intervene` (first time) or a shorter second line if already hinted |
| `save_intent` | coached | blocked by stop | `stop`: "‹expert› would not post this yet: ‹missing›." + stop quote; "Who would you ask?" only when `who` was named |
| `save_clicked` | coached | — | ledger bookkeeping only |

   `committing` = proposed status ∈ `{approved, posted}`. At save intent an empty or untouched target field that does not equal the rule's value is a contradiction (this covers both a prefilled wrong code and D's empty cost center). The matcher tracks touched fields per invoice. `Matcher` constructor gains `opts?: { predict?: boolean; modeOf?: (invoice?) => "coached"|"independent"|undefined }`; phase = `e.mode ?? modeOf(inv) ?? "coached"` (the controller fills `modeOf` from `GET /api/erp/invoices?queue=newhire`, so a vision event that lost `mode` cannot turn an independent case into coaching). `TutorDecision` gains `ruleId`, `missing`, `who`, `topic`. `MasteryOutcome` gains `stop_hit`, so a correct fix blocked for a missing prerequisite is not booked as `missed` on the main rule.
2. **Client-side `saveVerdict` on save intent** is the pre-save catch for "leaves the wrong value and reaches for Save"; the server 409 stays the backstop. Until H1 lands end to end, target-field interventions plus `save_blocked` keep working.
3. **Novelty from the map**: `noveltyOf(state, seen): string | undefined` returns the first topic of `flag:negative_amount` (amount < 0), `flag:no_po`, `flag:unknown_supplier`, `entity:<value>` whose value/flag is not in `map.seen`. `category` is recorded in `seen` but is deliberately not a novelty dimension: an unseen category with nothing unusual is routine work, and making it novel would have the tutor speak on every ordinary invoice of a kind the expert happened not to open. Notes are looked up by topic (legacy topics `credit_note`, `no_po` aliased).
4. **Teach start sequence** (`TeachClient.start`, steps as data in `lib/teach-flow.ts`): (a) refuse when `!map.confirmedAt` (`vm.blocked = "unconfirmed"`; `app/teach/page.tsx` lists only confirmed maps, newest first) → (b) `POST /api/teach/guard { action: "disarm" }` → (c) `POST /api/erp/reset?queue=newhire` → (d) `POST /api/teach/guard { action: "arm", mapSessionId, teachSessionId }` → (e) `startedAt = now`, `sourceMapRevision`, **build the `Matcher` here**, `startedRef = true` (events before this are ignored) → (f) share screen: `pipeline.start({ mode, cropTo })` (P-23) where D hands the ERP frame element to the controller through the callback `vm.registerErpFrame(el)` (a callback, not a ref on the vm) → (g) `await voice.connect({ firstMessage, dynamicVariables: { expert_name, newhire_name, task }, context })` where `context` = `tutorBrief(map)` (rules in plain words via `spokenRule`, primary quotes, notes; no superseded quotes) cut with A's `chunk(…, 1500)` and prefixed `[WORK MAP i/n]`; the mic stays closed (A's gate) → (h) fallback until `connect` accepts `context`: one `voice.sendContext` per chunk → (i) 5 s session sync on a ref-stable interval; `sendBeacon` disarm on unload. The vm exposes `guard: { armed, teachSessionId }` from the guard route's actual response (never an assumed "guard armed" label) and `erpEpoch`, bumped after the queue reset so D reloads the ERP frame in workspace mode.
5. **Speaking**: every tutor line goes through `voice.turn()` (P-12): `turn({ tag, text: payload, spoken, listen: kind ∈ {predict, intervene, stop}, timeoutSecs: 12 })`; the mic closes when the turn resolves. Until A ships it, `components/turnCompat.ts` (lane C, new) gives the same promise shape over today's `say`/`setMicMuted`; adoption is then a one-line swap. Payloads are built with A's `buildTutorPayload({ message, quote, stepId, ruleId, ruleTitle, who, clip })` (`lib/voice-protocol.ts`), never hand-formatted; tags `INTERVENE`, `STOP`, `PREDICT`, `PRAISE`, `NOVEL_COVERED`, `NOVEL_FLAG`. Until A's module and prompts v2 are on main (H11), send today's shapes (`[NOVEL]`, no `ruleId=`/`clip=`). If A's measured latency misses the target, pass `watchdogSecs: 2.5` on `INTERVENE`/`STOP`.
6. **Replay shown deterministically**: on `intervene`/`stop`, open the replay when the turn resolves or 4 s after the tutor stops speaking, whichever is first; `show_replay` stays as an idempotent accelerator. `vm.replay = { frameUrl: frame.url ?? frame.dataUrl, stepTitle, decision, field, quote, audioUrl }`. Her clip is played with `await voice.playClip(url)` (A) and the payload says `clip=yes`, so the tutor does not read the quote over her voice; before `playClip` exists, no autoplay: the tutor reads the quote (`clip=no`).
7. **Handlers resolve rule ids themselves**: `record_prediction`, `record_mastery`, `show_replay` use `pending.decision.ruleId`; an LLM-supplied id is used only if it equals an existing rule id; never fall back to the first rule (`TeachClient.tsx:176`). `flag_for_expert` dedupes by invoice; the client already flags, so the tool is a no-op when a flag exists.
8. **Guard** (`lib/erp.ts`). Interim, today: a guard older than 30 minutes is treated as disarmed; `resetErp()` for the new-hire queue or all queues clears it; `disarm` with a `teachSessionId` only clears a matching guard. **H9, by M2** (B files an issue with the diff; B's persistence check at M2 needs this PR): replace `load`/`persist` with `getErpState()`/`saveErpState()` (reseed only when the store returns `undefined`), `armTeachGuard`/`getTeachGuard`/`disarmTeachGuard` with `saveGuard`/`getGuard`/`clearGuard`, call `clearGuard()` from `resetErp()`, and remove `node:fs` from the file; TTL then lives in the store. Call the store **without** a workspace argument: B's `currentWorkspace()` default makes P-25 (H14) work with no second change here.
9. **Metrics** (`lib/metrics.ts`): window `openedAt` = the triggering event's `t`; latency = `(spokeAt ?? askedAt) − openedAt` (P-22); add `preSaveCatches` (interventions whose `openedAt` precedes the first `save_clicked`/`save_blocked` of that invoice) and count slots by `filledBy.source` instead of step quotes (`metrics.ts:36-40`).
10. Neutral copy and no spoilers from the controller: the vm carries `rulesInPlay` but D shows it only with `?presenter=1` (WD-2).

**Files** — edit `lib/matcher.ts`, `lib/erp.ts`, `lib/metrics.ts`, `app/api/teach/guard/route.ts`, `app/teach/page.tsx`, `components/TeachClient.tsx`, `components/views/teach.vm.ts`; create `lib/teach-flow.ts`, `components/turnCompat.ts`. Requests: H1 (B type, D posts `save_intent` with the proposed state), H2 (D: one `field_changed` on blur), H3/H4 (A), H5 (B `Frame.url`), H9 (B store), H13 (B/D workspace capture), H14 (B workspace id), H11 (A: `ruleId`/`clip` segments, covered-novel wording, no agent-side `flag_for_expert`).

**Contracts** — consumes P-1, P-11, P-12, P-13, P-14, P-21, P-22, P-23, P-25 and A's additive `playClip`, `connect({ context })`, `[NOVEL_COVERED]`/`[NOVEL_FLAG]`, `ruleId=`/`clip=`/`who=` segments; produces P-16, P-17.

**Acceptance — automated** — `lib/matcher.fieldaware.test.ts` (asset-number and note events → `none`; a route change while a cost-center rule applies → `none`; cost-center change to a wrong value → one `intervene`) · `lib/matcher.saveintent.test.ts` (empty or wrong target at `save_intent` → `intervene` before any `save_clicked`; correct target with a true stop → `stop` with `missing` and the stop quote, ledger `stop_hit`; independent phase → `none`) · `lib/matcher.novelty.test.ts` (driven only by `map.seen`; a map whose expert handled a no-PO invoice does not flag one) · `lib/teach-flow.test.ts` (start sequence order; payload builder; events before start ignored) · `lib/erp.guard.test.ts` (TTL, reset clears, mismatched disarm ignored; valid saves pass, invalid 409).

**Acceptance — human** — §7 HT-7, HT-9.

**Sub-agents** — X1 `lib/matcher.ts` pure logic + tests (can start in W1) [AUTO] · X2 `lib/erp.ts` + guard route + tests, in W2 because of H9 [AUTO] · X3 `lib/teach-flow.ts` + `TeachClient.tsx` + `teach.vm.ts` + `app/teach/**` [AUTO after split; HUMAN with voice] · X4 `lib/metrics.ts` [AUTO].

**Pitfalls** — Do not add a case-id or supplier branch to make a beat pass. Resetting the queue at start is correct; calling a reset that reseeds sample sessions from Teach start is not (it would overwrite maps mid-demo). A praise must not unmute the mic. Test both valid and invalid saves: a guard that blocks everything is a defect.

### WC-8 · Process view data   `[P1 · by M3 · Req M3 A3]`

**Why** — The brief's story is "seven steps, three judgment calls, four guardrails"; the baseline shows 10 per-invoice event rows and a bar nobody can interpret.

**Today** — `WorkMapView` renders instance steps; `understanding()` is computed and voided (`MapClient.tsx:207`).

**Build**
1. `canonicalSteps(map): CanonicalStep[]` in `lib/workmap.ts` (pure): group instance steps by action signature (`open`, `field:<field>`, `route`, `hold`, `approve`, `save`), ordered by first occurrence. `CanonicalStep { id, index, title, judgment, instances: { stepId, invoice, t, frameId, decision }[], ruleIds: string[], guardrails: GuardrailCard[] }`; `GuardrailCard { id, kind, statement, quote?, stepId, ruleId?, frameId?, evidence: "demonstrated"|"described" }`. Titles are generic verbs over the field label.
2. `evidenceMatrix(map): EvidenceRow[]`, one row per judgment step: `{ stepId, ruleId?, invoice, decision, reason, trigger, replay, limit, who, confirmed }`, each cell `{ state: "yes"|"no"|"open"|"skipped"|"n/a", quote? }`, derived from the step, its rule (`origin`, `replay`), its slots and `confirmedAt`.
3. Expose on `map.vm.ts`: `canonical`, `evidence`, `counts { steps, judgmentCalls, guardrails }`, `understanding { filled, skipped, total }`, `readiness`, `compile`, `knowledge`.

**Files** — edit `lib/workmap.ts`, `components/views/map.vm.ts`, `components/MapClient.tsx`.

**Contracts** — P-20. Note: "replay-verified" cannot be derived from the map alone, hence `Rule.replay` (WC-1).

**Acceptance — automated** — `lib/workmap.process.test.ts`: a three-invoice session yields ≤ 7 canonical steps with every instance step in exactly one group; matrix row count equals judgment steps; a rule-less step shows `trigger: "open"`.

**Acceptance — human** — on `/map/<id>`: the headline counts match what you did; every matrix cell that says "yes" opens a quote you said.

**Sub-agents** — one agent, `lib/workmap.ts` + test [AUTO]; vm wiring by the Map controller agent.

**Pitfalls** — Derived only: no new stored fields here. Keep both functions cheap (they run on every render).

### WC-9 · Outcome card with evidence + "Practice this"   `[P1 · by M3 · Req T3]`

**Why** — Apprentice Test 4 is answered by the card; today "Practice next" is a text list and `practiceCaseFor` is dead code (`matcher.ts:217-233`, `TeachClient.tsx:333-341`).

**Today** — `masteryCard()` returns label and a one-line detail; no evidence, no case to open.

**Build**
1. `masteryCard()` rows gain `evidence: { invoice, t, what, helpBefore, phase }[]` built from the ledger (what = the action in plain words), and `practice: boolean` for `needs_practice`/`untested`.
2. `POST /api/erp/invoices` (P-19) body `{ mapSessionId, ruleId }`: loads the confirmed map, builds `practiceCaseFor(rule, base)` from the rule's own condition literals over a neutral base invoice (target field empty, `mode: "coached"`, numeric-string id), appends it via `addInvoice()` in `lib/erp.ts`, returns `{ invoice }`. `resetErp(queue)` drops invoices that are not in the seed. Remove the hardcoded default supplier at `matcher.ts:231` (use the base invoice's).
3. `teach.vm.ts`: `card[]` with evidence, `practice(ruleId): Promise<{ invoiceId }>`, `flagged[]`.

**Files** — edit `lib/matcher.ts`, `lib/erp.ts`, `app/api/erp/invoices/route.ts`, `components/TeachClient.tsx`, `teach.vm.ts`.

**Contracts** — P-19.

**Acceptance — automated** — `lib/matcher.card.test.ts` (labels unchanged from baseline tests; evidence rows present; a rescued case is never "correct without help") · `lib/erp.practice.test.ts` (practice invoice satisfies the rule's `when`, lands in the new-hire queue, disappears on reset).

**Acceptance — human** — end a teach session with one missed rule, click "Practice this", a new invoice opens in the ERP and the tutor treats it like any coached case.

**Sub-agents** — server (`erp.ts`, route) and card (`matcher.ts`) are file-disjoint [AUTO].

**Pitfalls** — A practice case is generated from the rule, never from a canned list. Cut-list item 8 applies: if behind, keep the plain per-rule list.

### WC-10 · Soft matcher for rule-less cases (LLM, quote-locked)   `[P1 · by — · Req T2 N1]`

**Why** — Only if rehearsals show judgment steps that still have no rule after WC-1/2 (so the tutor is silent where the expert clearly had a reason).
**Today** — no rule → silence.
**Build** — At `save_intent` in the coached phase, when no rule applies but the map has a rule-less judgment step with quotes: one model call returns `{ relevant: boolean, stepId, quoteText }`; `quoteText` must pass `locateQuote`; the tutor may only say "On a similar invoice ‹expert› did ‹decision› and said "‹quote›". Does that apply here?" Never blocks a save, never writes the ledger as a rule outcome, labeled "hint, not a rule" in the vm.
**Files** — `lib/matcher-soft.ts` (new), `components/TeachClient.tsx`. **Contracts** — none.
**Acceptance — automated** — `lib/matcher.soft.test.ts`: unverifiable quote → no hint. **Acceptance — human** — the hint is heard as a question, not a correction.
**Sub-agents** — one [ASK FIRST: only after M3 is green]. **Pitfalls** — this is the place a guess could sneak in; quote-lock or do not ship.

### WC-11 · Step explanations gated on pauses   `[P1 · by — · Req T1]`

**Why** — The brief: the tutor "explains each step the way the expert did".
**Today** — the tutor speaks only on predict/intervene/stop/praise/novel.
**Build** — In the coached phase, after a routine event whose canonical step has an expert reason, and after ≥ 3 s with no event and no typing (`pipeline.signals`), send one `[PRAISE]`-shaped line "That is the step where ‹expert› said "‹fragment›"." At most one per invoice, never in the independent phase, never while a turn is open.
**Files** — `lib/teach-flow.ts`, `components/TeachClient.tsx`. **Contracts** — none (reuses `[PRAISE]`).
**Acceptance — automated** — `lib/teach-flow.explain.test.ts` (rate limit, phase gate). **Acceptance — human** — it never lands while you type.
**Sub-agents** — one [ASK FIRST]. **Pitfalls** — chatter. If it annoys a human once, turn it off.

### WC-12 · Two-experts diff   `[X4 · by — · Req X4]`

**Why** — Official stretch. **Today** — nothing.
**Build** — `diffMaps(a, b)`: align rules by `then` and target field; report differing literals, extra conditions, differing stops; one `counterfactual` slot per difference in each map ("‹other expert› does this from ‹n›; you said ‹m›. Why?"). Data through `map.vm.ts`; D renders.
**Files** — `lib/workmap-diff.ts` (new), `app/map/page.tsx`. **Contracts** — none.
**Acceptance — automated** — `lib/workmap.diff.test.ts`. **Acceptance — human** — two captures by two teammates show ≥ 1 difference.
**Sub-agents** — one [ASK FIRST: only after M3 and X1–X3]. **Pitfalls** — first item on the cut list.

## 5. Wave plan

| Wave | Clock (ET) | WPs in parallel | Sub-agent scopes (file-disjoint) | The human meanwhile |
|---|---|---|---|---|
| W0 | 5:00–5:30 PM | WC-1 steps 1–2 | (a) split: `lib/compile.ts` + `lib/compile/*` — merges alone first · (b) `scripts/compile-live.ts` · (c) `lib/compile/__fixtures__/corpus.ts` · (d) contract PR: `lib/workmap.ts` + `docs/03` | preflight; run the spike with the key; post `CONTRACT:`; ask D whether the seam split merged |
| W1 | 5:30–7:30 PM | WC-1, WC-5, WC-7 (pure), WC-4 step 1 | S1 `schema/numbers/quotes.ts` · S2 `replay.ts` · S3 `rules-llm.ts` + compile route · S4 fixtures + harness + `record-fixture.ts` · T1 `lib/workmap.ts` (totality; sole writer) · T2 `steps.ts` + `rules-regex.ts` · T3 map route + map page · X1 `lib/matcher.ts` · V1 `suppliers.ts` · Y1 `lib/speech.ts` | type the corpus and your own paraphrases into the runner; judge every rule; record fixtures; M1 checkpoint |
| W2 | 7:45–10:30 PM | WC-3, WC-2, WC-4, WC-6 | `slots.ts` + `lib/workmap.ts` (`understanding`; sole writer) · `lib/debrief.ts` · `patch.ts` + `lock.ts` · `fill.ts` + slot route + compile route · `correct.ts` + `confirm.ts` + confirm route · `lib/teachback.ts` + teachback route · `lib/erp.ts` + guard route (H9 migration) · one controller agent: `MapClient.tsx` + `map.vm.ts` + `components/turnCompat.ts` (starts once the seam split is on main; integrates the others last) | run the debrief and teach-back by voice with A; phrase corrections badly on purpose; M2 checkpoint |
| W3 | 10:45 PM–1:30 AM | WC-7 controller, WC-8, WC-9 | `TeachClient.tsx` + `teach.vm.ts` + `lib/teach-flow.ts` + `app/teach/**` · `lib/erp.ts` (`addInvoice`, reset drops practice cases) + `app/api/erp/invoices/route.ts` · `lib/workmap.ts` (`canonicalSteps`, `evidenceMatrix`; sole writer) + `map.vm.ts` fields · `lib/matcher.ts` card + `lib/metrics.ts` | play the new hire with real voice; try to save wrong things fast; M3 checkpoint |
| W4 | 1:45–3:30 AM | P0 issues from M3; fixture re-record; HT-8 | one agent per issue, by file | anti-hardcoding run; decide cuts; freeze at 3:30 |

Orchestrator rules: one sub-agent = one worktree = one branch `c/<task>` = one PR ≤ ~400 lines; merge sequentially; run `docs/prompts/pre-merge-review.md` as a fresh reviewer for anything touching validation, slots, confirm, matcher or guard.

## 6. Handshakes

**Owed to this lane**

| H | From | What | Needed by | If late |
|---|---|---|---|---|
| H1 | B (type, pipeline), D (`InvoiceForm`) | `save_intent` with the proposed `state`, delivered in every source mode | type M0+1h; end to end M2 | target-field interventions + 409 still work; pre-save catch for "just clicks Save" is weaker |
| H2 | D | text inputs post one `field_changed` on blur | M1 | matcher and compile already ignore `assetNumber`/`notes` |
| H3 | A | `voice.turn()` (P-12) | ships M1; Map adopts by M2, Teach by M3 with WC-7 | `components/turnCompat.ts` |
| H4 | A | `connect({ dynamicVariables })`, resolves when connected (P-13) | M1 | tutor says placeholder names |
| H5 | B | `Frame.url` + frames endpoint (P-1) | M2 | vm falls back to `dataUrl` |
| H6 | B (type), A (writes) | `SessionLog.deferred` (P-15) | M2 | structural slots only |
| H7 | D | scenario changes announced as `CONTRACT:` (five expert invoices, empty new-hire cost center, dates) | M1 | lane-C tests derive from `seedInvoices()`, never from literals |
| H9 | B | store functions for ERP state and guard (P-21); B sends the `lib/erp.ts` diff as an issue | types ~6:30 PM; this lane's `lib/erp.ts` PR by M2 | `lib/erp.ts` keeps its own files with the interim TTL fix |
| H12 | B | `/api/demo/reset` | M3 | Teach start uses its own disarm → reset → arm (and keeps doing so) |
| H13 | B (pipeline), D (layout) | workspace capture: `pipeline.start({ mode, cropTo })` (P-23) | M2 | Teach shares a tab in two-window mode |
| H14 | B | per-visitor workspace: cookie `tacit_ws`, resolved inside the store (P-25) | M3 | nothing to do here as long as `lib/erp.ts` calls the store without a workspace argument; until then one shared ERP and guard |

**This lane owes**

| H | To | What | By |
|---|---|---|---|
| contract | all | `lib/workmap.ts` additions + `docs/03` in one PR | 5:45 PM |
| H8 | D | vm fields — map: `compile { llm, note, via, accepted, rejected }`, `readiness`, `understanding`, `pending`, `patch`, `canRecompile`, `skip()`, `confirm(yes, { correction, waive })`, `canonical`, `evidence`, `knowledge`; teach: `blocked`, `guard`, `erpEpoch`, `registerErpFrame(el)`, `replay`, `card[].evidence`, `practice()`, `rulesInPlay` (presenter only) | as each lands; list in `docs/status/C.md` |
| H11 | A | wording and payload proposals for `agents/*.md` (issue or courtesy PR) | M2 (debrief), M3 (tutor) |
| — | B | signatures of `compileDeterministic`, `fillSlot`, `applyCorrection` unchanged for the seed script; issue: remove injected stop, export skips superseded quotes and includes notes | M1 |

**Chat messages (copy, fill, send)**

- `CONTRACT: lib/workmap.ts additive — Rule.origin?, Rule.replay?, Rule.stopAndAsk.{quote?, who optional} (P-16), Quote.evidence? (P-6), Quote.superseded?, Slot.kind += "trigger", Slot.attempts?, WorkMap.seen? (P-17, + flags), WorkMap.teachback?; SaveVerdict.missing? (P-16). Old maps still parse. PR #__.`
- `CONTRACT: POST /api/compile response gains compile{via,model,ms,accepted,rejected[]}; body gains force? (409 map_has_debrief_state without it). POST …/slot returns {adequate,skipped,patch?}. POST …/confirm body gains revision?, waive?; returns changed, say?, readiness, patch?; 409 not_ready / stale_revision. All three always return llm and note (P-27). POST /api/teachback returns sentences, via, revision. PR #__.`
- `@A H3/H4: Map and Teach controllers are written against VoiceApi.turn(opts) exactly as P-12. Until it is on main we run components/turnCompat.ts. Tell me when turn() and connect({dynamicVariables}) merge.`
- `@A H11 (debrief): three things for interviewer.md: (1) no agent-side follow-up in [DEBRIEF] — the page owns the single follow-up; (2) these lines must be read as written: "[TEACHBACK] I did not catch what to change. Which part is wrong?", "[TEACHBACK] Which supplier do you mean — A, B or C?", "[TEACHBACK] One decision I still cannot teach: … Is that OK?"; (3) /slot and /confirm can take up to 12 s, I await them between turns. Issue #__.`
- `@A H11 (tutor): I send payloads only through buildTutorPayload with your §10 tags (INTERVENE, STOP, PREDICT, PRAISE, NOVEL_COVERED, NOVEL_FLAG; ruleId=, who=, clip=) and play her clip with voice.playClip. Until lib/voice-protocol.ts and prompts v2 are on main I keep today's shapes. One request: a [STOP] with empty who= must ask what is missing, not who. Tell me when prompts v2 are deployed.`
- `@D H7: novelty is derived from what the expert saw (negative amount, no PO, unknown supplier, unseen entity), not from category. If one of the two routine expert invoices is dated December from another supplier, replay will reject "every December" rules by itself and beat 5 needs a different correction (for example over vs from). Your call; tell me which.`
- `@B H1/H9/H14: Teach needs save_intent in every source mode with the proposed state. Send the lib/erp.ts diff issue when the store types are on main; my PR (store-backed ERP state and guard, resetErp → clearGuard, no node:fs) lands before M2 and calls the store without a workspace argument. compileDeterministic, fillSlot and applyCorrection keep their signatures and stay synchronous, so the honest seed can build its maps from them alone; note that fillSlot now re-derives rules from debrief answers and applyCorrection resolves supplier names against the suppliers seen in the session.`

## 7. Human test scripts

Say everything in your own words. Never read the role card aloud. "The number you said" means exactly that.

- **HT-1 · Spike (2 min, W0).** `npx tsx scripts/compile-live.ts --session demo_sabine --legacy`. Expect either rules or a provider error. Paste `used`, `note` and the error text into `docs/status/C.md`.
- **HT-2 · Paraphrase by keyboard (2 min, repeat all night).** `npx tsx scripts/compile-live.ts --say-capex "<how you would explain the cost-center change>" --say-route "<…the second approval>" --say-hold "<…the hold>"`. Must see, per decision: a rule in plain words whose condition contains the number, supplier, month or entity **you said** (nothing you did not say), `replay ok`, and a quote that is a piece of your sentence. If you gave a reason with no condition ("because it's expensive"), must see **no rule** and a question instead. A rule you did not mean = P0 bug; write the sentence into the corpus.
- **HT-3 · Live compile (2 min, after A's capture works).** Capture three invoices while talking. Open `/map/<id>`. Must see the compile badge "LLM", one rule per decision you explained, each opening a frame and your words; a decision you did not explain shows a question, not a rule.
- **HT-4 · Debrief creates a rule; a non-answer is skipped (2 min).** Use a session where you explained nothing live (press "Not now" during capture). Start the debrief. Must hear 3–5 questions naming the invoice and supplier. Answer the first properly: a rule appears and the next question is different. Answer one with "no idea, skip that": the slot shows skipped, no new guardrail, the bar does not rise. Give one vague answer: must hear exactly one follow-up.
- **HT-5 · Correction by voice (2 min).** During the teach-back say a correction that names the supplier the way your accent says it. Must see the diff on exactly one rule with the supplier's real on-screen name, and hear only that sentence re-read. Then say "hmm, that's not quite it": must hear "I did not catch what to change". Say yes: `confirmed`, bar locks. Type one more correction: the confirmed badge clears.
- **HT-6 · Listen (1 min).** Eyes closed during the teach-back. Must be under a minute, no symbols or codes read strangely, your own words recognisable, ends with one question. Would a colleague talk like this? Yes/no into the status file.
- **HT-7 · Teach (2 min).** Start Teach on the confirmed map. Open the first new-hire invoice, type in the note and asset number first: silence. Pick a wrong cost center, or leave it and click Save: the tutor speaks before anything is posted; the replay opens by itself with the still and the quote. Fix it: one short confirmation. Next invoice (December, other supplier): approve; silence. Credit note: your debrief answer is quoted, or it says nobody taught it. Independent cases: silence; a wrong save is refused. End: the card separates "correct without help" from "corrected after intervention".
- **HT-8 · Anti-hardcoding (2 min, M4).** New capture; state a different limit that still fits your own invoice (for example a number between the unseen invoice's amount and your own invoice's amount), confirm, run Teach: the tutor must now stay quiet on the unseen equipment invoice and the guard must still refuse the larger independent one. Second variant: say the hold applies to every supplier; the other supplier's December invoice is now stopped. No code changed in between. Note: a limit above your own invoice's amount is rejected by replay and becomes a question; that is correct.
- **HT-9 · Guard (1 min).** With Teach running: a valid save posts; an invalid one returns "Not posted" and says what is missing; reload the Teach tab and start again: the queue is fresh and the guard belongs to the new session.

## 8. If you are behind

Lane cut order, cut from the top. It keeps the relative order of spec §11 (X4 → prediction prompts → replay audio → map editing → outcome-card polish); lane-internal items are slotted between them.

1. WC-12 (spec cut 1), WC-11, WC-10: never started unless M3 is green.
2. Prediction prompts (spec cut 4): `Matcher` option `predict: false`; keep intervene, stop, praise.
3. WC-8 evidence matrix: keep the `canonicalSteps` counts only; then drop both and show instance steps.
4. Replay audio (spec cut 6): still + quote read by the tutor.
5. Map editing before confirm (spec cut 7): keep correct-by-voice; `PUT …/map` stays for the tutor's flagged slots.
6. WC-9 "Practice this" and card evidence (spec cut 8): plain per-rule list.
7. Last resorts inside P0 packages: LLM-written teach-back → the deterministic spoken version (it already avoids symbols and cuts on sentences); the adequacy follow-up (WC-3 step 4).

**Never cut:** WC-1 with replay validation and verbatim quotes · a slot for every decision without a runnable rule · debrief answers creating rules · one working spoken correction with the "did not catch" path · the confirm gate bound to a revision · the field-aware matcher with the pre-save catch and the 409 backstop · keyless compile and its tests. If WC-1 itself is in trouble at M1: stop everything else in the lane, put every agent on it, and tell the team; an open slot is an acceptable outcome, a wrong or invented rule is not.

## 9. Stretch (only after M3 is green)

- **X2 support** (with A): the understand pass emits `Quote.translation` when `expert.language ≠ "en"` (P-7); matching and replay stay on the original text; the tutor speaks the translation, the replay plays the original clip.
- **WC-10**, then **WC-11**, then **WC-12**, in that order, each behind a flag that defaults off.
- Deep removal at the Map stage: deleting a quote also redacts its transcript segment and clip (needs B's `DELETE` routes, P-18).

## Appendix — Paraphrase corpus (test INPUT only)

**Read this first.** These are ways a human might phrase things. They live in `lib/compile/__fixtures__/corpus.ts`, are imported only by `*.test.ts` files and the local runner, and must never appear in prompts, defaults, seed data or the live path (`lib/compile.nohardcode.test.ts` enforces it). The "oracle" column is what a test asserts about the **derived** rule by probing it with invoice states; no expected rule may be written into product code. `RULE` = a rule must result and behave as described; `SLOT` = no rule, an open question instead; `EITHER` = both are acceptable but the "never" clause must hold.

**A · Threshold decision (cost-center change on the expert's equipment invoice)**

| # | The expert says | Oracle |
|---|---|---|
| A1 | "Equipment over five thousand is always capex." | RULE: fires on equipment at 5 001, not at 5 000, not on non-equipment |
| A2 | "The limit is 5,000 euros. Above that it's an asset, so it goes on 0400." | RULE: number 5 000; boundary slot open |
| A3 | "€5,000 or more goes to capex." | RULE: fires at exactly 5 000 |
| A4 | "It's 7,850, that's above our 5,000 limit, so capex." | RULE: threshold 5 000, never the invoice's own amount |
| A5 | "This one is seven thousand eight hundred, and anything over five thousand is capex." | RULE: fires at 5 500 |
| A6 | "Machines from five k upwards we capitalise." | RULE: inclusive at 5 000, equipment only |
| A7 | "From 5.000 euros it's a fixed asset." | RULE: 5 000 (European format), inclusive |
| A8 | "Anything north of five grand that's a machine is an investment, not maintenance." | RULE: exclusive, equipment only |
| A9 | "We capitalise equipment once it's more than 5000 net, below that it's just expensed." | RULE: exclusive at 5 000 |
| A10 | "Under five thousand stays opex, everything else is capex if it's equipment." | RULE: fires at 5 000 |
| A11 | "equipment over 5000 is always cap ex" (STT spelling) | RULE as A1 |
| A12 | "It's a fixed asset, so capex." | EITHER; never a numeric threshold |
| A13 | "That one is capex, it is a spindle." | EITHER; never a numeric threshold; limit slot open if a rule exists |
| A14 | "Because it's expensive." | SLOT |

**B · Second-approval decision (route change on the subsidiary invoice)**

| # | The expert says | Oracle |
|---|---|---|
| B1 | "Anything from a subsidiary needs a second signature." | RULE: fires on any subsidiary invoice, not on parent |
| B2 | "It's intercompany, so four eyes." | RULE: fires on the subsidiary case, not on parent |
| B3 | "Novak is a sister company, those never go through on one approval." | RULE: fires on that supplier's subsidiary invoice; never on parent |
| B4 | "That's one of our affiliates. Affiliates always get the group controller's sign-off as well." | RULE; `who` only as she said it |
| B5 | "It belongs to the group, so I can't approve it on my own." | RULE |
| B6 | "Group companies need two approvals, mine isn't enough." | RULE |
| B7 | "Czech subsidiary. Second approval, always, doesn't matter how small." | RULE with no amount condition |
| B8 | "Because the amount is small I could do it alone, but it's from our own subsidiary, so no." | RULE on entity; no amount condition |
| B9 | "Freight from Novak always goes to Markus too." | RULE scoped to that supplier (category optional); never on parent suppliers |
| B10 | "A daughter company, so the controller has to countersign." | RULE |
| B11 | "anything from a subsidy area gets a second approval" (STT mangled) | EITHER; never a rule on a field she did not mean |
| B12 | "I always add a second approval on these." | SLOT |
| B13 | "It needs a second pair of eyes." | SLOT |

**C · Supplier-specific December hold (status change on the December invoice)**

| # | The expert says | Oracle |
|---|---|---|
| C1 | "Bäcker double-bills every December, so this one waits until I've matched it against November." | RULE: fires on that supplier in December; not on another supplier in December |
| C2 | "They always double invoice in December, so I never pay a December one from them until it's matched." | RULE as C1 ("they" binds to the supplier on screen) |
| C3 | "Every Dec these guys bill us double — hold." | RULE as C1 |
| C4 | "Becker, December. They double bill every December." (STT) | RULE: supplier resolved to the on-screen name |
| C5 | "Baker Elektrotechnik has a habit of invoicing the same job twice around Christmas." | RULE: supplier resolved; month 12 or limit slot open |
| C6 | "This supplier sends everything twice at year end. I park it until I've checked last month's." | RULE on that supplier; month 12 or limit slot open |
| C7 | "It's dated the second of December and it's Bäcker — with them I wait in December." | RULE as C1 |
| C8 | "In the twelfth month this vendor is on my watch list, last year they billed us twice for the same maintenance." | RULE as C1 |
| C9 | "Not before I've compared it with the November invoice — Bäcker does this every year in December." | RULE as C1 |
| C10 | "December invoices get held until matched." | RULE on month only; supplier-scope slot open (she said it broadly) |
| C11 | "I hold this one." | SLOT |
| C12 | "Because of duplicates." | SLOT |
| C13 | "Hold, it's a double." | SLOT |

**K · Teach-back corrections**

| # | The expert says | Oracle |
|---|---|---|
| K1 | "Not every supplier — only Bäcker." | hold rule gains the supplier condition; other rules untouched |
| K2 | "No, only Becker." | same as K1 after resolution |
| K3 | "No, only when it's Baker." | same as K1; never a condition on the word "when" |
| K4 | "It's from five thousand, not over." | threshold rule becomes inclusive; number unchanged |
| K5 | "No, the threshold is 10.000." | rejected by replay (her own invoice would no longer fit); specific spoken reply; map unchanged |
| K6 | "Not only equipment, software too." | hold rule untouched; threshold rule unchanged (value not on this screen); her words kept as a described exception |
| K7 | "The group controller signs, not me." | no condition changes; escalation guardrail with her words |
| K8 | "Yes, but I also hold Bäcker in January." | hold rule fires in months 12 and 1 for that supplier; not treated as a plain yes |
| K9 | "Hmm, that's not quite it." | `changed: false`; "I did not catch what to change" |
| K10 | "Yes, that's how it works." / "Mhm, yes." | confirmation |
| K11 | "Mhm." / "Okay." | not a confirmation; one re-ask ("is that a yes?") |

**D · Debrief answers**

| # | To which slot | The expert says | Oracle |
|---|---|---|---|
| D1 | limit (hold) | "No no, just Becker. Everyone else goes through as normal." | supplier condition added, resolved |
| D2 | escalation (hold) | "Me or the AP lead, once it's matched against November." | escalation guardrail; `who` verbatim; no stop condition |
| D3 | any | "Hmm, not sure, skip that one." | `skipped`; no quote, no guardrail |
| D4 | any | "I don't know, I'd have to check." | `skipped` |
| D5 | novel (no PO) | "Never post without one. It goes back to whoever ordered it." | note under the no-PO topic with her words |
| D6 | trigger (threshold) | "Well this one was 7.850, and anything above 5.000 is an asset." | rule created in the debrief: threshold 5 000, exclusive |
| D7 | limit (threshold) | "Strictly over. Five thousand flat is still opex. And it's the net amount." | operator stays exclusive; guardrail with her words |
| D8 | any | "Can we do this later? I have a call." | `skipped` |
| D9 | any | "That is all." / "Yeah, that's it." | `thin`: nothing stored in the map; one follow-up; then `skipped` |


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

