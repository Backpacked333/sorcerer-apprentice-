# Lane B status

_Updated by the lane's AI on every PR. Overwritten at each checkpoint (see docs/prompts/checkpoint.md)._

## Done and merged (WP ids)

In progress on `B/durable-vercel-product` (not merged): Supabase + Vercel deployment work authorized by Roy across lanes. PostgreSQL/Storage provisioned; migration applied. Anonymous cookie workspaces, fail-closed Supabase selection, private media, bounded uploads, durable rate limits, ERP isolation, and serialized session sync are implemented. Confirmation/export safety and finite AI SDK provider schemas are included as required dependencies (N2, M1–M3, T1–T3).

## Human acceptance (who, when, what they did)

No live human, voice/timing, rendered UI, or real-provider acceptance is claimed.

## Automated verification

Follow-up checks on `B/durable-vercel-product`: `npx vitest run lib/store.durable.test.ts lib/uploads.test.ts lib/recording-consent.test.ts lib/health.test.ts` passed (4 files, 20 tests); `npm run typecheck` passed; `npm run build` passed. A local keyless HTTP smoke passed: `GET /api/sessions` under `STORAGE_BACKEND=local STORE_OWNER_ID=local` returned `demo_sabine` and `demo_sabine_confirmed`. The earlier full-suite run passed 21 files / 212 tests and was not repeated for this follow-up. Vercel CLI 62.2.0 authenticated and linked the existing project; no deployment was run.

## Not verified yet (and the script to verify)

Real-provider connectivity and voice/screen-vision acceptance. Follow the README competition acceptance run: three live questions including a guardrail, three distinct debrief answers, evidence review and explicit confirmation, then a wrong decision on an unseen case caught before save.

## Blocked on (lane, handshake id, what exactly)

Lead-owned deployment and a human wearing headphones for the competition acceptance run. Optional German, MCP and two-expert stretches remain deferred behind core acceptance.

## Next 3 things

1. Deploy with the provisioned Vercel project and verify `/api/health` against Supabase.
2. Run the README competition acceptance with a human wearing headphones.
3. Complete the separate CI review after push.

## Risks I see for the demo

Production connectivity, voice timing, and the rendered UI have not been manually verified.
