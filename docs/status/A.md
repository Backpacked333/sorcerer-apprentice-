# Lane A status

_Updated by the lane's AI on every PR. Overwritten at each checkpoint (see docs/prompts/checkpoint.md)._

## Done and merged (WP ids)

- WA-1/WA-9 prompt v2 and prompt/tool protocol regression tests merged in PR #2.
- WA-1 provisioning script is idempotent, read-only-checkable, Expressive Mode explicit, and preserves an existing knowledge base; merged in PR #3.
- WA-1 awaited connection contract, generation-safe failure fallback, SDK/Scribe debug tap, and keyed/keyless `/voice-check` diagnostics merged in PR #7.
- WA-2/WA-3 pure output-gate and turn lifecycle reducer is implemented with full state/effect regression coverage; merge pending.

## Verified live by a human (who, when, what they did)

- None yet.

## Not verified yet (and the script to verify)

- Prompt tone, phrasing and structural silence: run HT-1 then HT-2 from `docs/lanes/A-voice-and-timing.md` with headphones, followed by the speaker echo check in HT-4.
- Live provisioning: after explicit approval and a key, run `npm run agents:create` twice and confirm identical IDs, then `npm run agents:create -- --check` and confirm prompt hashes/tool counts/settings.
- Awaited connect and `/voice-check`: run HT-1 with a real agent key and microphone; verify connect id, event order, exact Scribe commit, and audible response timing. Headless checks cannot verify audio or permissions.
- Turn lifecycle audio behavior: after `voice.tsx` integration, run HT-2, HT-3 and HT-4; the pure reducer cannot verify interruption feel, echo on speakers, or actual mic closure.

## Blocked on (lane, handshake id, what exactly)

- Human/key: `ELEVENLABS_API_KEY` is absent locally, so the shared agents cannot be updated and the keyed prompt behavior cannot be heard yet.

## Next 3 things

1. Integrate the merged P-12 reducer into `components/voice.tsx` with the structural output gate.
2. With explicit approval and a key, update both shared agents and run `npm run agents:create -- --check`.
3. Run HT-1 through HT-4 on `/voice-check`, recording the first missing event or each pass.

## Risks I see for the demo

- Prompt text is automated-test verified but not yet deployed or judged by a human listener.
- Keyless fallback remains the only executable path in this environment until the ElevenLabs key is supplied.
- A keyed connection, first-message speaking edge, microphone gate, and Scribe event order remain human-unverified.
