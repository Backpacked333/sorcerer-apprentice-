# Lane B status

_Updated by the lane's AI on every PR. Overwritten at each checkpoint (see docs/prompts/checkpoint.md)._

## Done and merged (WP ids)

In progress on `B/durable-vercel-product` (not merged): Supabase + Vercel deployment work authorized by Roy across lanes. PostgreSQL/Storage provisioned; migration applied. Anonymous cookie workspaces, fail-closed Supabase selection, private media, bounded uploads, durable rate limits, ERP isolation, and serialized session sync are implemented. Confirmation/export safety and finite AI SDK provider schemas are included as required dependencies (N2, M1–M3, T1–T3).

## Live deployment

Production: [https://tacit-ai-apprentice.vercel.app](https://tacit-ai-apprentice.vercel.app), currently deployed from `ddc1cf1`. HTTP-only smoke checks verified public root/health access, reachable Supabase storage, cookie-workspace isolation, PNG/WebM uploads and private reads, and rejection of draft export/Teach creation. The health response reports voice and gateway integrations degraded/not configured.

The production smoke exposed stale Storage CDN bytes after evidence withdrawal. The lead's direct HTTP diagnostics isolated the response to CDN caching; this branch adds a per-download `cacheNonce` with `no-store` and zero upload cache lifetime. The cache fix is **awaiting redeploy and live retest**; do not claim evidence-withdrawal cache behavior is resolved on the deployed build.

## Human acceptance (who, when, what they did)

No live human, voice/timing, rendered UI, or real-provider acceptance is claimed. Production verification to date was HTTP-only, not browser testing.

## Automated verification

The latest previously verified full suite passed `npm run test`: 23 files, 219 tests. It was not repeated for this cache-only follow-up. This follow-up passed `npx vitest run lib/store.durable.test.ts` (1 file, 6 tests), `npm run typecheck`, and `npm run build`. A prior local keyless HTTP smoke returned `demo_sabine` and `demo_sabine_confirmed` from `GET /api/sessions` under `STORAGE_BACKEND=local STORE_OWNER_ID=local`. Vercel CLI 62.2.0 is available and the project is linked; no deployment is being run here.

## Not verified yet (and the script to verify)

Real-provider connectivity and voice/screen-vision acceptance. Follow the README competition acceptance run: three live questions including a guardrail, three distinct debrief answers, evidence review and explicit confirmation, then a wrong decision on an unseen case caught before save.

## Blocked on (lane, handshake id, what exactly)

Lead-owned redeployment and live retest of the media cache fix, plus a human wearing headphones for the competition acceptance run. Optional German, MCP and two-expert stretches remain deferred behind core acceptance.

## Next 3 things

1. Redeploy the cache-bypass fix and repeat the evidence-withdrawal HTTP check.
2. Run the README competition acceptance with real providers and a human wearing headphones.
3. Complete the separate CI review after push.

## Risks I see for the demo

Cache-withdrawal behavior is not verified on the deployed fix; real-provider connectivity, voice timing, and the rendered UI have not been manually verified.
