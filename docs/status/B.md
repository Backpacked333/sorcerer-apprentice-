# Lane B status

_Updated by the lane's AI on every PR. Overwritten at each checkpoint (see docs/prompts/checkpoint.md)._

## Done and merged (WP ids)

## Verified live by a human (who, when, what they did)

## Not verified yet (and the script to verify)

## Blocked on (lane, handshake id, what exactly)

## Next 3 things

## Risks I see for the demo

## Task5 pipeline · C2 · [#33](https://github.com/Backpacked333/sorcerer-apprentice-/pull/33)

- Done, pending landing: isolated visual diff and honest provenance; shared normalized invoice identities; list suppression; asset entered/cleared; observed-success saves deduplicated across Cancel; retained combined invoice state; HTTP-200-only counters; keyless shutdown; 9-second request timeout; 15-minute screen-capture cap that stops telemetry/held events until a new Start.
- Automated: 31 mocked diff/hook regressions and 224 full-suite tests, typecheck, production build and CI passed. Five final-review regressions failed before fixes, including Cancel beyond five seconds and immediate/held DOM identity matching. No source changes in this documentation update.
- Human/live verification: none. Actual browser sharing/timers, privacy/crop behavior, provider accuracy/latency, UI integration, prompt-injection resistance and human timing/phrasing remain untested; no paid calls, reseeding or deployment.
- Blocked/integration: route/schema [#28](https://github.com/Backpacked333/sorcerer-apprentice-/pull/28) supplies `banner`; D [#23](https://github.com/Backpacked333/sorcerer-apprentice-/issues/23) supplies visible On hold/Posted status, a persistent successful Posted banner and distinct blocked/held wording. Visual-save integration remains open, not verified by the mocked tests.
- Next: independent approval/landing, then Task6 hold/merge replacement, supplemental ERP metadata during corroboration, ERP controls in every source mode and broader session lifecycle (including no-screen/manual-stop sessions). Task7/8 crop/masks and mocked/non-mutating eval remain separate; live keyed eval needs approval.
- Manual check after integration (not run): compare DOM/vision badges on one invoice; save, reopen confirmation, wait beyond five seconds and Cancel (no second save); switch invoices and check state isolation; verify a blocked save has no success boundary; reach the capture cap and confirm telemetry stops, then restart. A human must assess timing; no-screen session lifetime is still Task6.
