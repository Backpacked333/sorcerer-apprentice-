# Lane C status

## Background inference integration (Roy-authorized; C1/C3/M2)
- Added proposed, evidence-linked role profiles compiled alongside rules and persisted in
  WorkMap. Read-time revalidation removes withdrawn/changed sources. Profiles are visible
  for review but do not become tutor rules upon map confirmation.
- Migrated rule inference to AI SDK 7 structured output with flat wire schema, local JSON
  condition validation, high reasoning, bounded timeout and finalized expert-only quotes.
- Model IDs checked against the live Gateway catalog. Real inference, held-out semantic
  accuracy, multilingual coverage, live voice and human acceptance remain unverified.
- Sonnet 5.5 high reasoning through Gateway; single-flight Capture analysis, shadow default,
  opt-in live packets with exact-state/expiry validation at voice dispatch.
- Keyless/failure paths preserve deterministic Capture. Mocked route and packet tests pass.
- Next: profile persistence/Map visibility; no live provider or human timing acceptance yet.

_Updated by the lane's AI on every PR. Overwritten at each checkpoint (see docs/prompts/checkpoint.md)._

## Done and merged (WP ids)

- S0 merged in [#5](https://github.com/Backpacked333/sorcerer-apprentice-/pull/5): six internal compiler modules, all ten public exports retained. Independent review compared 4,768 exact base/head snapshots; this is behavior parity, not semantic acceptance.
- S4 merged in [#6](https://github.com/Backpacked333/sorcerer-apprentice-/pull/6): 71 synthetic fixtures covering all 60 appendix rows (63 utterances), four arbitrary-name/value variants and four adverse-evidence cases. Integrity tests do not prove compiler acceptance.
- Dependencies landed: B's unnamed-recipient export/autopilot repairs (#10/#11), D's controller/view split (#18), and A's VoiceApi turn adapter (#41).

## This prerequisite PR (C0)

- [#8](https://github.com/Backpacked333/sorcerer-apprentice-/pull/8) lands only P-6/P-16/P-17's pre-approved subset: optional quote evidence, stop-specific quote/recipient, seen categories/entities/suppliers, and save-verdict missing text. Legacy maps still parse; unnamed recipients stay unresolved.
- Combined prerequisite source on current main: typecheck, 277 tests and production build pass. Named, absent and empty recipient consumers and guard preservation were also checked in disposable integration probes during review. No lint script exists.

## Verified live by a human (who, when, what they did)

- None reported for Lane C.

## Not verified yet (and the script to verify)

- No live model, browser, microphone, voice timing or human-understanding verification in this wave. After WC-1, run the corpus through the injected validator and live-key compile, then collect human phrasing and recorded provider fixtures.
- Human check after implementation: teach an arbitrary rule, correct its scope, explicitly confirm the reread, then have a stranger attempt an unseen wrong decision and verify intervention before save. Do not claim M1/M2/M3 from these prerequisite tests.

## Blocked on (lane, handshake id, what exactly)

- Broader provenance/replay, trigger/attempts, superseded quotes, seen flags and persisted teach-back contracts still await Roy's approval; they are excluded here.
- Live AI Gateway / ElevenLabs credentials and human validation remain unavailable to this session. Remaining A/B event/store handshakes must be rechecked before their integration waves.

## Next 3 things

### Memory integration foundation (Roy-authorized cross-lane scope; C1/M2)

- Added bounded session projections, exact evidence checks, proposed role relationships
  and cancellable single-flight handoffs; no provider/model-owned memory or new storage.
- Focused memory tests and typecheck pass. Human/live-provider acceptance: not performed.
- Next: wire background reasoning to Capture and profile compilation to Map without
  bypassing the governor or turning proposed relationships into executable rules.
- Live Gateway validation awaits credentials; no merge, deployment or remote agent changes.

1. WC-1: flat model-facing schema, injected model call, eligible expert quotes, demonstrated replay and deterministic merge, preserving keyless fallback.
2. WC-5 truthfulness fixes and slots/readiness; distinguish transport failure, semantic rejection and valid-empty output.
3. Debrief/correction/confirmation and Teach integration in dependency order; use D's landed view-model seams, not JSX views.

## Risks I see for the demo

- The compiler split preserves known compiler defects. Synthetic fixture integrity and additive schema compatibility are not evidence of a grounded live compiler or successful stranger learning.
