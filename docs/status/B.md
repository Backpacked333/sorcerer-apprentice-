# Lane B status

_Updated by the lane's AI on every PR. Overwritten at each checkpoint (see docs/prompts/checkpoint.md)._

## Done and merged (WP ids)

## Verified live by a human (who, when, what they did)

## Not verified yet (and the script to verify)

## Blocked on (lane, handshake id, what exactly)

## Next 3 things

## Risks I see for the demo

## Task6 — pure merge engine (pending review; not wired)
- Done: isolated `b/merge` slice, `lib/merge.ts` and fake-timer tests. Held/late corroboration preserves honest source, ERP time/mode/state; controls bypass holds in every source mode; typing/debounce, queue/session filters, pause/reset/strike cancellation, latency-based holds and counters are covered.
- Automated: 24 engine tests pass. Four mocked scenarios fail against the unchanged baseline hook (vision-mode controls, `holdMs: 0`, asset coalescing, merged mode/time/state); equivalent engine scenarios pass. This does not fix the running hook yet.
- Human/live verification: none. No provider calls, browser testing, reseeding, deployment or merges. Actual repaint/sent-frame selection, screen sharing, latency and intervention-before-save remain unverified.
- Next/blocked: wire the hook after #33 and the shared telemetry contracts land, including epoch guards, hello/reannounce, repeated static-frame candidates, frame delivery and A/C `enabled`/queue/session/`holdMs: 0` adoption. Route/UI Posted integration (#28, #23), crop/masks and eval remain separate. CODEOWNERS registration remains with the parent (CI/ownership files are outside this assignment).
- Manual follow-up (not run): after wiring, turn vision on in Teach; edit a field in coached and independent cases, confirm the coached intervention precedes Save and the independent case stays silent; inspect honest badges, then pause/strike and check no queued event or frame appears. A human must record the timing result.
