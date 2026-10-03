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
