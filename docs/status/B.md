# Lane B status

_Updated by the lane's AI on every PR. Overwritten at each checkpoint (see docs/prompts/checkpoint.md)._

## Task5 route/schema · C2 · [#28](https://github.com/Backpacked333/sorcerer-apprentice-/pull/28)

- Done, merged: bounded AI SDK 7 structured generation, nullable wire schema/clean API state, normalized IDs/list suppression, posted/blocked distinction, sanitized errors and keyless 503. Oversized-image stack exhaustion is fixed; the image-field cap is after JSON parsing, not a whole-body streaming limit.
- Automated: 36 mocked route/schema tests and 229 full-suite tests, typecheck, production build and CI passed; baseline tests reproduced the old SDK behavior and oversized-image failure. No paid provider calls, reseeding or deployment.
- Human/live verification: none. Provider accuracy/latency, screenshot prompt-injection resistance, actual UI and human timing remain untested. No claim of human-verified behavior or provider zero retention.
- Blocked/integration: [#33](https://github.com/Backpacked333/sorcerer-apprentice-/pull/33) supplies the separate pipeline; D [#23](https://github.com/Backpacked333/sorcerer-apprentice-/issues/23) must visibly distinguish current On hold/Posted status and persistent successful Posted banners from blocked/held wording. ERP control events remain DOM-sourced; banner integration is still open.
- Next: integrate #33/D's UI; add a mocked/non-mutating eval harness before any explicitly approved keyed evaluation. Task6 hold/merge and Task7/8 crop/masks remain separate.
- Manual check after integration (not run): share a sandbox invoice, change a field, compare its event/source badge, cancel a save and verify no save boundary, then save successfully and verify exactly one Posted boundary; repeat a blocked save. Keyed network checks require approval; ask a human to judge timing/phrasing.

## [PR #27](https://github.com/Backpacked333/sorcerer-apprentice-/pull/27) — N2: CI/runtime configuration (merged)

- Done: Node 22 `check`, PR-only cancellation, worktree exclusions, runtime `tsx`, smoke/start commands and Cloudflare dev origins; seven baseline-failing structural regressions now pass.
- Automated: typecheck, full unit tests and production build pass. No human live verification; browser smoke, tunnel access, deployment and production startup remain untested.
- Blocked/next: merged with dependencies #29/#30, including the seeder's tested `--if-missing` behavior. This PR only wires the command; live production startup remains untested. No reseeding or paid calls performed.

## Done and merged (WP ids)

- [PR #26](https://github.com/Backpacked333/sorcerer-apprentice-/pull/26) merged as [38b3ccd](https://github.com/Backpacked333/sorcerer-apprentice-/commit/38b3ccd): private-agent/TTS deployment defaults, full governor tuning examples, and persistent `DATA_DIR` guidance (N2/C3). No secrets included.

- [PR #29](https://github.com/Backpacked333/sorcerer-apprentice-/pull/29) merged as [3b5cf39](https://github.com/Backpacked333/sorcerer-apprentice-/commit/3b5cf39): WB-4 shared event/hello contracts, filesystem media/ERP/guard APIs, local workspace stub and regression tests. Optional additions preserve existing callers; Lane C integration remains.
- At [source revision ab06647](https://github.com/Backpacked333/sorcerer-apprentice-/commit/ab06647a70eb31851c31a9b5d3dc87a14532c5dd), automated checks passed: typecheck, 210 tests across 18 files, production build and CI. Four review regressions failed before the guard recency/input snapshot, workspace scheduling and ERP entry-shape fixes. Documentation-only compliance update adds no source changes.

- [PR #30](https://github.com/Backpacked333/sorcerer-apprentice-/pull/30) merged as [ee515c8](https://github.com/Backpacked333/sorcerer-apprentice-/commit/ee515c8) (N2): non-destructive sample boot, incomplete-pair preflight, and fail-closed health/readiness. Automated boot/health tests, build and CI passed before landing; deployed startup remains untested.

- [PR #27](https://github.com/Backpacked333/sorcerer-apprentice-/pull/27) merged as [858eb99](https://github.com/Backpacked333/sorcerer-apprentice-/commit/858eb99) (N2): CI/runtime configuration; detailed automated results and live-verification gaps above are preserved.

## Prepared (not merged)

- [PR #34](https://github.com/Backpacked333/sorcerer-apprentice-/pull/34) (N2): isolated production smoke with credential/dotenv exclusion, nonce ownership, strict capture/map/confirmation/tutor/independent-409/mastery/console assertions, and cancellation-safe POSIX process-group cleanup.
- Fresh independent review found and verified the fix for orphaned tsx descendants at `b88ef99`. The gate uses the app's existing text-only speech fallback because headless audio is unavailable; real audio remains untested.
- Automated: 316 tests, typecheck and production build passed with #27/#8; earlier combined integration passed production smoke, deliberate 409→200 failed correctly, and SIGTERM removed data/released the port. Two final landed-main runs remain required.

## Verified live by a human (who, when, what they did)

None reported; all results below are automated. No human verification, UI/browser testing, live-provider calls or deployed-storage testing was performed for PR #29.

## Not verified yet (and the script to verify)

- After C/D integration, a human should capture a session, replay a URL-backed frame from its Work Map, start Teach from a confirmed map, exercise the before-save guard, and confirm explicit reset disarms it. Record who/when and the observed result; automated tests do not establish human timing or voice behavior.
- No human/live deployment check. After deployment, inspect `/api/health` and exercise a real voice pause; environment examples alone do not enable private-agent token exchange.

- On an approved isolated persistent-volume deployment, edit sample data and restart; verify preservation and inspect health before/after removing a sample pair. No deployment or human verification has been performed.

## Blocked on (lane, handshake id, what exactly)

- Remaining approved order: #34 → #32 → #33. PRs #26/#29/#30/#27/#28 are merged; deployment remains unapproved.
- C / P-21, P-25 ([#24](https://github.com/Backpacked333/sorcerer-apprentice-/issues/24)): migrate `lib/erp.ts` to store APIs and wire request workspace identity. `currentWorkspace()` returns `"local"`; per-visitor isolation is not delivered.
- C/D / P-1 ([#24](https://github.com/Backpacked333/sorcerer-apprentice-/issues/24), [#23](https://github.com/Backpacked333/sorcerer-apprentice-/issues/23)): render `frame.url ?? frame.dataUrl` in Teach and WorkMap replay consumers. A/D hello/reannounce producer/subscriber wiring also remains outside this PR.

- Railway dashboard setup and lane A private-agent integration; CODEOWNERS usernames remain outstanding. PR #26 is already merged.

## Next 3 things

1. Parent completes review and lands PR #34 and remaining dependencies in the approved order.
2. Owning lanes integrate store, telemetry and frame contracts, then re-run the keyless gate on landed main; do not treat optional metadata as isolation or automatic wiring.
3. Complete the live Railway and post-integration human browser/audio checks above, recording results before claiming readiness or live verification.

## Risks I see for the demo

- Local workspace default is shared, not per-visitor isolation. ERP object-entry validation is not full invoice-field validation.
- Production build passes with two dynamic-filesystem tracing warnings; deployment size/tracing remains untested.

## [PR #32](https://github.com/Backpacked333/sorcerer-apprentice-/pull/32) — A5/P-24: PII helpers (not merged)

- Done: source-scoped DOM rectangles, crop projection, pre-encoding black painter and conservative text redaction; baseline-failing privacy regressions pass, including contiguous international phones and trailing business values.
- Automated: mocked geometry/canvas and text tests, typecheck, full tests and production build. No human live/network verification or browser/provider tests; helpers alone do not protect outgoing frames.
- Blocked/next: D adds actual `data-pii` fields and layout/scroll/resize publication; B pairs `sourceId` with the selected surface, enforces freshness and paints outgoing vision frames AND stored stills before encoding. Pipeline wiring remains open. After integration, a human must inspect sent/stored frames for masking during scrolling/cropping and publisher changes.
