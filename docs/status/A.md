## Oct 4 · Off-record tool precedence [N2, C3]

- Review found that answer-tool matching ignored `mark_off_record` while listening or closing. The privacy tool now takes precedence, yielding an empty aborted/off-record result, discarding the clip and preventing late transcript/answer events from restoring it.
- Four new reducer-to-Capture outcome regressions failed before the fix and passed afterward: listening, closing a confirmed answer, closing typed input, and closing a timeout. No provider settings, V4 model, or storage code changed. Human/privacy UI acceptance is still outstanding.
- The merged base now brings CaptureLoop, explicit human/agent transcript callbacks, and consent-safe recording into this branch. Local merge checks passed 532 tests, typecheck, build and diff validation. These real Capture changes are not yet deployed; the last checked production runtime remains `4d76c20`.

## Oct 4 · Active-exchange presence [C1-C3, M1-M3]

- Both live agents now distinguish connection/repeat/time requests from unrelated background speech while a tagged question is pending. Warm, brief acknowledgments are allowed; `log_answer` speaks before saving (`pre_tool_speech=force`, `execution_mode=post_tool_speech`) and still awaits the result. No acknowledgment may claim the answer is correct or already saved. Idle/background silence and V4 Turbo remain unchanged.
- Read-back verified exact prompts and preserved unrelated configuration, knowledge-base, privacy and model settings. Provisioning `--check` now fails on prompt, skip policy or answer-acknowledgment drift. 512 tests, typecheck, build and diff checks passed before live testing.
- Real production Capture test on frontend `4d76c20`: an unsaved ERP route change triggered a grounded question; "Can you hear me?" received "Yes, I can hear you." in ~856ms sampled waveform latency with no answer tool or browser speech. Both generated turns in `conv_8201m42dqsr6eths3ezkz9nbey94` reported `eleven_v4_turbo`. Controlled synthetic input is not human naturalness acceptance.
- Blocking app findings: the legacy Capture controller persisted that human commit as `speaker:agent` because the agent had begun replying, and uploaded a timeout clip despite no accepted answer. Stopped before legitimate-answer acknowledgment ordering and tutor checks. Earlier diagnostic-only checks did not establish real Capture/Map/Teach integration; those screens still used legacy `say()` at the tested production revision.
- Next: correct the real controller path, repeat with an actual task answer and slow clip persistence, then obtain a human listening pass. Map/Teach integration remains a Lane C coordination item.

## Oct 4 · Background speech and conversational flow [C1, M1-M3, S1]

- Roy's post-deploy listening feedback: voice sounds okay, but nearby voices trigger it and responses feel hesitant. This is not acceptance of the full voice experience.
- Saved remote configs had `background_voice_detection=false`, patient turn eagerness, and no Gemini thinking budget. Provisioning now sends background detection through the SDK wire override (the installed SDK otherwise drops the VAD field), normal turn eagerness, and `thinking_budget=0` only for Gemini 2.5 Flash. Tools, knowledge bases, privacy, voice identity, V4 Turbo, and structural mic/output gates are preserved.
- Both prompts now explicitly permit the immediate spoken answer to a tagged question; previously their tagged-only rules conflicted with answer handling. Delivery asks for direct, steady phrases, not fillers or invented confidence. Interviewer no longer suggests the `thoughtful` audio tag.
- Historical diagnostic turns from the same saved agent version include provider metrics labeled `eleven_v3`; the latest inspected human call reports `eleven_v4_turbo`. The source of mixed telemetry is unresolved. Saved configuration alone is not proof of the model used for every generated turn.
- Both live agents were narrowly updated and read back with the exact expected configuration; tools, knowledge bases, privacy and voice identity are unchanged. Production interviewer diagnostic `conv_5901m42aza0vfvebj5skzb0zke4n` produced four speech turns, all reporting actual `eleven_v4_turbo`. Questions started in 585/739ms with no browser speech; a legitimate answer reached `log_answer`.
- The same single-mic synthetic test failed background handling: unrelated speech caused a repeat request and Scribe-only answer completion. This is not a spatial/real-room test. The prompt now explicitly distinguishes unrelated speech (silent `skip_turn`) from a clearly directed but unclear answer (one clarification).
- Added `TurnOptions.answerTool`; `VoiceApi.turn()` requires `log_answer` for real-agent listening ASK/DEBRIEF turns. Unconfirmed transcript/partial text times out empty rather than filling a slot or uploading a clip. Only a literal transcript match of the logged reason becomes answer evidence; unrelated text in the window is excluded. Typed, keyless/browser fallback, other tags, eight-second watchdog and late-response quarantine are preserved. This additional safeguard requires a website deploy.
- All 502 tests, typecheck, production build, CI and diff checks passed. Production deployment `dpl_39Asz1G4XAYbenvMke5ZE9fjm22H` reached READY at runtime commit `4d76c20`; public health confirms the revision and reachable Supabase.
- Final production single-mic tests passed: unrelated speech caused `skip_turn`/empty timeout; unrelated then legitimate speech accepted only the legitimate reason. Three questions on one connection began in 610/684/618ms; tutor PRAISE/PREDICT and `record_prediction` passed. No browser speech or unexpected disconnect, closed output gates stayed muted. All nine speech-generating entries across `conv_2401m42bt6yjfdfs0q1z74kggd36` / `conv_4701m42bzvr7ecbrqdgsxebay7j6` reported `eleven_v4_turbo`.
- Human naturalness/real-room acceptance remains pending; provider acknowledgment latency reached 3.979s. Automated audio analysis is not human approval. Actual clip-upload suppression was unit-tested, not exercised by diagnostic turns; typed/keyless UI was not repeated in the final run. Runtime-log access remains denied (403).
- Human 2-minute check after reconnect: with a nearby conversation playing, stay silent for 20 seconds; require no false answer. Answer one short and one multi-clause question with a mid-sentence pause; require that your words are retained and Tacit waits for completion without an awkward extra delay. Repeat once with the tutor. Stop/off-record commands must still work.

