## Oct 4 · V4 release deployment [S1]

Deployed the focused V4 provisioning revision `b1a8af2` from live durable-storage base `c51b9f3`, without introducing the newer integration branch's UI/voice changes. Production health reports voice configured and Supabase reachable. The first live check exposed Gateway's environment-only readiness guard: Vercel supplies OIDC through request context. The fix uses `getVercelOidcTokenSync()` with API-key/local-token support and fails closed when credentials are absent. Typecheck and 225 tests pass (25 files). Redeploy and real vision/compile checks remain pending. No human audio/UI acceptance is claimed.

The checkpoint below records earlier deployment evidence, not the current live provider status.

# Lane B status

_Updated by the lane's AI on every PR. Overwritten at each checkpoint (see docs/prompts/checkpoint.md)._

## Done and merged (WP ids)

In progress on `B/durable-vercel-product` (not merged): Supabase + Vercel deployment work authorized by Roy across lanes. PostgreSQL/Storage provisioned; migration applied. Anonymous cookie workspaces, fail-closed Supabase selection, private media, bounded uploads, durable rate limits, ERP isolation, and serialized session sync are implemented. Confirmation/export safety and finite AI SDK provider schemas are included as required dependencies (N2, M1–M3, T1–T3).

## Live deployment

Production: [https://tacit-ai-apprentice.vercel.app](https://tacit-ai-apprentice.vercel.app), currently deployed from `c51b9f3` (`dpl_8cB6Wci8xxxMSX3GpeuLu45o9ukN`). Earlier HTTP-only smoke checks verified public root/health access, reachable Supabase storage, cookie-workspace isolation, PNG/WebM uploads and private reads, and rejection of draft export/Teach creation. Those broader checks were not repeated after this redeploy.

The narrow HTTP retest on `c51b9f3` uploaded valid PNG and WebM fixtures, persisted their references, warmed and byte-compared separate reads, withdrew both references once, and immediately reattached metadata only. The first reads after reattachment returned 404 for both media routes. References were then removed and verified absent. Health returned 200 with Supabase configured and reachable; voice and gateway remain degraded/not configured. The test was HTTP-only, not a browser or real-provider test. The current merge integration has not been HTTP/UI retested and is not deployed.

## Human acceptance (who, when, what they did)

No live human, voice/timing, rendered UI, or real-provider acceptance is claimed. Production verification to date was HTTP-only, not browser testing.

## Automated verification

The latest previously verified full suite passed `npm run test`: 23 files, 219 tests. It was not repeated for the cache-only follow-up or these documentation changes. The cache follow-up passed `npx vitest run lib/store.durable.test.ts` (1 file, 6 tests), `npm run typecheck`, and `npm run build`. PR #36's `check` job passed on `c51b9f3`. A prior local keyless HTTP smoke returned `demo_sabine` and `demo_sabine_confirmed` from `GET /api/sessions` under `STORAGE_BACKEND=local STORE_OWNER_ID=local`. The Vercel CLI smoke-session error/fatal query returned zero records; Vercel log-drain configuration was not inspected.

## Not verified yet (and the script to verify)

Real-provider connectivity and voice/screen-vision acceptance. Follow the README competition acceptance run: three live questions including a guardrail, three distinct debrief answers, evidence review and explicit confirmation, then a wrong decision on an unseen case caught before save.

## Blocked on (lane, handshake id, what exactly)

Real-provider configuration and a human wearing headphones for the competition acceptance run remain outstanding. Optional German, MCP and two-expert stretches remain deferred behind core acceptance.

## Next 3 things

1. Configure the real voice and AI Gateway integrations.
2. Run the README competition acceptance with a human wearing headphones.
3. Review Vercel log-drain/monitoring configuration if operational visibility is needed.

## Risks I see for the demo

Real-provider connectivity, voice timing, and the rendered UI have not been manually verified. Vercel log-drain configuration has not been checked.
