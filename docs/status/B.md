# Lane B status

_Updated by the lane's AI on every PR. Overwritten at each checkpoint (see docs/prompts/checkpoint.md)._

## Done and merged (WP ids)

- PR #30 prepared, not merged (N2): `seedDemo({ifMissing:true})` preserves existing records and preflights incomplete pairs; `/api/health` fails closed on missing/corrupt samples. Automated boot/health tests and build passed.

## Verified live by a human (who, when, what they did)

## Not verified yet (and the script to verify)

- No human/live deployment check. On an isolated persistent-volume deployment, edit sample data, restart, and check it survives; inspect `/api/health` before/after deliberately removing a sample pair.

## Blocked on (lane, handshake id, what exactly)

- Specific merge approval and Railway setup. Persisted-guard reset integration follows the storage PR; explicit demo reset remains separate.

## Next 3 things

## Risks I see for the demo