## Oct 4 · Voice-quality timeout correction [M1-M3, S1]

- Live diagnostic reproduction: both roles disconnected themselves after roughly four seconds without detected speech and invoked browser TTS. `FALLBACK_SPEAK` called `endSession()`, so the SDK's `user` disconnect reason did not mean a human clicked Disconnect. Subsequent tutor turns remained on browser speech. Audible fallback quality was not human-verified.
- Configured-agent turns now wait eight seconds by default before the existing labeled timeout fallback. This preserves V4 for the 6.867 s and 7.231 s live responses observed in local browser retesting while retaining transport-failure recovery and the existing late-response quarantine. New regressions cover delayed real speech, the full timeout window, and keyless speech.
- Both tested sessions negotiated PCM/Opus at 48 kHz; the saved 16 kHz setting is not proof of the browser transport rate. Some remote TTS usage reported `eleven_v4_turbo`; the subsequent audit above found mixed historical per-turn model labels. No voice/model/provider settings changed in that timeout fix.
- Human listening remains required. Tutor greeting/authorization overlap and duplicated responses were observed in diagnostics but are separate, unresolved investigations, not claimed as the cause of Roy's original complaint.

## Oct 4 · V4 Turbo release correction [S1]

Both remote agents were updated and read back with `ttsModel: eleven_v4_turbo`, `expressiveMode: true`, `llm: gemini-2.5-flash`, matching prompt hashes, `recordVoice: false`, and seven-day retention. Their IDs are configured in Vercel production. The source now enforces the V4 wire model despite SDK 2.70's stale enum and rejects a different saved model on provisioning or `--check`. Initial local verification: typecheck and 223 tests passed. Human audio/timing and browser acceptance remain unverified.

The checkpoint below is historical; its missing-key/provisioning blockers have been superseded by this live API verification.

## Checkpoint M1 — 8:02 PM ET

### Ready for independent review (not merged)

- WA-4/WA-5 Capture integration is on `a/wa45-capture-integration`: Capture now drives `CaptureLoop` through P-12 `VoiceApi.turn()`, rechecks freshness, records phase/app-clock evidence, persists deferred questions, exposes cadence diagnostics, and keeps keyless typed fallback operational. Automated gates pass, including the isolated production smoke; HT-5/HT-6 remain human-only and unverified.
- Issue #40 / P-12 is merged on `main` at `ee41948`. The WA-4/WA-5 branch is based on that commit and does not modify `components/voice.tsx`, `lib/voice-turn*`, `lib/voice-hub*`, or `app/voice-check/*`.

### Done and merged (WP ids)

