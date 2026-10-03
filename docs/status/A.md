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
- WA-2 real-client structural gate now guards remote audio before DOM attachment, reasserts on SDK lifecycle events, uses a flicker-safe speech authorization latch, sends idle heartbeats, and exposes snapshot-based soak diagnostics; merge pending.

## Done in the current PR (pending merge)

- WA-5 Capture configuration parsing/page routing now resolves `DEMO_GOVERNOR ← environment ← URL` (`?tune=1` only), rejects empty/non-finite numeric overrides, and carries all cadence, grace and chaining knobs through the existing config prop. Pure parser coverage is complete; human tuning remains pending. `graceSecs` and `maxChained` are currently runtime no-ops because frozen `CaptureClient` still constructs `new CandidateQueue(90)` and does not adopt `CaptureLoop`; the mechanism drawer also does not display effective values.

## Verified live by a human (who, when, what they did)

- None yet.

## Not verified yet (and the script to verify)

- Prompt tone, phrasing and structural silence: run HT-1 then revised HT-2 from `docs/lanes/A-voice-and-timing.md` with headphones; record both the automated soak result and the human audible result, followed by the speaker echo check in HT-4.
- Live provisioning: after explicit approval and a key, run `npm run agents:create` twice and confirm identical IDs, then `npm run agents:create -- --check` and confirm prompt hashes/tool counts/settings.
- Awaited connect and `/voice-check`: run HT-1 with a real agent key and microphone; verify connect id, event order, exact Scribe commit, and audible response timing. Headless checks cannot verify audio or permissions.
- Turn lifecycle audio behavior: after `voice.tsx` integration, run HT-2, HT-3 and HT-4; the pure reducer cannot verify interruption feel, echo on speakers, or actual mic closure.
- WA-3 real audio attribution remains unverified: HT-4 must cover speakers, headphones, barge-in, late echo and clip playback; deterministic protocol tests cannot judge microphone echo or interruption feel.
- WA-11 live tutor attachment remains unverified: after a key and explicit shared-agent approval, confirm one map and verify the document appears within 10 seconds without changing the prompt hash, LLM, or tool ids.
- WA-5 audible cadence remains unverified: run HT-6 variants A (brisk), B (talkative) and C (noisy) with a human listener; deterministic replay cannot judge interruption, echo, phrasing or feel.

## Blocked on (lane, handshake id, what exactly)

- Human/key: `ELEVENLABS_API_KEY` is absent locally, so the shared agents cannot be updated and the keyed prompt behavior cannot be heard yet.
- Human/audio: a person must grant microphone permission and listen/speak through HT-4 before WA-3 can be marked live-verified.
- Human/key: WA-11's live confirm mutates the shared tutor agent and cannot be run without the missing ElevenLabs key and explicit first-mutation approval.
- Lane D / [issue #4](https://github.com/Backpacked333/sorcerer-apprentice-/issues/4): the Capture seam split is still open, so A cannot integrate the configured grace/chaining values or expose them through the view model without editing D-owned presentation JSX.
- Lane B / [issue #19](https://github.com/Backpacked333/sorcerer-apprentice-/issues/19): `.env.example` must add the seven new public tuning names and change its shipped cooldown from `60` to `20`.

## Next 3 things

1. After D lands issue #4, integrate `CandidateQueue(90, graceSecs)` + `CaptureLoop`/`maxChained` and expose the effective timing values through the Capture view model for the mechanism drawer.
2. Have a human run the keyed three-minute HT-2 soak and record automated counters plus the audible pass/fail.
3. With explicit approval and a key, update both shared agents, run `npm run agents:create -- --check`, then run HT-1 through HT-6.

## Risks I see for the demo

- Prompt text is automated-test verified but not yet deployed or judged by a human listener.
- Keyless fallback remains the only executable path in this environment until the ElevenLabs key is supplied.
- A keyed connection, first-message speaking edge, microphone gate, and Scribe event order remain human-unverified.
- The page parses grace/chaining overrides, but they cannot affect runtime cadence until the post-seam Capture integration above lands; the drawer likewise cannot show effective values yet.
