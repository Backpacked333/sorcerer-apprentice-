<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Tacit — the AI Apprentice · working agreement for every AI agent in this repo

You are one of several AI agents working for a **four-person hackathon team** on a hard deadline: **submission Sunday Oct 4, 2026, 9:00 AM ET** (we submit by 7:30 AM; feature freeze 3:30 AM). Four humans, each with their own agent swarm, push to this repo at the same time. Read this file fully. It is short on purpose; the detail lives in `docs/`.

## 1. What we are building (30 seconds)

The Hack-Nation × ElevenLabs challenge "The AI Apprentice": **Capture → Map → Teach**.

1. **Capture** — an expert shares their screen and works real cases. A vision model turns frames into events. An ElevenLabs voice agent stays silent while they type, read or talk, and asks short *why / what's the limit / when would you stop* questions at natural pauses, about what is on screen.
2. **Map** — a spoken debrief closes the remaining gaps, then the agent explains the process back until the expert says yes. Output: the **Work Map** — a clickable timeline where every step links to a screen moment, the decision, the reason *in the expert's own words*, and its guardrails.
3. **Teach** — a new hire works an unseen case on their own screen. The tutor (same pipeline, same map) steps in **before** a wrong decision is saved, explains with the expert's reasoning, replays her screen moment, and ends with what was mastered and what to practice.

Thesis: *an apprentice is a slot-filling machine, not a recorder.* Knowledge is rules with empty slots (reason, limit, exception, who to ask). The screen shows when a judgment call happened; voice fills a slot only at a pause; "understood" means zero open slots plus the expert's explicit yes; the same rules then run against the new hire's screen. One artifact (the Work Map), three readers (expert, new hire, agent).

The repo already runs all three modules **keyless** (browser speech, ERP telemetry, deterministic compile). Our job is to make the **real** stack (ElevenAgents, Scribe v2 Realtime, vision model, LLM compile) reliable with a stranger driving, polish it, and ship what the jury actually receives: **a live deployed link, a public GitHub repo, three 60-second videos (demo, tech, team) and a team photo.** The repo is public — never commit a secret.

## 2. Read before you write

| Doc | When |
|---|---|
| `docs/01-SPEC.md` | always: product, requirement IDs, architecture, known defects, cut list |
| `docs/02-PLATFORM-FACTS.md` | before touching ElevenLabs, the AI SDK, a model schema, capture APIs or hosting: verified facts, known SDK mismatches in our code, snippets |
| `docs/03-CONTRACTS.md` | before touching any type, route, tag, tool or env var |
| `docs/04-TEAM-PROTOCOL.md` | file ownership, git workflow, checkpoints |
| `docs/lanes/<your lane>.md` | your task list and acceptance tests |
| `docs/05-DEMO-AND-SUBMISSION.md` | the demo script every feature must serve |

**Your lane is told to you by your human in the kickoff prompt (A, B, C or D). If you do not know your lane, ask before editing anything.**

## 3. Lanes and file ownership (single-writer rule)

| Lane | Owns (only this lane edits these) |
|---|---|
| **A · Voice & Timing** | `components/voice.tsx`, `agents/**`, `scripts/create-agents.ts`, `app/api/scribe-token/`, `app/api/agent-token/`, `lib/governor.ts`, `lib/curiosity.ts`, `lib/elevenlabs-sync.ts`, `components/CaptureClient.tsx`, `components/views/capture.vm.ts`, `app/capture/`, `app/voice-check/` |
| **B · Eyes, Trust & Platform** | `components/useScreenPipeline.ts`, `lib/framediff.ts`, `lib/redact.ts`, `lib/events.ts`, `lib/telemetry.ts`, `lib/store.ts`, `lib/export.ts`, `lib/autopilot.ts`, `app/api/vision/`, `app/api/sessions/route.ts`, `app/api/sessions/[id]/route.ts`, `app/api/sessions/[id]/{clips,frames}/`, `app/api/{export,autopilot,mcp,health,demo}/`, `scripts/seed-session.ts`, `scripts/smoke.mjs`, `scripts/vision-eval.mjs`, `.github/`, `next.config.ts`, `.env.example`, `package.json`, `package-lock.json` |
| **C · Map & Teach Brain** | `lib/workmap.ts`, `lib/compile.ts`, `lib/teachback.ts`, `lib/matcher.ts`, `lib/metrics.ts`, `lib/erp.ts`, `lib/engines.test.ts`, `components/MapClient.tsx`, `components/TeachClient.tsx`, `components/views/{map,teach}.vm.ts`, `app/map/`, `app/teach/`, `app/api/{compile,teachback,teach,erp}/`, `app/api/sessions/[id]/{map,slot,confirm}/` |
| **D · Experience, Demo & Pitch** | `app/globals.css`, `app/layout.tsx`, `app/page.tsx`, `app/erp/`, `components/views/*View.tsx`, `components/ui/**`, `components/WorkMapView.tsx`, `components/Meter.tsx`, `components/TeachStart.tsx`, `components/InvoiceForm.tsx`, `components/ErpHeader.tsx`, `lib/erp-model.ts` (scenario data), `app/demo/`, `public/`, `README.md`, `docs/05-DEMO-AND-SUBMISSION.md` |