- WA-1 recovery hardening: restored a fully local dependency tree after macOS offloaded 23,677 package files, then added bounded ElevenAgents WebRTC auto-reconnect with a 10-second stability reset, suppressed stale tagged speech during recovery, no duplicate greeting, preserved app-clock/session metadata, and browser fallback only after recovery is exhausted (this PR).
- WA-1: generic prompts/tools, idempotent provisioning/check script, awaited connection/fallback contract, debug tap, and keyed/keyless `/voice-check` diagnostics (PRs #2, #3, #7).
- WA-2: client-side ElevenLabs output gate, idle heartbeat, persistent late-speech squelch, and soak counters (PR #22).
- WA-3: pure turn reducer, protocol/echo helpers, one shared Scribe/WebSpeech hub, app-clock transcript timing, bounded fatal fallback, config reconnect, teardown safety, and the documented `VoiceApi.turn()` React adapter with structural gate/mic/tool/typed/clip wiring (PRs #9, #12, #35 and branch `a/wa3-turn-adapter`).
- WA-5 foundations: deterministic governor/curiosity/Capture-loop engines plus safe environment/URL tuning parsing (PRs #17, #20). Capture controller adoption remains blocked on the D seam.
- WA-11: safe tutor knowledge-base sync with verbatim debrief notes and rollback verification (PRs #13, #15); no shared-agent mutation was run.
- Scribe token route: provider failures are contained as truthful, non-cacheable fallback responses instead of HTTP 500 (PR #31).
- Fresh branch gate after rebasing current `origin/main`: `npm run typecheck`, 447 passed / 1 skipped tests, and `git diff --check` passed. Headless keyless `/voice-check?keyless=1&role=interviewer&stt=off` proved fallback speech held through its end into listening, one typed resolution, no-listen resolution, cancellation, and final idle/mic-muted/gate-closed state with no page errors. Review regressions cover single-path WebSpeech delivery, stale async tools, legacy gate authorization (including a stale legacy timeout clearing only for an explicit tagged turn), persistent hub speech time, raw agent-ASR echo rejection, and clip-stream cleanup. The full seeded smoke passed Capture (`question window opened: true`) but then timed out on C's Map debrief typed input; routed to lane C as issue #42. An earlier merged-main smoke had completed all four predicates.

### Verified live by a human (who, when, what they did)

- Lane A human, 2026-10-03: quick post-WA-2 gate check heard no unsolicited audio. This was a partial check only, not the required three-minute HT-2 soak. During the same check Scribe displayed browser fallback; Scribe health is recorded separately and was not counted as a silence failure.

### Not verified yet (and the script to verify)

- HT-1 male ElevenLabs recovery — 2 minutes: hard-refresh `http://localhost:3000/voice-check?role=interviewer`; click **Request / refresh microphone**, allow access, then click **Connect**. Require `Mode: agent`, `Status: connected`, and a `conv_…` conversation id. Click **Send [ASK] sample** once; require the male ElevenLabs interviewer to say the sample exactly once and the mode to remain `agent` (never `fallback: browser speech`). If `reconnect_scheduled` appears in Raw events, require `reconnect_attempt` followed by a new `connect` and then repeat **Send [ASK] sample** once. Report the first row or audible result that differs.
- HT-1 real round trip — 2 minutes: open `http://localhost:3000/voice-check?role=interviewer`; confirm agent id and Scribe token rows are green; allow the mic; click **Connect** and require connected/id/no sound; click **Send [ASK] sample** and require one sentence with 9001, 1000, 2000; click **Open mic**, say “Because that item belongs to the other department, testing one two three,” then require live partials, one exact Scribe commit, `tool log_answer stepRef=9001:code`, and a four-word-or-shorter acknowledgement. Report the first missing line.
- HT-2 structural silence — the checkpoint explicitly requires 3 minutes, so no honest 2-minute script can verify it: on `/voice-check?role=interviewer`, connect with gate **CLOSED**, click **Silence soak**; spend 60 seconds silent, 60 seconds typing elsewhere, and 60 seconds reading aloud; require no audible agent speech, automated PASS, `audible unsolicited: 0`, no disconnect, and heartbeat delta at least 15. Record gated utterances separately.
- HT-3/HT-4 turn exits and speaker echo — blocked until the React `VoiceApi.turn()` adapter lands. Then, in 2 minutes on `/voice-check`: run one tool-backed turn, one no-tool answer, one silent timeout, one immediate abort-on-speech, and one typed answer; require one matching resolve for each. Unplug headphones, send `[ASK]`, stay silent and require every returned segment to be `agent echo` with empty `heard`; repeat saying “my own words only” and require exactly that text. Repeat on `?keyless=1`.
- HT-5 M1 real-eyes path — 2 minutes after B/C/D dependencies land: open the deployed `/capture` and `/erp` side by side; allow mic/screen; start Capture; change one visible ERP field; require a `seen`/vision event; pause until the real interviewer asks about that exact change; answer “I changed it for this live checkpoint”; require that exact Scribe text with app-clock `t`, an answered window with `closedBy`, then end Capture and require an LLM-produced map for the same session.
- Three mic consumers on both demo laptops — 2 minutes per laptop: open keyed `/voice-check`, connect, run one Scribe utterance, one interviewer question/answer, and one clip recording; require exactly one live mic indicator at a time, automatic re-mute, and no echo/feedback. Repeat on the second laptop.
- Real Scribe token health — open `/voice-check?keyless=1`, allow mic, confirm the token row is green and the badge says Scribe rather than browser transcription; say “Scribe live check, testing one two three”; require partials plus one exact commit. The running process currently does not contain `ELEVENLABS_API_KEY`, so this cannot pass until the key is loaded into the correct checkout/process.

### Blocked on (lane, handshake id, what exactly)

- Human-only: `ELEVENLABS_API_KEY` is loaded and can mint Scribe tokens, but it lacks ElevenLabs `convai_write`; interviewer/tutor agent ids remain absent. A human must grant that key Conversational AI write access without posting it, then Lane A can provision agents, restart the correct checkout, and run the mic/audio checks.
- Lane A, H3 / P-12, issue #40: `VoiceApi.turn()` / `cancelTurn()` / `submitTyped()` and live phase, partial, STT, session-clock, tool, clip and transcript wiring are implemented on `a/wa3-turn-adapter`; automated adapter/reducer coverage and `/voice-check` controls are green. Keyed HT-1–HT-5 still require provisioned agent ids and human audio verification.
- WA-1 live bring-up attempted Oct 3 at 8:04 PM ET: ElevenLabs accepted Scribe token minting (`/api/scribe-token` returned a real single-use token) but rejected agent provisioning because the configured key lacks `convai_write`. No agent ids were written to `.env.local`; unblock by granting that key Conversational AI write access, then rerun `npm run agents:create` and rebuild/restart.
- Lane D, H8, issue #4 / PR #18: the Capture controller/view seam is not on main, blocking WA-4/WA-5 controller integration and the mechanism drawer.
- Lane B, P-4/P-22, issue #14 / PR #29: `QuestionWindow.spokeAt` and `closedBy` are not on main.
- Lane B, H10, issue #38: no deployed/current real-vision event has been handed to Lane A for HT-5.
- Lane B, environment contract, issue #19 / PR #26: the complete governor defaults are not yet in `.env.example`/deploy configuration.
- Lane C, M1, issue #39: no real-key LLM compile evidence from a live session is available.
- Lane C, keyless smoke, issue #42: after Capture passes, the Map debrief no longer exposes the typed-answer input expected by `scripts/smoke.mjs:82` within 15 seconds.
- Lane B → A → C, H6 / P-15: `SessionLog.deferred` is not on main, so deferred Capture candidates cannot be persisted/consumed.

### Next 3 things

1. Land issue #40 and announce `CONTRACT: P-12`; then provision both agents once `convai_write` is enabled and run HT-1–HT-5 with a human listener.
2. After PRs #18 and #29 land, integrate WA-4/WA-5 into the Capture controller and run HT-5 with B’s real vision event and C’s live compile.
3. With the valid key and existing agent ids loaded—or explicit approval for first creation/update—run HT-1, the full three-minute HT-2, HT-3, HT-4, and the two-laptop mic check.

### Risks I see for the demo

- Automated recovery is green, but the actual male voice and WebRTC reconnect remain human-audibility checks; do not mark the hotfix live-verified until HT-1 above passes.
- M1 is missed: real ElevenAgents + real Scribe + real vision + real compile have not completed one end-to-end session.
- P-12 is implemented and automatically verified, but keyed speech timing, audibility, echo behavior, and microphone coexistence still require the human HT-1/HT-3/HT-4 runs before they can be called live-verified.
- The quick human silence result is encouraging but does not replace the required three-minute audible soak.
- Keyless smoke completed its functional beats but logged a transient Capture hydration warning and the expected guarded-save 409; neither predicate failed, but both should be watched after the D/B merges.
- WA-4/WA-5 integration, off-record media purge, paid-route limits, and live provisioning remain P0 work; do not spend time on stretch goals.
