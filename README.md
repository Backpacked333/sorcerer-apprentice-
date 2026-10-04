> **Team: start at [`docs/00-START-HERE.md`](docs/00-START-HERE.md).**
> Competition acceptance and remaining live checks are tracked below. A working fallback demo is not evidence that real voice and vision pass the challenge.

# Tacit · the AI Apprentice

> We know more than we can tell. A recorder captures what happened. An automation tool copies the clicks. An apprentice asks why, learns the limit and the moment to stop, and refuses to say it understands until the expert says so.

Hack-Nation × ElevenLabs "AI Apprentice": three modules on one pipeline, one artifact (the Work Map) with three readers: the expert who confirms it, the new hire who is tutored from it, and an agent that loads it as guardrails.

**Everything runs keyless.** The sandbox ERP reports its own events over a BroadcastChannel, the browser's speech synthesis and recognizer stand in for the voice agent, and the Work Map compiles deterministically. Add keys for the real thing: ElevenAgents for the interviewer and tutor voices, Scribe v2 Realtime for the transcript, a Vercel AI Gateway key for vision and the LLM compile pass.

## Live deployment

[Open Tacit](https://tacit-ai-apprentice.vercel.app).

The `c51b9f3` deployment passed a narrow HTTP retest: valid PNG/WebM reads matched their uploads, and after one evidence withdrawal an immediate metadata-only reattachment still returned 404 for both media routes on the first read. Health reported Supabase configured and reachable; voice and AI Gateway integrations are degraded/not configured. An earlier HTTP smoke verified workspace isolation and draft Teach/export rejection; those broader checks were not repeated after this redeploy. Real-provider, browser/UI, voice/timing, and human acceptance remain unverified.

## Run it in two minutes

```bash
npm install
STORAGE_BACKEND=local STORE_OWNER_ID=local npm run seed:session
STORAGE_BACKEND=local STORE_OWNER_ID=local npm run dev  # http://localhost:3000
```

1. Open the ERP in one tab: `/erp` (Sabine's queue: 4471, 4472, 4473).
2. Open `/capture` in another tab, click Start, share the ERP tab. Work the invoices. The side panel shows the governor lights, the question window, the candidate queue and the privacy ledger.
3. Click Done. `/map/<session>` compiles the Work Map, runs the debrief on the open slots, reads the calibrated teach-back, and locks on your yes.
4. `/teach` picks a confirmed map. Share the ERP tab on Lena's queue. Coached cases first: the tutor asks for a prediction on 4490, steps in before the €7,200 equipment invoice is saved to opex and replays Sabine's captured still, stays quiet on 4491, and on the credit note (4492) either quotes what Sabine said in the debrief or, if nobody asked, says so and flags it for her. Then the independent follow-up (4493, 4494): the tutor stays silent, help is recorded before each decision, and the sandbox's server-side save guard holds any commit that breaks a confirmed rule so the tutor can explain it in her words. The session outcome labels each rule: correct without help, correct after a hint, corrected after intervention, not tested. The stretch panel on the Map page loads `policy.json` and runs the routine queue, halting on the unknown supplier.

Add `?share=0` to `/capture` or `/teach` to skip screen sharing (the ERP telemetry still delivers exact events). Use headphones once voice is on: the apprentice must not hear itself.

## Keys

Copy `.env.example` to `.env.local`.

| Key | What it unlocks | Where |
| --- | --- | --- |
| `ELEVENLABS_API_KEY` | Scribe v2 Realtime transcript (single-use tokens are minted server side), `npm run agents:create` | elevenlabs.io |
| `NEXT_PUBLIC_INTERVIEWER_AGENT_ID`, `NEXT_PUBLIC_TUTOR_AGENT_ID` | The two ElevenAgents voices | printed by `npm run agents:create`, or the dashboard |
| `AI_GATEWAY_API_KEY` | Vision (`/api/vision`) and the LLM compile pass (`/api/compile`) | vercel.com → AI Gateway. `curl https://ai-gateway.vercel.sh/v1/models` lists model slugs for `VISION_MODEL` and `COMPILE_MODEL` |
| `NEXT_PUBLIC_EVENT_SOURCE` | `vision` (the brief's path), `both` (default: vision stays primary, the ERP's telemetry waits 2.5 s and fills in only what vision missed, each event badged `seen` or `erp`) or `dom` (keyless development, emergency fallback) | |

`npm run agents:create` creates both agents with their client tools (`agents/tools.json`), the `skip_turn` and `language_detection` system tools, Eleven v3 Conversational TTS (Expressive Mode), a 30 s turn timeout, silence end-call disabled, overrides enabled. The prompts live in `agents/interviewer.md` and `agents/tutor.md`; paste them into the dashboard if you prefer clicking.

## How it answers the Apprentice Test

| Question | Mechanism | File |
| --- | --- | --- |
| When to ask | The governor fuses four signals every 500 ms (speech silence from Scribe, screen stillness from a 64 x 36 frame diff, no typing pattern, budget and cooldown) and opens a question window only when all four are green and a candidate is worth it. The agent's microphone is muted outside windows, so it cannot interrupt. | `lib/governor.ts`, `lib/framediff.ts`, `components/CaptureClient.tsx` |
| What to ask | Events are scored for judgment value in plain code (an edit of a prefilled value, a hold, a reroute). Each judgment event yields a why plus sibling probes: counterfactual ("if it had been €4,946?"), limit, stop, who. Templates are filled from the event's own numbers. Narration that already answers a why fills it silently. By the third window a guardrail question is forced. | `lib/curiosity.ts` |
| When it has understood | A slot ledger: every judgment step needs a reason, every rule a limit or exception, every stop a who. The debrief asks the open slots, the teach-back is generated from the map (not the transcript), marks what it is sure of and what it is guessing, is capped at 130 words, and done means zero open slots plus an explicit yes. Corrections patch the rule and re-read only the changed sentence. | `lib/compile.ts`, `lib/teachback.ts`, `components/MapClient.tsx` |
| Whether the new hire learned | The same pipeline on the new hire's screen. The matcher evaluates each rule's `when` against the invoice state on every field change, before save. Wrong value: "Sabine would stop here. Why do you think?", then her captured still and her clip. Right value: praise in her words. No rule: quote her debrief answer if she was asked, otherwise say so and flag it; never guess. Then an independent follow-up with the tutor silent and the server-side save guard as the only backstop; help is recorded before each decision and disclosed on the outcome card. | `lib/matcher.ts`, `lib/erp.ts` (`checkSave`), `components/TeachClient.tsx` |
| Trust | Consent screen before capture. Designated regions are masked before any frame leaves the browser; model-detected PII is blurred before a frame is stored; only frames tied to steps are stored at all. "Scratch that" (voice tool or button) strikes transcript, events, frames and clips in the window, leaves a red tombstone and invalidates anything in flight (a consent epoch). Hold-to-pause stops transmission and hearing. A regex redactor runs over every transcript segment. The ledger counts frames sent, frames kept, entities redacted, seconds struck, and says plainly that the voice provider keeps transcripts and audio per the account's retention settings. | `lib/redact.ts`, `components/useScreenPipeline.ts`, `components/CaptureClient.tsx` |

## Repo map

```
app/
  erp/                 sandbox ERP (queue, invoice detail with a Save confirm dialog), seeded from lib/erp-model.ts
  capture/             1 · Capture
  map/[sessionId]/     2 · Map: debrief runner + clickable Work Map
  teach/[sessionId]/   3 · Teach: tutor, replay panel, mastery card, autopilot
  api/vision           one frame in, screen state out (AI SDK generateText + Output.object, finite provider schema)
  api/compile          deterministic compile, then an optional validated LLM refinement
  api/sessions/*       session log, map, slot fill, confirm, audio clips
  api/export           policy.json · agent prompt · SOP markdown
  api/autopilot        runs the policy over the routine queue through the ERP's own API
lib/
  workmap.ts           the Work Map type, Zod schemas, condition evaluator
  governor.ts          engine 1: when to ask
  curiosity.ts         engine 2: what to ask
  compile.ts           events + transcript + answers -> Work Map, slot filling, corrections
  teachback.ts         calibrated teach-back under the word cap
  matcher.ts           Teach: rules against the new hire's screen, mastery, practice cases
  autopilot.ts         people first, then agents
  framediff.ts         typing vs scrolling vs still, send-or-skip
  redact.ts            text redaction, region blur
  metrics.ts           the numbers for slide 6
  engines.test.ts      19 tests covering all of the above (npm test)
components/
  voice.tsx            ElevenAgents + Scribe with a browser fallback; one API for the pages
  useScreenPipeline.ts screen share -> diff -> vision or telemetry -> events with screen moments
agents/                interviewer.md, tutor.md, tools.json
scripts/               create-agents.ts, seed-session.ts, smoke.mjs (keyless end-to-end with screenshots)
```

## Demo-day checklist

- `npm run seed:session` before every rehearsal; it resets the two demo sessions. `/api/erp/reset?queue=expert` resets a queue.
- Headphones on both laptops. Share the ERP tab only.
- Production uses `NEXT_PUBLIC_EVENT_SOURCE=both` (or `vision`); `dom` is for local development only. Degraded ERP telemetry stays explicitly labeled, never presented as vision.
- If ElevenLabs is down, leave the agent ids empty: the browser voice fallback keeps every beat runnable, including the question windows, the debrief and the interventions.
- `npm test` and `node scripts/smoke.mjs` (with `npm run dev -- -p 3077` running) before you record the video.

## How this maps to the brief

Module 1 Capture: screen share, a frame to the vision model every 1.5 s (sooner on a visible change, with dropped frames counted and shown as degraded observation when the model falls behind), events not video, the agent in a side panel, quiet while she types, reads or talks, questions at pauses about what is on screen, at least one about a guardrail (the third window prefers one if none was asked), three to five per ten minutes, a "Not now" control that defers to the debrief. Module 2 Map: the spoken debrief asks the open slots including the cases it has not seen, the teach-back is the apprentice explaining the process in its own words, the expert confirms or corrects, every step and guardrail links to a screen moment and her words. Module 3 Teach: the tutor watches the new hire's screen the same way, explains in the expert's words, asks for a prediction, steps in before a guardrail is broken, replays her captured still, then an independent follow-up answers Apprentice Test 4 with help disclosed; the session ends with a task-specific outcome card and what to practice next. Built with ElevenLabs: ElevenAgents plays interviewer and tutor (Eleven v3 Conversational, Expressive Mode), your choice of LLM, Scribe v2 Realtime for the pause signal, and the confirmed Work Map goes into the tutor's knowledge base. Stretch: agent-ready guardrails (`policy.json`, agent prompt, SOP), proven by running the routine queue. Everything else in the repo exists to make those beats reliable on demo day.

The compiler never assumes a policy: a rule exists only when the expert stated its trigger (a number, a month, who it applies to); otherwise the step keeps its gap open and the tutor cannot use it. Change one explanation in the debrief and the tutor changes with it, through the same map id and revision, with nothing re-entered by hand.

## What is deliberately not here yet

German capture → English teaching, MCP guardrail lookup, and two-expert comparison remain **optional stretches**, not required modules. The competition PDF is the authority: it lists Capture, Map and Teach as required. `docs/01-SPEC.md` records the objectives and explicitly excludes account-based auth. Do not expand into stretches before the core live acceptance run passes.

## Competition acceptance: implemented is not the same as verified

This is a requirement-by-requirement status, not an invented judging score.

| Required objective | Baseline gap | Implementation / remaining proof |
| --- | --- | --- |
| Capture screen + ElevenLabs interview | Real providers unverified; provider schema used recursive/unsupported shapes | Finite schemas and supported structured-output calls; real screen/voice run still required |
| At least 3 live questions at natural pauses, including a guardrail | Governor and candidate queue exist | A human must verify timing, interruptions, and the three answers with headphones |
| At least 3 debrief follow-ups, not already answered | Slot ledger exists; confirmation could bypass open gaps | Confirmation requires completed debrief answers and no open slots; question relevance needs human review |
| Evidence-linked steps and guardrails | Inline frames and local clips were ephemeral | Private Storage-backed evidence; confirmation rejects missing screen references/reason/guardrail quotes; review evidence against the recording |
| Expert explicitly confirms teach-back | Stale/draft maps could be confirmed or exported | Revision-bound confirmation; edits invalidate confirmation; draft exports/autopilot rejected |
| Unseen new-hire case; wrong decision caught before save | Matcher exists; ERP/guard were global local files | Workspace-scoped ERP and guard, confirmed-map teaching; real new-hire interaction still required |
| Tutor explains using expert reasoning | Shared agent knowledge base mixed visitor maps | Only the current conversation receives its Work Map; no shared knowledge-base mutation |
| Public, isolated, durable demo without login | Files and process memory on serverless | Supabase PostgreSQL + private Storage; anonymous cookie-scoped workspaces |

The deterministic compiler supports a limited set of explanation patterns. It is a labeled fallback, not proof of general speech understanding. Screen references alone cannot prove evidence quality. Required human acceptance: perform a real expert task, answer three live questions, complete three distinct debrief follow-ups, inspect every evidence link, explicitly confirm, then have a second person attempt a wrong decision on an unseen invoice. Verify the intervention occurs **before save**, quotes the expert accurately, and leaves the wrong change unsaved.

## Deploy on Supabase + Vercel

Supabase **is PostgreSQL**, plus private object storage. No Supabase Auth is needed: the brief requires a no-login judge experience. Visitors receive an unguessable HttpOnly workspace cookie. This is anonymous browser isolation, **not accounts or cross-device recovery**; losing the cookie loses access to that workspace. Use synthetic demo data; this is not a compliance-reviewed production ERP.

### 1. Create the database and private media bucket

Create a new Supabase project and run the complete checked-in SQL in `supabase/migrations/202610030001_durable_workspaces.sql` through the Supabase SQL editor, or link the project and use `supabase db push`.

The migration creates `sessions` and `work_maps` with JSONB payloads, workspace-scoped ERP/guard state and rate counters, atomic map revision/invoice/rate-limit functions, and the private `tacit-media` bucket. All tables enable RLS and deny anon/authenticated access; only server-side service-role calls access data. Media objects are workspace-prefixed and served through workspace-checked routes, not public bucket URLs. The bucket accepts JPEG/PNG frames and WebM clips with a 3 MiB object ceiling; application routes enforce narrower limits and upload quotas.

### 2. Configure secrets

Copy `.env.example` to `.env.local` for local development. Add the following in Vercel Project Settings → Environment Variables (Production, plus Preview if wanted):

| Variable | Purpose |
| --- | --- |
| `SUPABASE_URL` | Project API URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only service-role key; **never** a `NEXT_PUBLIC_` variable |
| `STORAGE_BACKEND=supabase` | Explicit durable backend |
| `NEXT_PUBLIC_EVENT_SOURCE=both` | Real vision with visibly labeled sandbox telemetry fallback; `vision` is also supported |
| `AI_GATEWAY_API_KEY` | Vision/compile access; Vercel OIDC may supply auth on Vercel when Gateway is enabled |
| `VISION_MODEL`, `COMPILE_MODEL` | Model slugs; defaults are in `.env.example` |
| `ELEVENLABS_API_KEY` | Server-side Scribe provisioning and agent creation |
| `NEXT_PUBLIC_INTERVIEWER_AGENT_ID`, `NEXT_PUBLIC_TUTOR_AGENT_ID` | Public agent identifiers from the next step |
| `ELEVENLABS_VOICE_ID` | Optional voice selection |

Never commit `.env.local`, service-role credentials, Vercel tokens, recordings or `.data/`. Production fails closed when durable storage is absent or misconfigured; it must not silently switch to local files. Local keyless development can use the documented local backend. Keep sensitive providers' retention settings explicit: deleting application evidence does not claim deletion from provider logs/transcripts.

### 3. Provision ElevenLabs agents

```bash
npm ci
npm run agents:create
```

The script reads the server-side ElevenLabs key and agent definitions. Copy the returned public agent IDs into Vercel **before building** (`NEXT_PUBLIC_*` variables are bundled). Follow `docs/02-PLATFORM-FACTS.md` for voice overrides and permissions. Use dedicated tutor/interviewer agents for this app; do not attach other visitors' documents to a shared tutor knowledge base. The confirmed Work Map is supplied as conversation-scoped context.

Without ElevenLabs, the app exposes its browser/text fallback; without Gateway, vision returns a labeled unavailable response and compilation reports deterministic mode. Provider failure is degradation, not successful real-provider verification.

### 4. Verify and deploy

```bash
npm run typecheck
npm run test
npm run build
npx vercel link
npx vercel deploy --prod
```

Use Vercel's Next.js framework preset. Select the Supabase project URL/key from step 1, not an unrelated existing database. Run `/api/health` after deployment; verify storage is ready and inspect provider readiness separately. Open two fresh browser contexts: each should start with its own sessions and ERP state. Create a session, upload evidence, refresh, and confirm it survives a new server process/deployment.

For a local seeded rehearsal, run both `STORAGE_BACKEND=local STORE_OWNER_ID=local npm run seed:session` and `STORAGE_BACKEND=local STORE_OWNER_ID=local npm run dev`. The explicit local owner lets browser requests read the seeded workspace outside Vercel; production remains cookie-scoped. Local `.data/` is not uploaded to Vercel. Production users create their own captures; do not treat a seeded recording as evidence of a live challenge run.

Do not connect automatic production deployment to an older `main` revision until this deployment change is merged. This repository's earlier long-running Node hosting recommendation is superseded for this deployment by Supabase + Vercel.
