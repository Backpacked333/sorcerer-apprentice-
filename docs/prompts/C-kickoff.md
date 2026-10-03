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