Rules:

- **Never edit a file outside your lane.** Not to fix a typo, not to "quickly" add a field. Instead: open a GitHub issue (`gh issue create -l lane:<owner> -l P0|P1|P2`) with the exact change, or — if ≤ 15 lines and blocking — a *courtesy PR* touching only that file, titled `courtesy(<lane>): …`, which the owner merges. Tell your human.
- New files belong to the lane that creates them; add them to `docs/04-TEAM-PROTOCOL.md` §2 in the same PR.
- New tests go in **new files** next to the module (`lib/<module>.<topic>.test.ts`). Only lane C edits `lib/engines.test.ts`.
- Only lane B changes `package.json` / lockfile. Need a dependency? Ask your human to ping B. Never hand-merge the lockfile.
- Until D's seam-split PR merges (`components/views/*`), nobody edits `CaptureClient.tsx`, `MapClient.tsx`, `TeachClient.tsx`. After it: logic lanes expose state through the `vm`; D renders. D never adds hooks to a Client; A/C never write JSX in a View.

## 4. Non-negotiables (violating any of these is a defect, even if the demo "passes")

1. **No hardcoding to pass a beat.** No invoice-ID branches, no canned thresholds, no scripted dialogue. Behavior must come from what the expert said in *this* session. The expert's business rules live only on a private role card (`docs/05`); never copy them into `agents/*.md`, compile prompts, seed data, or the live path.
2. **Verbatim or nothing.** A `Quote.text` is a literal substring of what the expert said (as transcribed). Paraphrases go in `decision` / `title` / `text` fields. A model-written sentence the expert said "yes" to is not her quote.
3. **A rule exists only if the expert stated its trigger.** Otherwise the step keeps an open slot. Never infer the converse of a rule. Unknown stays unknown.
4. **The agent never interrupts.** Its microphone is closed outside a governor-opened window; it speaks only on a tagged message. Do not "simplify" this into prompt-only turn-taking.
5. **Two sources, never disguised as one.** Vision events say `vision`; ERP telemetry says `dom`. Badges stay honest. Fallback modes are labeled as fallback.
6. **Trust is real.** Masks are painted before a frame leaves the browser; off-the-record strikes transcript, events, frames and clips and invalidates in-flight work (consent epoch); nothing struck reaches compile. No "zero retention" claims about providers.
7. **Only a confirmed map teaches.** Tutor, save guard and exports load only a map with `confirmedAt`. A model never confirms its own output.
8. **Before save.** The tutor reacts to the field change, not the save click; the server-side save guard is the backstop, not the feature.
9. **Keyless mode keeps working.** `npm run seed:session` + `node scripts/smoke.mjs` is our insurance. A change that breaks it gets reverted.
10. **Scope.** Every change maps to a requirement ID in `docs/01-SPEC.md` §4 or a bug in one. No ID → don't build it. Stretch goals stay off until checkpoint M3 is green.

## 5. Commands

```bash
npm install                 # after every pull that touches package-lock.json
npm run dev                 # http://localhost:3000   (use `npm run dev -- -p 3077` for the smoke script)
npm run typecheck           # tsc --noEmit            — must pass before every push
npm test                    # vitest run              — must pass before every push
npm run seed:session        # resets the two demo sessions (debrief-ready + confirmed-for-Teach)
node scripts/smoke.mjs      # keyless end-to-end with screenshots (dev server on 3077)
npm run agents:create       # (lane A) creates the two ElevenAgents agents from agents/*.md + tools.json
```

