# Lane C status

_Updated by the lane's AI on every PR. Overwritten at each checkpoint (see docs/prompts/checkpoint.md)._

## Done and merged (WP ids)

## Verified live by a human (who, when, what they did)

## Not verified yet (and the script to verify)

- S4 (`c/compile-corpus`): 71 synthetic fixtures cover all 60 appendix rows (63 utterances), four arbitrary-value/name variants and four adverse-evidence cases. Corpus integrity and the empty-expert-evidence smoke pass (44 tests total), independently reviewed; typecheck and unchanged seed/export outputs also pass. This PR is **not merged**.
- These are intended semantic oracles, **not** recorded model responses or proof the compiler satisfies the corpus. After WC-1, execute each through the injected validator and a live-key compile, then collect human phrasing and recorded provider fixtures. No live model, UI, microphone, voice timing or human-understanding verification has run; no lint script exists.

## Blocked on (lane, handshake id, what exactly)

## Next 3 things

## Risks I see for the demo
