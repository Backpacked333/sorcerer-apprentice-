# 04 · Team Protocol — four people, four AI swarms, one repo

> How we work without stepping on each other. Read once (10 minutes). Your AI tools read it too, via `AGENTS.md`.
> Clock: submissions close **Sunday Oct 4, 9:00 AM ET**. We submit by **7:30 AM ET**. Everything below serves that.

---

## 1. The four lanes

| Lane | Name | One-line mission | The human in this lane is the one who… |
|---|---|---|---|
| **A** | Voice & Timing — *"the Conversation"* | The ElevenLabs agent speaks at the right moment, says the right line, hears the answer, and never interrupts. In all three modules. | wears the headphones. Talks to the agent for hours. Tunes the feel. |
| **B** | Eyes, Trust & Platform — *"the Senses and the Floor"* | The screen becomes correct events within ~2 s; nothing private leaks; off-the-record really is; the app is deployed, persistent, and green in CI. | watches the event feed and network tab; owns deploy, env, dependencies. |
| **C** | Map & Teach Brain — *"the Knowledge"* | A free-form human explanation becomes a correct, evidence-linked Work Map with machine-checkable rules; the same rules catch a new hire's mistake before save. | plays "judge who phrases things weirdly" against compile, debrief, matcher. |
| **D** | Experience, Demo & Pitch — *"the Show"* | Every pixel a judge sees, the sandbox scenario, the juror's path through the live link, the three 60-second videos, the README, the submission. Also our QA: plays both judges at every checkpoint. | has not read the code and therefore behaves like a judge. |

Each lane has its own doc (`docs/lanes/<lane>-*.md`) with the task list, acceptance tests and exact file scope, and its own kickoff prompt (`docs/prompts/<lane>-kickoff.md`).

**Why this split.** The seams follow the three *contracts* that already exist in the code, so lanes meet at typed interfaces instead of inside files:

- **A ⇄ everyone:** the `VoiceApi` + tag protocol + client tools (`components/voice.tsx`, `agents/`). C decides *what* the tutor/debrief says and *when*; A guarantees it is *spoken well* and the answer is *heard*.
- **B ⇄ everyone:** `ScreenEvent` / `SessionLog` (`lib/events.ts`) and the store. B guarantees events and evidence exist; A and C consume them.
- **C ⇄ everyone:** the `WorkMap` (`lib/workmap.ts`). C guarantees it is correct; A reads slots/teach-back, D renders it, B exports it.
- **D ⇄ A/C:** view-models (`components/views/*.vm.ts`). Logic lanes expose state; D renders it.

---

## 2. File ownership (single-writer rule)

**One lane writes each file.** Everyone may read everything. If a file is not listed, the lane that creates it owns it and adds it here in the same PR. `.github/CODEOWNERS` mirrors this table.

