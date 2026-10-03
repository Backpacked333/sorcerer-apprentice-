## Checkpoint M1 — 7:55 PM ET

### Done and merged (WP ids)

- WA-1: generic prompts/tools, idempotent provisioning/check script, awaited connection/fallback contract, debug tap, and keyed/keyless `/voice-check` diagnostics (PRs #2, #3, #7).
- WA-2: client-side ElevenLabs output gate, idle heartbeat, persistent late-speech squelch, and soak counters (PR #22).
- WA-3 foundations: pure turn reducer, protocol/echo helpers, one shared Scribe/WebSpeech hub, app-clock transcript timing, bounded fatal fallback, config reconnect, and teardown safety (PRs #9, #12, #35). The documented `VoiceApi.turn()` React adapter is not implemented yet.
- WA-5 foundations: deterministic governor/curiosity/Capture-loop engines plus safe environment/URL tuning parsing (PRs #17, #20). Capture controller adoption remains blocked on the D seam.
- WA-11: safe tutor knowledge-base sync with verbatim debrief notes and rollback verification (PRs #13, #15); no shared-agent mutation was run.
- Scribe token route: provider failures are contained as truthful, non-cacheable fallback responses instead of HTTP 500 (PR #31).
- Fresh merged-main gate: `npm install`, `npm run typecheck`, and 215/215 tests passed. Keyless seed/smoke completed with `question window opened: true`, `intervened: true`, `guard held the independent miss: true`, and `independent success recorded: true`.

### Verified live by a human (who, when, what they did)

- Lane A human, 2026-10-03: quick post-WA-2 gate check heard no unsolicited audio. This was a partial check only, not the required three-minute HT-2 soak. During the same check Scribe displayed browser fallback; Scribe health is recorded separately and was not counted as a silence failure.

### Not verified yet (and the script to verify)

- HT-1 real round trip — 2 minutes: open `http://localhost:3000/voice-check?role=interviewer`; confirm agent id and Scribe token rows are green; allow the mic; click **Connect** and require connected/id/no sound; click **Send [ASK] sample** and require one sentence with 9001, 1000, 2000; click **Open mic**, say “Because that item belongs to the other department, testing one two three,” then require live partials, one exact Scribe commit, `tool log_answer stepRef=9001:code`, and a four-word-or-shorter acknowledgement. Report the first missing line.
- HT-2 structural silence — the checkpoint explicitly requires 3 minutes, so no honest 2-minute script can verify it: on `/voice-check?role=interviewer`, connect with gate **CLOSED**, click **Silence soak**; spend 60 seconds silent, 60 seconds typing elsewhere, and 60 seconds reading aloud; require no audible agent speech, automated PASS, `audible unsolicited: 0`, no disconnect, and heartbeat delta at least 15. Record gated utterances separately.
- HT-3/HT-4 turn exits and speaker echo — blocked until the React `VoiceApi.turn()` adapter lands. Then, in 2 minutes on `/voice-check`: run one tool-backed turn, one no-tool answer, one silent timeout, one immediate abort-on-speech, and one typed answer; require one matching resolve for each. Unplug headphones, send `[ASK]`, stay silent and require every returned segment to be `agent echo` with empty `heard`; repeat saying “my own words only” and require exactly that text. Repeat on `?keyless=1`.
- HT-5 M1 real-eyes path — 2 minutes after B/C/D dependencies land: open the deployed `/capture` and `/erp` side by side; allow mic/screen; start Capture; change one visible ERP field; require a `seen`/vision event; pause until the real interviewer asks about that exact change; answer “I changed it for this live checkpoint”; require that exact Scribe text with app-clock `t`, an answered window with `closedBy`, then end Capture and require an LLM-produced map for the same session.
- Three mic consumers on both demo laptops — 2 minutes per laptop: open keyed `/voice-check`, connect, run one Scribe utterance, one interviewer question/answer, and one clip recording; require exactly one live mic indicator at a time, automatic re-mute, and no echo/feedback. Repeat on the second laptop.
- Real Scribe token health — open `/voice-check?keyless=1`, allow mic, confirm the token row is green and the badge says Scribe rather than browser transcription; say “Scribe live check, testing one two three”; require partials plus one exact commit. The running process currently does not contain `ELEVENLABS_API_KEY`, so this cannot pass until the key is loaded into the correct checkout/process.

### Blocked on (lane, handshake id, what exactly)

- Human-only: the running Next process and repository `.env.local` do not contain `ELEVENLABS_API_KEY`; interviewer/tutor agent ids are also absent. A human must load the secret/ids without posting them, restart the correct checkout, grant mic/screen permissions, and judge audio. First shared-agent creation/update remains `[ASK FIRST]`.
- Lane A, H3 / P-12, issue #40: the pure reducer and shared hub are merged, but `components/voice.tsx` still lacks the documented `VoiceApi.turn()` adapter; HT-3 and Capture adoption cannot run.
- Lane D, H8, issue #4 / PR #18: the Capture controller/view seam is not on main, blocking WA-4/WA-5 controller integration and the mechanism drawer.
- Lane B, P-4/P-22, issue #14 / PR #29: `QuestionWindow.spokeAt` and `closedBy` are not on main.
- Lane B, H10, issue #38: no deployed/current real-vision event has been handed to Lane A for HT-5.
- Lane B, environment contract, issue #19 / PR #26: the complete governor defaults are not yet in `.env.example`/deploy configuration.
- Lane C, M1, issue #39: no real-key LLM compile evidence from a live session is available.
- Lane B → A → C, H6 / P-15: `SessionLog.deferred` is not on main, so deferred Capture candidates cannot be persisted/consumed.

### Next 3 things

1. Land issue #40: implement the `VoiceApi.turn()` adapter against the merged reducer/hub, re-review it, and announce `CONTRACT: P-12`.
2. After PRs #18 and #29 land, integrate WA-4/WA-5 into the Capture controller and run HT-5 with B’s real vision event and C’s live compile.
3. With the valid key and existing agent ids loaded—or explicit approval for first creation/update—run HT-1, the full three-minute HT-2, HT-3, HT-4, and the two-laptop mic check.

### Risks I see for the demo

- M1 is missed: real ElevenAgents + real Scribe + real vision + real compile have not completed one end-to-end session.
- `docs/03-CONTRACTS.md` documents the additive P-12 `VoiceApi.turn()` surface before the React adapter exists; consumers must not treat it as available yet.
- The quick human silence result is encouraging but does not replace the required three-minute audible soak.
- Keyless smoke completed its functional beats but logged a transient Capture hydration warning and the expected guarded-save 409; neither predicate failed, but both should be watched after the D/B merges.
- WA-4/WA-5 integration, off-record media purge, paid-route limits, and live provisioning remain P0 work; do not spend time on stretch goals.
