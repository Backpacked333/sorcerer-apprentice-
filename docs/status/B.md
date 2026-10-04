# Lane B status

_Updated by the lane's AI on every PR. Overwritten at each checkpoint (see docs/prompts/checkpoint.md)._

## Done and merged (WP ids)

- [PR #26](https://github.com/Backpacked333/sorcerer-apprentice-/pull/26) merged as [38b3ccd](https://github.com/Backpacked333/sorcerer-apprentice-/commit/38b3ccd): private-agent/TTS deployment defaults, full governor tuning examples, and persistent `DATA_DIR` guidance (N2/C3). No secrets included.

- [PR #29](https://github.com/Backpacked333/sorcerer-apprentice-/pull/29), merged: WB-4 shared event/hello contracts, filesystem media/ERP/guard APIs, local workspace stub and regression tests. Optional additions preserve existing callers; Lane C integration remains.
- At [source revision ab06647](https://github.com/Backpacked333/sorcerer-apprentice-/commit/ab06647a70eb31851c31a9b5d3dc87a14532c5dd), automated checks passed: typecheck, 210 tests across 18 files, production build and CI. Four review regressions failed before the guard recency/input snapshot, workspace scheduling and ERP entry-shape fixes. Documentation-only compliance update adds no source changes.

## Prepared (not merged)

- PR #30 (N2): non-destructive sample boot, incomplete-pair preflight, and fail-closed health/readiness. Previous boot/health tests and build passed; checks are being refreshed against current main.

## Verified live by a human (who, when, what they did)

None reported; all results below are automated. No human verification, UI/browser testing, live-provider calls or deployed-storage testing was performed for PR #29.

## Not verified yet (and the script to verify)

- After C/D integration, a human should capture a session, replay a URL-backed frame from its Work Map, start Teach from a confirmed map, exercise the before-save guard, and confirm explicit reset disarms it. Record who/when and the observed result; automated tests do not establish human timing or voice behavior.
- No human/live deployment check. After deployment, inspect `/api/health` and exercise a real voice pause; environment examples alone do not enable private-agent token exchange.

- On an approved isolated persistent-volume deployment, edit sample data and restart; verify preservation and inspect health before/after removing a sample pair. No deployment or human verification has been performed.

## Blocked on (lane, handshake id, what exactly)

- PR #30 is approved but still unmerged; remaining platform dependencies must land in order.
- C / P-21, P-25 ([#24](https://github.com/Backpacked333/sorcerer-apprentice-/issues/24)): migrate `lib/erp.ts` to store APIs and wire request workspace identity. `currentWorkspace()` returns `"local"`; per-visitor isolation is not delivered.
- C/D / P-1 ([#24](https://github.com/Backpacked333/sorcerer-apprentice-/issues/24), [#23](https://github.com/Backpacked333/sorcerer-apprentice-/issues/23)): render `frame.url ?? frame.dataUrl` in Teach and WorkMap replay consumers. A/D hello/reannounce producer/subscriber wiring also remains outside this PR.

- Railway dashboard setup and lane A private-agent integration; CODEOWNERS usernames remain outstanding. PR #26 is already merged.

## Next 3 things

1. Parent completes review and lands PR #30 and remaining dependencies in the approved order.
2. Owning lanes integrate store, telemetry and frame contracts, then re-run the keyless gate on landed main; do not treat optional metadata as isolation or automatic wiring.
3. Complete the live Railway and post-integration human browser/audio checks above, recording results before claiming readiness or live verification.

## Risks I see for the demo

- Local workspace default is shared, not per-visitor isolation. ERP object-entry validation is not full invoice-field validation.
- Production build passes with two dynamic-filesystem tracing warnings; deployment size/tracing remains untested.

## Task6 — pure merge engine (pending review; not wired)
- Done: isolated `b/merge` slice, `lib/merge.ts` and fake-timer tests. Held/late corroboration preserves honest source, ERP time/mode/state; controls bypass holds in every source mode; typing/debounce, queue/session filters, pause/reset/strike cancellation, latency-based holds and counters are covered.
- Automated: 24 engine tests pass. Four mocked scenarios fail against the unchanged baseline hook (vision-mode controls, `holdMs: 0`, asset coalescing, merged mode/time/state); equivalent engine scenarios pass. This does not fix the running hook yet.
- Human/live verification: none. No provider calls, browser testing, reseeding, deployment or merges. Actual repaint/sent-frame selection, screen sharing, latency and intervention-before-save remain unverified.
- Next/blocked: wire the hook after #33 and the shared telemetry contracts land, including epoch guards, hello/reannounce, repeated static-frame candidates, frame delivery and A/C `enabled`/queue/session/`holdMs: 0` adoption. Route/UI Posted integration (#28, #23), crop/masks and eval remain separate. CODEOWNERS registration remains with the parent (CI/ownership files are outside this assignment).
- Manual follow-up (not run): after wiring, turn vision on in Teach; edit a field in coached and independent cases, confirm the coached intervention precedes Save and the independent case stays silent; inspect honest badges, then pause/strike and check no queued event or frame appears. A human must record the timing result.
