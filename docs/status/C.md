# Lane C status

_Updated by the lane's AI on every PR. Overwritten at each checkpoint (see docs/prompts/checkpoint.md)._

## Done and merged (WP ids)

## Verified live by a human (who, when, what they did)

## Not verified yet (and the script to verify)

## Blocked on (lane, handshake id, what exactly)

- C0 subset (`c/workmap-contracts`, not merged): P-6/P-16/P-17 — optional evidence, stop quote/recipient, seen categories/entities/suppliers, and save-verdict missing condition. Old stored shapes remain valid. Teach-back explicitly leaves an unnamed recipient unresolved. Broader provenance/replay, trigger/attempts, superseded quotes, seen flags and persisted teach-back additions await Roy's approval.
- Verified locally: typecheck, 46 tests (nine new compatibility cases), production build and isolated seed (10 steps / 3 judgments / 3 rules / 5 open slots; confirmed twin 3 rules / 0 open slots). No lint script exists.
- Landing dependencies: B's export and autopilot text interpolate `stopAndAsk.who`; land the separate `c/export-unknown-recipient` and `c/autopilot-unknown-recipient` single-file courtesy fixes first. An unnamed stop is already reachable through map PUT once this schema lands, even without new compiler producers. Live-provider, browser and human validation are not run; D's seam split and live keys remain unavailable.

## Next 3 things

## Risks I see for the demo
