# Lane A status

_Updated by the lane's AI on every PR. Overwritten at each checkpoint (see docs/prompts/checkpoint.md)._

## Done and merged (WP ids)

- WA-1/WA-9 prompt v2 and prompt/tool protocol regression tests merged in PR #2.
- WA-1 provisioning script is idempotent, read-only-checkable, Expressive Mode explicit, and preserves an existing knowledge base; merge pending.

## Verified live by a human (who, when, what they did)

- None yet.

## Not verified yet (and the script to verify)

- Prompt tone, phrasing and structural silence: run HT-1 then HT-2 from `docs/lanes/A-voice-and-timing.md` with headphones, followed by the speaker echo check in HT-4.
- Live provisioning: after explicit approval and a key, run `npm run agents:create` twice and confirm identical IDs, then `npm run agents:create -- --check` and confirm prompt hashes/tool counts/settings.

## Blocked on (lane, handshake id, what exactly)

- Human/key: `ELEVENLABS_API_KEY` is absent locally, so the shared agents cannot be updated and the keyed prompt behavior cannot be heard yet.

## Next 3 things

1. Merge WA-1 provisioning and awaited-connect diagnostics.
2. With explicit approval and a key, update both shared agents and run `npm run agents:create -- --check`.
3. Run HT-1 on `/voice-check`, then record the first missing log line or the pass.

## Risks I see for the demo

- Prompt text is automated-test verified but not yet deployed or judged by a human listener.
- Keyless fallback remains the only executable path in this environment until the ElevenLabs key is supplied.
