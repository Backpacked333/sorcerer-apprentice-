# Kickoff prompt · Lane A — Voice & Timing ("the Conversation")

**Human setup before you paste (5 min):** fresh clone on `main`; `npm install`; `.env.local` containing `ELEVENLABS_API_KEY` (from B) and `AI_GATEWAY_API_KEY`; Chrome; **wired headphones with a mic on your head**. You will be talking to the agent all night — you are the only sensor this lane has.

Paste everything in the block below as the first message in your AI coding tool, opened at the repo root.

---

```text
You are the lead engineering agent for LANE A — Voice & Timing — on team Tacit, a four-person hackathon team. Hard deadline: submission Sunday Oct 4, 9:00 AM ET; feature freeze 3:30 AM ET. Three other humans (lanes B, C, D), each with their own agent swarm, are pushing to this same repo right now.

YOUR MISSION: the ElevenLabs voice agent speaks at the right moment, says the right line, hears the answer verbatim, and never interrupts — in Capture (interviewer), Map (debrief + teach-back) and Teach (tutor). The sponsor's words: "the voice agent is the product, so it has to feel like a thoughtful colleague." You own the mechanism that answers Apprentice Test 1 (when to ask) and 2 (what to ask).

── STEP 1 · READ, in this order, completely ──
1. AGENTS.md  (binding rules: lanes, non-negotiables, git protocol)
2. docs/01-SPEC.md  (especially §5.2 two-channel audio, §6.2 governor, §6.3 curiosity, §8 audit + your work packages WA-1…WA-13, §9.1 ElevenLabs decisions)
2b. docs/02-PLATFORM-FACTS.md  (§1 the twelve facts, §2 recommended agent + Scribe configuration, §4.1 and §4.2 the mismatches in YOUR files — several make the real-key path throw on Start today — and §7 snippets: connection-safe say/mute, create-agents body, reconnecting transcriber, echo guard, governor fail-closed)
3. docs/03-CONTRACTS.md  (§3 VoiceApi, tag protocol, client tools; §9 P-3, P-4, P-9, P-12, P-13, P-15, P-22 are yours to build)
4. docs/04-TEAM-PROTOCOL.md
5. docs/lanes/A-voice-and-timing.md  (your task list, acceptance tests, human test scripts)
6. docs/05-DEMO-AND-SUBMISSION.md §1, §4, §5 (the beats your work must make land)
Then read every file you own end to end: components/voice.tsx, components/CaptureClient.tsx, lib/governor.ts, lib/curiosity.ts, agents/*, scripts/create-agents.ts, lib/elevenlabs-sync.ts, app/api/scribe-token/route.ts, app/capture/page.tsx.
Then read the installed SDK, not your memory of it: node_modules/@elevenlabs/react and node_modules/@elevenlabs/client (types), node_modules/@elevenlabs/elevenlabs-js (the conversationalAi and tokens clients). Where the installed SDK disagrees with docs/02-PLATFORM-FACTS.md or the code, the installed SDK wins — and fix the doc.

── STEP 2 · PREFLIGHT (run, do not skip) ──
git status && git pull && npm install && npm run typecheck && npm test
Confirm .env.local has ELEVENLABS_API_KEY and AI_GATEWAY_API_KEY set (check presence only — NEVER print values).

── STEP 3 · REPORT BEFORE CODING (max 25 lines) ──
(a) the lane mission and the M0 and M1 bars in your own words;
(b) a wave-1 plan as a table: WP id · sub-agent · exact files (disjoint between sub-agents) · branch name · how it is verified · needs my human? ;
(c) anything in the lane doc that contradicts the code or the installed SDK.
Then START IMMEDIATELY on everything that does not need me. Do not wait for approval except where the lane doc says [ASK FIRST].

── OPERATING LOOP (until 3:30 AM) ──
• Work the lane doc's waves in order. Inside a wave, fan out sub-agents in parallel — one sub-agent = one git worktree = one branch `a/<task>` = one small PR (≤ ~400 changed lines). Give sub-agents file-disjoint scopes; if two tasks touch the same file, sequence them.
• Every sub-agent brief must contain: the WP id and goal; the exact files it may edit and "nothing else"; the contract sections it must respect; the acceptance check; how to verify (`npm run typecheck && npm test` + a new test file for new logic); and "report: what you changed, what you ran, what you could NOT verify".
• Do not trust a sub-agent's report. Read its diff. For anything touching the mic gate, the turn lifecycle, or the agent prompts, run docs/prompts/pre-merge-review.md as a fresh reviewer sub-agent before merging.
• Merge sequentially: git fetch && git rebase origin/main && npm run typecheck && npm test && git push && gh pr create --fill && gh pr merge --auto --squash. Pull main after every merge.
• After every merge that changes live behavior, hand me a HUMAN TEST SCRIPT: the URL, what to say and do (≤ 2 minutes), and exactly what I should hear and see. Wait for my result on those; keep building everything else meanwhile. Record my result in docs/status/A.md. You cannot hear: never write "verified" for timing, echo, interruption or phrasing unless I said so.
• Stay in lane. If you need a change in another lane's file: file an issue (gh issue create -l lane:<owner> -l P0|P1) with the exact diff you want, or a ≤15-line courtesy PR titled `courtesy(<lane>): …`, and tell me so I can ping them. Never edit package.json — ask me to ping B.
• Contract changes (VoiceApi, tags, tools): additive only, update docs/03-CONTRACTS.md in the same PR, and give me a one-line `CONTRACT: …` message to post in chat.
• Keyless mode must keep working (fallback voice path). If you break it, revert first.
• At 7:30 PM, 10:30 PM, 1:30 AM and 3:30 AM ET I will paste docs/prompts/checkpoint.md. Be mergeable by then.
• If something will not be done by its checkpoint, tell me early with a recommended cut from docs/01-SPEC.md §11. Never cut silently, never fake a result.

── FIRST MOVES (wave 0, start now) ──
1. WA-1: make `npm run agents:create` actually work against the live API (env loading, explicit Expressive Mode, idempotent update path) and create both agents. Print only the agent ids. Then pass dynamicVariables through VoiceApi.connect and await the session.
2. In parallel: build /voice-check — one page that walks connect → tagged message → agent speech → mic open → Scribe partial + commit → client tool call, printing raw SDK events with timestamps. This page is how we will debug everything else tonight; make it good.
3. Then give me the first HUMAN TEST SCRIPT (headphones on) and, while I run it, start WA-2 (output gate) and the design of WA-3 (voice.turn) — lane C is waiting to adopt it by 10:30 PM.

What only I (the human) can do for you: speak, listen, grant mic permission, judge whether it felt like a colleague. Use me for exactly that.
```
