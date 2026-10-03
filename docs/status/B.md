# Lane B status

_Updated by the lane's AI on every PR. Overwritten at each checkpoint (see docs/prompts/checkpoint.md)._

## Done and merged (WP ids)

In progress on `B/durable-vercel-product` (not merged): Supabase + Vercel deployment work authorized by Roy across lanes. PostgreSQL/Storage provisioned; migration applied. Anonymous cookie workspaces, fail-closed Supabase selection, private media, bounded uploads, durable rate limits, ERP isolation, and serialized session sync are implemented. Confirmation/export safety and finite AI SDK provider schemas are included as required dependencies (N2, M1–M3, T1–T3).

## Verified live by a human (who, when, what they did)

Automated checks on `B/durable-vercel-product`: `npx vitest run lib/product.test.ts` passed (5 tests); `lib/store.durable.test.ts` passed (4 tests); `npm run typecheck` passed; `npm run test` passed (20 files, 209 tests); `npm run build` passed. No live human or voice/timing acceptance is claimed.

## Not verified yet (and the script to verify)

Real ElevenLabs voice and screen-vision acceptance. Follow the README competition acceptance run: three live questions including a guardrail, three distinct debrief answers, evidence review and explicit confirmation, then a wrong decision on an unseen case caught before save.

## Blocked on (lane, handshake id, what exactly)

ElevenLabs credentials/agent provisioning and a human wearing headphones. Optional German, MCP and two-expert stretches remain deferred behind core acceptance.

## Next 3 things

1. Deploy with the provisioned Vercel project and verify `/api/health` against Supabase.
2. Run the README competition acceptance with a human wearing headphones.
3. Complete the separate CI review after push.

## Risks I see for the demo

Production connectivity, voice timing, and the rendered UI have not been manually verified.