Useful URLs: `/erp` (expert queue) · `/erp?queue=newhire` · `/capture` (`?share=0` skips screen share) · `/map/<sessionId>` · `/teach` · `/api/erp/reset?queue=expert`.

## 6. Git protocol (four swarms, one trunk)

- Branch `<lane>/<task>` from fresh `origin/main`; **one sub-agent = one worktree = one branch = one small PR** (≤ ~400 changed lines, ≤ 90 minutes old). Sub-agents in the same lane get file-disjoint scopes.
- Before pushing: `git fetch origin && git rebase origin/main && npm run typecheck && npm test`.
- Open and auto-merge: `gh pr create --fill && gh pr merge --auto --squash`. PR title: `<lane>: <what> [<requirement id>]`.
- Never force-push `main`, never rewrite shared history, never commit `.env.local`, `.data/`, or keys. Never print secrets into logs, docs or PRs.
- If `main` breaks because of your change: revert first, fix on a branch.
- Update `docs/status/<lane>.md` in every PR: *done · verified live by a human (who, when)? · next · blocked on*.
- Changing a contract (anything in `docs/03-CONTRACTS.md`): additive only, update that doc in the same PR, and tell your human to post `CONTRACT: …` in the team chat.

## 7. Stack facts (your training data is probably stale — check the installed code)

- **Next.js 16** App Router (see the block at the top): `params`/`searchParams`/`cookies()`/`headers()` are async; no `middleware.ts` (it is `proxy.ts`), no `runtime = "edge"`, no `webpack()` config, no `cacheComponents`; one `next dev` per checkout — each sub-agent that needs a server uses its own worktree and port. Read `node_modules/next/dist/docs/` before using any Next API.
- **Hosting is one long-running Node instance with a volume** (not serverless). Demos run from `next build && next start`.
- **React 19**, **Tailwind 4** (`@theme` tokens in `app/globals.css`, no `tailwind.config`), **Zod 4**, **Vitest 5**.
- **AI SDK 7** (`ai`, `@ai-sdk/gateway`) through the **Vercel AI Gateway**: a model is a plain string slug (`"anthropic/claude-haiku-4.5"`), auth via `AI_GATEWAY_API_KEY`. Structured output is `generateText` + `Output.object` (not `generateObject`); schemas sent to a model must be flat — no recursion, no `z.record`, no `.min/.max`, `.nullable()` not `.optional()` (see `docs/02-PLATFORM-FACTS.md` §1).
- **ElevenLabs**: `@elevenlabs/react` (`ConversationProvider`, `useConversation`, `useConversationClientTool`, `useScribe`) and `@elevenlabs/elevenlabs-js` (server). The SDK surface changes often: **read the types in `node_modules/@elevenlabs/*` and the current docs before editing `voice.tsx` or `create-agents.ts`**; `docs/02-PLATFORM-FACTS.md` lists the verified facts and the known mismatches in our code (e.g. `startSession` is not awaitable; `setMuted` / `sendUserMessage` throw with no live session; pass `dynamicVariables`).
- Persistence goes through `lib/store.ts` only; do not touch `fs` anywhere else (lane B is moving `lib/erp.ts` behind it too).

## 8. How to verify (and what you cannot verify)

- Logic → a unit test in a new test file. UI → run the dev server and look (Playwright is installed; `scripts/smoke.mjs` shows how).
- **You cannot hear or speak.** Anything about voice timing, interruption, echo, phrasing, or "did the tutor catch it before save" needs your human. Build the instrumentation (logs, metrics, on-screen state), run what you can headlessly, then hand your human an exact 2-minute test script and record the result in `docs/status/<lane>.md`. Never write "verified" for something only a human can verify.
- Report honestly: what you ran, what passed, what you did not test.

## 9. When you are unsure

Prefer the smallest change that makes a demo beat more reliable. If two lanes need the same thing, the contract owner builds it. If the spec is silent, the challenge brief wins (summary in `docs/01-SPEC.md` §2), then `docs/01-SPEC.md`, then ask your human. Do not invent requirements, judging criteria, or business rules.
