# Lane B status — integrated release, Oct 4

## Done (N2, M1–M3, T1–T3, S1)

Roy authorized the cross-lane Supabase + Vercel integration. Preserved main’s voice turn adapter, screen-event grounding, privacy masks, compiler split, seed safety and keyless smoke, plus the parallel V4 Turbo/OIDC release.

Production uses cookie-isolated Supabase PostgreSQL/private Storage for sessions, maps, evidence, invoices, rate limits and guards. Local filesystem mode remains available for development. Added the per-teach-session guard compatibility migration; live SQL assertions verified ordering, invoice preservation, RLS and denied anonymous privileges.

Repaired three missing screen moments in the explicitly scripted sample rather than weakening confirmation. Fresh visitors can load that private sample from the home page without login or resetting their ERP/captures. Health distinguishes configuration from a successful provider request.

## CaptureLoop integration follow-up (C1–C3, N2, S1)

Merged main through `8164d6a`, retaining CaptureLoop window correlation, natural-pause decisions and ElevenAgents reconnection. Capture keeps ordered frame upload/session sync and retryable save errors. VoiceApi owns the single answer recorder; the optional consent-epoch callback now protects its pending microphone acquisition and clip uploads, including deletion after an off-record/upload race. Recorder chunks and session identity are captured before asynchronous shutdown.

Post-merge verification: typecheck, **502 tests across 57 files**, production build, isolated keyless smoke and diff checks pass. Six new HTTP upload/withdrawal regressions cover consent changes and rejected requests. No lint script is configured. This follow-up has **not** been deployed or verified live by a human; the production evidence below applies only to the pinned revision.

## Live deployment

- Public URL: https://tacit-ai-apprentice.vercel.app
- Runtime revision: [47a0fb2](https://github.com/Backpacked333/sorcerer-apprentice-/commit/47a0fb240254cc7f0662f80c2462cbb59fd3acdc)
- Deployment: `dpl_9kNuxT51cEFgows8s982nPAkvn12`, production READY, Next.js, 17-second remote build.
- Staged with production variables, tested, then promoted. Repeated the same 36 HTTP checks against the public URL **without Vercel authentication**.
- Both runs passed: private sample creation; cross-visitor isolation; durable session/PNG/WebM reads; upload type/size rejection; immediate media withdrawal after metadata-only reattachment; draft Teach/export rejection; persistent save guard; rejected wrong saves do not persist; stale-map saves fail closed.
- Smoke-scoped error/fatal log scan returned zero records. Log drains/long-term monitoring were not inspected.

## Automated and provider verification

- Typecheck, 482 tests across 54 files, and production build pass. No lint command is configured.
- The repository’s isolated keyless production smoke passed Capture, debrief/correction/confirmation, tutor intervention, independent save guard and mastery, with no page errors. This uses mocked browser audio, not real voice acceptance.
- PR #36 CI passed on runtime revision 47a0fb2; PR remains unmerged.
- The earlier Gateway billing restriction is resolved for the tested calls: production vision returned HTTP 200 with `anthropic/claude-haiku-4.5` (6,233 ms on a synthetic black image); production compile returned HTTP 200 with `llm: true` and three rules on the scripted example.
- Production Scribe issued a single-use token. No token was logged or committed. Token issuance does not verify streaming transcription or a spoken conversation.

## Human acceptance (who, when, what they did)

Still outstanding. No person has verified the integrated release’s ElevenAgents conversation, microphone timing, transcription quality, real screen understanding or human before-save intervention. Synthetic provider checks are not accuracy evaluations or a live competition demonstration.

## Next

1. Run the README competition acceptance with a human wearing headphones: three natural-pause capture questions including a guardrail, three new debrief questions, evidence review, explicit teach-back confirmation, then an unseen-case spoken intervention before save.
2. Record the required submission media against the accepted revision.
3. Optional German/MCP/two-expert stretches stay deferred behind core acceptance.

## Historical V4/OIDC checkpoint (superseded by the release above)

Deployed the focused V4/OIDC revision `ff1a7de` from live durable-storage base `c51b9f3` as `dpl_6wSbRyuyfSCV6Rb5HoZ4pzVxFaf1`, without introducing the newer integration branch's UI/voice changes. Production health reports voice and Gateway configured and Supabase reachable; Scribe token minting succeeds. The readiness fix uses `getVercelOidcTokenSync()` because Vercel supplies OIDC through request context, retains API-key/local-token support, and fails closed without credentials.

Live HTTP checks used synthetic input, not customer data: vision returned 502; compile returned `llm: false` with the explicit provider error "Free tier users do not have access to this model. Upgrade to paid credits". Paid AI Gateway credits are required; configuration presence is not successful model execution. No human audio/UI acceptance is claimed.

PR #44 was updated from `B/durable-vercel-product`; the sole conflict was Lane A status documentation, resolved by retaining the newer checkpoint plus the V4 verification addendum. The integrated branch passed `npm ci`, typecheck, 289 tests across 36 files, and a production build. At that checkpoint, production remained pinned to the focused hotfix above, not this broader merge integration.