| Path | Owner | Notes |
|---|---|---|
| `lib/memory.ts`, `lib/memory.test.ts` | **C** | bounded application-owned memory, evidence validation and cancellable reasoning handoffs; Roy authorized this cross-lane integration |
| `components/voice.tsx` | **A** | `VoiceApi` is a contract: additive only |
| `agents/interviewer.md`, `agents/tutor.md`, `agents/tools.json` | **A** | C proposes tutor/debrief wording via issue or courtesy PR |
| `scripts/create-agents.ts`, `app/api/scribe-token/`, `app/api/agent-token/`, `app/voice-check/` | **A** | |
| `lib/governor.ts`, `lib/curiosity.ts`, `lib/capture-loop.ts`, `lib/capture-config.ts`, `lib/capture-config.test.ts`, `lib/scribe-token.test.ts`, `lib/voice-turn.ts`, `lib/voice-turn*.test.ts`, `lib/voice-turn-adapter.ts`, `lib/voice-connect.test.ts`, `lib/voice-output-gate.test.ts`, `lib/voice-hub.ts`, `lib/voice-hub.test.ts`, `lib/voice-protocol.ts`, `lib/voice-protocol*.test.ts` | **A** | voice timing and configuration, capture-loop decisions, token fallback, turn state machine and adapter, shared transcription/output-gate lifecycle, curiosity and protocol regression tests |
| `lib/governor.demo.test.ts`, `lib/curiosity.classify.test.ts`, `lib/curiosity.queue.test.ts`, `lib/curiosity.narration.test.ts`, `lib/capture-loop.replay.test.ts` | **A** | WA-5 cadence, attribution, queue and replay regressions |
| `lib/elevenlabs-sync.ts`, `lib/elevenlabs-sync.test.ts` | **A** | tutor knowledge-base sync and keyless regression tests |
| `components/CaptureClient.tsx` (logic), `components/views/capture.vm.ts`, `app/capture/` | **A** | after the seam split (§3) |
| `components/useScreenPipeline.ts`, `lib/framediff.ts`, `app/api/vision/` | **B** | shared by Capture and Teach |
| `lib/vision-schema.ts`, `lib/vision-schema.test.ts`, `lib/vision-route.test.ts` | **B** | flat vision wire schema, normalization and mocked route/schema regressions (#28) |
| `lib/events.ts`, `lib/telemetry.ts` | **B** | contracts: additive only |
| `lib/visiondiff.ts`, `lib/visiondiff.test.ts`, `lib/vision-pipeline.test.ts` | **B** | pure visual diff, normalized identities and mocked capture lifecycle regressions (#33) |
| `lib/events.contract.test.ts`, `lib/store.fs.test.ts`, `lib/workspace.ts` | **B** | WB-4 event/hello and filesystem regressions; local-only workspace resolver stub |
| `lib/redact.ts` | **B** | privacy |
| `lib/pii-masks.ts`, `lib/pii-masks.test.ts`, `lib/redact.privacy.test.ts` | **B** | P-24 source-scoped DOM rectangles, crop projection, pre-encoding masks and text privacy regressions |
| `lib/store.ts`, `app/api/sessions/route.ts`, `app/api/sessions/[id]/route.ts`, `…/clips/`, `…/frames/` | **B** | persistence |
| `lib/export.ts`, `lib/autopilot.ts`, `app/api/export/`, `app/api/autopilot/`, `app/api/mcp/`, `app/api/health/`, `app/api/demo/` | **B** | stretch X1 (agent-ready) and X3 (MCP); health + one-call demo reset |
| `scripts/seed-session.ts`, `scripts/smoke.mjs`, `scripts/vision-eval.mjs`, `.github/`, `next.config.ts`, `.env.example` | **B** | |
| `lib/seed.ts`, `lib/seed-boot.test.ts`, `lib/health.test.ts` | **B** | non-destructive sample boot and readiness regressions |
| `lib/platform-env.test.ts` | **B** | deployment environment example regression |
| `package.json`, `package-lock.json` | **B** (gatekeeper) | see §5.4 |
| `lib/smoke-runtime.mjs`, `lib/smoke-runtime.test.ts` | **B** | smoke environment isolation, process cleanup and console guards |
| `lib/platform-config.test.ts` | **B** | N2 structural regressions for CI, runtime configuration and worktree exclusions |
| `lib/workmap.ts` | **C** | THE contract: additive only |
| `lib/workmap.contracts.test.ts` | **C** | legacy/new map compatibility for pre-approved contract additions |
| `lib/compile.ts`, `lib/teachback.ts`, `lib/matcher.ts`, `lib/metrics.ts` | **C** | |
| `lib/compile/{steps,rules-regex,slots,rules-llm,fill,correct}.ts`, `lib/compile.split.test.ts` | **C** | compiler internals; `lib/compile.ts` retains the public API |
| `lib/erp.ts`, `app/api/erp/`, `app/api/teach/` | **C** | sandbox server + save guard |
| `app/api/compile/`, `app/api/teachback/`, `app/api/sessions/[id]/{map,slot,confirm}/` | **C** | |
| `components/MapClient.tsx`, `components/TeachClient.tsx` (logic), `components/views/{map,teach}.vm.ts`, `app/map/`, `app/teach/` | **C** | after the seam split (§3) |
| `lib/engines.test.ts` | **C** | frozen for others: new tests go in new files (§5.5) |
| `lib/fixtures/compile-corpus{,.types}.ts`, `lib/compile.corpus.test.ts` | **C** | synthetic test-only oracle corpus; never runtime prompt material |
| `app/globals.css`, `app/layout.tsx`, `app/page.tsx`, `app/icon.svg`, `public/` | **D** | design system |
| `components/views/*View.tsx`, `components/ui/**` | **D** | all presentational JSX. `capture.vm.ts` is A's and `map.vm.ts` / `teach.vm.ts` are C's from the seam-split merge |
| `components/erp/**`, `components/demo/**` | **D** | PII publisher, queue reset, presenter tabs, embed class, health strip, demo room |
| `lib/erp-ui.ts`, `lib/ui/**` | **D** | presentational helpers and their tests |
| `app/error.tsx`, `app/not-found.tsx`, `scripts/d-shots.mjs`, `docs/pitch/**` | **D** | error screens, layout shots, submission copy |
| `components/WorkMapView.tsx`, `components/Meter.tsx`, `components/TeachStart.tsx` | **D** | |
| `components/InvoiceForm.tsx`, `components/ErpHeader.tsx`, `app/erp/`, `lib/erp-model.ts`, `app/demo/` | **D** | ERP UI **and the scenario data** (seed invoices are a contract: announce changes; the ERP server + guard is C) |
| `README.md`, `docs/05-DEMO-AND-SUBMISSION.md`, deck, video | **D** | |
| `docs/status/<lane>.md` | each lane | your running status, updated by your AI on every PR |
| `docs/01…04`, `AGENTS.md` | all | change only by announcing `CONTRACT:` in chat |

### Touching a file you do not own

1. **Default: don't.** Open a GitHub issue with labels `lane:<owner>` + `P0|P1|P2` containing the exact change you need (ideally a diff). Ping the owner in chat.
2. **Tiny and urgent (≤ 15 lines, blocks you now):** make a *courtesy PR* touching only that file, title `courtesy(<owner-lane>): …`, and ping the owner. The owner merges or rejects within 10 minutes. Do not auto-merge a courtesy PR.
3. **Never** let an AI agent "fix while it's there" in another lane's file. This rule is in `AGENTS.md` and is the main thing that keeps four swarms from colliding.

---

## 3. Hour-zero seam split (D's first PR, blocks nothing else)

Three files mix logic and JSX and would be edited by three lanes at once: `CaptureClient.tsx` (576 lines), `MapClient.tsx` (405), `TeachClient.tsx` (398). Before anyone edits them:

- **D** mechanically extracts the JSX of each into `components/views/CaptureView.tsx`, `MapView.tsx`, `TeachView.tsx`. Each `*Client.tsx` keeps every hook, ref, effect and handler, builds one `vm` object, and ends with `return <XView vm={vm} />`.
- The `vm` type lives in `components/views/capture.vm.ts` (owner A), `map.vm.ts`, `teach.vm.ts` (owner C). D creates them in this PR; ownership transfers on merge.
- **Zero behavior change.** `npm run typecheck && npm test && node scripts/smoke.mjs` must pass before and after. Target: merged **30 minutes after kickoff**.
- **Until it merges, A and C do not edit the three `*Client.tsx` files** (they have plenty to do in `voice.tsx`, `agents/`, `lib/`). B is unaffected.

After the split: logic lanes add a field to their `vm` type and populate it; D renders it. If D needs a new piece of state, D asks for a `vm` field (issue or chat) — D never adds hooks to a Client.

---

## 4. Checkpoints (hard stops, everyone merges, D plays the judge)

All times ET. If kickoff slips, M0–M3 slip with it; **M4 and the submit time do not move.**

| When | Checkpoint | What must be true on `main` *and on the deployed URL* |
|---|---|---|
| **Kickoff + 30 min** | **M0 · Wired** | Repo pushed, CI green, everyone has `.env.local` with real keys, both ElevenAgents agents exist, seam split merged, a deploy exists (even if ugly). |
| **Sat 7:30 PM** | **M1 · Real voice, real eyes** | With keys on: the real ElevenAgents interviewer speaks **one** grounded question at a real pause about a change the **vision model** saw; the answer lands in the transcript verbatim via Scribe; LLM compile runs on a real session. |
| **Sat 10:30 PM** | **M2 · Capture → Map, for real** | A teammate who is *not* A or C plays Sabine without a script: ≥ 3 live questions at pauses (≥ 1 guardrail), "scratch that" works, debrief asks ≥ 3 new questions by voice, teach-back is corrected once then confirmed, Work Map shows frames + verbatim quotes. |
| **Sun 1:30 AM** | **M3 · End to end with a stranger** | D plays both judges on the deployed URL: tutor catches the €7,200 opex mistake **before save** with the real voice, replays Sabine's moment, independent follow-up runs, outcome card shows. Design pass 1 is in. |
| **Sun 3:30 AM** | **M4 · FEATURE FREEZE** | Only bug fixes and copy after this. Raw recordings of every beat exist. The live link passes a full run in a fresh Chrome profile. Stretch goals already merged stay; unmerged ones die. |
| Sun 3:30–6:15 AM | Rehearse ×3, record | Three clean full runs, recorded with the agent's voice audible. README final. Team video and team photo done. |
| Sun 6:15–7:15 AM | Cut | Demo, Tech and Team videos: ≤ 60 s each, H.264 MP4, captions burned in. |
| **Sun 7:30 AM** | **SUBMIT on HackOS** | Three videos + live link + public repo + team photo; "Submit project" clicked and confirmed. Then nobody pushes to `main` and nobody redeploys (the link must stay up through Oct 10). |
| Sun 9:00 AM | Deadline | 90-minute buffer for upload failures. |

**Checkpoint ritual (15 minutes, non-negotiable):** (1) everyone merges what is green and stops typing; (2) B confirms the deploy is on the latest `main`; (3) D runs the judge script from `docs/05-DEMO-AND-SUBMISSION.md` with real voice while the others watch silently; (4) every failure becomes a GitHub issue with a lane label and `P0`/`P1`; (5) P0s are fixed before new work.

**Slip rule.** If a checkpoint's bar is not met, apply the cut list in `docs/01-SPEC.md` §11 top-down. Never cut a line of the brief's "Required" boxes.

---

## 5. Git workflow (trunk-based, small, fast)

### 5.1 Rules

- `main` is **always demoable**. CI (`.github/workflows/ci.yml`: typecheck + unit tests) must be green to merge. No required human review — speed matters — except courtesy PRs (§2).
- Work on short-lived branches named `<lane>/<task>` (`a/mic-gating`, `b/frames-endpoint`). A branch lives **≤ 90 minutes** and a PR is **≤ ~400 changed lines**. Bigger means split it.
- Squash-merge. Rebase on `origin/main` right before you push. Enable auto-merge so green PRs land without you watching:

```bash
git fetch origin && git rebase origin/main && git push -u origin HEAD && gh pr create --fill && gh pr merge --auto --squash
```

- Pull `main` at least every 30 minutes and before starting any new task.
- If you break `main` (CI red, or the keyless smoke path dies): **revert first** (`git revert <sha>` → PR → merge), fix on a branch after. No heroics on `main`.
- Never `git push --force` to `main`. Never rewrite shared history. Force-pushing your *own* branch after a rebase is fine (`--force-with-lease`).
- Commit/PR title format: `<lane>: <what changed> [<requirement id>]` — e.g. `a: close window on Scribe commit if log_answer is late [C3]`.

### 5.2 One-time repo settings (B does this at kickoff)

- The repo is **public** from the first push (the submission requires a public repo; private does not count). Turn on secret scanning + push protection. Nothing secret is ever committed: keys live in `.env.local` and the host's env only.
- Branch protection on `main`: require status check `check`; do **not** require reviews; allow squash only; allow auto-merge; auto-delete head branches.
- Labels: `lane:A` `lane:B` `lane:C` `lane:D` `P0` `P1` `P2` `contract` `demo-blocker`.
- Replace the `@LANE_*` placeholders in `.github/CODEOWNERS` with real handles.

### 5.3 Parallel agents inside one lane (worktrees)

Your AI swarm should run each independent sub-task in its **own git worktree and branch**, so sub-agents never share a working directory:

```bash
git worktree add ../wt-a-mic-gating -b a/mic-gating origin/main
```

Rules for the orchestrating AI: give each sub-agent a **file-disjoint** scope inside your lane; one sub-agent = one branch = one small PR; the orchestrator rebases and merges them one at a time; remove the worktree after merge (`git worktree remove`). Two sub-agents must never edit the same file concurrently — sequence those tasks instead.

### 5.4 Dependencies and the lockfile

- **Only lane B merges changes to `package.json` / `package-lock.json`.** Need a package? Ask B in chat; B lands a PR containing *only* the two files within minutes, everyone pulls and runs `npm install`.
- Lockfile conflict on your branch? Never hand-merge it:

```bash
git checkout origin/main -- package-lock.json package.json && npm install
```

### 5.5 Tests

- New tests go in **new files next to the module** (`lib/compile.llm.test.ts`, `lib/governor.window.test.ts`). `lib/engines.test.ts` is edited by C only. This removes the most common merge conflict.
- Every bug found at a checkpoint that *can* be reproduced in a unit test gets one before the fix.
- The keyless path (`npm run seed:session`, then `node scripts/smoke.mjs` against `npm run dev -- -p 3077`) is our insurance policy. **Any PR that breaks keyless mode is reverted.**

### 5.6 Secrets

- Real keys live only in `.env.local` (gitignored) and in the deploy platform's env settings. B distributes them out-of-band (password manager / DM), never in the repo, an issue, a PR, or an AI prompt that gets committed.
- AI agents must never print `.env.local` contents into logs, docs or commit messages.

---

## 6. Contracts and how to change them

The frozen interfaces are in `docs/03-CONTRACTS.md`. They are what lets four swarms build in parallel.

- **Additive changes** (new optional field, new event kind, new tool, new tag, new route): the owning lane makes the change **and updates `docs/03-CONTRACTS.md` in the same PR**, then posts one line in chat starting with `CONTRACT:` (e.g. `CONTRACT: QuestionWindow.gotAnswerVia added ("tool" | "scribe")`).
- **Breaking changes** (rename, remove, change meaning or type): not allowed without a 2-minute voice/chat agreement of every lane that consumes it. After M2, not allowed at all.
- If you find the contract doc and the code disagree, **the code on `main` wins**; fix the doc in your next PR.

---

## 7. Communication

- **One team chat channel.** Prefixes so messages are scannable: `CONTRACT:` (interface change), `BLOCKED:` (I cannot proceed, need X from lane Y), `MERGED:` (something others should pull now), `BROKEN:` (main or deploy is broken — drop everything).
- **Status lives in the repo**, one file per lane: `docs/status/A.md` … `D.md`. Your AI updates it in every PR: *done / verified live by a human? / next / blocked on*. Per-lane files never conflict. D reads all four before each checkpoint.
- **Bugs and requests are GitHub issues** with a lane label; agents can file and read them with `gh issue create` / `gh issue list -l lane:A`.
- **Decisions** that change the spec are appended to the bottom of `docs/01-SPEC.md` §14 by whoever made them, in the same PR as the change.

---

## 8. Definition of done

A task is done when **all** are true:

1. It maps to a requirement ID in `docs/01-SPEC.md` §4 (or it is a bug fix for one). No ID → not built (§9).
2. `npm run typecheck` and `npm test` pass; keyless smoke still passes.
3. For anything involving voice, vision, timing or the live UI: **a human ran it live** and the lane status file says so (`verified live: yes, by <name>, <time>`). A green unit test is not evidence that a spoken interruption felt natural.
4. Merged to `main`, deployed, and the status file is updated.

---

## 9. Scope discipline (the change-control rule)

Every proposed feature must map to a requirement ID in `docs/01-SPEC.md` §4 (C1–C3, M1–M3, T1–T3, A1–A5, S1, P1, N1–N5), a named stretch goal (X1–X4), or a work package in §8.3. Write down the concrete judge-visible failure it fixes. Prefer the smallest change that fixes it.

No such link → it is deferred, no matter how impressive. A requirement may not be swapped for an adjacent cool feature. The sandbox may not become a simulator product; the Work Map may not become a generic dashboard; the tutor may not become an autonomous worker. Stretch goals stay off until M3 is green.

**Honesty rules (also change-control):** events show their real source (`seen` vs `erp`); a rule exists only if the expert stated its trigger; a paraphrase is never shown as a quote; captured stills are called stills; keyless fallback is labeled as fallback; we never claim "zero retention" for the voice provider. If an AI agent is tempted to hardcode an invoice ID, a threshold, or a line of dialogue to make a demo beat pass, that is a defect, not a fix.

---

## 10. Working with your AI swarm (for humans)

1. Open the repo in your tool. `AGENTS.md` (and `CLAUDE.md`, which imports it) loads automatically in Claude Code, Codex, Cursor and most others.
2. Paste your lane's kickoff prompt from `docs/prompts/<lane>-kickoff.md` as the first message.
3. Let the orchestrator fan out sub-agents per your lane doc's task waves. You stay in the loop for the things only a human can do: **talk to the agent, share a screen, judge whether it felt right.**
4. At each checkpoint, paste `docs/prompts/checkpoint.md`.
5. Before each merge of anything non-trivial, paste `docs/prompts/pre-merge-review.md` (or let the orchestrator run it as a sub-agent).

What humans must do themselves, because agents cannot: wear headphones and speak; grant mic/screen permissions; listen for interruptions, echo, and awkward phrasing; play the judge without reading the code; make the cut calls at checkpoints.
