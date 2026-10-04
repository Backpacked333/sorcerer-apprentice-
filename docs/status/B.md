# Lane B status

_Updated by the lane's AI on every PR. Overwritten at each checkpoint (see docs/prompts/checkpoint.md)._

## Done and merged (WP ids)

None from this PR yet.

## Prepared (not merged)

- PR #34 prepared, not merged (N2): isolated production smoke gate, credential/dotenv exclusion, owned-server marker, console assertions and cancellation-safe cleanup. Branch typecheck/198 tests and independent diff review passed. Clean local integration: 236 tests and two smoke runs passed; deliberate 409→200 failed correctly; SIGTERM removed data and released the port.
- Updated for the landed experience surface: preserve test-ID selectors and the independent HTTP 409 assertion, open the mechanism before waiting for Governor, and use the current posting controls. Branch syntax, typecheck, 262 tests and production build pass; full smoke on this revision still requires the landing dependencies.
- Fresh review found an orphaned tsx descendant on forced shutdown. Build/seed/server now own POSIX process groups; regression covers a descendant surviving its launcher. Typecheck and 263 branch tests pass. A local combined integration passes 419 tests and production smoke with the app's text-only speech fallback (headless audio is unavailable); real audio remains untested.

## Verified live by a human (who, when, what they did)

None reported; all results below are automated.

## Not verified yet (and the script to verify)

- No human/live verification, real microphone, screen picker, paid-provider accuracy or voice timing check. After dependencies land, run `npm run smoke` twice from clean main; then use a fresh Chrome profile for the real Capture → Map → Teach flow.

## Blocked on (lane, handshake id, what exactly)

- Landing #29 → #30 → #27; Roy approved this PR's merge. Install matching Chromium with `npx playwright install chromium --only-shell`. No lint script is configured; typecheck, tests and production build are the available code gates.

## Next 3 things

- Land the approved dependencies in order.
- Re-run the keyless gate on landed main.
- Complete the live Railway and human browser/audio checks before claiming readiness.

## Risks I see for the demo
