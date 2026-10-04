# Lane B status

_Updated by the lane's AI on every PR. Overwritten at each checkpoint (see docs/prompts/checkpoint.md)._

## Task5 route/schema · C2 · [#28](https://github.com/Backpacked333/sorcerer-apprentice-/pull/28)

- Done, pending landing: bounded AI SDK 7 structured generation, nullable wire schema/clean API state, normalized IDs/list suppression, posted/blocked distinction, sanitized errors and keyless 503. Oversized-image stack exhaustion is fixed; the image-field cap is after JSON parsing, not a whole-body streaming limit.
- Automated: 36 mocked route/schema tests and 229 full-suite tests, typecheck, production build and CI passed; baseline tests reproduced the old SDK behavior and oversized-image failure. No paid provider calls, reseeding or deployment.
- Human/live verification: none. Provider accuracy/latency, screenshot prompt-injection resistance, actual UI and human timing remain untested. No claim of human-verified behavior or provider zero retention.
- Blocked/integration: [#33](https://github.com/Backpacked333/sorcerer-apprentice-/pull/33) supplies the separate pipeline; D [#23](https://github.com/Backpacked333/sorcerer-apprentice-/issues/23) must visibly distinguish current On hold/Posted status and persistent successful Posted banners from blocked/held wording. ERP control events remain DOM-sourced; banner integration is still open.
- Next: land after independent approval; then integrate #33/D's UI; add a mocked/non-mutating eval harness before any explicitly approved keyed evaluation. Task6 hold/merge and Task7/8 crop/masks remain separate.
- Manual check after integration (not run): share a sandbox invoice, change a field, compare its event/source badge, cancel a save and verify no save boundary, then save successfully and verify exactly one Posted boundary; repeat a blocked save. Keyed network checks require approval; ask a human to judge timing/phrasing.

## Done and merged (WP ids)

- [PR #26](https://github.com/Backpacked333/sorcerer-apprentice-/pull/26) merged as [38b3ccd](https://github.com/Backpacked333/sorcerer-apprentice-/commit/38b3ccd): private-agent/TTS deployment defaults, full governor tuning examples, and persistent `DATA_DIR` guidance (N2/C3). No secrets included.

## PR prepared (not merged)

- [PR #29](https://github.com/Backpacked333/sorcerer-apprentice-/pull/29), `b/contracts`: WB-4 shared event/hello contracts, filesystem media/ERP/guard APIs, local workspace stub and regression tests. Optional additions preserve existing callers; Lane C integration remains.
- At [source revision ab06647](https://github.com/Backpacked333/sorcerer-apprentice-/commit/ab06647a70eb31851c31a9b5d3dc87a14532c5dd), automated checks passed: typecheck, 210 tests across 18 files, production build and CI. Four review regressions failed before the guard recency/input snapshot, workspace scheduling and ERP entry-shape fixes. Documentation-only compliance update adds no source changes.

## Verified live by a human (who, when, what they did)

None reported for either PR; all results below are automated. No human verification, UI/browser testing, live-provider calls or deployed-storage testing was performed for PR #29.

## Not verified yet (and the script to verify)

- After C/D integration, a human should capture a session, replay a URL-backed frame from its Work Map, start Teach from a confirmed map, exercise the before-save guard, and confirm explicit reset disarms it. Record who/when and the observed result; automated tests do not establish human timing or voice behavior.
- No human/live deployment check. After deployment, inspect `/api/health` and exercise a real voice pause; environment examples alone do not enable private-agent token exchange.

## Blocked on (lane, handshake id, what exactly)

- Parent owns review and landing of PR #29; it remains prepared and unmerged, with no auto-merge enabled.
- C / P-21, P-25 ([#24](https://github.com/Backpacked333/sorcerer-apprentice-/issues/24)): migrate `lib/erp.ts` to store APIs and wire request workspace identity. `currentWorkspace()` returns `"local"`; per-visitor isolation is not delivered.
- C/D / P-1 ([#24](https://github.com/Backpacked333/sorcerer-apprentice-/issues/24), [#23](https://github.com/Backpacked333/sorcerer-apprentice-/issues/23)): render `frame.url ?? frame.dataUrl` in Teach and WorkMap replay consumers. A/D hello/reannounce producer/subscriber wiring also remains outside this PR.

- Railway dashboard setup and lane A private-agent integration; CODEOWNERS usernames remain outstanding. PR #26 is already merged.

## Next 3 things

1. Parent completes review and lands PR #29 and dependencies in the approved order.
2. Owning lanes integrate store, telemetry and frame contracts, then re-run the keyless gate on landed main; do not treat optional metadata as isolation or automatic wiring.
3. Complete the live Railway and post-integration human browser/audio checks above, recording results before claiming readiness or live verification.

## Risks I see for the demo

- Local workspace default is shared, not per-visitor isolation. ERP object-entry validation is not full invoice-field validation.
- Production build passes with two dynamic-filesystem tracing warnings; deployment size/tracing remains untested.
