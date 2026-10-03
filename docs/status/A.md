# Lane A status

_Updated by the lane's AI on every PR. Overwritten at each checkpoint (see docs/prompts/checkpoint.md)._

## Done and merged (WP ids)

- WA-1/WA-9 prompt v2 and prompt/tool protocol regression tests merged in PR #2.
- WA-1 provisioning script is idempotent, read-only-checkable, Expressive Mode explicit, and preserves an existing knowledge base; merged in PR #3.
- WA-1 awaited connection contract, generation-safe failure fallback, SDK/Scribe debug tap, and keyed/keyless `/voice-check` diagnostics merged in PR #7.
- WA-2/WA-3 pure output-gate and turn lifecycle reducer merged in PR #9 with full state/effect regression coverage.
- WA-3 pure voice protocol is implemented with echo attribution, bounded commands, confirmation, safe tag builders, capture summaries, chunking and keyterms; merged in PR #12.
- WA-11 knowledge sync now uploads SOP + debrief notes + tutor prompt, patches only the knowledge-base leaf, verifies agent configuration, rolls back on drift, removes only the superseded same-session document, and times out safely; live confirm remains pending.
- WA-5 pure cadence engines merged in PR #17: `DEMO_GOVERNOR`, fail-closed transcriber health, cooldown-safe guardrail chaining, hardened candidate classification/queueing, targeted narration attribution with evidence timestamps, deterministic deferred ordering, WA-4 outcome mapping, and the pure Capture loop.
- WA-2 real-client structural gate now guards only ElevenLabs remote-stream audio before LiveKit `play()`, reasserts on SDK lifecycle events, persistently squelches late speech after the 8 s authorization watchdog, uses a flicker-safe speech authorization latch, sends idle heartbeats, and exposes snapshot-based soak diagnostics; merged in PR #22.

## Done in the current PR (pending merge)

- `/api/scribe-token` now contains provider/auth failures as a non-cacheable `200 { token: null, reason }`, so browser transcription degrades truthfully instead of surfacing an HTTP 500; success, missing-key and invalid-key paths have regression coverage.
- WA-5 Capture configuration parsing/page routing now resolves `DEMO_GOVERNOR ← environment ← URL` (`?tune=1` only), rejects empty/non-finite numeric overrides, and carries all cadence, grace and chaining knobs through the existing config prop. Pure parser coverage is complete; human tuning remains pending. `graceSecs` and `maxChained` are currently runtime no-ops because frozen `CaptureClient` still constructs `new CandidateQueue(90)` and does not adopt `CaptureLoop`; the mechanism drawer also does not display effective values.
- WA-3 shared transcription hub owns the sole `useScribe`/browser-recognition connection, connects for enabled subscribers or an active voice session, supports `?stt=off`, uses reset-safe/clamped application-clock segment bounds, and routes echo, mixed speech, commands, and human activity through the merged voice protocol. Its generation-safe demand coordinator preserves deferred attempts across ordinary rerenders, bounds fatal SDK failures to one token plus one labeled WebSpeech fallback per demand window, tears resources down before provider replacement, and performs one controlled reconnect for effective STT config changes. Agent speech intervals close on their own debounced mode tail even when output was unsolicited/gated. `useTranscriber` keeps its existing API and adds optional metadata, echo, and command callbacks. `VoiceApi.turn`, cancellation, and clip recording remain for the next sequential PR.
- Automated replay covers brisk red/green timing, an off-screen retro question, ≥3 grounded windows with a guardrail, talkative narration, repeated one-word noise through 64 s, and the legacy-default cadence defect. On rebased `f4aca2a`, `npm run typecheck` passed and `npm test` passed 214 tests across 17 files. Headless `/voice-check?keyless=1` made exactly one token request and stayed gate-closed; `&stt=off` made none. A provider unmount/remount made exactly one request per provider (two total), with no overlays or browser errors. Audible behavior remains human-only below.

## Verified live by a human (who, when, what they did)

- Lane A human, 2026-10-03: quick post-WA-2 gate check heard no unsolicited audio during the partial check. This is not the full three-minute HT-2 pass. Scribe degraded to browser transcription during the same check and is recorded separately below.

## Not verified yet (and the script to verify)

- Prompt tone, phrasing and structural silence: run HT-1 then revised HT-2 from `docs/lanes/A-voice-and-timing.md` with headphones; record both the automated soak result and the human audible result, followed by the speaker echo check in HT-4.
- Live provisioning: after explicit approval and a key, run `npm run agents:create` twice and confirm identical IDs, then `npm run agents:create -- --check` and confirm prompt hashes/tool counts/settings.
- Awaited connect and `/voice-check`: run HT-1 with a real agent key and microphone; verify connect id, event order, exact Scribe commit, and audible response timing. Headless checks cannot verify audio or permissions.
- Turn lifecycle audio behavior: after `voice.tsx` integration, run HT-2, HT-3 and HT-4; the pure reducer cannot verify interruption feel, echo on speakers, or actual mic closure.
- WA-3 real audio attribution remains unverified: HT-4 must cover speakers, headphones, barge-in, late echo and clip playback; deterministic protocol tests cannot judge microphone echo or interruption feel.
- WA-11 live tutor attachment remains unverified: after a key and explicit shared-agent approval, confirm one map and verify the document appears within 10 seconds without changing the prompt hash, LLM, or tool ids.
- WA-5 audible cadence remains unverified: run HT-6 variants A (brisk), B (talkative) and C (noisy) with a human listener; deterministic replay cannot judge interruption, echo, phrasing or feel.
- Scribe keyed health: the token endpoint reached ElevenLabs, but the configured key was rejected with provider status 401 and browser transcription activated. The contained fallback is verified; real Scribe remains unverified until a valid key is supplied.

## Blocked on (lane, handshake id, what exactly)

- Human/key: `ELEVENLABS_API_KEY` is present, but ElevenLabs rejects it as invalid (401). A valid replacement is required for Scribe and shared-agent verification.
- Human/audio: a person must grant microphone permission and listen/speak through HT-4 before WA-3 can be marked live-verified.
- Human/key: WA-11's live confirm mutates the shared tutor agent and cannot be run without a valid ElevenLabs key and explicit first-mutation approval.
- Lane D / [issue #4](https://github.com/Backpacked333/sorcerer-apprentice-/issues/4): the Capture seam split is still open, so A cannot integrate the configured grace/chaining values or expose them through the view model without editing D-owned presentation JSX.
- Lane B / [issue #19](https://github.com/Backpacked333/sorcerer-apprentice-/issues/19): `.env.example` must add the seven new public tuning names and change its shipped cooldown from `60` to `20`.

## Next 3 things

1. Integrate the merged turn reducer as `VoiceApi.turn`/`cancelTurn`/`submitTyped`, including clip lifecycle, without creating a second Scribe connection.
2. Extend `/voice-check` for turn exits and hub counters, then run keyed HT-3/HT-4 with a human listener on headphones and speakers.
3. After D lands issue #4, integrate `CandidateQueue(90, graceSecs)` + `CaptureLoop`/`maxChained` and expose the effective timing values through the Capture view model.

## Risks I see for the demo

- Prompt text is automated-test verified but not yet deployed or judged by a human listener.
- Browser transcription fallback remains the only healthy STT path in this environment until the invalid ElevenLabs key is replaced.
- A keyed connection, first-message speaking edge, microphone gate, and Scribe event order remain human-unverified.
- The page parses grace/chaining overrides, but they cannot affect runtime cadence until the post-seam Capture integration above lands; the drawer likewise cannot show effective values yet.
