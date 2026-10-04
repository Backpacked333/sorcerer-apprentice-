# Lane B status

_Updated by the lane's AI on every PR. Overwritten at each checkpoint (see docs/prompts/checkpoint.md)._

## [PR #27](https://github.com/Backpacked333/sorcerer-apprentice-/pull/27) — N2: CI/runtime configuration (merged)

- Done: Node 22 `check`, PR-only cancellation, worktree exclusions, runtime `tsx`, smoke/start commands and Cloudflare dev origins; seven baseline-failing structural regressions now pass.
- Automated: typecheck, full unit tests and production build pass. No human live verification; browser smoke, tunnel access, deployment and production startup remain untested.
- Merged after independent review and green CI; dependencies #29/#30 are merged, including the seeder's tested `--if-missing` behavior. This PR only wires the command; live production startup remains untested. No reseeding or paid calls performed.

## Done and merged (WP ids)

- [PR #26](https://github.com/Backpacked333/sorcerer-apprentice-/pull/26) merged as [38b3ccd](https://github.com/Backpacked333/sorcerer-apprentice-/commit/38b3ccd): private-agent/TTS deployment defaults, full governor tuning examples, and persistent `DATA_DIR` guidance (N2/C3). No secrets included.

- [PR #29](https://github.com/Backpacked333/sorcerer-apprentice-/pull/29) merged as [3b5cf39](https://github.com/Backpacked333/sorcerer-apprentice-/commit/3b5cf39): WB-4 shared event/hello contracts, filesystem media/ERP/guard APIs, local workspace stub and regression tests. Optional additions preserve existing callers; Lane C integration remains.
- At [source revision ab06647](https://github.com/Backpacked333/sorcerer-apprentice-/commit/ab06647a70eb31851c31a9b5d3dc87a14532c5dd), automated checks passed: typecheck, 210 tests across 18 files, production build and CI. Four review regressions failed before the guard recency/input snapshot, workspace scheduling and ERP entry-shape fixes. Documentation-only compliance update adds no source changes.

- [PR #30](https://github.com/Backpacked333/sorcerer-apprentice-/pull/30) merged as [ee515c8](https://github.com/Backpacked333/sorcerer-apprentice-/commit/ee515c8) (N2): non-destructive sample boot, incomplete-pair preflight, and fail-closed health/readiness. Automated boot/health tests, build and CI passed before landing; deployed startup remains untested.

## Prepared (not merged)

- PR #34 prepared, not merged (N2): isolated production smoke gate, credential/dotenv exclusion, owned-server marker, console assertions and cancellation-safe cleanup. Branch typecheck/198 tests and independent diff review passed. Clean local integration: 236 tests and two smoke runs passed; deliberate 409→200 failed correctly; SIGTERM removed data and released the port.
- Updated for the landed experience surface: preserve test-ID selectors and the independent HTTP 409 assertion, open the mechanism before waiting for Governor, and use the current posting controls. Branch syntax, typecheck, 262 tests and production build pass; full smoke on this revision still requires the landing dependencies.
- Fresh review found an orphaned tsx descendant on forced shutdown. Build/seed/server now own POSIX process groups; regression covers a descendant surviving its launcher. Typecheck and 263 branch tests pass. A local combined integration passes 419 tests and production smoke with the app's text-only speech fallback (headless audio is unavailable); real audio remains untested.

## Verified live by a human (who, when, what they did)

None reported; all results below are automated. No human verification, UI/browser testing, live-provider calls or deployed-storage testing was performed for PR #29.

## Not verified yet (and the script to verify)

- After C/D integration, a human should capture a session, replay a URL-backed frame from its Work Map, start Teach from a confirmed map, exercise the before-save guard, and confirm explicit reset disarms it. Record who/when and the observed result; automated tests do not establish human timing or voice behavior.
- No human/live deployment check. After deployment, inspect `/api/health` and exercise a real voice pause; environment examples alone do not enable private-agent token exchange.

- On an approved isolated persistent-volume deployment, edit sample data and restart; verify preservation and inspect health before/after removing a sample pair. No deployment or human verification has been performed.

## Blocked on (lane, handshake id, what exactly)

- Remaining approved order: #28 → #34 → #32 → #33. Deployment remains unapproved.
- C / P-21, P-25 ([#24](https://github.com/Backpacked333/sorcerer-apprentice-/issues/24)): migrate `lib/erp.ts` to store APIs and wire request workspace identity. `currentWorkspace()` returns `"local"`; per-visitor isolation is not delivered.
- C/D / P-1 ([#24](https://github.com/Backpacked333/sorcerer-apprentice-/issues/24), [#23](https://github.com/Backpacked333/sorcerer-apprentice-/issues/23)): render `frame.url ?? frame.dataUrl` in Teach and WorkMap replay consumers. A/D hello/reannounce producer/subscriber wiring also remains outside this PR.

- Railway dashboard setup and lane A private-agent integration; CODEOWNERS usernames remain outstanding. PR #26 is already merged.

## Next 3 things

1. Parent completes review and lands the remaining dependencies in the approved order.
2. Owning lanes integrate store, telemetry and frame contracts, then re-run the keyless gate on landed main; do not treat optional metadata as isolation or automatic wiring.
3. Complete the live Railway and post-integration human browser/audio checks above, recording results before claiming readiness or live verification.

## Risks I see for the demo

- Local workspace default is shared, not per-visitor isolation. ERP object-entry validation is not full invoice-field validation.
- Production build passes with two dynamic-filesystem tracing warnings; deployment size/tracing remains untested.
