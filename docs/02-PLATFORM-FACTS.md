# 02 · Platform facts — verified against live docs and the installed SDKs on Oct 3, 2026

> **Why this file exists.** The baseline was written without ever running against ElevenLabs, the AI Gateway or a deploy target. Your training data about these SDKs is stale. This file is what three research agents confirmed today from the official docs, API references and the exact package versions in `package-lock.json`. **Nothing here was executed against a live account** — the first real-key smoke test is task zero for lanes A, B and C. Where this file and the installed package disagree, the installed package (`node_modules/…`) wins; fix this file.

Pinned versions (all are the current npm `latest`): `@elevenlabs/react` 1.16.0 (re-exports `@elevenlabs/client` 1.26.0) · `@elevenlabs/elevenlabs-js` 2.70.0 · `ai` 7.0.127 · `@ai-sdk/gateway` 4.0.103 · `next` 16.3.8 · `react` 19.x · `zod` 4.6.5 · Node ≥ 22.

---

## 1. The twelve facts that change code tonight

**Oct 4 release override:** Roy requires `eleven_v4_turbo` for both agents ([official V4 page](https://elevenlabs.io/v4)); the historical V3 recommendations below are superseded. SDK 2.70's outbound enum still rejects V4. `lib/agent-model.ts` serializes the remaining conversation settings and uses the SDK's `additionalBodyParameters` escape hatch to set the wire model without editing generated dependencies. Provisioning and `--check` reject any other saved model. Live account support, Expressive Mode behavior, and audible quality remain unverified until the real-key checks pass; a model label or configured health status is not proof of execution.

| # | Fact | Consequence | Lane |
|---|---|---|---|
| 1 | `startSession()` returns **void**, not a promise. The session comes up asynchronously; use `onConnect` / `status === "connected"`. | `await voice.connect()` resolves before the session exists. `connect()` must return a promise resolved by `onConnect` (rejected by `onError` or a 12 s timeout). | A |
| 2 | `setMuted`, `sendUserMessage`, `sendContextualUpdate`, `sendUserActivity`, `setVolume`, `getId` **throw** `No active conversation` when no session is live. | With real keys, Start in Capture and Teach throws immediately today. Make mute **state-only** (the controlled `micMuted` prop is applied by the SDK when a conversation exists); queue tagged messages until connected; wrap sends in try/catch with the labeled fallback voice. | A |
| 3 | Prompts reference `{{expert_name}}` / `{{newhire_name}}`; agent-level placeholders are documented as *testing* defaults only. | Always pass `dynamicVariables` at `startSession`. | A |
| 4 | `turn_timeout` is 1–30 s and cannot be disabled: on a muted, silent session the platform nudges the agent to take a turn every ≤ 30 s. `sendUserActivity()` resets that timer **and** suppresses agent speech for ≥ 2 s. `setVolume({ volume })` exists. | Silence must be structural: a `sendUserActivity` heartbeat while no turn is open (stop it ~2 s before a `say`), an output gate (`setVolume 0` outside turns), and `skip_turn` in the prompt as the third layer. | A |
| 5 | There is **no "say this verbatim" API**: a tagged message is a user message to an LLM. With Expressive Mode on, any `[bracketed]` token the LLM echoes can be read as an audio tag. | Temperature 0; short teach-backs; prompt rules "never output square-bracket tags" and "read invoice numbers and cost-center codes digit by digit". | A |
| 6 | Sending a new `user_message` from inside a blocking client-tool handler races with the tool result. | Chain through the tool result: return `"logged. NEXT: [DEBRIEF] slot=… <question>"` and add the prompt rule "when a tool result contains NEXT:, follow it" — or send the next tag only after the agent is back to listening. | A, C |
| 7 | `isSpeaking` comes from LiveKit active-speaker events: it flickers during TTS pauses. Scribe VAD commits land ≈ 1 s after speech ends. Scribe word timestamps are on Scribe's own audio clock. | Debounce the speaking→listening edge (600–800 ms). Echo = a commit that overlaps an agent-speech interval (+0.8 s) **and** shares ≥ 60 % of its words with the agent's last line. Stamp transcript segments with the app clock; advance `lastSpeechAt` from end-of-speech, not commit arrival (today's effective pause is ≈ 3.6 s, not 2.5 s). | A |
| 8 | A Scribe socket can die silently (`insufficient_audio_activity`, `session_time_limit_exceeded`, 15 s without client messages). Tokens are single-use, 15 min. `RealtimeConnection.mute()` sends silence and keeps the socket open. | Reconnect watchdog with a **fresh token each time**; the governor **fails closed** (`transcriberHealthy === false` ⇒ not silent); hold-to-pause calls Scribe `mute()`. | A |
| 9 | Anthropic native structured output rejects **recursive schemas, numeric `min/max`, and `additionalProperties` ≠ false**; limits of 24 optional and 16 nullable/union fields per request. `generateObject`, `system`, and `{type:"image"}` parts are deprecated in AI SDK 7 (`generateText` + `Output.object`, `instructions`, `{type:"file", mediaType}`); `generateObject` has no `timeout`. | The LLM compile pass almost certainly **fails today and silently falls back** (recursive `CondSchema`, `z.record`). Give models a flat, nullable, constraint-free wire schema and convert after. Vision route: drop `min/max`, add `timeout`, `maxRetries: 0`, `maxOutputTokens`, and abort the browser fetch. Confirm `llm: true` in the `/api/compile` response before believing anything. | C, B |
| 10 | Vercel functions: read-only filesystem, 4.5 MB body limit, multiple instances. Everything here writes `.data/` and keeps in-process globals. | **Host on one long-running Node instance with a persistent volume** (§3). No serverless migration tonight. | B |
| 11 | Hidden pages get timers once per second (once per minute after 5 min without WebRTC); a fully covered window counts as hidden. `BroadcastChannel` only connects the **exact same origin** in the same browser profile. | Workspace mode (one visible window) is the default; drive ticks from a Worker and make activity classification time-based; never mix `localhost` / `127.0.0.1` / tunnel URLs across the two pages. | B, D |
| 12 | Defaults that bite: `max_duration_seconds` 600 (set 3600); `record_voice` true and retention unlimited (set `record_voice: false`, short retention; struck sessions can be deleted via `DELETE /v1/convai/conversations/{id}`); client tools default `pre_tool_speech: "auto"` (set `"off"`); `NEXT_PUBLIC_*` is inlined at **build** time. | Set them explicitly in `scripts/create-agents.ts`; rebuild after changing agent ids. | A, B |

---

## 2. ElevenLabs — recommended configuration

### 2.1 Agents (interviewer + tutor)

```text
AGENTS (two agents, same skeleton; REST field names shown, JS SDK uses camelCase equivalents)

conversation_config.agent
- first_message: "" for the interviewer ("If empty, the agent waits for the user"); tutor: one short line, or set per session via override.
- language: "en"; add language_presets (e.g. de) only if the any-language stretch is in scope.
- dynamic_variables.dynamic_variable_placeholders: { expert_name: "Sabine", newhire_name: "Lena" } AND always pass real values at startSession.
- prompt.prompt: agents/interviewer.md or agents/tutor.md, plus: tone block for expressive delivery, "read codes digit by digit", "never output square-bracket tags", "if a tool result contains NEXT:, follow it".
- prompt.llm: keep "gemini-2.5-flash" (valid; named in the docs' tool-calling recommendation) or A/B one newer small model returned by GET /v1/convai/llm/list; measure time-to-first-audio on a real [ASK]. prompt.temperature: 0. Lowest reasoning_effort / thinking_budget 0 where the model allows.
- prompt.tool_ids: client tool ids. prompt.built_in_tools: skip_turn only ({ type: "system", name: "skip_turn", description: "Stay silent when no tagged message was received or the user needs a moment.", params: { system_tool_type: "skip_turn" } }). Drop language_detection unless language_presets exist.
- Tutor only: prompt.knowledge_base: [{ type: "text", id, name, usage_mode: "prompt" }], prompt.rag.enabled false, optional prompt.mcp_server_ids, plus free-form Procedures (one per guardrail).

conversation_config.tts: { model_id: "eleven_v3_conversational", expressive_mode: true, voice_id: <non-PVC voice>, optional suggested_audio_tags }. Verify in the dashboard that the Voice tab shows V3 Conversational.
conversation_config.asr: leave default (provider scribe_realtime).
conversation_config.turn: { turn_timeout: 30 (max), silence_end_call_timeout: -1, turn_eagerness: "patient", soft_timeout_config.timeout_seconds: -1 }.
conversation_config.conversation: { max_duration_seconds: 3600 (allowed 60-7200; default 600 would kill a demo at 10 min), client_events: ["audio","interruption","user_transcript","agent_response","agent_response_correction","client_tool_call","agent_tool_response"] (+ "mcp_tool_call","mcp_connection_status" with MCP) }.

platform_settings
- overrides.conversation_config_override: { agent: { first_message: true, language: true, prompt: { prompt: true } }, tts: { voice_id: true } }.
- privacy: { record_voice: false, retention_days: small number or 0 }.
- auth.enable_auth: false for the demo (public agent id), or true + server-minted conversation token.

CLIENT TOOLS: type client; names exactly as registered in voice.tsx; expects_response true only where the result should steer the agent; response_timeout_secs 20 (1-120); pre_tool_speech "off"; omit parameters for no-arg tools.

SESSION WIRING (browser)
- startSession({ agentId, connectionType: "webrtc", dynamicVariables: {...}, overrides only with non-empty fields }).
- Treat the session as usable only after status === "connected" / onConnect; queue tagged messages until then; handle onDisconnect.
- Mic: drive exclusively through the controlled micMuted prop; never call setMuted directly.
- Quiet periods: sendUserActivity() every 15-20 s while no window is open; pause pings around a say().
- Speak on demand: sendUserMessage("[TAG] ..."); chain follow-ups through blocking client-tool results rather than a second user message during a tool call.
- Screen events: sendContextualUpdate, batched (one grouped update per few seconds).
- Tutor correctness per session: inject the confirmed Work Map via prompt override or a dynamic variable in addition to the KB/Procedures sync.

SCRIBE (separate stream, already correct): useScribe({ modelId: "scribe_v2_realtime", commitStrategy: CommitStrategy.VAD, vadSilenceThresholdSecs: 1.0, includeTimestamps: true }), token from POST /v1/single-use-token/realtime_scribe; add onError/onDisconnect with re-token and reconnect.
```
### 2.2 Scribe v2 Realtime and the two-channel design

```text
VERDICT ON THE TWO-CHANNEL DESIGN: sound with the current SDKs, on Chromium desktop, once the fixes above are in. It is also the only design that satisfies the brief: the agent's own events (onMessage user_transcript, onVadScore) only describe audio the agent receives, so with the agent mic muted they are blind, and with the agent mic open every sentence the expert narrates becomes an LLM turn that must be suppressed by skip_turn. A separate always-on Scribe socket gives the verbatim transcript and the pause clock without ever giving the agent a turn. It was NOT run end to end here (no keys, no node_modules); treat the first real-key smoke test as task zero.

SCRIBE CHANNEL (always on, never gated by the governor)
- Transport: wss://api.elevenlabs.io/v1/speech-to-text/realtime, model_id=scribe_v2_realtime, auth by single-use token (POST /v1/single-use-token/realtime_scribe, 15 min TTL, consumed on use). Mint a fresh token for every connect and reconnect; never cache it.
- commitStrategy: VAD. vadSilenceThresholdSecs: 1.0 (default 1.5, range 0.3-3.0). Keep it well below the governor's silenceSecs (2.5) so the commit for the last sentence has landed before a question window can open.
- vadThreshold: start at default 0.4; raise toward 0.5-0.6 only if keyboard noise creates phantom speech. minSpeechDurationMs 100-150, minSilenceDurationMs 100.
- includeTimestamps: true and includeLanguageDetection: true (gives language_code per segment). Do not combine with filterBackgroundAudio; if the demo room is noisy and phantom speech is a problem, the alternative profile is includeTimestamps:false + filterBackgroundAudio:true + handle COMMITTED_TRANSCRIPT instead.
- languageCode: undefined for auto-detect; set 'de' explicitly for the German-expert stretch (more reliable than auto-detect on short utterances).
- keyterms (optional): capex, opex, cost center, accrual, credit note, supplier names, and German equivalents if used.
- microphone: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } (these are also the SDK defaults).
- Speech clock: lastSpeechAt advances only on a non-empty, changed partial. Segment times come from the wall clock at first/last changed partial, converted to session seconds.
- Health: watchdog every 1.5 s reconnects when the socket is down; auth/quota/terms errors stop retries and switch to the browser recognizer; governor treats 'transcriber not healthy' as 'not silent'.
- Mute Scribe (connection.mute(), silence keeps the socket alive) during hold-to-pause always, and during agent speech when not on headphones.

AGENT CHANNEL (speaks only inside governor windows)
- connectionType 'webrtc' (required for echo cancellation of the agent voice). asr.provider stays 'scribe_realtime' (default). Optionally pass overrides.asr.keywords with the same domain terms.
- Mic is controlled only through the `micMuted` prop of useConversation, initial true. Never call conversation.setMuted directly. Unmute when the agent finishes the question; mute in closeWindow.
- connect() resolves only when status === 'connected'; say() degrades to the browser voice if the session is not live.
- Agent config: turn_timeout 30 (max), turn_eagerness patient, silence_end_call_timeout -1, max_duration_seconds 3600, client_events including audio, interruption, user_transcript, agent_response, agent_response_correction, client_tool_call, vad_score (the starter script already does this).
- Unprompted-speech guard: sendUserActivity() heartbeat every ~1.5 s while no window is open, optional setVolume({volume:0}) outside windows.
- [SCREEN] events go through sendContextualUpdate (no response triggered); [ASK]/[DEBRIEF]/[TEACHBACK] go through sendUserMessage.

GOVERNOR
- silenceSecs 2.5 measured from end of speech (not commit arrival), stillSecs 2, typingQuietSecs 3, cooldown 60, max 5 per 10 min, warmup 15 (Scribe needs ~2 s of audio before first output anyway).
- New optional signal transcriberHealthy; fail closed.
- Echo rule: a committed segment is agent echo only if it overlaps an agent-speaking interval (+0.8 s) and shares >= 60% of its words with the agent's last utterance.

ENVIRONMENT
- Chrome or Edge desktop only. Wired headphones preferred; on laptop speakers enable half-duplex Scribe mute. Avoid Bluetooth headsets with their own mic (hands-free profile degrades the agent voice; general WebRTC behaviour, not from ElevenLabs docs).
- Run the agent path (not keyless) for any session longer than 5 minutes so the hidden capture tab is not timer-throttled to one tick per minute.
- Budget: Scribe $0.39/h plus agent $0.08/min for the whole time the agent session is open, even while muted. Disconnect agents promptly during development and check plan concurrency before all four people test at once.
```
### 2.3 What we may truthfully claim about privacy

- The agent's microphone is closed outside question windows, so no audio *content* reaches the agent then (WebRTC mute mutes the published track).
- The always-on Scribe stream **does** send audio to ElevenLabs for transcription while a session runs; hold-to-pause mutes it (silence is sent).
- By default ElevenLabs stores agent conversation transcripts and audio; we set `record_voice: false` and a short retention on our agents, and can delete a conversation by id. Zero Retention Mode and provider-side redaction are enterprise features — **do not claim them**.
- Frames reach the vision model after masks are painted in the browser; for the sandbox we paint exact PII rectangles published by the ERP's DOM *before upload*. Model-reported PII regions are a second layer applied to stored frames. The default vision model is flagged zero-data-retention on the gateway.

---

## 3. Hosting, models, browser — recommended configuration

```text
HOSTING (one recommendation): run ONE long-lived Node instance with a persistent disk, not Vercel serverless. The starter as written cannot run on Vercel: every write under .data throws on the read-only filesystem (ERP pages and session creation return 500), state is split across lib/store.ts and lib/erp.ts, and the whole-log PUT will hit the 4.5 MB cap. A single instance needs zero storage code changes and keeps the path that has actually been exercised.
- Public URL for judges: Railway service from the GitHub repo, 1 replica, a volume mounted at /app/.data, env vars set in the dashboard, Generate Domain for HTTPS. Start command should build, seed, then serve (`next build` at build time; `npm run seed:session && next start -p $PORT` at start, or the standalone form Railway's guide describes). Render free is unsuitable (15-minute spin-down, ephemeral disk).
- Recording the video and the live demo: http://localhost:3000 on the demo laptop (`next build && next start`, not `next dev`). A cloudflared quick tunnel is the backup public URL only while that laptop stays awake; avoid ngrok free (1 GB / 20k requests per month, interstitial page).
- Vercel only if someone owns the full swap (storage driver over Supabase for sessions, maps, clips, erp invoices, erp guard; frames uploaded separately; routes accept OIDC). Roughly 150 lines plus retesting; treat as optional, not on the critical path.

MODELS (.env.local):
AI_GATEWAY_API_KEY=<key from Vercel dashboard > AI Gateway > API Keys>
VISION_MODEL=anthropic/claude-haiku-4.5        # zdr=all; replace only after the bake-off
COMPILE_MODEL=anthropic/claude-sonnet-5.5      # requires the flat wire schema; fallback openai/gpt-6.1-sol
NEXT_PUBLIC_EVENT_SOURCE=both
Bake-off candidates for vision, in order: google/gemini-3.5-flash-lite, openai/gpt-6-luna (reasoning 'none'), openai/gpt-4.1-mini, google/gemini-3.1-flash-lite. Decide on measured p50/p95 latency and field accuracy on 20 real ERP frames; I could not measure latency.

LLM-FACING SCHEMA RULES (apply to every Output.object schema): no recursion, no z.record, no .min/.max, `.nullable()` instead of `.optional()`, at most 16 nullable/union fields and 24 optional fields per request, enums for closed sets. Validate and coerce after the call.

BROWSER: Chrome or Edge desktop only (Document PiP, CaptureController, picker hints are Chromium features). Two windows side by side: ERP on the left, Tacit capture/companion on the right, the Tacit window never minimised or fully covered. Share the ERP as a TAB so the frame equals the viewport and DOM-published PII masks line up. Both tabs on the exact same origin.

NEXT.JS 16 RULES FOR CODING AGENTS: await params/searchParams/cookies()/headers(); route handler context is `{ params: Promise<...> }`; no middleware.ts (it is proxy.ts, Node runtime); no `runtime = 'edge'`; do not enable cacheComponents; do not add a webpack() config; `next lint` does not exist; GET handlers are uncached by default so do not add caching exports; read node_modules/next/dist/docs before using an unfamiliar API; only one `next dev` per checkout (lockfile), so each agent that needs a server uses its own git worktree and port; commit the AGENTS.md managed block. Node >= 22 everywhere.
```

**Layout note:** the research text above recommends two side-by-side windows. The spec has since made **workspace mode** (one window: ERP frame + companion side panel, capture cropped to the ERP frame) the default surface (`01-SPEC.md` §8.3 WD-11 / WB-6); the two-window guidance still applies to two-window mode. **Heartbeat note:** the two research passes suggest different `sendUserActivity` intervals (≈ 1.5 s vs 15–20 s). Decision: ping every ~10 s to keep the turn timer from firing, rely on the **volume gate** as the hard guarantee, stop pinging ≥ 2 s before any `say`, and measure with `/voice-check`.

**Decision (binding for tonight):** Railway (or any single always-on Node host) with one replica and a volume mounted at the data directory; build with `next build`, start with `npm run seed:session && next start -p $PORT`; `NEXT_PUBLIC_*` set before the build. Emergency URL: `cloudflared tunnel --url http://localhost:3000` from the demo laptop serving a production build. The live link is a required submission item and must stay up through Oct 10.

---

## 4. Known mismatches between the baseline code and the platforms (work list)

Each item names the file, the problem and the fix. Lane = owner of the file.

### 4.1 ElevenAgents (React SDK, agent config, knowledge base)

| Lane | File | Problem | Fix |
|---|---|---|---|
| A | `components/voice.tsx` | HIGH. setMicMuted() calls conversation.setMuted(m) unguarded (line 155). In @elevenlabs/react 1.16.0 setMuted throws 'No active conversation. Call startSession() first.' whenever no session object exists. Callers hit this: CaptureClient.start() and TeachClient.start() call voice.setMicMuted(true) immediately after connect() while the session is still connecting (unhandled rejection on every agent-mode start); CaptureClient.closeWindow() calls it before await stopRecorder(), so if the session has dropped the window never closes and the governor stalls; the 500 ms governor tick calls setMicMuted(false). | Make setMicMuted state-only: const setMicMuted = (m) => setMicMutedState(m). The micMuted value is already passed to useConversation({ micMuted }), and the SDK's own effect applies conversation.setMicMuted() as soon as a conversation exists and on every change. If a direct call is kept, guard it: if (conversation.status === 'connected') { try { conversation.setMuted(m) } catch {} }. |
| A | `components/voice.tsx` | HIGH. connect() does not wait for the connection and say() is unguarded. startSession returns void in 1.16.0 (typings: (options?: HookOptions) => void), so 'await voice.connect()' resolves before the WebRTC session is up; say() then calls conversation.sendUserMessage(), which throws the same 'No active conversation' error when not connected. There is also no onDisconnect handling, so a dropped session (agent hang-up, max duration, network) is invisible and every later say() throws. | Gate on connection: queue tagged messages in a ref and flush them in an effect when conversation.status === 'connected' (or in onConnect); make connect() return a promise resolved by onConnect / rejected by onError; add onDisconnect((d) => ...) to surface d.reason ('error' \| 'agent' \| 'user') and offer reconnect; wrap sendUserMessage in try/catch. |
| A | `components/voice.tsx` | HIGH. dynamicVariables are never passed to startSession, yet agents/interviewer.md uses {{expert_name}} and agents/tutor.md uses {{expert_name}} and {{newhire_name}}. The docs describe agent-level placeholders as 'default values for testing without passing variables at runtime'; runtime behaviour when a referenced variable is missing is not documented (third-party reports describe a 'Missing required dynamic variables' failure at conversation start). The UI also lets the judge type an expert name that never reaches the agent. | Extend connect() opts with vars and pass startSession({ agentId, connectionType: 'webrtc', dynamicVariables: { expert_name, newhire_name }, ... }). Pass the real expert/new-hire names from CaptureClient, MapClient and TeachClient. |
| A | `components/voice.tsx` | MEDIUM. connect({ firstMessage: '' }) builds overrides.agent.firstMessage = '' (the check is opts.firstMessage !== undefined). The overrides docs say to 'omit any fields you don't want to override rather than setting them to empty strings or null values'; the client sends first_message: '' on the wire. The interviewer agent already has first_message '' in its own config, so the override is redundant and risky. | Only include a field when it is a non-empty string: ...(opts?.firstMessage ? { firstMessage: opts.firstMessage } : {}), and only pass overrides at all when at least one field is set. |
| A | `components/voice.tsx` | MEDIUM. No user_activity keep-alive. With the mic muted for minutes, the server sees silence and after turn_timeout (max 30 s) 'the assistant takes a turn and prompts the user'; the starter relies on the LLM calling skip_turn every 30 s for the whole task (an LLM call each time plus the risk of an unprompted utterance, which would violate 'quiet while they type, read or talk'). | While no question window is open, call conversation.sendUserActivity() every 15-20 s (documented to reset the turn timeout timer). Stop pinging about 2 s before and during a say(), because the agent will not speak for at least 2 seconds after a user_activity event. Keep skip_turn in the prompt as the backstop. |
| A | `components/voice.tsx` | LOW. No onUnhandledClientToolCall, onStatusChange or onAgentToolResponse handlers, so a misnamed tool or a skip_turn call is invisible during debugging; language override is cast with 'as "en"' and will only work for a language the agent is configured for. | Add onUnhandledClientToolCall and onAgentToolResponse logging (and add 'agent_tool_response' to the agent's client_events); type language as the SDK's Language union. |
| C | `components/MapClient.tsx` | HIGH. startDebrief() does await voice.connect({ firstMessage }) then setTimeout(() => askNext(map), 2500). At 2.5 s the session may not be connected (setMicMuted/say throw), and if it is connected the first message is still being spoken, so the [DEBRIEF] user_message arrives as user input mid-utterance (docs: user_message 'Triggers the same response flow as spoken user input'), which can cut off or reorder the greeting. | Trigger the first askNext from state, not a timer: wait for connected and for the first agent message to finish (mode back to 'listening' after having been 'speaking', debounced about 700 ms), then send the first [DEBRIEF] message. |
| C | `components/MapClient.tsx` | MEDIUM. The log_answer and confirm_teachback client-tool handlers call askNext()/confirm(), which send a new user_message ([DEBRIEF]/[TEACHBACK]/[CONFIRMED]) while the blocking tool call (expectsResponse: true) is still awaiting its result. Ordering between that user_message and the tool result is not defined by the docs. | Drive the next step through the tool result, which the docs say is appended to the conversation context: return e.g. 'logged. NEXT: [DEBRIEF] slot=<id> <question>' (or 'NEXT: [TEACHBACK] <text>') and add a prompt rule 'after a tool returns a NEXT instruction, follow it'. Alternatively return first and send the next tagged message only after the agent's mode returns to listening. |
| A | `scripts/create-agents.ts` | MEDIUM. builtInTools.languageDetection is enabled but no conversationConfig.languagePresets are defined; the tool can only switch to languages defined in the agent settings, so it is dead weight the LLM may call. The per-session language override (enabled in platformSettings) likewise has no configured target language. | Remove languageDetection, or (for the any-language stretch) add languagePresets: { de: { overrides: { agent: { firstMessage: '...' } } } } and keep it. |
| A | `scripts/create-agents.ts` | MEDIUM. No platformSettings.privacy. Defaults are record_voice true and retention unlimited (-1 in the API reference; the retention page says 2 years), so the 'off the record' strike only clears the app's own log while ElevenLabs keeps the conversation transcript and audio. | Add platformSettings.privacy: { recordVoice: false, retentionDays: <small number, or 0 for scheduled deletion> }. For struck sessions also call DELETE /v1/convai/conversations/{conversation_id} server side (store the conversationId from onConnect). |
| A | `scripts/create-agents.ts` | MEDIUM. clientEvents omits 'agent_tool_response' (needed to observe skip_turn and tool calls via onAgentToolResponse) and, if an MCP server is added for the tutor, 'mcp_tool_call' / 'mcp_connection_status'. It includes 'vad_score' although voice.tsx never uses onVadScore. | clientEvents: ['audio','interruption','user_transcript','agent_response','agent_response_correction','client_tool_call','agent_tool_response'] plus 'mcp_tool_call','mcp_connection_status' when MCP is used; keep 'vad_score' only if the governor will consume it. |
| A | `scripts/create-agents.ts` | LOW. Client tools are created without preToolSpeech, so the default 'auto' can make the agent speak before a tool call; temperature is 0.2 although the prompts demand reading text exactly as written (API default is 0); expressiveMode is left implicit; no-argument tools (end_task, end_session) are sent with parameters { type:'object', required: [], properties: {} } although parameters is optional/nullable; every run creates a fresh set of duplicate tools and agents. | Add preToolSpeech: 'off' to each client tool; set temperature: 0; set tts: { modelId: 'eleven_v3_conversational', expressiveMode: true, voiceId }; omit parameters when a tool has no properties; make the script idempotent (store ids and call agents.update / reuse tools when ids exist). |
| A | `scripts/create-agents.ts` | LOW (security). The agents are public (auth.enableAuth false) while the system-prompt override is enabled, and the agent ids ship in NEXT_PUBLIC_* variables, so anyone with the id can run arbitrary prompts on the team's quota. | Acceptable for the demo. To harden: enableAuth true plus a server route that returns a conversation token (GET /v1/convai/conversation/token?agent_id=...) and startSession({ conversationToken }). |
| A | `scripts/create-agents.ts` | INFO. tts.modelId 'eleven_v3_conversational', turn { turnTimeout: 30, silenceEndCallTimeout: -1, turnEagerness: 'patient' }, conversation.maxDurationSeconds 3600, builtInTools.skipTurn shape, toolIds, dynamicVariables.dynamicVariablePlaceholders, platformSettings.overrides.conversationConfigOverride and tools.create({ toolConfig: { type:'client', expectsResponse, responseTimeoutSecs, parameters } }) all match the current API reference and SDK 2.70.0 field names. LLM default 'gemini-2.5-flash' and the alternative 'claude-haiku-4-5' are both still valid enum values. | No change required for these fields. Note turnTimeout 30 is the documented maximum. |
| A | `agents/tools.json` | LOW. Shape is the starter's own camelCase format (expectsResponse), fine for the script but not the REST/CLI shape (expects_response); all nine names match the useConversationClientTool registrations in voice.tsx. log_answer, confirm_teachback and the tutor tools use expectsResponse true, which blocks the agent until the browser replies (20 s timeout). | Keep names as they are (case-sensitive match). Keep expectsResponse true only where the result should steer the agent (log_answer, confirm_teachback, show_replay); consider false for pure side-effect tools (record_prediction, record_mastery, flag_for_expert). Do not feed this file to the elevenlabs CLI without converting to snake_case. |
| A | `agents/interviewer.md` | MEDIUM. Depends on {{expert_name}} being supplied at runtime (it is not). No tone guidance for Expressive Mode, and nothing tells the model how to read codes and amounts (default text_normalisation_type 'system_prompt' adds number-normalisation instructions, so '0400' or '4711' may be read as quantities). With expressive mode on, any bracketed text the LLM echoes can be interpreted as an audio tag. | Pass the variable at session start. Add: a tone block (calm, low-key, no laughter tags), 'read invoice numbers and cost-centre codes digit by digit', 'never output square-bracket tags of any kind', and 'when a tool result contains NEXT:, follow it' if the tool-result chaining fix is adopted. |
| A | `agents/tutor.md` | MEDIUM. Depends on {{expert_name}} and {{newhire_name}} at runtime (not passed). Relies on 'the Work Map document in your knowledge base' which exists only after a successful sync to the single shared tutor agent; no Procedures and no MCP lookup are configured although the brief names both. | Pass both variables at session start. Either keep KB sync but also inject the confirmed Work Map into the session (prompt override, which is already enabled, or a {{work_map}} dynamic variable) so the right map is guaranteed per session; add procedures per guardrail and optionally an MCP guardrail-lookup server. |
| A | `lib/elevenlabs-sync.ts` | MEDIUM. The update spreads the whole GET prompt object (SDK Output model: prompt, llm, builtInTools in output form, rag, deprecated tools, ...) back into the PATCH. The endpoint is a patch and the docs' own examples send only the changed leaf; round-tripping output-shaped fields risks validation errors and silently rewrites settings. | Send only the knowledge base: await client.conversationalAi.agents.update(agentId, { conversationConfig: { agent: { prompt: { knowledgeBase: [...existing, { type: 'text', id: doc.id, name: doc.name, usageMode: 'prompt' }] } } } }). |
| A | `lib/elevenlabs-sync.ts` | LOW. usageMode 'auto' only means full-context because RAG was never enabled on the agent; old 'Tacit Work Map' documents are detached but never deleted (orphans accumulate); the prefix filter removes every other session's map, so one shared tutor agent only ever knows the most recently confirmed Work Map (last confirm wins, which breaks the two-experts stretch and parallel demos). | Use usageMode: 'prompt' (document must stay under about 300,000 characters). Keep one document per expert/task and update it in place with knowledgeBase.documents.update(id, { name, content }), or delete detached documents. Do not rely on the shared agent's KB for per-session correctness; inject the map per session as well. |
| A | `lib/elevenlabs-sync.ts` | MEDIUM (missing config versus the brief). Nothing writes Procedures and no MCP server is attached, although the brief says the Work Map goes into the tutor's knowledge base and Procedures and hints at an MCP guardrail lookup. | After confirm: branchId = (await agents.get(agentId)).mainBranchId; create one free-form procedure per guardrail/judgment call with agents.procedures.create(agentId, branchId, { name, type: 'free_form', trigger, content }) (content under 50,000 chars), then publish with agents.update(agentId, { branchId }). Optional: mcpServers.create + prompt.mcpServerIds for a guardrail-lookup MCP server (approvalPolicy 'auto_approve_all' for read-only lookups). |
| B | `package.json` | INFO. @elevenlabs/react ^1.16.0 and @elevenlabs/elevenlabs-js ^2.70.0 equal the latest npm versions; no upgrade is available. The 2.70.0 TtsConversationalModel type does not yet include 'eleven_v4' / 'eleven_v4_turbo' that the API reference lists. No node_modules directory exists in the starter folder. | Run npm install before anything else. Stay on eleven_v3_conversational; only if testing eleven_v4_turbo, cast the value past the SDK type. |

### 4.2 Scribe v2 Realtime and the governor's speech clock

| Lane | File | Problem | Fix |
|---|---|---|---|
| A | `components/voice.tsx (setMicMuted, lines 152-158)` | CRITICAL. setMicMuted calls conversation.setMuted(m) directly. In @elevenlabs/react 1.16.0 that throws 'No active conversation. Call startSession() first.' whenever the session is not live. Call sites hit this: CaptureClient.tsx:329-330 and TeachClient.tsx:207-208 call it right after connect() (always throws, unhandled rejection); MapClient.tsx:174 calls askNext 2.5 s after connect, and if WebRTC is not up yet the throw happens before say() so the debrief never asks its first question; CaptureClient.tsx:163 calls it first inside closeWindow, so if the agent session has dropped the throw aborts closeWindow before governor.close() and the governor is stuck with an open window forever; TeachClient.tsx:90 calls it before say(), so a dropped session silently kills the tutor intervention. | Make it state-only: `const setMicMuted = useCallback((m: boolean) => setMicMutedState(m), [])`. The `micMuted` prop already passed to useConversation is applied by the SDK as soon as a conversation exists and on every change. Keep the initial state `true`. |
| A | `components/voice.tsx (connect, lines 115-129)` | connect() resolves immediately: conversation.startSession() returns void and the WebRTC session comes up asynchronously (token fetch, mic permission, LiveKit). Callers treat the awaited promise as 'connected' (CaptureClient start, TeachClient start, MapClient startDebrief with a blind 2500 ms timer that can also talk over the agent's first message). | After startSession, await a promise resolved by an effect on `conversation.status === "connected"` (reject or resolve false via onError or a 12 s timeout). In MapClient.startDebrief replace the 2500 ms setTimeout with: await connect, then wait until isSpeaking has gone true then false (or 6 s cap) before askNext. |
| A | `components/voice.tsx (say, lines 140-150; mode, line 56)` | `mode` is decided only by whether an agent id exists. If the agent fails to connect or drops (bad id, quota, concurrency limit, network), say() calls conversation.sendUserMessage which throws, and there is no degrade to the browser voice. In Capture this loops: window opens, throw, 8 s abort, repeat, with no question ever asked. | In say(): if status is not 'connected', call speakFallback(spoken ?? text) instead of sendUserMessage, and wrap sendUserMessage in try/catch with the same fallback. Surface the state in `status` so the header tag turns amber. |
| A | `components/voice.tsx (useTranscriber, lines 203-216 and 218-287)` | HIGH. No reconnect and no error handling for Scribe. The socket can close on insufficient_audio_activity (long silent stretches while the expert types or reads), session_time_limit_exceeded, 15 s without client messages, quota, or a network blip. After that `engine` stays 'scribe', lastSpeechAt freezes, the governor's silence light goes green permanently and the agent can ask while the expert is talking, which is exactly the behaviour the brief marks as weak. The single-use token is also fetched only once. | Add a watchdog that reconnects with a FRESH token whenever the connection is down while enabled; stop retrying and fall to the browser recognizer on auth/quota/unaccepted-terms; expose `healthy` and feed it to the governor (see snippet). Either drive `Scribe.connect()` directly (recommended, snippet 2) or keep useScribe and add onInsufficientAudioActivityError, onSessionTimeLimitExceededError, onAuthError, onQuotaExceededError, onError handlers plus the watchdog. |
| A | `components/voice.tsx (lines 210-213) with components/CaptureClient.tsx` | Clock mismatch. words[0].start is passed as startSecs and CaptureClient uses it directly as the transcript segment's session time `t`. Scribe word times are on Scribe's audio timeline (starts when the mic stream starts, after token fetch and mic permission, not at log.startedAt), and the docs do not say whether they are session-relative or segment-relative. Transcript `t` values therefore drift from event and frame times, which breaks 'every step links to a screen moment and the expert's own words' and the off-record strike range (strike filters transcript by s.t). | Timestamp segments on the wall clock: record Date.now() at the first changed partial of a segment and at the last changed partial; pass those as startMs/endMs and convert with (ms - log.startedAt)/1000. Keep word timestamps only as optional detail. |
| A | `components/CaptureClient.tsx (line 98)` | `lastSpeechAt.current = nowSecs()` runs when the VAD commit arrives, which is at least vadSilenceThresholdSecs (1.0 s) plus latency after the expert stopped. That resets the silence clock late, so the real pause needed before a question is about 3.6 s, not the configured 2.5 s. | Use the end of speech, not the commit arrival: `lastSpeechAt.current = Math.max(lastSpeechAt.current, (endMs - L.startedAt) / 1000)`. |
| A | `components/CaptureClient.tsx (lines 86, 94-97), components/MapClient.t` | HIGH on speakers. Echo is attributed by reading isSpeaking at the moment a commit arrives. Commits land about 1 s after the audio ended, so the agent's own question (if it leaks through the speakers) commits after isSpeaking is already false, in Capture exactly when the window has just entered 'answering'. The echo is then stored as the expert's answer (qw.answerText, markAnswered), in Map appended to heardRef and saved as her verbatim words, in Teach stored as the new hire's answer. Conversely real expert speech that commits while the agent is talking is labelled 'agent' or dropped. | Keep a log of agent speaking intervals (from isSpeaking transitions) and classify a segment as echo only if its wall-clock span overlaps an interval (+0.8 s tail) AND its words overlap the agent's last utterance by >= 60% (snippet 3). On speakers also run Scribe half-duplex: transcriber.setMuted(true) while the agent speaks. |
| A | `components/CaptureClient.tsx (lines 84-90, 427, 543)` | Trust claim not true. 'Hold to pause' shows 'paused: nothing is transmitted or kept', but only the callbacks drop text; the Scribe socket keeps streaming microphone audio to ElevenLabs for the whole hold. | On hold call the transcriber's mute (RealtimeConnection.mute(): silence is sent, socket stays up) and unmute on release: `useEffect(() => transcriber.setMuted(holding), [holding])`. |
| A | `components/CaptureClient.tsx (lines 84-88) and lib/governor.ts (line 3` | Every partial_transcript bumps lastSpeechAt, including empty or unchanged ones. The server can emit partials as keepalives, and noise can produce empty partials, so the silence clock can be reset with nobody speaking (fewer questions asked than required). | Advance the speech clock only when the trimmed partial is non-empty and different from the previous partial of the segment (done inside the transcriber in snippet 2). |
| A | `lib/governor.ts (Signals, evaluate lines 79-96)` | The governor fails open: it has no notion of transcriber health, so 'no speech heard' and 'not listening at all' look identical. lib/engines.test.ts builds Signals literals, so a required new field would break the tests. | Add optional `transcriberHealthy?: boolean` (default true) to Signals; `const silence = healthy && now - lastSpeechAt >= silenceSecs && !agentSpeaking`; push reason 'transcript offline'. CaptureClient passes `transcriber.healthy`. Keep the tests green by leaving the field optional and add one test for the offline case. |
| A | `components/voice.tsx (lines 210-213)` | Only onCommittedTranscriptWithTimestamps is handled. That works only while includeTimestamps (or language detection) is on; if someone turns timestamps off to use filterBackgroundAudio (the two cannot be combined) commits silently stop arriving. The word filter `w.type !== "spacing"` also keeps `audio_event` words, so non-speech sounds can define a segment. | Treat a commit as speech only if it contains at least one word with type === 'word'; drop empty commits. If filterBackgroundAudio is ever enabled, switch the handler to onCommittedTranscript / COMMITTED_TRANSCRIPT. |
| A | `app/api/scribe-token/route.ts` | The API usage is correct and matches the docs exactly (tokens.singleUse.create("realtime_scribe"), 15 minute single-use token). Gaps: no try/catch, so any ElevenLabs error (bad key, key without Speech to Text access, quota) becomes a 500 and the client silently falls back to browser STT with only a small amber tag; no explicit no-store. | Wrap in try/catch and return {token:null, reason}; add `export const dynamic = "force-dynamic"` and a `cache-control: no-store` header; client fetch with `{cache: "no-store"}`; show `reason` in the UI (snippet 1). |
| A | `components/voice.tsx (lines 221-270)` | Keyless path only: when there is no token the `cancelled` flag is never checked, so under React StrictMode (on by default in dev) the first, already-cleaned-up effect run still starts a webkitSpeechRecognition. Two recognizers race; depending on fetch order the surviving one may not restart on end and browser STT goes dead in dev. | Check `if (cancelled) return;` immediately after the token fetch regardless of whether a token came back, before constructing the recognizer. |
| A | `components/voice.tsx (lines 208, 242) and call sites in CaptureClient.` | Language is not wired. No call site passes `language`, so the German-expert stretch cannot be switched on, and the single `language` option feeds two different formats: Scribe wants ISO 639-1/639-3 ('de'), webkitSpeechRecognition wants BCP-47 ('de-DE'). | Add a language selector on Capture/Map; pass ISO code to Scribe (or leave undefined for auto-detect and read language_code from the commit), and map to BCP-47 for the browser recognizer ({en:'en-US', de:'de-DE'}). |
| A | `components/CaptureClient.tsx (lines 124-135, endTask 236-246)` | A third microphone capture is opened for MediaRecorder with getUserMedia({audio:true}) and its tracks are never stopped, so the browser mic indicator stays on after 'Done' (bad look for the Trust criterion). Three concurrent captures also make Safari even less viable. | In endTask (and on unmount) run `micStream.current?.getTracks().forEach(t => t.stop()); micStream.current = null`. |
| A | `scripts/create-agents.ts (turn config) and agents/interviewer.md` | Not an API mismatch but the weak joint of the muted-mic design: turnTimeout 30 is the documented maximum (range 1-30, no documented disable), so during a quiet capture the platform re-engages the agent about every 30 s and silence depends entirely on the LLM calling skip_turn each time. One miss means the agent speaks while the expert is typing. | Keep the prompt rule, and add a client-side guarantee: while no question window is open, call conversation.sendUserActivity() on a ~1.5 s heartbeat (documented as preventing the agent from speaking), and/or gate output with conversation.setVolume({volume: 0}) outside windows and restore to 1 just before say(). |

### 4.3 AI SDK, gateway, Next.js, hosting, capture

| Lane | File | Problem | Fix |
|---|---|---|---|
| C | `lib/compile.ts (RefinementSchema, lines 272-310) + lib/workmap.ts (Con` | HIGHEST RISK, untested against a real model. The LLM compile schema embeds CondSchema (recursive z.lazy union, used 3 times) and ActSchema (z.record -> additionalProperties: string). Anthropic native structured outputs reject recursive schemas and additionalProperties != false with HTTP 400, and COMPILE_MODEL defaults to an Anthropic model. The try/catch then silently returns the deterministic draft with note 'LLM refinement failed', so the 'LLM merges events + transcript + answers into the Work Map' path the brief asks for probably never runs. Not confirmed with a live call (no key available to me). | Give the model a flat, provider-neutral wire schema and convert after: conditions as { mode: 'all'\|'any', conds: [{ field: enum, op: enum, value: string }] }, actions as { kind: 'set'\|'route'\|'status', field, value }, `.nullable()` instead of `.optional()`. See snippet 'Flat compile wire schema'. Keep CondSchema for storage only. Surface `note` and `llm: false` visibly in the Map UI so a silent fallback is noticed. First task for the owner: one real call with the key and read the error text. |
| B | `app/api/vision/route.ts (lines 10-16, 32-45)` | (a) Uses deprecated generateObject, `system`, and `{ type: 'image' }`; all still work in ai@7.0.127 but log a deprecation warning on every frame. (b) `confidence: z.number().min(0).max(1)` emits minimum/maximum, which Anthropic native structured outputs do not support; whether the SDK strips them is undocumented, so this may 400 on Haiku 4.5. (c) No timeout and default maxRetries (2): a slow or hung gateway call holds the request open and retries, so latency can triple. (d) No maxOutputTokens. (e) Hard-gates on AI_GATEWAY_API_KEY, so an OIDC-only Vercel deploy returns 503. | Switch to generateText + Output.object with `instructions`, a `{ type: 'file', mediaType: 'image/jpeg', data: <base64 without the data: prefix> }` part, `timeout: { totalMs: 8000 }`, `maxRetries: 0`, `maxOutputTokens: 500`, and a wire schema with no min/max and nullable fields (keep nullable count <= 16). Clamp confidence and drop nulls after. Add `export const maxDuration = 30`. Gate on `AI_GATEWAY_API_KEY \|\| VERCEL_OIDC_TOKEN`. See snippet 'Vision route'. |
| B | `components/useScreenPipeline.ts (sendToVision, lines 155-200)` | The client fetch to /api/vision has no AbortSignal. `inFlight` is only cleared in `finally`, so one hung request stops all further frames; the only symptom is the 'frames not sent' counter climbing. A new canvas is also allocated per send and the frame goes up as base64 JSON (33% larger than binary). | `fetch('/api/vision', { ..., signal: AbortSignal.timeout(9000) })`. Reuse one canvas. Optional: `canvas.toBlob` + FormData to cut payload. |
| B | `components/useScreenPipeline.ts (start, lines 263-272)` | `getDisplayMedia({ video: { frameRate: 4 }, audio: false })` passes no picker hints: Chrome opens on its default pane, the user can share the capture tab itself (hall of mirrors) or a whole monitor (maximum PII exposure), and there is no 'share this tab instead' control. | Pass displaySurface 'browser', selfBrowserSurface 'exclude', surfaceSwitching 'include', monitorTypeSurfaces 'exclude', and read `track.getSettings().displaySurface` to know whether tab-exact masking applies. See snippet 'Screen share start'. |
| A | `components/useScreenPipeline.ts (500 ms tick, lines 203-237) and compo` | Both loops are main-thread `setInterval(…, 500)`. The moment the expert switches to the ERP tab in the same window (or the capture window is fully covered), the capture page is hidden and Chrome runs its timers once per second. classifyActivity looks at the last 4 diffs assuming 500 ms spacing, so typing detection and pause timing (the heart of 'when to ask') change behaviour exactly when the expert is working. The agent's WebRTC session prevents the 1-per-minute tier, not the 1-per-second tier. | Primary: make the demo layout two side-by-side windows (capture/companion window never fully covered) and say so in the UI. Secondary: drive both ticks from a dedicated Worker ticker (snippet 'Worker ticker') and make classifyActivity time-based (use timestamps, not sample counts). Optional: Document PiP companion. |
| B | `components/useScreenPipeline.ts (sendToVision line 174, captureFrame l` | Trust gap. Frames go to the cloud vision model with only manually drawn masks painted; PII regions are discovered BY that model and applied afterwards to stored frames, using boxes from the previous response (stale if the screen changed). In `dom` mode nothing is auto-blurred. So 'personal data on screen is protected' currently means 'blurred in what we store, after the provider saw it'. | For the sandbox ERP, publish exact PII rectangles from the DOM (data-pii elements -> normalized getBoundingClientRect) over a BroadcastChannel and paint them before any toDataURL when displaySurface === 'browser' (snippet 'DOM PII masks'). Keep model-reported regions as a second layer. Pick a zdr=all vision model and state both facts honestly in the consent copy. |
| B | `lib/store.ts (lines 1-4, 10, 48-101) and README.md line 95` | Comment and README say the store is 'four functions' to swap for Supabase. It actually exports seven: getSession, saveSession, listSessions, getMap, saveMap, saveClip, readClip. All write under process.cwd()/.data, which is read-only on Vercel (writes throw). The globalThis cache is per instance. | Put a tiny document/bytes driver under it (readDoc, writeDoc, listDocs, deleteDoc, writeBytes, readBytes) with an fs implementation and a Supabase implementation chosen by env. Keep the seven exported signatures unchanged. See snippet 'Storage driver'. |
| C | `lib/erp.ts (lines 13-79)` | A second, separate fs writer that the 'swap the store' note misses: .data/erp.json (invoice queue) and .data/erp-guard.json (teach guard). On a read-only filesystem load() falls into its catch and calls persist(), which throws, so every ERP page and API call returns 500. Also the invoice queue and the guard are single global documents: two judges using one deployment at the same time overwrite each other's ERP state and guard. | Route erp.json and erp-guard.json through the same driver (keys 'erp/invoices', 'erp/guard'). If concurrent judges are expected, namespace both keys by a workspace id cookie; otherwise document 'one demo at a time' and add a visible Reset button. |
| A | `components/CaptureClient.tsx (lines 242, 309-318) and components/Teach` | The browser PUTs the entire SessionLog every 5 s, including every kept frame as a base64 data URL (960 px JPEG). The body grows without bound; GET /api/sessions/[id] returns the same blob. On Vercel either direction fails at 4.5 MB (413). The seeded demo hides this because its frames are 6 KB SVG placeholders, not screenshots. | Upload each frame once (POST /api/sessions/[id]/frames -> writeBytes) and keep only { id, t, width, height, url } in the log; or, as a stopgap, cap kept frames (e.g. 640 px, quality 0.5, max 40) and show a warning near the limit. Not needed on a single self-hosted instance. |
| B | `next.config.ts (line 5)` | `experimental.serverActions.bodySizeLimit: '8mb'` with the comment 'raise the body limit for route handlers' has no effect: it only applies to Server Actions, and the app has none. No allowedDevOrigins, so `next dev` behind a tunnel hostname has its dev assets/endpoints blocked. | Remove the serverActions block. Add `allowedDevOrigins: ['*.trycloudflare.com', '*.ngrok-free.app']`. Do not add `cacheComponents` (it removes `export const dynamic`, used by 4 pages) or a `webpack()` function (Turbopack build fails). |
| B | `.env.example (lines 12-13)` | Slugs are valid but dated: COMPILE_MODEL=anthropic/claude-sonnet-4.5 costs $3/$15 while anthropic/claude-sonnet-5.5 is $2/$10 and newer. VISION_MODEL=anthropic/claude-haiku-4.5 is the most expensive of the fast vision options ($1/$5); it does have zdr=all, which matters for the trust story. | Keep Haiku 4.5 as the safe default for vision until a latency bake-off says otherwise (snippet 'Vision bake-off'); set COMPILE_MODEL=anthropic/claude-sonnet-5.5 after the flat schema lands (it only supports native structured output, so the flat schema is a prerequisite). Add a gateway fallback list. |
| B | `lib/redact.ts (line 3)` | Header comment promises 'Swap in a Presidio sidecar via REDACT_URL'. No code anywhere reads REDACT_URL. | Delete the claim, or implement a 10-line optional POST to a presidio-analyzer container for transcript text only. Regex + region masking is the honest in-browser path. |
| B | `package.json` | No `engines` field although ai@7 requires Node >= 22 (Next 16 alone would accept 20.9). `@ai-sdk/gateway` is listed but never imported (ai re-exports it). No lint script (next lint no longer exists). | Add `"engines": { "node": ">=22" }`. Leave the gateway dep or remove it; harmless. |
| B | `.gitignore` | .data is ignored, so the seeded demo sessions and maps (demo_sabine, demo_sabine_confirmed) do not exist on any fresh clone or deployment until `npm run seed:session` runs there. | Run the seed as part of the host's start command (or on first request when the store is empty), or commit a seed/ directory the driver falls back to. |

---

## 5. Pitfalls (read once)

**ElevenAgents**

- The agent path has never been exercised against the real service in a way that would survive: with keys set, Start in Capture and Teach throws immediately (setMicMuted right after connect) and Debrief relies on a 2.5 s timer. Budget time for a real end-to-end voice test early; the keyless fallback hides all of this.
- Default max conversation duration is 600 s. Any agent created in the dashboard (rather than by the script) will hang up at 10 minutes unless max_duration_seconds is raised (60-7200).
- turn_timeout cannot exceed 30 s and cannot be disabled per the docs: a muted, silent session makes the agent take a turn every 30 s unless user_activity pings reset the timer or the LLM reliably calls skip_turn. A user_activity ping also suppresses agent speech for at least 2 s, so do not ping just before an [ASK].
- There is a short live-mic window at session start: the mic is published when the WebRTC session connects and is muted only when the SDK's micMuted effect runs after the conversation object is created. Speech in that window can trigger an agent turn; keep first_message empty and the prompt strict.
- In WebRTC mode isSpeaking comes from LiveKit active-speaker events (first active speaker's identity starts with 'agent'). It can flicker during pauses in TTS and flips to listening if the local user is the loudest speaker. The governor uses the true-to-false edge to open the mic; debounce it (about 600-800 ms) or the answer window opens mid-question.
- Tagged messages are user messages to an LLM, not a say-verbatim API. 'Read exactly as written' for the teach-back is best effort; use temperature 0 and keep teach-back text short. Any bracketed token the LLM echoes can be treated as an Eleven v3 audio tag.
- Expressive Mode injects an audio-tags prompt (expressive_mode default true), so the model may add [laughs] and similar tags. For a calm interviewer, steer tone in the system prompt and/or supply suggested_audio_tags.
- Eleven v3 Conversational does not preserve Professional Voice Clone characteristics; pick a stock or instant voice.
- The Expressive Mode docs page shows model_id 'eleven_v4_turbo' in its code samples while describing V3 Conversational, and the API says expressive_mode is automatically disabled for non-v3 models. Use eleven_v3_conversational and confirm in the dashboard.
- Overrides are rejected unless enabled per field on the agent, and empty-string overrides are discouraged. Enabling the prompt override on a public agent lets anyone with the agent id run arbitrary prompts on your credits.
- Client tool names and parameter names are case-sensitive and must match on both sides; a tool created with expects_response false will not wait for the browser, and one with true blocks the agent until the handler returns (20 s default timeout).
- Sending a new user_message from inside a blocking client-tool handler (current debrief flow) races with the tool result. Chain through the tool result instead.
- Contextual updates on every screen event can overwhelm the LLM context over a 10+ minute task; the docs advise concise, grouped updates.
- Knowledge base usage_mode 'auto' silently changes behaviour if someone enables RAG on the agent (adds about 250 ms and retrieves chunks instead of the whole map). Use 'prompt' for the Work Map and keep it under roughly 300,000 characters (system prompt cap 2MB).
- The tutor is one shared agent: KB sync is last-write-wins across sessions and experts, and each agents.update creates a new agent version. Inject the map per session as well.
- Procedure drafts are per-user, per-branch and do nothing until published with an Update agent call on that branch; the agent keeps only the five most recently started procedures in context.
- MCP must be enabled per workspace first, the MCP server must be publicly reachable (not localhost), the default approval policy requires approval for every tool call, and MCP is unavailable with Zero Retention Mode.
- Trust claims: by default ElevenLabs stores agent conversation transcripts and audio (record_voice true; retention unlimited/2 years). The app's 'strike' does not remove ElevenLabs' copy. PII redaction and Zero Retention Mode are enterprise features, so do not claim them unless the account has them; what can be claimed truthfully is: mic muted outside question windows (no audio content reaches the agent), record_voice off, short retention, per-conversation delete via API, and client-side redaction before anything is stored by the app.
- The separate Scribe v2 Realtime stream is not muted by the governor and hears everything, including the agent's own voice through speakers. Scribe sessions can end with session_time_limit_exceeded or insufficient_audio_activity during long silent stretches; useTranscriber has no error handling or reconnect, and single-use tokens are consumed on use (fetch a new one per reconnect).
- Per-session language override requires the language override to be enabled and the target language configured on the agent (language_presets); the language_detection tool is useless without presets.
- The JS SDK 2.70.0 types conversationConfig with Output-shaped models (for example AgentConfig.prompt is PromptAgentApiModelOutput), so TypeScript may complain or need casts in create/update calls even when the runtime payload is correct.

**Scribe / audio**

- Nothing in the voice path has been run against real services in this review: the starter copy has no node_modules, no .env.local and no keys. Every statement that the agent/Scribe path works is from reading code and docs. First task for whoever owns voice: npm install, typecheck, and the smoke test in snippet 0.
- Silent Scribe death is the most dangerous failure for the REQUIRED 'asks at a natural pause' behaviour: if the socket closes (insufficient_audio_activity during quiet typing, session time limit, network), the current code keeps showing 'Scribe v2', the silence light goes permanently green and the agent can interrupt speech. Reconnect watchdog plus governor fail-closed are mandatory.
- The agent mic mute path throws in @elevenlabs/react 1.16.0 when no session is live. In the current code that can stall the debrief before its first question, block a tutor intervention, and leave the capture governor stuck with an open window. Make mute state-only (micMuted prop).
- Echo on laptop speakers: a judge will probably not wear headphones. The agent's question can be transcribed by Scribe and stored as the expert's answer, because commits arrive about 1 s after the audio and the isSpeaking check has already flipped. Use interval-plus-text echo detection and half-duplex Scribe mute on speakers. Echo cancellation helps only for WebRTC playback; the keyless speechSynthesis fallback is not covered by the 'remote-only' guarantee, so the fallback demo is more echo-prone than the real one.
- Scribe word timestamps are not on the session clock and their reference point is undocumented. Using them as session time misaligns transcript quotes with screen moments and with off-record strike ranges. Use wall-clock times.
- Effective pause threshold is currently about 3.6 s, not 2.5 s, because the commit event resets the speech clock. After fixing it, re-tune silenceSecs by feel; do not assume the old demo timing.
- The agent is re-engaged by the platform every turn_timeout (max 30 s) and stays quiet only if the LLM calls skip_turn every time. Over a 10 minute capture that is about 20 chances to speak out of turn. Add the sendUserActivity heartbeat or a volume gate; do not rely on the prompt alone.
- Hold-to-pause currently keeps streaming audio to ElevenLabs while the UI says nothing is transmitted. A judge probing the Trust criterion can catch this from the network tab. Mute the Scribe connection on hold. Also note enable_logging defaults to true and zero-retention is enterprise only, so do not claim ElevenLabs stores nothing.
- Chromium desktop only. Safari can mute the first microphone capture when a second getUserMedia is made, and this app makes three (Scribe, agent, MediaRecorder). Put a browser check on the start screen.
- The capture tab is hidden while the expert works in the ERP tab. Timers drop to once per second (fine), but in keyless mode with no WebRTC connection Chrome drops them to once per minute after 5 minutes hidden, which breaks the governor and frame sampling in long keyless demos. Prefer a separate window for the ERP, or run with the agent connected.
- useScribe captures callbacks at connect time and appends duplicate segments to committedTranscripts when timestamps are on. If the team keeps the hook instead of snippet 2, callbacks must only touch refs and nobody should render committedTranscripts directly.
- filterBackgroundAudio cannot be combined with includeTimestamps, and with timestamps off the with-timestamps commit event may not fire. Changing one flag without changing the handler makes commits disappear.
- Single-use tokens are consumed on first use and expire in 15 minutes: never reuse one for a reconnect, never prefetch one at page load for a session that starts later, and never let any layer cache /api/scribe-token.
- Cost and concurrency while four people develop in parallel on one account: every open capture/teach tab holds one agent conversation ($0.08/min for its whole duration, even muted) and one Scribe socket ($0.39/h). Starter-tier agent concurrency is 4. Use keyless mode for UI work and disconnect agents when idle.
- When two parallel changes touch components/voice.tsx (agent side and transcriber side) they will conflict: it is one 300-line file shared by all three modules. Assign the whole file to one owner or split it into voice-agent.tsx and transcriber.ts first.
- Bluetooth headsets that also provide the microphone switch to a low-quality hands-free profile when capture starts, which makes the Expressive Mode voice sound poor in the demo. Use wired headphones, or Bluetooth for output with the laptop mic as input. (General WebRTC behaviour, not from ElevenLabs docs.)

**Platform**

- Deploying the starter to Vercel unchanged breaks immediately: lib/store.ts and lib/erp.ts write under process.cwd()/.data on a read-only filesystem, so the ERP pages, session creation, map save, clip upload and the teach guard all fail. Pointing DATA_DIR at /tmp only 'works' per instance and loses data between instances.
- The LLM compile pass probably never succeeds against an Anthropic model because of the recursive schema, and the failure is swallowed into a deterministic fallback. Anyone demoing 'the LLM built this map' should first confirm `llm: true` in the /api/compile response.
- generateObject has no `timeout` option in v7 and defaults to 2 retries; a slow vision call blocks the single in-flight slot. Use generateText + timeout + maxRetries 0, and abort the browser fetch too.
- Never wrap a data URL as { type: 'data', data: 'data:...' } in a v7 file part; it throws. Strip the prefix or pass the bare string.
- claude-sonnet-5.5 / opus-5.5 only do native structured output (no JSON-tool fallback) and do not list temperature as a supported parameter; schemas for them must be flat and constraint-free.
- Gemini 3.x flash models cannot turn reasoning off (low/high only), which may cost latency on the 1 to 2 second frame loop; measure before switching VISION_MODEL.
- If the capture page is a background tab in the same window as the ERP, its timers run once per second and typing/pause detection changes. A fully covered window is treated the same way. Demo with two side-by-side windows.
- BroadcastChannel telemetry silently delivers nothing if the two tabs differ in origin (localhost vs 127.0.0.1, tunnel URL vs localhost, preview URL vs production alias) or browser profile (normal vs incognito). The app then looks alive but hears no ERP events.
- The ERP invoice queue and the teach guard are single global documents on the server: two people using one deployment at once corrupt each other's run. Plan for one demo at a time or namespace by workspace cookie.
- getDisplayMedia and getUserMedia need a secure context: http://localhost works, a LAN IP over http does not. Permission cannot be remembered, so every session needs a click; calling it outside a click handler throws InvalidStateError.
- Picker hints are hints: a judge can still pick a window or (if not excluded) a screen. DOM-published PII rectangles only line up for tab capture; check track.getSettings().displaySurface and fall back to manual masks otherwise.
- Frames currently reach the vision provider before any automatic PII blur. Do not claim otherwise in the pitch until DOM masks are painted pre-upload.
- The seeded demo session uses 6 KB SVG placeholder frames; real sessions carry real JPEGs inside the session JSON, so payload-size problems will not show up until a real capture runs.
- `next dev` holds a lockfile per project directory: two agents cannot each run a dev server in the same checkout. Use git worktrees and distinct ports, or one shared dev server.
- `next dev` re-adds the AGENTS.md managed block and regenerates next-env.d.ts; commit AGENTS.md once so four people do not fight over the diff.
- NEXT_PUBLIC_* variables are inlined at build time. Changing an agent id or event source on the host requires a rebuild, not just a restart.
- Document PiP closes when its opener navigates; any client-side route change away from the capture page kills the companion. It also needs its own user gesture.
- Quick tunnels do not support Server-Sent Events and change hostname on every restart; if a streaming endpoint is added later, it will not work through trycloudflare.
- .data is git-ignored: a fresh deployment has no demo_sabine sessions until the seed script runs there.

---

## 6. Unknowns — measure these with a real key, do not assume

- Whether a conversation fails to start when the prompt references {{expert_name}} / {{newhire_name}} and no dynamicVariables are passed, or whether agent-level placeholders are used as runtime defaults. Official docs only call placeholders testing defaults; third-party sources report a 'Missing required dynamic variables' error. Not confirmed.
- Which API model_id the dashboard option 'V3 Conversational' maps to today (eleven_v3_conversational vs eleven_v4_turbo), given the Expressive Mode page's samples use eleven_v4_turbo; and whether expressive_mode stays active on eleven_v4_turbo.
- Official relative latency of the selectable LLMs. The docs give no ranking or numbers; which model is fastest must be measured in the team's own workspace.
- Whether the turn timeout keeps re-firing every 30 s after the agent has called skip_turn, and whether turn_timeout accepts any value that disables it (docs state 1-30 only).
- Whether a user_message sent while the agent is speaking interrupts the current utterance, is queued, or is merged; and the ordering guarantee between a user_message sent during a pending blocking client-tool call and that tool's result.
- Whether an empty-string first_message override is accepted, ignored, or rejected by the platform.
- Default value of conversation.client_events when omitted, and whether conversation_initiation_metadata and ping are always sent regardless of the list (the API reference lists them as enum values without a default).
- Whether a client tool with parameters { type: 'object', properties: {} } is accepted by POST /v1/convai/tools (parameters is optional/nullable; safest is to omit it).
- Whether knowledge base or agent config changes made by agents.update affect an already running conversation or only new ones.
- Whether per-agent zero_retention_mode can be switched on by a non-enterprise workspace (the per-agent page does not state plan gating; the general ZRM page says enterprise).
- Exact retention default: the retention docs page says 2 years while the API reference lists retention_days default -1 (no limit).
- Whether per-session knowledge_base / tool_ids overrides can be sent from the web SDK: the overrides docs show them in a JavaScript sample, but @elevenlabs/client 1.26.0 only types and forwards agent.prompt { prompt, llm }, first_message, language, tts, asr.keywords and text_only.
- Whether file/image input (uploadFile + sendMultimodalMessage) works inside a voice (WebRTC) conversation or only in chat/text channels; the docs describe it as attaching files 'in chat'.
- Whether passing a language override for a language without a language_preset errors or works with eleven_v3_conversational.
- The Scribe v2 Realtime maximum session length for the team's plan (only the error name session_time_limit_exceeded is documented).
- The force-delete parameter name for knowledge base documents in the JS SDK (docs mention force deletion but the snippet was not shown on the pages read).
- Whether the LiveKit mute in WebRTC mode still transmits silence packets at the transport level (the SDK calls track.mute(); transport behaviour was not verified).
- The context7 MCP docs tool was not consulted; all facts come from the official elevenlabs.io docs markdown, the API reference pages and the published npm package contents (unpkg) fetched on 2026-10-03. Nothing was run against a live ElevenLabs account, so no behaviour above is empirically tested.
- Maximum Scribe realtime session duration: the error session_time_limit_exceeded exists but no value is documented. One third-party search snippet mentioned 5 hours; not confirmed on elevenlabs.io.
- The threshold behind insufficient_audio_activity (how long a mostly silent stream is tolerated). Not documented. Must be measured with a real key (snippet 0, step 4).
- Whether word start/end times are relative to the session's audio start or reset per committed segment. The API reference only says 'Start time in seconds'.
- The exact auto-commit ceiling for manual mode: the commit-strategies page states a figure, but my reads of it were inconsistent (36 s vs 90 s). Irrelevant under VAD commit; check the page if manual commit is ever used.
- Whether Scribe v2 Realtime is usable on the Free plan (pricing lists no included realtime hours for Free) and what credits the hackathon account has.
- Whether an agent conversation's internal ASR counts against the realtime STT concurrency limit in addition to the agent concurrency limit.
- No official ElevenLabs statement was found on running useScribe and an Agents WebRTC conversation in the same tab. The conclusion that it works rests on both SDKs making independent getUserMedia calls and on general Chromium behaviour; it was not tested here.
- How well Chrome's echo cancellation removes the agent voice from the Scribe stream on laptop speakers in practice. Not measured; plan for residual echo.
- Whether Scribe realtime actually emits audio_event tokens (the 1.16.0 types allow type 'audio_event'; the API reference summary listed only word and spacing).
- How tentative_user_transcript reaches the app in client 1.26.0 (no dedicated handler found; possibly only via onIncomingEvent or onDebug).
- Whether turn_timeout can be disabled (docs: range 1-30 s, nothing about -1) and exactly what the agent does on a turn timeout when the LLM returns skip_turn (whether the timer simply re-arms).
- Whether sendUserActivity resets the turn-timeout timer or only suppresses speech for about 2 seconds; the heartbeat mitigation is based on the documented purpose, not on a test.
- Whether useScribe clears its internal connection ref after a server-initiated close (affects reconnecting through the hook). Snippet 2 avoids the question by owning the connection.
- LiveKit's stopMicTrackOnMute default could not be fetched from LiveKit docs; the ElevenLabs client source (as summarised) mutes the track without stopping it.
- Limits and price of keyterms and entity_detection on the realtime model (pricing page lists add-on prices for batch only; an SDK comment says max 50 keyterms of up to 20 characters, unconfirmed in docs).
- Which API key permission scope is required to mint realtime_scribe tokens with a restricted key.
- Whether `import { Scribe, RealtimeEvents } from "@elevenlabs/react"` type-checks as written (the package re-exports @elevenlabs/client, but this was not compiled). If it does not, import from "@elevenlabs/client" and add it to package.json at 1.26.0.
- Whether overriding agent.language to 'de' works without first adding German as a supported language on the agent in the dashboard (outside this assignment, relevant to the any-language stretch).
- Whether /api/vision and the LLM compile pass work against the real gateway today. No key was available to me. The recursive-schema and min/max failures are predicted from Anthropic's documented limits, not observed; it is undocumented whether the AI SDK or the gateway strips or rewrites unsupported keywords.
- Actual latency and accuracy of each vision model on ERP screenshots. Prices and capabilities are verified; speed is not. Run the bake-off.
- Whether Chrome keeps delivering fresh frames to a <video> element (and canvas.drawImage) in a hidden capturing tab, and whether requestVideoFrameCallback fires there. I found no authoritative Chrome statement; a WebKit bug shows Safari fails at this. Test for 10 minutes with the capture tab backgrounded.
- Whether dedicated Worker timers are exempt from background throttling in current Chrome. Widely reported and used by libraries, but not stated in Chrome's throttling article.
- Whether a Document PiP window keeps its opener's timers unthrottled when the opener tab is hidden, and whether requestWindow and getDisplayMedia can share one click. Use separate buttons.
- Whether macOS Chrome applies the same occlusion throttling as documented for Windows.
- Whether Chrome's tab-capture frame is exactly the page viewport in all cases (zoom, devtools open, device pixel ratio). Assumed by the DOM mask snippet; verify by drawing a test rectangle.
- Whether `next start` honours a PORT environment variable without -p; I did not re-fetch the CLI page today. Use `next start -p $PORT`.
- Whether Railway's builder copies public/ and .next/static for the standalone start command its guide prescribes, and current Railway trial/pricing terms. Fly.io was not checked at all.
- Vercel's default Node.js version for new projects and whether preview deployments are behind Vercel Authentication by default for this team; check project settings before sending judges a preview URL.
- Supabase details not re-fetched today: `.maybeSingle()`, `.like()`, `storage.download()` return shape, service-role bypass of RLS, and any request-size ceiling for multi-megabyte jsonb rows. These are long-standing supabase-js v2 behaviours but unverified in this session.
- Upstash was not evaluated.
- ElevenLabs-side facts (agent WebRTC vs WebSocket transport, Scribe v2 Realtime token flow, client tool wiring) were outside this assignment and are not verified here.

---

## 7. Reference snippets (unverified against a live account — adapt, type-check, test)

### ElevenAgents: voice.tsx: connection-safe say / mute / keep-quiet (replaces unguarded calls)

```ts
const outbox = useRef<string[]>([]);
const quietRef = useRef(true); // true while no question window is open; set false in say(), true again when the window closes

const conversation = useConversation({
  micMuted, // controlled: the SDK applies conversation.setMicMuted() itself once a session exists
  onMessage: (m) => setMessages((xs) => [...xs, { role: m.role === "agent" ? "agent" : "user", text: m.message, t: Date.now() }]),
  onError: (message) => setError(message),
  onDisconnect: (d) => setError(d.reason === "error" ? d.message : d.reason === "agent" ? "agent ended the session" : null),
  onUnhandledClientToolCall: (c) => console.warn("unregistered client tool", c.tool_name),
});

useEffect(() => {
  if (conversation.status !== "connected") return;
  for (const m of outbox.current.splice(0)) { try { conversation.sendUserMessage(m); } catch {} }
  const id = window.setInterval(() => {
    if (quietRef.current) { try { conversation.sendUserActivity(); } catch {} } // resets the 30 s turn timeout
  }, 15_000);
  return () => window.clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [conversation.status]);

const connect = async (opts?: { firstMessage?: string; prompt?: string; language?: string; vars?: Record<string, string> }) => {
  const agent = {
    ...(opts?.firstMessage ? { firstMessage: opts.firstMessage } : {}), // never send ""
    ...(opts?.prompt ? { prompt: { prompt: opts.prompt } } : {}),
    ...(opts?.language ? { language: opts.language as "en" } : {}),
  };
  conversation.startSession({ // returns void in @elevenlabs/react 1.16.0
    agentId: agentId!,
    connectionType: "webrtc",
    dynamicVariables: opts?.vars ?? {},
    ...(Object.keys(agent).length ? { overrides: { agent } } : {}),
  });
};

const say = (tag: string, text: string) => {
  const msg = `[${tag}] ${text}`;
  quietRef.current = false;
  if (conversation.status === "connected") { try { conversation.sendUserMessage(msg); } catch { outbox.current.push(msg); } }
  else outbox.current.push(msg);
};

const setMicMuted = (m: boolean) => setMicMutedState(m); // do NOT call conversation.setMuted(): it throws when no session is live
```

### ElevenAgents: create-agents.ts: agent body aligned with the current API reference (JS SDK 2.70.0)

```ts
await client.conversationalAi.agents.create({
  name,
  tags: ["tacit", "hack-nation"],
  conversationConfig: {
    agent: {
      firstMessage, // "" = agent waits for the user
      language: "en",
      dynamicVariables: { dynamicVariablePlaceholders: dynamicVars },
      prompt: {
        prompt,
        llm: LLM,            // e.g. "gemini-2.5-flash"; list valid ids with GET /v1/convai/llm/list
        temperature: 0,
        toolIds,
        builtInTools: {
          skipTurn: { type: "system", name: "skip_turn", description: "Stay silent when no tagged message was received, or the user needs a moment.", params: { systemToolType: "skip_turn" } },
        },
      },
    },
    tts: { modelId: "eleven_v3_conversational", expressiveMode: true, ...(VOICE ? { voiceId: VOICE } : {}) },
    turn: { turnTimeout: 30, silenceEndCallTimeout: -1, turnEagerness: "patient" },
    conversation: {
      maxDurationSeconds: 3600, // default 600, allowed 60-7200
      clientEvents: ["audio", "interruption", "user_transcript", "agent_response", "agent_response_correction", "client_tool_call", "agent_tool_response"],
    },
  },
  platformSettings: {
    auth: { enableAuth: false },
    privacy: { recordVoice: false, retentionDays: 7 },
    overrides: { conversationConfigOverride: { agent: { firstMessage: true, language: true, prompt: { prompt: true } }, tts: { voiceId: true } } },
  },
});
```

### ElevenAgents: create-agents.ts: client tool creation (quiet, no-arg safe)

```ts
const hasParams = Object.keys(t.parameters.properties).length > 0;
const res = await client.conversationalAi.tools.create({
  toolConfig: {
    type: "client",
    name: t.name,                 // case-sensitive; must equal the useConversationClientTool name
    description: t.description,
    expectsResponse: t.expectsResponse, // true = agent blocks until the browser returns; result is appended to context
    responseTimeoutSecs: 20,      // 1-120
    preToolSpeech: "off",         // do not let the agent talk before calling the tool
    ...(hasParams ? { parameters: { type: "object", required: t.parameters.required ?? [], properties: Object.fromEntries(Object.entries(t.parameters.properties).map(([k, v]) => [k, { type: v.type as "string" | "number" | "boolean", description: v.description ?? k }])) } } : {}),
  },
});
return res.id;
```

### ElevenAgents: elevenlabs-sync.ts: minimal knowledge-base patch (no prompt round-trip)

```ts
const doc = await client.conversationalAi.knowledgeBase.documents.createFromText({ text, name });
const agent = await client.conversationalAi.agents.get(agentId);
const existing = (agent.conversationConfig?.agent?.prompt?.knowledgeBase ?? []).filter((k) => !k.name.startsWith(DOC_PREFIX));
await client.conversationalAi.agents.update(agentId, {
  conversationConfig: { agent: { prompt: { knowledgeBase: [...existing, { type: "text", id: doc.id, name: doc.name, usageMode: "prompt" }] } } },
});
// later revisions of the same map: update in place instead of creating a new document
// await client.conversationalAi.knowledgeBase.documents.update(doc.id, { name, content: newText });
```

### ElevenAgents: Procedures from the Work Map (one free-form procedure per guardrail), then publish

```ts
const agent = await client.conversationalAi.agents.get(agentId);
const branchId = agent.mainBranchId!;
for (const rule of map.rules) {
  await client.conversationalAi.agents.procedures.create(agentId, branchId, {
    name: rule.title,
    type: "free_form",
    trigger: `When the new hire is about to break or asks about: ${rule.title}`,
    content: `Say what ${map.expert.name} does, quote her exact words, then ask why. Her words: "${rule.quotes[0]?.text ?? ""}"`, // max 50,000 chars
  });
}
await client.conversationalAi.agents.update(agentId, { branchId }); // publishes every changed procedure draft on the branch
```

### ElevenAgents: Optional MCP guardrail-lookup server for the tutor

```ts
await client.conversationalAi.settings.update({ canUseMcpServers: true }); // workspace opt-in, once
const server = await client.conversationalAi.mcpServers.create({
  config: {
    url: "https://<public-host>/api/mcp", // must be reachable from ElevenLabs; SSE or streamable HTTP
    name: "Tacit Work Map",
    description: "Look up guardrails and the expert's words for a step",
    approvalPolicy: "auto_approve_all",  // API enum: auto_approve_all | require_approval_all | require_approval_per_tool
    transport: "STREAMABLE_HTTP",        // or "SSE"
  },
});
await client.conversationalAi.agents.update(agentId, { conversationConfig: { agent: { prompt: { mcpServerIds: [server.id] } } } });
// also add "mcp_tool_call" and "mcp_connection_status" to conversation.clientEvents
```

### ElevenAgents: Debrief chaining through the blocking tool result (MapClient tools)

```ts
log_answer: async (p) => {
  const slot = currentRef.current;
  if (!slot) return "no open slot";
  const m = await fill(slot, heardRef.current.trim() || String(p.reason ?? ""));
  const next = openSlots(m)[0];
  if (next) { setCurrent(next); return `logged. NEXT: [DEBRIEF] slot=${next.id} ${next.question}`; }
  const tb = await fetch("/api/teachback", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ sessionId: m.sessionId }) }).then((r) => r.json());
  setTeachback(tb); setPhase("teachback");
  return `logged. NEXT: [TEACHBACK] ${tb.text}`;
},
// interviewer.md addition: "When a tool result contains NEXT:, treat what follows exactly like a tagged message."
```

### ElevenAgents: Private-agent option: server route for a WebRTC conversation token

```ts
// app/api/agent-token/route.ts
export async function GET(req: Request) {
  const agentId = new URL(req.url).searchParams.get("agent") === "tutor" ? process.env.NEXT_PUBLIC_TUTOR_AGENT_ID : process.env.NEXT_PUBLIC_INTERVIEWER_AGENT_ID;
  const r = await fetch(`https://api.elevenlabs.io/v1/convai/conversation/token?agent_id=${agentId}`, { headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY! } });
  if (!r.ok) return Response.json({ token: null }, { status: 500 });
  const { token } = await r.json();
  return Response.json({ token });
}
// client: conversation.startSession({ conversationToken: token, dynamicVariables, overrides })
```

### ElevenAgents: Off the record on the ElevenLabs side (server)

```ts
// keep the id from onConnect: ({ conversationId }) => ...
await fetch(`https://api.elevenlabs.io/v1/convai/conversations/${conversationId}`, {
  method: "DELETE",
  headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY! },
}); // deletes the whole stored conversation; combine with privacy.recordVoice=false and a short retentionDays
```

### Scribe: 0. Two-minute smoke test with a real key (do this before any coding)

```bash
# 1) token (expect {"token":"sutkn_..."}; a 401/403 here means the key or its Speech-to-Text scope is wrong)
curl -s -X POST https://api.elevenlabs.io/v1/single-use-token/realtime_scribe -H "xi-api-key: $ELEVENLABS_API_KEY"

# 2) the URL the browser SDK opens with that token (for reference / wscat testing)
# wss://api.elevenlabs.io/v1/speech-to-text/realtime?model_id=scribe_v2_realtime&token=sutkn_...&commit_strategy=vad&vad_silence_threshold_secs=1&include_timestamps=true&include_language_detection=true

# 3) in the app: npm install && npm run typecheck && npm run dev, open /capture in Chrome,
#    header tag must read "Scribe v2" (green). If it reads "browser STT", GET /api/scribe-token and read `reason`.
# 4) stay silent for 3 minutes with the session open: the tag must stay green (tests insufficient_audio_activity + reconnect).
```

### Scribe: 1. app/api/scribe-token/route.ts (hardened; API call unchanged)

```ts
import { NextResponse } from "next/server";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";

export const dynamic = "force-dynamic"; // a single-use token must never be cached
const noStore = { headers: { "cache-control": "no-store" } };

/** Single-use Scribe token (15 min TTL, consumed on first use). One per connect AND per reconnect. */
export async function GET() {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) return NextResponse.json({ token: null, reason: "ELEVENLABS_API_KEY not set" }, noStore);
  try {
    const client = new ElevenLabsClient({ apiKey });
    const { token } = await client.tokens.singleUse.create("realtime_scribe");
    return NextResponse.json({ token }, noStore);
  } catch (err) {
    const reason = err instanceof Error ? err.message : "token request failed";
    console.error("[scribe-token]", reason);
    return NextResponse.json({ token: null, reason }, noStore);
  }
}
```

### Scribe: 2. components/voice.tsx: reconnecting transcriber on the client-level Scribe API (replaces the useScribe half of useTranscriber)

```ts
import { Scribe, RealtimeEvents, CommitStrategy, type RealtimeConnection } from "@elevenlabs/react"; // re-exported from @elevenlabs/client; verify the import compiles

export interface TranscriberOptions {
  enabled: boolean;
  language?: string; // ISO 639-1/-3 ("de", "en"); undefined = auto-detect
  keyterms?: string[];
  onPartial: (text: string) => void; // only non-empty, CHANGED partials: this is the speech clock
  onCommitted: (text: string, startMs: number, endMs: number, language?: string) => void; // wall-clock epoch ms
}

export function useTranscriber(opts: TranscriberOptions) {
  const [engine, setEngine] = useState<"scribe" | "webspeech" | "none">("none");
  const [connected, setConnected] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const optsRef = useRef(opts);
  optsRef.current = opts;
  const conn = useRef<RealtimeConnection | null>(null);
  const wantMuted = useRef(false);

  /** Scribe receives silence (track.enabled=false) and the socket stays open. Hold-to-pause, and agent speech on speakers. */
  const setMuted = useCallback((m: boolean) => {
    wantMuted.current = m;
    try {
      if (m) conn.current?.mute();
      else conn.current?.unmute();
    } catch {
      /* mic not attached yet; re-applied after session start */
    }
  }, []);

  useEffect(() => {
    if (!opts.enabled) return;
    let stopped = false;
    let busy = false;
    let giveUp = false; // no key / auth / quota: stop retrying, use the browser recognizer
    let seg: { startMs: number; lastMs: number; text: string } | null = null;

    const open = async () => {
      if (stopped || busy || giveUp || conn.current) return;
      busy = true;
      try {
        const res = await fetch("/api/scribe-token", { cache: "no-store" });
        const { token, reason } = res.ok ? await res.json() : { token: null, reason: `HTTP ${res.status}` };
        if (stopped) return;
        if (!token) {
          giveUp = true;
          setProblem(reason ?? "no token");
          startWebSpeech(); // the existing webkitSpeechRecognition block, moved into a function; sets engine "webspeech"
          return;
        }
        const c = Scribe.connect({
          token, // single use: a fresh one for every (re)connect
          modelId: "scribe_v2_realtime",
          commitStrategy: CommitStrategy.VAD,
          vadSilenceThresholdSecs: 1.0,
          includeTimestamps: true,
          includeLanguageDetection: true,
          languageCode: optsRef.current.language,
          keyterms: optsRef.current.keyterms,
          microphone: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        });
        conn.current = c;
        const mine = () => conn.current === c;
        const drop = (why: string, fatal = false) => {
          if (!mine()) return;
          conn.current = null;
          seg = null;
          setConnected(false);
          setProblem(why);
          if (fatal) {
            giveUp = true;
            startWebSpeech();
          }
          try {
            c.close();
          } catch {
            /* already closed */
          }
        };
        c.on(RealtimeEvents.SESSION_STARTED, () => {
          if (!mine()) return;
          setEngine("scribe");
          setConnected(true);
          setProblem(null);
          if (wantMuted.current) window.setTimeout(() => mine() && setMuted(true), 800);
        });
        c.on(RealtimeEvents.PARTIAL_TRANSCRIPT, ({ text }) => {
          const t = (text ?? "").trim();
          if (!mine() || !t) return;
          const now = Date.now();
          seg ??= { startMs: now, lastMs: now, text: "" };
          if (t === seg.text) return; // unchanged partial or server keepalive: not speech
          seg.text = t;
          seg.lastMs = now;
          optsRef.current.onPartial(t);
        });
        c.on(RealtimeEvents.COMMITTED_TRANSCRIPT_WITH_TIMESTAMPS, (d) => {
          if (!mine()) return;
          const s = seg;
          seg = null;
          const text = (d.text ?? "").trim();
          const spoken = d.words ? d.words.some((w) => w.type === "word") : text.length > 0;
          if (!text || !spoken) return;
          const now = Date.now();
          optsRef.current.onCommitted(text, s?.startMs ?? now, s?.lastMs ?? now, d.language_code ?? undefined);
        });
        c.on(RealtimeEvents.AUTH_ERROR, () => drop("auth", true));
        c.on(RealtimeEvents.QUOTA_EXCEEDED, () => drop("quota", true));
        c.on(RealtimeEvents.UNACCEPTED_TERMS, () => drop("terms not accepted", true));
        c.on(RealtimeEvents.INSUFFICIENT_AUDIO_ACTIVITY, () => drop("idle"));
        c.on(RealtimeEvents.SESSION_TIME_LIMIT_EXCEEDED, () => drop("session time limit"));
        c.on(RealtimeEvents.CLOSE, () => drop("closed"));
      } catch {
        /* the watchdog retries */
      } finally {
        busy = false;
      }
    };

    void open();
    const watchdog = window.setInterval(open, 1500); // hidden tabs tick at most once per second, which is fine
    return () => {
      stopped = true;
      window.clearInterval(watchdog);
      const c = conn.current;
      conn.current = null;
      try {
        c?.close();
      } catch {
        /* ignore */
      }
      stopWebSpeech();
      setConnected(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts.enabled]);

  return { engine, connected, healthy: connected, problem, setMuted };
}
```

### Scribe: 3. components/CaptureClient.tsx: speech clock from end of speech, echo guard, pause that really pauses

```ts
// agent speaking intervals in session seconds
const agentSpans = useRef<{ from: number; to: number | null }[]>([]);
useEffect(() => {
  const t = nowSecs();
  const last = agentSpans.current.at(-1);
  if (voice.isSpeaking) agentSpans.current.push({ from: t, to: null });
  else if (last && last.to === null) last.to = t;
}, [voice.isSpeaking, nowSecs]);

const duringAgent = (fromS: number, toS: number, tail = 0.8) => agentSpans.current.some((s) => fromS <= (s.to ?? Infinity) + tail && toS >= s.from);
const words = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N} ]/gu, " ").split(/\s+/).filter(Boolean);
const agentSaid = () => voiceRef.current.messages.filter((m) => m.role === "agent").slice(-2).map((m) => m.text).join(" ") + " " + (log.current.windows.at(-1)?.question ?? "");
const isEcho = (heard: string) => {
  const h = words(heard);
  const a = new Set(words(agentSaid()));
  return h.length > 0 && h.filter((w) => a.has(w)).length / h.length >= 0.6;
};

const transcriber = useTranscriber({
  enabled: started,
  onPartial: (text) => {
    if (holdingRef.current) return;
    const t = nowSecs();
    if (!voiceRef.current.isSpeaking && !duringAgent(t - 0.3, t)) lastSpeechAt.current = t;
    setPartial(text);
  },
  onCommitted: (text, startMs, endMs) => {
    if (holdingRef.current) return;
    setPartial("");
    const L = log.current;
    const from = Math.max(0, (startMs - L.startedAt) / 1000);
    const to = Math.max(from, (endMs - L.startedAt) / 1000);
    if (duringAgent(from, to) && isEcho(text)) {
      L.transcript.push({ id: `tr_${L.transcript.length}`, t: from, text, speaker: "agent", final: true });
      return;
    }
    lastSpeechAt.current = Math.max(lastSpeechAt.current, to); // when she stopped, not when the commit landed
    const { text: clean, entities } = redactText(text);
    entitiesRedacted.current += entities.length;
    L.transcript.push({ id: `tr_${L.transcript.length}`, t: from, text: clean, speaker: "expert", final: true });
    // ...rest unchanged: open-window answer capture, off-record phrase, narrationFills, extractThresholds
  },
});

// hold-to-pause stops audio leaving the machine; on speakers Scribe is half-duplex while the agent talks
const [headphones, setHeadphones] = useState(true); // checkbox on the start screen
useEffect(() => {
  transcriber.setMuted(holding || (!headphones && voice.isSpeaking));
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [holding, headphones, voice.isSpeaking]);

// governor tick: fail closed when the transcript is offline
// const s = { ...existing, transcriberHealthy: transcriber.healthy };

// endTask: release the recorder's microphone
// micStream.current?.getTracks().forEach((t) => t.stop()); micStream.current = null;
```

### Scribe: 4. components/voice.tsx (VoiceInner): mute by prop only, connect that waits, say that degrades

```ts
const statusRef = useRef<string>("disconnected");
const waiters = useRef<((ok: boolean) => void)[]>([]);

const conversation = useConversation({
  micMuted, // controlled: the SDK applies it when a conversation exists and on every change
  onMessage: (m) => setMessages((xs) => [...xs, { role: m.role === "agent" ? "agent" : "user", text: m.message, t: Date.now() }]),
  onError: (message) => {
    setError(String(message));
    waiters.current.splice(0).forEach((f) => f(false));
  },
});
statusRef.current = conversation.status;
useEffect(() => {
  if (conversation.status === "connected") {
    setError(null);
    waiters.current.splice(0).forEach((f) => f(true));
  }
}, [conversation.status]);

const connect = useCallback<VoiceApi["connect"]>(async (opts) => {
  if (mode === "fallback") {
    setFallbackConnected(true);
    if (opts?.firstMessage) speakFallback(opts.firstMessage);
    return;
  }
  conversation.startSession({ agentId: agentId!, connectionType: "webrtc", overrides: /* unchanged */ undefined });
  const ok = await new Promise<boolean>((resolve) => {
    waiters.current.push(resolve);
    window.setTimeout(() => resolve(false), 12000);
  });
  if (!ok) setError("agent did not connect; using the browser voice");
}, [agentId, conversation, mode, speakFallback]);

// never call conversation.setMuted(): it throws when no session is live
const setMicMuted = useCallback((m: boolean) => setMicMutedState(m), []);

const say = useCallback<VoiceApi["say"]>((tag, text, spoken) => {
  if (mode === "fallback" || statusRef.current !== "connected") return speakFallback(spoken ?? text);
  try {
    conversation.sendUserMessage(`[${tag}] ${text}`);
    setMessages((xs) => [...xs, { role: "user", text: `[${tag}] ${text}`, t: Date.now() }]);
  } catch {
    speakFallback(spoken ?? text);
  }
}, [conversation, mode, speakFallback]);

// optional hard guarantee of silence outside question windows (call from the governor tick while no window is open):
// if (statusRef.current === "connected") { try { conversation.sendUserActivity(); } catch {} }
```

### Scribe: 5. lib/governor.ts: fail closed when the transcript is offline (tests keep passing because the field is optional)

```ts
export interface Signals {
  now: number;
  lastSpeechAt: number; // end of the expert's last speech: last CHANGED Scribe partial (-Infinity if never)
  lastScreenChangeAt: number;
  lastTypingAt: number;
  lastBoundaryAt: number;
  lastInvoiceOpenedAt: number;
  agentSpeaking: boolean;
  transcriberHealthy?: boolean; // false = we cannot hear her, so we must not assume she is silent
}

// in evaluate():
const healthy = s.transcriberHealthy ?? true;
const silence = healthy && s.now - s.lastSpeechAt >= c.silenceSecs && !s.agentSpeaking;
// ...
if (!silence) reasons.push(!healthy ? "transcript offline" : s.agentSpeaking ? "agent speaking" : "expert talking");
```

### Platform: Vision route (AI SDK 7 current API, provider-neutral schema) - replaces the generateObject call in app/api/vision/route.ts

```ts
import { NextResponse } from "next/server";
import { generateText, Output } from "ai";
import { z } from "zod";

export const maxDuration = 30;

// Wire schema: nullable (not optional), no min/max, 14 nullable fields (Anthropic cap is 16 union-typed params).
const WireState = z.object({
  invoice: z.string().nullable(), supplier: z.string().nullable(), entity: z.string().nullable(),
  amount: z.number().nullable(), category: z.string().nullable(), invoiceMonth: z.number().nullable(),
  invoiceDate: z.string().nullable(), costCenter: z.string().nullable(), route: z.string().nullable(),
  status: z.string().nullable(), hasAssetNumber: z.boolean().nullable(), knownSupplier: z.boolean().nullable(),
  hasPO: z.boolean().nullable(), description: z.string().nullable(),
});
const VisionWire = z.object({
  screen: z.enum(["invoice_list", "invoice_detail", "confirm_dialog", "other"]),
  state: WireState,
  uiActivity: z.enum(["typing", "reading", "navigating", "idle"]),
  piiRegions: z.array(z.object({ x: z.number(), y: z.number(), w: z.number(), h: z.number(), kind: z.string() })),
  confidence: z.number(),
});

export async function POST(req: Request) {
  const body = (await req.json()) as { seq: number; image: string; prevState?: Record<string, unknown> };
  if (!process.env.AI_GATEWAY_API_KEY && !process.env.VERCEL_OIDC_TOKEN)
    return NextResponse.json({ error: "no gateway credentials", mock: true }, { status: 503 });
  const started = Date.now();
  const model = process.env.VISION_MODEL ?? "anthropic/claude-haiku-4.5";
  try {
    const { output } = await generateText({
      model,
      instructions: SYSTEM, // `system` is deprecated in v7
      output: Output.object({ schema: VisionWire }),
      messages: [{ role: "user", content: [
        { type: "text", text: `Previous state (may be stale): ${JSON.stringify(body.prevState ?? {})}\nReport the current state of this frame.` },
        // base64 only; a data: URL inside { type: 'data' } throws in v7
        { type: "file", mediaType: "image/jpeg", data: body.image.replace(/^data:image\/\w+;base64,/, "") },
      ] }],
      maxOutputTokens: 500,
      maxRetries: 0,
      timeout: { totalMs: 8000 },
      // reasoning: "none", // only for models whose reasoning_options include 'none' (e.g. openai/gpt-6-luna)
    });
    const state = Object.fromEntries(Object.entries(output.state).filter(([, v]) => v !== null));
    const confidence = Math.min(1, Math.max(0, output.confidence));
    return NextResponse.json({ seq: body.seq, ...output, state, confidence, model, latencyMs: Date.now() - started });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message, seq: body.seq }, { status: 502 });
  }
}
```

### Platform: Flat compile wire schema + converters (lib/compile.ts) - removes recursion and z.record from what the model sees

```ts
const FIELDS = ["amount","category","supplier","entity","invoiceMonth","costCenter","hasAssetNumber","knownSupplier","hasPO","route","status"] as const;
const LeafWire = z.object({
  field: z.enum(FIELDS),
  op: z.enum([">", ">=", "<", "<=", "==", "!=", "in", "matches", "exists"]),
  value: z.string(), // numbers and booleans as text; 'in' as comma-separated; '' for exists
});
const CondWire = z.object({ mode: z.enum(["all", "any"]), conds: z.array(LeafWire) });
const ActWire = z.object({ kind: z.enum(["set", "route", "status"]), field: z.string(), value: z.string() });

const RefinementWire = z.object({
  rules: z.array(z.object({
    stepId: z.string(), title: z.string(), when: CondWire, then: ActWire,
    unless: CondWire.nullable(),
    stopAndAsk: z.object({ who: z.string(), when: CondWire }).nullable(),
    quoteTexts: z.array(z.string()), confidence: z.enum(["high", "medium", "low"]),
  })),
  guardrails: z.array(z.object({ stepId: z.string(), kind: z.enum(["limit", "exception", "escalation"]), text: z.string(), quoteText: z.string().nullable() })),
  slots: z.array(z.object({ stepId: z.string().nullable(), kind: z.enum(["reason", "limit", "exception", "escalation", "counterfactual", "novel"]), question: z.string() })),
  stepReasons: z.array(z.object({ stepId: z.string(), quoteText: z.string() })),
});

const NUM = new Set(["amount", "invoiceMonth"]);
const BOOL = new Set(["hasAssetNumber", "knownSupplier", "hasPO"]);
type Leaf = z.infer<typeof LeafWire>;
const leaf = (l: Leaf): Cond => ({
  field: l.field, op: l.op,
  value: l.op === "exists" ? undefined
    : l.op === "in" ? l.value.split(",").map((s) => s.trim())
    : NUM.has(l.field) ? Number(l.value)
    : BOOL.has(l.field) ? l.value.trim().toLowerCase() === "true"
    : l.value,
});
export const toCond = (c: z.infer<typeof CondWire>): Cond =>
  c.conds.length === 1 ? leaf(c.conds[0]) : c.mode === "all" ? { all: c.conds.map(leaf) } : { any: c.conds.map(leaf) };
export const toAct = (a: z.infer<typeof ActWire>): Act =>
  a.kind === "set" ? { set: { [a.field]: a.value } } : a.kind === "route" ? { route: a.value } : { status: a.value as "hold" | "approved" | "posted" };

// call site
const { output } = await generateText({
  model: process.env.COMPILE_MODEL ?? "anthropic/claude-sonnet-5.5",
  instructions: SYSTEM_LINES.join("\n"),
  output: Output.object({ schema: RefinementWire }),
  prompt,
  maxRetries: 1,
  timeout: { totalMs: 90_000 },
  providerOptions: { gateway: { models: ["openai/gpt-6.1-sol"] } }, // fallback if the primary fails
});
// then: when: toCond(r.when), unless: r.unless ? toCond(r.unless) : undefined, then: toAct(r.then), ...
// and add `export const maxDuration = 120` to app/api/compile/route.ts
```

### Platform: Screen share start with picker hints (components/useScreenPipeline.ts start())

```ts
const start = useCallback(async () => {
  // Must run inside a click handler (transient activation) on a secure context (https or http://localhost).
  const stream = await navigator.mediaDevices.getDisplayMedia({
    video: { displaySurface: "browser", frameRate: { ideal: 5, max: 10 } }, // ideal/max only: min/exact throw TypeError
    audio: false,
    selfBrowserSurface: "exclude",   // cannot pick the Tacit tab itself
    surfaceSwitching: "include",     // 'Share this tab instead' button
    monitorTypeSurfaces: "exclude",  // hide whole-screen sharing (privacy)
  } as DisplayMediaStreamOptions);
  const track = stream.getVideoTracks()[0];
  const surface = (track.getSettings() as MediaTrackSettings & { displaySurface?: string }).displaySurface; // 'browser' | 'window' | 'monitor'
  surfaceRef.current = surface; // DOM-published PII masks are only valid when surface === 'browser'
  streamRef.current = stream;
  if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
  track.addEventListener("ended", () => setSharing(false));
  setSharing(true);
}, []);
// Optional focus control: const controller = new CaptureController(); pass { controller } above, then right after the await:
// if (surface !== "monitor") controller.setFocusBehavior("no-focus-change");  // or "focus-captured-surface"
```

### Platform: Worker ticker (new lib/ticker.ts) - keeps the 500 ms diff and governor loops off the throttled main-thread timer

```ts
export function startTicker(ms: number, fn: () => void): () => void {
  const src = `let id=setInterval(()=>postMessage(0),${ms});onmessage=()=>{clearInterval(id);close()}`;
  const url = URL.createObjectURL(new Blob([src], { type: "text/javascript" }));
  const w = new Worker(url);
  w.onmessage = fn;
  return () => { w.postMessage(0); URL.revokeObjectURL(url); };
}
// usage inside the effects that currently call window.setInterval(..., 500):
//   const stop = startTicker(500, tick); return stop;
// Also make classifyActivity time-based: store { diff, t } and look at the last 2 seconds, not the last 4 samples.
```

### Platform: Storage driver (new lib/kv.ts) + the exact surface that must stay stable

```ts
// lib/store.ts exports (signatures must not change):
//   getSession(id: string): Promise<SessionLog | undefined>
//   saveSession(s: SessionLog): Promise<void>
//   listSessions(): Promise<Pick<SessionLog, "id"|"mode"|"task"|"expertName"|"startedAt"|"endedAt">[]>
//   getMap(sessionId: string): Promise<WorkMap | undefined>      // WorkMapSchema.safeParse on read
//   saveMap(map: WorkMap): Promise<void>                         // bumps map.revision
//   saveClip(sessionId: string, audioId: string, bytes: Uint8Array): Promise<string>
//   readClip(sessionId: string, audioId: string): Promise<Uint8Array | undefined>
// lib/erp.ts private persistence that must move too: load()/persist() -> 'erp/invoices'; arm/disarm/getTeachGuard -> 'erp/guard'

import { promises as fs } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const sb = process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
  : null;
const ROOT = path.join(process.cwd(), ".data");
const file = (k: string, ext = ".json") => path.join(ROOT, k + ext);

export async function readDoc<T>(k: string): Promise<T | undefined> {
  if (sb) { const { data } = await sb.from("tacit_docs").select("value").eq("key", k).maybeSingle(); return (data?.value as T) ?? undefined; }
  try { return JSON.parse(await fs.readFile(file(k), "utf8")) as T; } catch { return undefined; }
}
export async function writeDoc(k: string, value: unknown): Promise<void> {
  if (sb) { const { error } = await sb.from("tacit_docs").upsert({ key: k, value, updated_at: new Date().toISOString() }); if (error) throw error; return; }
  await fs.mkdir(path.dirname(file(k)), { recursive: true });
  const tmp = `${file(k)}.${process.pid}.${Math.random().toString(36).slice(2, 8)}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(value)); await fs.rename(tmp, file(k));
}
export async function deleteDoc(k: string): Promise<void> {
  if (sb) { await sb.from("tacit_docs").delete().eq("key", k); return; }
  await fs.rm(file(k), { force: true });
}
export async function listDocs(prefix: string): Promise<string[]> {
  if (sb) { const { data } = await sb.from("tacit_docs").select("key").like("key", `${prefix}/%`); return (data ?? []).map((r) => r.key as string); }
  try { return (await fs.readdir(path.join(ROOT, prefix))).filter((f) => f.endsWith(".json")).map((f) => `${prefix}/${f.replace(/\.json$/, "")}`); } catch { return []; }
}
export async function writeBytes(k: string, bytes: Uint8Array, contentType: string): Promise<void> {
  if (sb) { const { error } = await sb.storage.from("tacit-clips").upload(k, bytes, { contentType, upsert: true }); if (error) throw error; return; }
  await fs.mkdir(path.dirname(file(k, "")), { recursive: true }); await fs.writeFile(file(k, ""), bytes);
}
export async function readBytes(k: string): Promise<Uint8Array | undefined> {
  if (sb) { const { data } = await sb.storage.from("tacit-clips").download(k); return data ? new Uint8Array(await data.arrayBuffer()) : undefined; }
  try { return await fs.readFile(file(k, "")); } catch { return undefined; }
}

/* Supabase SQL (run once):
create table if not exists tacit_docs (key text primary key, value jsonb not null, updated_at timestamptz not null default now());
alter table tacit_docs enable row level security;  -- no policies: only the server's service role can read or write
insert into storage.buckets (id, name, public) values ('tacit-clips', 'tacit-clips', false) on conflict do nothing;
Keys: sessions/<id>, maps/<sessionId>, erp/invoices, erp/guard ; bytes: clips/<sessionId>/<audioId>.webm */
```

### Platform: DOM PII masks painted before a frame leaves the browser (sandbox ERP only, tab capture only)

```ts
// ERP side (e.g. components/InvoiceForm.tsx): mark personal-data elements with data-pii="name|email|iban|phone"
const PII_CHANNEL = "tacit-erp-pii";
function publishPiiRects() {
  const W = window.innerWidth, H = window.innerHeight;
  const rects = [...document.querySelectorAll<HTMLElement>("[data-pii]")].map((el) => {
    const r = el.getBoundingClientRect();
    return { x: r.left / W, y: r.top / H, w: r.width / W, h: r.height / H, kind: el.dataset.pii ?? "pii" };
  }).filter((r) => r.w > 0 && r.h > 0 && r.y < 1 && r.y + r.h > 0);
  const ch = new BroadcastChannel(PII_CHANNEL); ch.postMessage({ at: Date.now(), rects }); ch.close();
}
// call on mount, after each render that changes layout, and on scroll/resize (passive listeners)

// Capture side (components/useScreenPipeline.ts)
const domPii = useRef<PiiRegion[]>([]);
useEffect(() => {
  const ch = new BroadcastChannel("tacit-erp-pii");
  ch.onmessage = (ev) => { domPii.current = ev.data.rects; };
  return () => ch.close();
}, []);
// in sendToVision AND captureFrame, before toDataURL:
const exact = surfaceRef.current === "browser" ? domPii.current : []; // tab capture: frame == viewport
paintMasks(c, [...masksRef.current, ...exact]);
```

### Platform: Document Picture-in-Picture companion (Chromium only; separate click from the screen-share click)

```ts
import { useCallback, useState } from "react";
import { createPortal } from "react-dom";

export function usePipWindow() {
  const [pipWin, setPipWin] = useState<Window | null>(null);
  const open = useCallback(async () => {
    if (!("documentPictureInPicture" in window)) return null; // fall back to the side-by-side window
    const w: Window = await (window as any).documentPictureInPicture.requestWindow({ width: 380, height: 560 });
    [...document.styleSheets].forEach((ss) => {
      try {
        const style = document.createElement("style");
        style.textContent = [...ss.cssRules].map((r) => r.cssText).join("");
        w.document.head.appendChild(style);
      } catch {
        if (!ss.href) return;
        const link = document.createElement("link"); link.rel = "stylesheet"; link.href = ss.href;
        w.document.head.appendChild(link);
      }
    });
    w.addEventListener("pagehide", () => setPipWin(null));
    setPipWin(w);
    return w;
  }, []);
  return { pipWin, open };
}
// render: {pipWin ? createPortal(<CompanionPanel />, pipWin.document.body) : <CompanionPanel />}
// The PiP window closes if the opener tab navigates or closes, so keep capture on a single route.
```

### Platform: next.config.ts

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // lets `next dev` be opened through a tunnel hostname; not needed for `next start`
  allowedDevOrigins: ["*.trycloudflare.com", "*.ngrok-free.app"],
  // Do NOT add: cacheComponents (removes `export const dynamic`), webpack() (Turbopack build fails),
  // experimental.serverActions.bodySizeLimit (no effect on route handlers).
};

export default nextConfig;
```

### Platform: Gateway smoke test and vision bake-off (run before any other work touches the LLM paths)

```bash
# 1) key works
curl --fail-with-body https://ai-gateway.vercel.sh/v1/chat/completions \
  -H "Authorization: Bearer $AI_GATEWAY_API_KEY" -H "Content-Type: application/json" \
  -d '{"model":"anthropic/claude-haiku-4.5","messages":[{"role":"user","content":"Reply with the single word ok"}],"max_tokens":8}'

# 2) scripts/bakeoff.ts  (npx tsx scripts/bakeoff.ts frame1.jpg frame2.jpg ...)
import { readFileSync } from "node:fs";
import { generateText, Output } from "ai";
import { VisionWire, SYSTEM } from "../lib/vision-schema"; // move the schema + prompt out of the route
const MODELS = ["anthropic/claude-haiku-4.5", "google/gemini-3.5-flash-lite", "openai/gpt-6-luna", "openai/gpt-4.1-mini", "google/gemini-3.1-flash-lite"];
for (const model of MODELS) {
  const ms: number[] = [];
  for (const f of process.argv.slice(2)) {
    const t = Date.now();
    try {
      const { output } = await generateText({ model, instructions: SYSTEM, output: Output.object({ schema: VisionWire }), maxRetries: 0, timeout: { totalMs: 15000 },
        messages: [{ role: "user", content: [{ type: "text", text: "Report the current state of this frame." }, { type: "file", mediaType: "image/jpeg", data: readFileSync(f) }] }] });
      ms.push(Date.now() - t);
      console.log(model, f, Date.now() - t, "ms", JSON.stringify(output.state));
    } catch (e) { console.log(model, f, "FAILED", (e as Error).message); }
  }
  ms.sort((a, b) => a - b);
  console.log("==", model, "p50", ms[Math.floor(ms.length / 2)], "max", ms.at(-1));
}
```

### Platform: Public URL commands

```bash
# Backup / same-day sharing from the demo laptop (production build, no account needed)
npm run build && npx next start -p 3000 &
cloudflared tunnel --url http://localhost:3000     # prints https://<random>.trycloudflare.com

# Single always-on instance (Railway): keeps the .data file store working unchanged
railway init && railway up
# dashboard: add a Volume mounted at /app/.data ; Variables: AI_GATEWAY_API_KEY, ELEVENLABS_API_KEY, NEXT_PUBLIC_* ;
# Settings > Networking > Generate Domain ; replicas = 1 ; start: npm run seed:session && next start -p $PORT
# NEXT_PUBLIC_* values are inlined at build time, so they must be set BEFORE the build runs.
```

---

## 8. Verified facts (full list, with sources)

### ElevenAgents

- **1 React SDK: package, provider, hooks** — Package is @elevenlabs/react (re-exports everything from @elevenlabs/client). All hooks must sit under <ConversationProvider>, which accepts the same options as useConversation (callbacks, clientTools, overrides, serverLocation) plus controlled mute props isMuted/onMutedChange. Hooks exported in 1.16.0: useConversation, useConversationControls, useConversationStatus, useConversationInput, useConversationMode, useConversationFeedback, useRawConversation, useConversationClientTool(name, handler), useScribe (+ CommitStrategy, AudioFormat, RealtimeEvents). *(source: https://elevenlabs.io/docs/eleven-agents/libraries/react and https://unpkg.com/@elevenlabs/react@1.16.0/dist/index.d.ts)*
- **1 React SDK: startSession params** — startSession needs exactly one of agentId (public agent), signedUrl (private, WebSocket) or conversationToken (private, WebRTC). Optional: connectionType 'webrtc' | 'websocket' (inferred if omitted: voice = WebRTC, text-only = WebSocket), userId, overrides, dynamicVariables (Record<string, string|number|boolean>), clientTools, textOnly, serverLocation ('us' default, 'eu-residency', 'in-residency', 'global'). Signed URL comes from GET /v1/convai/conversation/get-signed-url?agent_id=..., conversation token from GET /v1/convai/conversation/token?agent_id=... (both with xi-api-key, server side; token response is {token, conversation_id}). *(source: https://elevenlabs.io/docs/eleven-agents/libraries/react , https://elevenlabs.io/docs/api-reference/conversations/get-webrtc-token , https://unpkg.com/@elevenlabs/client@1.26.0/dist/utils/BaseConnection.d.ts)*
- **1 React SDK: startSession is not awaitable in 1.16.0** — The docs prose says startSession returns a promise resolving a conversationId, but the shipped 1.16.0 typings declare startSession: (options?: HookOptions) => void. The session is created asynchronously; onConversationCreated fires, then status becomes 'connected', then onConnect({conversationId}) fires. Use onConnect / status === 'connected' / getId() instead of awaiting startSession. *(source: https://unpkg.com/@elevenlabs/react@1.16.0/dist/conversation/useConversation.d.ts and https://unpkg.com/@elevenlabs/client@1.26.0/dist/VoiceConversation.js)*
- **1 React SDK: reactive state** — useConversation returns status ('disconnected' | 'connecting' | 'connected' | 'error' in the React typings), message, mode ('speaking' | 'listening'), isSpeaking, isListening, isMuted, setMuted, canSendFeedback, plus the control methods (startSession, endSession, sendUserMessage, sendContextualUpdate, sendUserActivity, sendFeedback, setVolume, changeInputDevice, changeOutputDevice, getId, getInputVolume, getOutputVolume, getInput/OutputByteFrequencyData, sendMCPToolApprovalResult, sendMultimodalMessage, uploadFile). *(source: https://elevenlabs.io/docs/eleven-agents/libraries/react and https://unpkg.com/@elevenlabs/react@1.16.0/dist/conversation/useConversation.d.ts)*
- **1 React SDK: micMuted / setMuted semantics** — useConversation({ micMuted }) is a controlled prop: the SDK runs an effect that calls setMuted(micMuted) once a conversation object exists. setMuted (and sendUserMessage, sendContextualUpdate, sendUserActivity, getId) THROW Error('No active conversation. Call startSession() first.') when no session is live. setMuted calls conversation.setMicMuted(). *(source: https://unpkg.com/@elevenlabs/react@1.16.0/dist/conversation/useConversation.js , https://unpkg.com/@elevenlabs/react@1.16.0/dist/conversation/ConversationInput.js , https://unpkg.com/@elevenlabs/react@1.16.0/dist/conversation/ConversationControls.js)*
- **1 React SDK: sendUserMessage vs sendContextualUpdate vs sendUserActivity** — sendUserMessage(text): 'treated as a user message and will prompt the agent to take its turn' (wire event {type:'user_message', text}; 'Triggers the same response flow as spoken user input'). sendContextualUpdate(text): 'won't trigger a response'; incorporated as background information, does not interrupt (wire event {type:'contextual_update', text}). sendUserActivity(): wire event {type:'user_activity'}; 'Resets the turn timeout timer', 'Useful for maintaining long-running conversations during periods of silence' (docs example pings every 30 s); the agent 'will not attempt to speak for at least 2 seconds after the user activity is detected'. The SDK throttles user_activity to one per 1000 ms. *(source: https://elevenlabs.io/docs/eleven-agents/libraries/react , https://elevenlabs.io/docs/eleven-agents/libraries/java-script , https://elevenlabs.io/docs/eleven-agents/customization/events/client-to-server-events , https://unpkg.com/@elevenlabs/client@1.26.0/dist/BaseConversation.js)*
- **1 React SDK: callbacks** — Callback signatures in client 1.26.0: onConnect({conversationId}), onDisconnect(details) where details.reason is 'error' (with message) | 'agent' | 'user', onError(message: string, context?), onMessage({message, role: 'user'|'agent', source (deprecated), event_id}), onModeChange({mode}), onStatusChange({status}), onVadScore({vadScore}), onUnhandledClientToolCall, onAgentToolResponse, onAgentToolRequest, onInterruption, onAgentResponseCorrection, onAgentChatResponsePart, onAudio, onAudioAlignment, onMCPToolCall, onMCPConnectionStatus, onGuardrailTriggered, onContextUsage, onIncomingEvent, onOutgoingEvent, onDebug. 'Not all client events are enabled by default for an agent.' *(source: https://unpkg.com/@elevenlabs/client@1.26.0/dist/types.d.ts and https://elevenlabs.io/docs/eleven-agents/libraries/java-script)*
- **1 React SDK: client tools** — Client tools are registered via the clientTools option or useConversationClientTool(name, handler) (auto-unregisters on unmount, always uses the latest closure). Tool and parameter names are case-sensitive and must match the agent configuration. SDK return type is string | number | void (objects are JSON.stringified; undefined becomes 'Client tool execution successful.'; a thrown error is sent back as is_error: true). The agent only waits for and uses the return value when the tool has 'Wait for response' ticked (expects_response: true); 'Otherwise, the agent assumes success and continues the conversation.' Unregistered tool calls go to onUnhandledClientToolCall or produce an error result. *(source: https://elevenlabs.io/docs/eleven-agents/libraries/react , https://elevenlabs.io/docs/eleven-agents/customization/tools/client-tools , https://unpkg.com/@elevenlabs/client@1.26.0/dist/BaseConversation.js)*
- **1 React SDK: overrides** — Client override shape: { agent: { prompt: { prompt, llm }, firstMessage, language }, tts: { voiceId, speed, stability, similarityBoost }, asr: { keywords }, conversation: { textOnly } }. Each field must first be enabled on the agent (Security tab, or platform_settings.overrides.conversation_config_override.{agent.first_message, agent.language, agent.prompt.prompt, agent.prompt.llm, agent.prompt.tool_ids, agent.prompt.knowledge_base, tts.voice_id, conversation.max_duration_seconds, ...} = true). 'For most fields, an error will be thrown if an override is provided when that field does not have overrides enabled.' 'omit any fields you don't want to override rather than setting them to empty strings or null values.' Overrides are disabled by default. The web client 1.26.0 only forwards agent.prompt, agent.first_message, agent.language, tts.*, asr.keywords, conversation.text_only. *(source: https://elevenlabs.io/docs/eleven-agents/customization/personalization/overrides , https://unpkg.com/@elevenlabs/client@1.26.0/dist/utils/overrides.js , https://elevenlabs.io/docs/api-reference/agents/create)*
- **1 React SDK: dynamic variables** — {{variable_name}} works in system prompts, first messages and tool parameters. Runtime values are passed as dynamicVariables at startSession (string, number or boolean). Agent-level conversation_config.agent.dynamic_variables.dynamic_variable_placeholders are documented as 'default values for testing without passing variables at runtime'. system__ prefix is reserved (system__conversation_id, system__time_utc, system__agent_turns, system__conversation_history, ...); secret__ prefixed variables are never sent to the LLM. Names are case-sensitive. *(source: https://elevenlabs.io/docs/eleven-agents/customization/personalization/dynamic-variables)*
- **2 Mute: what is uploaded** — WebRTC path: setMicMuted mutes the LiveKit microphone track publication (track.mute(), falling back to localParticipant.setMicrophoneEnabled(false)); it is a no-op with a console warning if the room is not connected. WebSocket path: the audio worklet replaces captured samples with a zero-filled buffer, so silent PCM chunks keep being streamed. In both paths no microphone content reaches ElevenLabs while muted. *(source: https://unpkg.com/@elevenlabs/client@1.26.0/dist/utils/WebRTCConnection.js and https://unpkg.com/@elevenlabs/client@1.26.0/dist/platform/web/rawAudioProcessor.generated.js)*
- **2 Mute: isSpeaking derivation** — Over WebRTC the SDK derives mode from LiveKit ActiveSpeakersChanged: mode = 'speaking' only when speakers[0].identity starts with 'agent', otherwise 'listening'. Over WebRTC the 'audio' client event is not sent because audio is handled by LiveKit. *(source: https://unpkg.com/@elevenlabs/client@1.26.0/dist/utils/WebRTCConnection.js and https://elevenlabs.io/docs/eleven-agents/customization/events/client-events)*
- **2/3 Turn timeout** — conversation_config.turn.turn_timeout ('Take turn after silence'): must be between 1 and 30 seconds, API default 7. It is 'how long your assistant waits during periods of user silence before taking the next turn and prompting for a response'. No documented way to disable it. user_activity events reset this timer. *(source: https://elevenlabs.io/docs/eleven-agents/customization/conversation-flow , https://elevenlabs.io/docs/api-reference/agents/create , https://elevenlabs.io/docs/eleven-agents/customization/events/client-to-server-events)*
- **2/3 Silence end-call and initial wait** — turn.silence_end_call_timeout default is -1 ('Maximum wait time since the user last spoke before terminating the call'). turn.initial_wait_time: 'How long the agent will wait for the user to start the conversation if the first message is empty. If not set, uses the regular turn_timeout.' Other turn fields: turn_eagerness (patient | normal | eager, default normal), spelling_patience (auto | off), speculative_turn (default false), turn_model (turn_v2 | turn_v3, default turn_v3), soft_timeout_config (timeout_seconds default -1 = disabled, range 0.5 to 8.0). *(source: https://elevenlabs.io/docs/api-reference/agents/create and https://elevenlabs.io/docs/eleven-agents/customization/conversation-flow)*
- **3 Max conversation duration** — conversation_config.conversation.max_duration_seconds: default 600 seconds, allowed 60 to 7200. Raise it via dashboard (Advanced > Call limits), CLI, or agents.update({conversationConfig:{conversation:{maxDurationSeconds:1200}}}). It can also be made client-overridable (conversation_config_override.conversation.max_duration_seconds). agent.max_conversation_duration_message is spoken when the limit is hit if non-empty. *(source: https://elevenlabs.io/docs/eleven-agents/customization/conversation-flow and https://elevenlabs.io/docs/api-reference/agents/create)*
- **3 Speaking on demand** — Documented ways to make the agent take a turn from the client: (a) sendUserMessage (user_message) which prompts a turn; (b) first_message (static or per-session override) spoken at session start; (c) the return value of a blocking client tool, which is appended to the conversation context while the agent waits; (d) the turn timeout. sendContextualUpdate never triggers speech. No client API that makes the agent speak a verbatim string was found; an LLM is always in the loop. Real-time monitoring control commands exist but are enterprise-only. *(source: https://elevenlabs.io/docs/eleven-agents/libraries/react , https://elevenlabs.io/docs/eleven-agents/customization/tools/client-tools , https://elevenlabs.io/docs/eleven-agents/guides/realtime-monitoring)*
- **3 Staying silent: skip_turn and empty first message** — skip_turn system tool: 'After this tool is called, the assistant will not speak. It waits for the user to re-engage or for another turn-taking condition to be met.' Optional param reason. API config: conversation_config.agent.prompt.built_in_tools.skip_turn = { type: 'system', name: 'skip_turn', description: '' (optional custom trigger), params: { system_tool_type: 'skip_turn' } } (JS SDK: builtInTools.skipTurn with params.systemToolType). agent.first_message: 'If empty, the agent waits for the user to start the discussion.' *(source: https://elevenlabs.io/docs/eleven-agents/customization/tools/system-tools/skip-turn and https://elevenlabs.io/docs/api-reference/agents/create)*
- **3 Interruptions and client events** — Interruptions are enabled by including 'interruption' in conversation.client_events. Allowed client_events values include conversation_initiation_metadata, ping, audio, interruption, user_transcript, tentative_user_transcript, agent_response, agent_response_correction, client_tool_call, mcp_tool_call, mcp_connection_status, agent_tool_request, agent_tool_response, agent_tool_response_full_payload, vad_score, agent_chat_response_part, agent_response_complete, guardrail_triggered, context_usage. agent_response_complete, agent_chat_response_part (voice) and guardrail_triggered must be explicitly enabled. *(source: https://elevenlabs.io/docs/eleven-agents/customization/conversation-flow , https://elevenlabs.io/docs/api-reference/agents/create , https://elevenlabs.io/docs/eleven-agents/customization/events/client-events)*
- **4 Expressive Mode: model id** — Expressive Mode is 'enabled by default when you select Eleven v3 Conversational as your agent's TTS model' (dashboard: Agent Voice tab > V3 Conversational). The Create Agent API enum for conversation_config.tts.model_id is: eleven_turbo_v2, eleven_turbo_v2_5, eleven_flash_v2 (default), eleven_flash_v2_5, eleven_multilingual_v2, eleven_v3_conversational, eleven_v4, eleven_v4_turbo. The id that corresponds to Eleven v3 Conversational is eleven_v3_conversational, and it is the only v3/v4 value in the 2.70.0 JS SDK's TtsConversationalModel type. NOTE: the Expressive Mode page's own CLI/API code samples currently set model_id to 'eleven_v4_turbo' while the prose says V3 Conversational (docs inconsistency). *(source: https://elevenlabs.io/docs/eleven-agents/customization/voice/expressive-mode , https://elevenlabs.io/docs/api-reference/agents/create , https://unpkg.com/@elevenlabs/elevenlabs-js@2.70.0/api/types/TtsConversationalModel.d.ts)*
- **4 Expressive Mode: API fields and behaviour** — tts.expressive_mode (boolean, default true): 'When enabled, applies expressive audio tags prompt. Automatically disabled for non-v3 models.' tts.suggested_audio_tags: list of {tag, description} 'for eleven_v3 and eleven_v3_conversational models'. The LLM can emit tags such as [laughs], [whispers], [sighs], [slow], [excited]; each affects roughly the next 4-5 words. 70+ languages. Turn-taking 'uses real-time signals from Scribe v2 Realtime'. Limitation: does not preserve Professional Voice Clone characteristics. Priced like other agent TTS models (from $0.08/min). Guide tone via system prompt rules. *(source: https://elevenlabs.io/docs/api-reference/agents/create and https://elevenlabs.io/docs/eleven-agents/customization/voice/expressive-mode)*
- **5 LLM options** — Natively supported models listed today: ElevenLabs-hosted DeepSeek Flash 4.1, GLM 5.2, Qwen3.6-35B-A3B, Qwen3.5-397B-A17B; Google Gemini 3.8/3.7/3.6/3.5 Flash, 3.5 Flash-Lite, 3.1 Pro Preview, 3.1 Flash Lite, 3 Flash Preview, 2.5 Flash, 2.5 Flash Lite; OpenAI GPT-6.1 Sol, GPT-6 Astra/Sol/Luna, GPT-5.6 Sol/Terra/Luna, GPT-5.5, 5.4, 5.4 Mini, 5.4 Nano, 5.2, 5.1, 5, 5 Mini, 5 Nano, 4.1, 4.1 Mini, 4.1 Nano, 4o, 4o Mini; Anthropic Claude Opus 5.5/5/4.8/4.7, Sonnet 5.5/5/4.6/4.5, Haiku 4.5; plus custom LLM. API ids (prompt.llm enum) include gemini-2.5-flash, gemini-2.5-flash-lite, gemini-3.5-flash, gemini-3.5-flash-lite, gemini-3.8-flash, gpt-5.4-mini, gpt-5.4-nano, gpt-4.1-mini, gpt-6-luna, claude-haiku-4-5, claude-sonnet-5, glm-52, qwen36-35b-a3b, deepseek-v41-flash, custom-llm. GET /v1/convai/llm/list returns what the workspace can actually use (with supports_image_input, supports_parallel_tool_calls, available_reasoning_efforts, deprecation_info). *(source: https://elevenlabs.io/docs/eleven-agents/customization/llm , https://elevenlabs.io/docs/api-reference/agents/create , https://elevenlabs.io/docs/api-reference/llm/list)*
- **5 LLM latency guidance** — The docs publish no latency ranking. Guidance only: 'For live voice conversations, choose a low-latency model and measure response time with your prompts and tools'; 'Start with a lower budget or effort for live voice agents because extra thinking can delay turn-taking' (prompt.reasoning_effort none|minimal|low|..., prompt.thinking_budget 0 to turn off); reasoning summaries add latency; RAG adds about 250 ms. For tool calling the client-tools page recommends 'high intelligence models like GPT 5.2, Gemini-2.5-Flash, or Claude Sonnet 4.5 and avoiding Gemini-2.0-Flash'. prompt.temperature defaults to 0. Backup LLM cascade: default / custom / disabled, cascade_timeout_seconds 2-15 (default 4). Max system prompt size 2MB including knowledge base content. *(source: https://elevenlabs.io/docs/eleven-agents/customization/llm , https://elevenlabs.io/docs/eleven-agents/customization/tools/client-tools , https://elevenlabs.io/docs/eleven-agents/customization/knowledge-base/rag , https://elevenlabs.io/docs/api-reference/agents/create)*
- **6 Knowledge base: create from text** — POST /v1/convai/knowledge-base/text with body { text (required), name (optional), parent_folder_id (optional) } returns { id, name, folder_path }. JS SDK: client.conversationalAi.knowledgeBase.documents.createFromText({ text, name }). *(source: https://elevenlabs.io/docs/api-reference/knowledge-base/create-from-text)*
- **6 Knowledge base: attach and usage mode** — Attach by listing locators in conversation_config.agent.prompt.knowledge_base: [{ type: 'file'|'url'|'text'|'folder', name, id, usage_mode: 'auto'|'prompt' }] via agents.update. usage_mode 'auto' (default): 'uses RAG when you enable RAG and the document is indexed; otherwise it uses full context'. 'prompt': always placed in the system prompt if small enough. Folders are RAG-only. RAG is off by default (prompt.rag.enabled false; embedding_model e5_mistral_7b_instruct; max_documents_length 50000; max_retrieved_rag_chunks_count 20). *(source: https://elevenlabs.io/docs/eleven-agents/customization/knowledge-base , https://elevenlabs.io/docs/eleven-agents/customization/knowledge-base/manage-documents , https://elevenlabs.io/docs/api-reference/agents/create)*
- **6 Knowledge base: limits and update flow** — Full-context use requires extracted text of roughly 300,000 characters or less; files up to 20MB (PDF, DOCX, TXT, MD, HTML, EPUB). RAG index size limit per workspace by plan: Free 1MB, Starter 2MB, Creator 20MB, Pro 100MB, Scale 500MB, Business 1GB; documents under 500 bytes cannot be RAG-indexed and are used in the prompt. Update in place with client.conversationalAi.knowledgeBase.documents.update(id, { name, content }) (re-chunks and re-embeds automatically). A document cannot be deleted while an agent depends on it (detach first or force-delete). One document can be attached to multiple agents. *(source: https://elevenlabs.io/docs/eleven-agents/customization/knowledge-base , https://elevenlabs.io/docs/eleven-agents/customization/knowledge-base/rag , https://elevenlabs.io/docs/eleven-agents/customization/knowledge-base/manage-documents)*
- **7 Procedures: what they are** — A procedure is task-specific instructions with a trigger ('when it applies') and content ('what to do'); the agent loads it when the conversation matches the trigger. Two types: free-form (natural-language markdown the agent adapts; can call tools, reference KB documents and other procedures) and structured (ordered typed steps run the same way every time). An empty trigger makes a sub-procedure callable only from another procedure. Inline reference syntax in API content: [tool id="tool_..."], [kb id="..."], [procedure id="agtprc_..."], [system_tool id="end_call"], {{dynamic_var}}. An SOP file (PDF/DOCX/TXT/MD/HTML/EPUB, 20MB max) can be imported in the dashboard into up to 10 draft procedures. *(source: https://elevenlabs.io/docs/eleven-agents/customization/procedures and https://elevenlabs.io/docs/eleven-agents/customization/procedures/free-form-procedures)*
- **7 Procedures: API usage** — Usable via API and CLI. POST /v1/convai/agents/{agent_id}/branches/{branch_id}/procedures with { name, type: 'free_form'|'deterministic'|'folder' (default free_form), trigger, content } returns procedure_id. JS: client.conversationalAi.agents.procedures.create(agentId, branchId, {...}) (needs @elevenlabs/elevenlabs-js >= 2.60.0). Drafts are per-user, per-branch; they go live only when you publish by calling Update agent on that branch (agents.update(agentId, { branchId }), body may be empty). PATCH /procedures/{id}/draft must include name, content, type and trigger. Agent GET responses expose mainBranchId and procedure metadata (not bodies). platform_settings.overrides.enable_procedure_ids_from_client lets a client pass procedure_ids at initiation to select which procedures are available. *(source: https://elevenlabs.io/docs/eleven-agents/customization/procedures , https://elevenlabs.io/docs/eleven-agents/customization/procedures/free-form-procedures , https://elevenlabs.io/docs/api-reference/agents/procedures/create , https://elevenlabs.io/docs/api-reference/agents/create)*
- **7 Procedures: constraints** — Content capped at 50,000 characters. The agent keeps the five most recently started procedures in context. Type cannot be changed after creation. Procedures belong to one agent (not shareable, not workspace-level). Structured procedures cannot reference knowledge base documents. Procedures version with the agent. More capable models route to the right procedure more reliably as the number of procedures grows. *(source: https://elevenlabs.io/docs/eleven-agents/customization/procedures and https://elevenlabs.io/docs/eleven-agents/customization/procedures/free-form-procedures)*
- **8 MCP server tools** — Agents can use external MCP servers over SSE or HTTP streamable transport (API enum transport: 'SSE' (default) | 'STREAMABLE_HTTP'). MCP is disabled per workspace until opted in (dashboard dialog, or client.conversationalAi.settings.update({ canUseMcpServers: true })). Create: client.conversationalAi.mcpServers.create({ config: { url, name, description, approvalPolicy, transport, secretToken?, requestHeaders? } }) (POST /v1/convai/mcp-servers), then attach with agents.update(agentId, { conversationConfig: { agent: { prompt: { mcpServerIds: [server.id] } } } }). Approval modes in the UI: Always Ask (recommended), Fine-Grained Tool Approval (per tool: auto-approved / requires approval / disabled), No Approval; API enum approval_policy: auto_approve_all | require_approval_all (default) | require_approval_per_tool (the guide's sample value 'always_ask' is not in the API enum). Approval requests reach the client as mcp_tool_call events (state awaiting_approval) and are answered with sendMCPToolApprovalResult(toolCallId, approved). Works for public and private agents. Not available with Zero Retention Mode or HIPAA. Not manageable via the CLI. *(source: https://elevenlabs.io/docs/eleven-agents/customization/tools/mcp , https://elevenlabs.io/docs/api-reference/mcp/create , https://elevenlabs.io/docs/eleven-agents/customization/events/client-events)*
- **9 Privacy: retention and audio saving** — Retention page: 'By default, ElevenLabs retains conversation data for 2 years'; configurable per agent as any number of days, -1 unlimited, 0 scheduled deletion; applies separately to transcripts and audio; field platform_settings.privacy.retention_days (API reference lists default -1), option apply_to_existing_conversations. Audio saving is on by default; platform_settings.privacy.record_voice=false stops storing new call audio (transcripts are still stored). Privacy overview 'Maximum Privacy': disable audio saving and set retention to 0 days. A single conversation can be deleted with DELETE /v1/convai/conversations/{conversation_id}. *(source: https://elevenlabs.io/docs/eleven-agents/customization/privacy/retention , https://elevenlabs.io/docs/eleven-agents/customization/privacy/audio-saving , https://elevenlabs.io/docs/eleven-agents/customization/privacy , https://elevenlabs.io/docs/api-reference/agents/create , https://elevenlabs.io/docs/api-reference/conversations/delete)*
- **9 Privacy: ZRM and redaction** — Per-agent Zero Retention Mode: platform_settings.privacy.zero_retention_mode=true means no call recordings and no transcripts/metadata containing PII are stored post-call (data only retrievable via post-call webhooks). The general ZRM page says 'Enterprise customers can use Zero Retention Mode', it 'applies to API use only', and LLM provider agreements prohibit training on customer content regardless of ZRM. Conversation history redaction (entities such as name, email_address, financial_id.bank_account, replaced by [ENTITY] placeholders and audio bleeps, applied post-call) is 'currently available to select enterprise clients only' and 'does not guarantee compliance'. Scribe realtime enableLogging:false (zero retention) 'may only be used by enterprise customers'. *(source: https://elevenlabs.io/docs/eleven-agents/customization/privacy/zrm , https://elevenlabs.io/docs/eleven-api/resources/zero-retention-mode , https://elevenlabs.io/docs/eleven-agents/customization/privacy/conversation-history-redaction , https://unpkg.com/@elevenlabs/react@1.16.0/dist/scribe.d.ts)*
- **10 Create/Update Agent body** — POST /v1/convai/agents/create body: { conversation_config (required), platform_settings, workflow, name, tags } returns { agent_id }. conversation_config = { asr { provider 'scribe_realtime' default | 'elevenlabs', user_input_audio_format, keywords }, turn {...}, tts { model_id, voice_id, expressive_mode, suggested_audio_tags, stability, speed, similarity_boost, text_normalisation_type 'system_prompt'|'elevenlabs', ... }, conversation { text_only, max_duration_seconds, client_events, file_input, monitoring_enabled, ... }, language_presets, vad, agent { first_message, language (default en), dynamic_variables { dynamic_variable_placeholders }, disable_first_message_interruptions, max_conversation_duration_message, prompt { prompt, llm, reasoning_effort, thinking_budget, temperature (default 0), max_tokens, tool_ids, built_in_tools, mcp_server_ids, native_mcp_server_ids, knowledge_base, rag, timezone, backup_llm_config, ignore_default_personality, tools (deprecated, use tool_ids) } } }. platform_settings = { auth { enable_auth, allowlist }, overrides { conversation_config_override {...}, enable_procedure_ids_from_client }, privacy {...}, call_limits, guardrails, ... }. PATCH /v1/convai/agents/{agent_id} takes the same optional sections plus version_description and procedures, with optional ?branch_id; the docs' examples send only the changed leaf. *(source: https://elevenlabs.io/docs/api-reference/agents/create and https://elevenlabs.io/docs/api-reference/agents/update)*
- **10 Client tool definition** — POST /v1/convai/tools with { tool_config: { type: 'client', name, description (required), parameters { type:'object', properties, required } (optional, nullable), expects_response (default false: 'If true, calling this tool should block the conversation until the client responds with some response which is passed to the llm'), response_timeout_secs (default 20, must be 1-120), execution_mode 'immediate'|'post_tool_speech'|'async', pre_tool_speech 'auto'|'force'|'off', interruption_mode 'allow'|'disable_during_tool'|'disable_during_tool_and_turn', tool_call_sound, assignments, dynamic_variables } } returns { id }; attach ids through conversation_config.agent.prompt.tool_ids. Each literal property needs type (boolean|string|integer|number) and exactly one of description / dynamic_variable / constant_value / is_system_provided / is_omitted. *(source: https://elevenlabs.io/docs/api-reference/tools/create and https://elevenlabs.io/docs/eleven-agents/customization/tools/client-tools)*
- **Versioning** — All agents are versioned (enable_versioning parameters are deprecated and ignored). Saving changes creates a new immutable version on a branch; every agent has a Main branch; drafts are per-user, per-branch. *(source: https://elevenlabs.io/docs/api-reference/agents/create and https://elevenlabs.io/docs/eleven-agents/operate/versioning)*
- **Language** — New agents default to English with Flash v2. Additional languages are added as conversation_config.language_presets[lang] = { overrides: { agent: { first_message } } }. The language_detection system tool can only switch to languages 'defined in the Agent settings'. agent.language drives both ASR and TTS. Per-session language override needs conversation_config_override.agent.language = true. *(source: https://elevenlabs.io/docs/eleven-agents/customization/voice/customization/language , https://elevenlabs.io/docs/eleven-agents/customization/tools/system-tools/language-detection , https://elevenlabs.io/docs/api-reference/agents/create)*
- **Scribe v2 Realtime (separate from the agent)** — useScribe({ modelId: 'scribe_v2_realtime', commitStrategy: CommitStrategy.VAD, vadSilenceThresholdSecs (0.3-3.0, default 1.5), vadThreshold, minSpeechDurationMs, minSilenceDurationMs, languageCode, includeTimestamps, onPartialTranscript, onCommittedTranscript, onCommittedTranscriptWithTimestamps, ... }) then scribe.connect({ token, microphone: { echoCancellation, noiseSuppression } }). Token: POST /v1/single-use-token/realtime_scribe (server side), expires after 15 minutes and is consumed on use. Server errors include session_time_limit_exceeded and insufficient_audio_activity ('You haven't sent enough audio activity to maintain the connection'). filterBackgroundAudio cannot be combined with includeTimestamps. *(source: https://elevenlabs.io/docs/eleven-api/resources/libraries/scribe-stt/react-scribe , https://elevenlabs.io/docs/api-reference/tokens/create , https://elevenlabs.io/docs/eleven-api/guides/how-to/speech-to-text/realtime/event-reference , https://unpkg.com/@elevenlabs/react@1.16.0/dist/scribe.d.ts)*
- **Multimodal file input** — conversation_config.conversation.file_input { enabled (default true), max_files_in_memory (1-10), max_files_per_conversation (default 10, -1 unlimited; uploads billed per file) } lets users send images/PDFs 'in chat' when the selected LLM supports image input; the SDK exposes uploadFile(blob) and sendMultimodalMessage({ text, fileIds }). *(source: https://elevenlabs.io/docs/eleven-agents/customization/multimodal-input and https://unpkg.com/@elevenlabs/client@1.26.0/dist/BaseConversation.d.ts)*
- **SDK versions** — npm latest today: @elevenlabs/react 1.16.0, @elevenlabs/elevenlabs-js 2.70.0, @elevenlabs/client 1.26.0. package.json pins ^1.16.0 and ^2.70.0 and package-lock.json resolves react 1.16.0, client 1.26.0, types 0.24.0, elevenlabs-js 2.70.0, livekit-client 2.22.3, so the starter is on the latest SDKs. There is no node_modules directory in the starter folder (npm install has not been run there). *(source: https://www.npmjs.com/package/@elevenlabs/react , https://www.npmjs.com/package/@elevenlabs/elevenlabs-js (checked with npm view on 2026-10-03))*

### Scribe v2 Realtime

- **How this was verified (read first)** — The starter has NO node_modules (never installed in this copy), so nothing was executed or type-checked. SDK behaviour was read from the published package files for the exact lockfile-pinned versions: @elevenlabs/react 1.16.0 (which is the current npm 'latest'), @elevenlabs/client 1.26.0, @elevenlabs/elevenlabs-js 2.70.0, @elevenlabs/types 0.24.0. Files were read through a summarising fetch tool, so re-check any load-bearing line locally after `npm install` (node_modules/@elevenlabs/react/dist/scribe.d.ts, node_modules/@elevenlabs/client/dist/scribe/*.js). *(source: https://registry.npmjs.org/@elevenlabs/react ; package-lock.json)*
- **Model id** — The realtime model id is exactly `scribe_v2_realtime` (the only allowed value of model_id on the realtime endpoint, and its default). *(source: https://elevenlabs.io/docs/api-reference/speech-to-text/v-1-speech-to-text-realtime ; https://elevenlabs.io/docs/overview/models)*
- **WebSocket URL** — wss://api.elevenlabs.io/v1/speech-to-text/realtime (SDK DEFAULT_BASE_URI = wss://api.elevenlabs.io, path /v1/speech-to-text/realtime). Regional hosts also exist: api.us.elevenlabs.io, api.eu.residency.elevenlabs.io, api.in.residency.elevenlabs.io, api.sg.residency.elevenlabs.io. Auth is either the `xi-api-key` header (server side) or the `token` query parameter (browser). *(source: https://elevenlabs.io/docs/api-reference/speech-to-text/v-1-speech-to-text-realtime ; https://unpkg.com/@elevenlabs/client@1.26.0/dist/scribe/scribe.js)*
- **WebSocket query params** — model_id, token, audio_format (pcm_8000|pcm_16000 default|pcm_22050|pcm_24000|pcm_44100|pcm_48000|ulaw_8000), language_code (ISO 639-1/639-3), secondary_languages, commit_strategy (manual|vad), vad_silence_threshold_secs, vad_threshold, min_speech_duration_ms, min_silence_duration_ms, include_timestamps (default false), include_language_detection (default false), keyterms, no_verbatim (default false), entity_detection (all|pii|phi|pci|other|offensive_language), transcript_edit, filter_background_audio (default false), keepalive_interval_ms (500-10000), enable_logging (default true). *(source: https://elevenlabs.io/docs/api-reference/speech-to-text/v-1-speech-to-text-realtime)*
- **Client and server messages** — Client sends `input_audio_chunk` {message_type, audio_base_64, commit:boolean, sample_rate, previous_text? (first chunk only)}. Server sends session_started {session_id, config}, partial_transcript {text}, committed_transcript {text}, committed_transcript_with_timestamps {text, language_code, words[]}, committed_transcript_entities {text, entities[{text, entity_type, start_char, end_char}]}, edited_transcript. committed_transcript_with_timestamps is 'Sent after the committed transcript' and is emitted when timestamps or language detection are enabled. *(source: https://elevenlabs.io/docs/api-reference/speech-to-text/v-1-speech-to-text-realtime ; https://elevenlabs.io/docs/eleven-api/guides/how-to/speech-to-text/realtime/event-reference.md)*
- **Error events** — auth_error, quota_exceeded, transcriber_error, input_error, invalid_request, error, commit_throttled, unaccepted_terms, rate_limited, queue_overflow, resource_exhausted, session_time_limit_exceeded ('Maximum session time has been reached'), chunk_size_exceeded, insufficient_audio_activity ('You haven't sent enough audio activity to maintain the connection'). The JS client emits the specific event AND the generic ERROR event for each. *(source: https://elevenlabs.io/docs/eleven-api/guides/cookbooks/speech-to-text/realtime/event-reference ; https://unpkg.com/@elevenlabs/client@1.26.0/dist/scribe/connection.js)*
- **Word timestamps** — Each word object: text, start (seconds), end (seconds), type ('word' | 'spacing' | 'audio_event' in the 1.16.0 React types), speaker_id, logprob, characters[]. Only delivered when include_timestamps=true. The docs do NOT say whether start/end are relative to the session start or to the committed segment. *(source: https://elevenlabs.io/docs/api-reference/speech-to-text/v-1-speech-to-text-realtime ; https://unpkg.com/@elevenlabs/react@1.16.0/dist/scribe.d.ts)*
- **Single-use token endpoint** — POST https://api.elevenlabs.io/v1/single-use-token/{token_type}, token_type in realtime_scribe | batch_scribe | tts_websocket, no request body, xi-api-key header. Response {"token": "sutkn_..."}: 'A time bound single use token that expires after 15 minutes. Will be consumed on use.' Server SDK call: `elevenlabs.tokens.singleUse.create("realtime_scribe")` returns the object containing `token`. *(source: https://elevenlabs.io/docs/api-reference/tokens/create ; https://elevenlabs.io/docs/eleven-api/guides/how-to/speech-to-text/realtime/client-side-streaming)*
- **useScribe options (React 1.16.0)** — ScribeHookOptions: token, modelId, baseUri, commitStrategy, vadSilenceThresholdSecs, vadThreshold, minSpeechDurationMs, minSilenceDurationMs, languageCode, secondaryLanguages, microphone {deviceId, echoCancellation, noiseSuppression, autoGainControl, channelCount, workletPaths}, audioFormat, sampleRate, autoConnect, includeTimestamps, includeLanguageDetection, keyterms, noVerbatim, transcriptEdit, filterBackgroundAudio ('Cannot be combined with includeTimestamps'), enableLogging (default true; false = zero retention, enterprise only). `entityDetection` is NOT in the hook's option type; it exists only on the lower-level client `Scribe.connect()` options. *(source: https://unpkg.com/@elevenlabs/react@1.16.0/dist/scribe.d.ts ; https://unpkg.com/@elevenlabs/client@1.26.0/dist/scribe/scribe.d.ts)*
- **useScribe defaults and ranges** — commitStrategy default 'manual'. vadSilenceThresholdSecs default 1.5, range 0.3-3.0. vadThreshold default 0.4, range 0.1-0.9 (lower = more sensitive). minSpeechDurationMs default 100, range 50-2000. minSilenceDurationMs default 100, range 50-2000. languageCode: 'Leave empty for auto-detection.' autoConnect default false. includeTimestamps default false. The client validates the ranges before opening the socket. *(source: https://elevenlabs.io/docs/eleven-api/resources/libraries/scribe-stt/react-scribe ; https://unpkg.com/@elevenlabs/client@1.26.0/dist/scribe/scribe.js)*
- **useScribe callbacks and return value** — Callbacks: onSessionStarted, onPartialTranscript({text}), onCommittedTranscript({text}), onCommittedTranscriptWithTimestamps({text, language_code?, words?}), onEditedTranscript, onError(Error|Event), onAuthError, onQuotaExceededError, onCommitThrottledError, onTranscriberError, onUnacceptedTermsError, onRateLimitedError, onInputError, onQueueOverflowError, onResourceExhaustedError, onSessionTimeLimitExceededError, onChunkSizeExceededError, onInsufficientAudioActivityError, onConnect, onDisconnect. Returns: status ('disconnected'|'connecting'|'connected'|'transcribing'|'error'), isConnected, isTranscribing, isMuted, partialTranscript, committedTranscripts (TranscriptSegment[] {id,text,timestamp,isFinal,languageCode?,words?,editedText?}), error, connect(options?: Partial<ScribeHookOptions>), disconnect(), mute(), unmute(), sendAudio(), commit(), clearTranscripts(), getConnection(). *(source: https://unpkg.com/@elevenlabs/react@1.16.0/dist/scribe.d.ts)*
- **useScribe internals that matter** — connect() throws 'Token is required' / 'Model ID is required' if missing; warns and returns if already connected; closes the connection on unmount. Callbacks are captured at connect() time (stale-closure risk: they must only touch refs). With includeTimestamps on, BOTH committed events append a segment to committedTranscripts (duplicates). status becomes 'transcribing' on partials and 'error' on any ERROR event. mute()/unmute() throw when not connected. *(source: https://unpkg.com/@elevenlabs/react@1.16.0/dist/scribe.js)*
- **Scribe mute semantics** — RealtimeConnection.mute() in microphone mode sets MediaStreamTrack.enabled=false, so 'the browser replaces real microphone input with silence'; silence frames keep flowing and the socket stays open. unmute() re-enables the track. commit() sends an empty chunk with commit:true. close() releases the mic stream and AudioContext and closes the socket with code 1000. *(source: https://unpkg.com/@elevenlabs/client@1.26.0/dist/scribe/connection.js)*
- **Scribe microphone capture** — The web mic pipeline calls getUserMedia with echoCancellation, noiseSuppression and autoGainControl all defaulting to true, channelCount 1, sampleRate ideal 16000, builds an AudioContext at the stream's actual rate, resamples to 16 kHz in an AudioWorklet and sends base64 PCM16 chunks. Mic streaming starts on the socket 'open' event. *(source: https://unpkg.com/@elevenlabs/client@1.26.0/dist/platform/web/scribeMicrophone.js ; https://unpkg.com/@elevenlabs/client@1.26.0/dist/scribe/scribe.js)*
- **Commit strategy behaviour** — Manual is the default; VAD is the recommended strategy for client-side microphone input and commits automatically when the silence threshold is reached. 'Transcript processing starts after the first 2 seconds of audio are sent.' 'If you stop sending audio, no keepalives are sent, and the server closes the connection after 15 seconds without any client messages.' previous_text only on the first chunk and works best under 50 characters. When keepalive_interval_ms is configured the server sends partial_transcript events as keepalives roughly once per interval (so a partial is not proof of speech). *(source: https://elevenlabs.io/docs/eleven-api/guides/cookbooks/speech-to-text/realtime/transcripts-and-commit-strategies ; https://elevenlabs.io/docs/eleven-api/guides/how-to/speech-to-text/realtime/event-reference.md)*
- **Languages / German / auto-detect** — 90+ languages with automatic language recognition; German (deu) is listed as supported. Leave languageCode empty for auto-detection, or pass 'de'/'deu'. includeLanguageDetection adds language_code to the committed-with-timestamps event; secondaryLanguages narrows identification to a set. Launch blog: 'Automatic language detection: Speak in any language, switch language mid conversation.' *(source: https://elevenlabs.io/docs/overview/capabilities/speech-to-text ; https://elevenlabs.io/docs/overview/models ; https://elevenlabs.io/blog/introducing-scribe-v2-realtime)*
- **Latency** — Partials in ~150 ms ('transcribes speech in under 150 ms', blog dated 11 Nov 2025; models page: 'Get partial transcriptions in ~150 milliseconds'). The Agents announcement (13 Nov 2025) quotes 30-80 ms inside ElevenLabs Agents. A VAD commit therefore lands at roughly end-of-speech + vadSilenceThresholdSecs + network latency. *(source: https://elevenlabs.io/blog/introducing-scribe-v2-realtime ; https://elevenlabs.io/blog/scribe-v2-realtime-in-elevenlabs-agents)*
- **Pricing** — Scribe v2 Realtime: $0.39 per hour on all plans; included hours Starter 2h30, Creator 15h, Pro 56h, Scale 254h, Business 767h; nothing listed as included for Free. Agents: $0.080 per minute (burst $0.160). transcriptEdit adds a 30% premium billed for at least 10 s per committed transcript (SDK comment). *(source: https://elevenlabs.io/pricing/api ; https://unpkg.com/@elevenlabs/react@1.16.0/dist/scribe.d.ts)*
- **Concurrency** — Realtime STT concurrency per plan: Free 6, Starter 9, Creator 15, Pro 30, Scale 45, Business 45, Enterprise elevated; over the limit requests queue (~50 ms typical). Agents concurrent calls: Starter 4, Creator 6, Pro 10, Scale 20, Business 40. One capture session uses 1 Scribe socket + 1 agent conversation per open tab, so 4 developers testing at once on one account can hit the Starter agent limit. *(source: https://elevenlabs.io/docs/overview/models ; https://elevenlabs.io/pricing/api)*
- **ElevenAgents ASR is Scribe realtime** — Agent config field conversation_config.asr.provider: enum `elevenlabs` | `scribe_realtime`, default `scribe_realtime` in the current API reference (the Nov 2025 blog still described it as something 'enabled under the Advanced configuration section'). Other asr fields: quality (high), user_input_audio_format (pcm_16000 default), keywords (boost list). Session overrides also expose overrides.asr.keywords. *(source: https://elevenlabs.io/docs/api-reference/agents/create ; https://elevenlabs.io/blog/scribe-v2-realtime-in-elevenlabs-agents ; https://unpkg.com/@elevenlabs/client@1.26.0/dist/utils/BaseConnection.d.ts)*
- **Agent client events** — conversation.client_events enum includes user_transcript (finalized), tentative_user_transcript, agent_response, agent_response_correction, vad_score (0..1), interruption, audio, client_tool_call, agent_chat_response_part, internal_turn_probability and more. In the JS SDK these surface as onMessage({message, role:'user'|'agent', source, event_id}), onVadScore({vadScore}), onInterruption, onModeChange({mode}), onAudioAlignment, onAgentChatResponsePart, onIncomingEvent (raw). client 1.26.0 has no dedicated handler for tentative_user_transcript. *(source: https://elevenlabs.io/docs/agents-platform/customization/events/client-events ; https://elevenlabs.io/docs/api-reference/agents/create ; https://unpkg.com/@elevenlabs/client@1.26.0/dist/types.d.ts ; https://unpkg.com/@elevenlabs/client@1.26.0/dist/BaseConversation.js)*
- **React agent hook surface (1.16.0)** — useConversation({micMuted?, volume?, ...callbacks}) must be inside ConversationProvider and returns startSession(options) => void (NOT a promise), endSession() => void, status, isSpeaking, isListening, mode, isMuted, setMuted, sendUserMessage, sendContextualUpdate, sendUserActivity, setVolume, getInputVolume, getId, etc. onError signature is (message: string, context?). The `micMuted` prop is applied by an effect that runs whenever micMuted changes AND a conversation exists. *(source: https://unpkg.com/@elevenlabs/react@1.16.0/dist/conversation/useConversation.d.ts ; https://unpkg.com/@elevenlabs/react@1.16.0/dist/conversation/useConversation.js)*
- **Agent controls throw with no live session** — setMuted(), sendUserMessage(), sendContextualUpdate(), sendUserActivity(), setVolume() and getId() all throw `No active conversation. Call startSession() first.` when the conversation ref is null. The ref is null immediately after startSession() returns (session creation is async) and again as soon as status becomes 'disconnecting'/disconnected. A failed start is reported only through onError. *(source: https://unpkg.com/@elevenlabs/react@1.16.0/dist/conversation/ConversationInput.js ; https://unpkg.com/@elevenlabs/react@1.16.0/dist/conversation/ConversationControls.js ; https://unpkg.com/@elevenlabs/react@1.16.0/dist/conversation/ConversationProvider.js)*
- **Agent WebRTC microphone** — WebRTC mode uses LiveKit (wss://livekit.rtc.elevenlabs.io). The mic is captured with createLocalAudioTrack({echoCancellation:true, noiseSuppression:true, autoGainControl:true, channelCount:{ideal:1}}). setMicMuted mutes/unmutes the published track (track.mute()/unmute(), fallback setMicrophoneEnabled); the track is not stopped, so unmuting is immediate and the browser mic indicator stays on. Events and text messages travel on the data channel; public agents fetch a token from /v1/convai/conversation/token?agent_id=... *(source: https://unpkg.com/@elevenlabs/client@1.26.0/dist/utils/WebRTCConnection.js)*
- **Agent text and activity messages** — sendUserMessage: 'Sends a text message to the agent' (triggers a response; wire type user_message). sendContextualUpdate: 'Sends contextual information to the agent that won't trigger a response' (wire type contextual_update). sendUserActivity: 'Notifies the agent about user activity to prevent interruptions. Useful for when the user is actively using the app and the agent should pause speaking'. *(source: https://elevenlabs.io/docs/agents-platform/libraries/react ; https://unpkg.com/@elevenlabs/client@1.26.0/dist/BaseConversation.js)*
- **Agent turn and duration limits** — turn_timeout ('Maximum wait time for the user's reply before re-engaging the user') default 7 s, documented range 1-30 s, no documented way to disable. turn_eagerness patient|normal|eager. silence_end_call_timeout default -1. max_duration_seconds default 600 (10 min), range 60-7200. The starter's create-agents.ts sets turnTimeout 30, patient, maxDurationSeconds 3600 and enables vad_score/user_transcript client events. *(source: https://elevenlabs.io/docs/agents-platform/customization/conversation-flow ; https://elevenlabs.io/docs/api-reference/agents/create ; scripts/create-agents.ts)*
- **Echo cancellation scope** — echoCancellation:true means the browser 'must attempt to cancel at least as much as remote-only and should attempt to cancel as much as all'; remote-only = audio from MediaStreamTracks sourced from an RTCPeerConnection. The agent's WebRTC voice is exactly such a track, so both the Scribe mic stream and the agent mic stream get best-effort cancellation of the agent's voice. This floor does not cover non-WebRTC playback (WebSocket connection type, or the keyless speechSynthesis fallback). *(source: https://developer.mozilla.org/en-US/docs/Web/API/MediaTrackConstraints/echoCancellation)*
- **Two microphone consumers** — Nothing in the ElevenLabs SDKs prevents useScribe and an Agents WebRTC session from each calling getUserMedia in the same tab; they are independent captures. The known browser problem is WebKit: on iOS Safari (and some macOS Safari versions) a second getUserMedia call mutes the track from the first call. Treat the design as Chromium-desktop only. *(source: https://bugs.webkit.org/show_bug.cgi?id=179363 ; https://unpkg.com/@elevenlabs/client@1.26.0/dist/platform/web/scribeMicrophone.js)*
- **Background-tab timers** — The capture tab is hidden while the expert works in the ERP tab. Chrome checks timers of hidden pages once per second, and once per minute after 5 minutes hidden when the page is silent for 30 s and 'WebRTC is not in use'. With the agent's WebRTC session open the intensive tier is avoided; in keyless fallback mode it is not, so the 500 ms governor tick and frame timers can degrade to one per minute. *(source: https://developer.chrome.com/blog/timer-throttling-in-chrome-88)*
- **Next.js GET route handlers** — Since v15 'The default caching for GET handlers was changed from static to dynamic', so /api/scribe-token is not cached by default in Next 16; adding `export const dynamic = "force-dynamic"` is hardening, not a bug fix. *(source: https://nextjs.org/docs/app/api-reference/file-conventions/route)*

### AI SDK · Gateway · Next.js · Browser · Hosting

- **Starter versions** — Every dependency pinned in package.json is the current npm `latest` as of 2026-10-03: ai 7.0.127, @ai-sdk/gateway 4.0.103, next 16.3.8, zod 4.6.5, @elevenlabs/react 1.16.0, @elevenlabs/elevenlabs-js 2.70.0, vitest 5.0.3. The starter folder has NO node_modules installed; local Node is v24.14.0. I did not run install/build/tests there because that would write into the folder. *(source: npm view <pkg> version dist-tags (run 2026-10-03); https://unpkg.com/ai@7.0.127/package.json)*
- **AI SDK 7 runtime requirements** — ai@7.0.127 declares engines node >=22, is ESM-only, peerDependency zod '^3.25.76 || ^4.1.8', and bundles @ai-sdk/gateway 4.0.103 as a dependency (gateway and createGateway are re-exported from 'ai'). *(source: https://unpkg.com/ai@7.0.127/package.json ; https://ai-sdk.dev/docs/migration-guides/migration-guide-7-0)*
- **AI SDK 7 structured output** — generateObject and streamObject are still exported in ai@7.0.127 but marked `@deprecated Use generateText with an output setting instead`. Current API: `const { output } = await generateText({ model, output: Output.object({ schema }), ... })`. `experimental_output` was removed. Parse/validation failure throws AI_NoObjectGeneratedError. *(source: https://unpkg.com/ai@7.0.127/dist/index.d.ts (generate-object.d.ts region) ; https://ai-sdk.dev/docs/ai-sdk-core/generating-structured-data ; https://ai-sdk.dev/docs/migration-guides/migration-guide-7-0)*
- **AI SDK 7 image input** — `{ type: 'image', image, mediaType }` (ImagePart) is deprecated in favor of `{ type: 'file', mediaType: 'image/jpeg', data }`. It still works at runtime: the SDK converts it to a file part and logs a deprecation warning on every call. A bare data-URL string (`data:image/jpeg;base64,...`) is accepted and split into mediaType + base64; but wrapping a data URL as `{ type: 'data', data: 'data:...' }` throws InvalidDataContentError ('Data URLs are not valid inline data'). *(source: https://unpkg.com/@ai-sdk/provider-utils@5.0.53/dist/index.d.ts (ImagePart/FilePart) ; https://unpkg.com/ai@7.0.127/dist/index.js (convertToLanguageModelV4FilePart, convertImagePartToFilePart))*
- **AI SDK 7 call options** — `system` is deprecated in favor of `instructions`. generateText accepts `timeout: number | { totalMs, stepMs, ... }`, `maxRetries`, `abortSignal`, `maxOutputTokens`, and a top-level `reasoning: 'provider-default'|'none'|'minimal'|'low'|'medium'|'high'|'xhigh'`. generateObject's type OMITS `timeout` (only abortSignal is available there). *(source: https://unpkg.com/ai@7.0.127/dist/index.d.ts ; https://unpkg.com/@ai-sdk/provider@4.0.21/dist/index.d.ts)*
- **AI Gateway auth** — Set AI_GATEWAY_API_KEY; the AI SDK reads it automatically and routes any plain string model id of the form 'creator/model' through the gateway. Keys never expire unless revoked. On Vercel deployments an OIDC token (VERCEL_OIDC_TOKEN) is supplied automatically; locally it needs `vercel env pull` and expires after 12 hours. If an API key is present it always wins over OIDC, even if invalid. OpenAI-compatible base URL: https://ai-gateway.vercel.sh/v1 ; AI SDK provider default baseURL: https://ai-gateway.vercel.sh/v4/ai. *(source: https://vercel.com/docs/ai-gateway/authentication-and-byok ; https://ai-sdk.dev/providers/ai-sdk-providers/ai-gateway)*
- **AI Gateway model slugs (live list, 407 models)** — Both .env.example slugs are valid: anthropic/claude-haiku-4.5 ($1/$5 per M tokens, vision, zdr=all) and anthropic/claude-sonnet-4.5 ($3/$15). Fast vision-capable candidates that exist today: google/gemini-3.5-flash-lite ($0.30/$2.50), google/gemini-3.1-flash-lite ($0.25/$1.50), google/gemini-2.5-flash-lite ($0.10/$0.40), google/gemini-3.8-flash ($0.75/$3.75), openai/gpt-6-luna ($0.10/$0.50), openai/gpt-5.6-luna ($0.20/$1.20), openai/gpt-5.4-mini ($0.75/$4.50), openai/gpt-4.1-mini ($0.40/$1.60, non-reasoning), openai/gpt-5-mini ($0.25/$2). Strong compile candidates: anthropic/claude-sonnet-5.5 ($2/$10, released 2026-09-28), anthropic/claude-sonnet-5 ($2/$10), anthropic/claude-opus-5.5 ($4/$20), openai/gpt-6.1-sol ($2/$10), google/gemini-3.1-pro-preview ($2/$12). All listed accept image input and carry the structured-output tag. *(source: https://ai-gateway.vercel.sh/v1/models (fetched 2026-10-03))*
- **AI Gateway model metadata** — Each model entry carries `zdr` and `no_training` flags and `reasoning_options`. zdr=all for anthropic/claude-haiku-4.5, claude-sonnet-4.5, claude-sonnet-5.5, openai/gpt-4.1-mini, openai/gpt-5.4-mini; zdr=some for the Gemini flash family and openai/gpt-6-luna. Reasoning: Haiku 4.5 is a toggle (off unless asked); Gemini 3.x flash only offers effort low/high (cannot be turned off); gpt-6-luna and gpt-5.4-mini support effort 'none'; claude-sonnet-5.5 is effort-only and does not list `temperature` as a supported parameter. *(source: https://ai-gateway.vercel.sh/v1/models (fetched 2026-10-03))*
- **AI Gateway routing options** — providerOptions.gateway supports `order`, `only`, and `models` (fallback model list tried in order when the primary fails), e.g. `providerOptions: { gateway: { models: ['openai/gpt-5.4-nano','google/gemini-3.8-flash'] } }`. *(source: https://ai-sdk.dev/providers/ai-sdk-providers/ai-gateway)*
- **Anthropic structured outputs limits** — Native Claude structured outputs do NOT support recursive schemas, numeric constraints (minimum/maximum/multipleOf), or additionalProperties other than false. Hard limits: 24 optional properties and 16 anyOf/type-array parameters across all schemas in a request. Unsupported schemas return HTTP 400. Supported on Haiku 4.5, Sonnet 4.5/4.6/5/5.5, Opus 4.5+. *(source: https://platform.claude.com/docs/en/build-with-claude/structured-outputs)*
- **AI SDK Anthropic structured output mode** — The Anthropic provider has `structuredOutputMode: 'auto' | 'outputFormat' | 'jsonTool'` (default 'auto' = native output format when supported, else JSON tool). claude-sonnet-5-5, claude-opus-5-5 and claude-fable-5-1 reject forced tool use, so 'jsonTool' cannot be used with them (falls back to outputFormat with a warning). The docs do not say whether unsupported schema keywords are stripped. *(source: https://ai-sdk.dev/providers/ai-sdk-providers/anthropic)*
- **Vercel function limits** — Request or response body max is 4.5 MB; over that returns 413 FUNCTION_PAYLOAD_TOO_LARGE. With Fluid compute, max duration is 300 s default and max on Hobby; 300 s default / 800 s max on Pro. Memory 2 GB / 1 vCPU on Hobby. Runs in one region (iad1) by default. *(source: https://vercel.com/docs/functions/limitations)*
- **Vercel filesystem** — Vercel Functions have a read-only filesystem with a writable /tmp scratch space up to 500 MB. Nothing in the docs promises /tmp persists or is shared across instances; concurrency auto-scales across instances. *(source: https://vercel.com/docs/functions/runtimes)*
- **Vercel Blob** — @vercel/blob (2.8.0) server API: `put(pathname, body, { access: 'private' | 'public', addRandomSuffix })`; a connected store injects BLOB_STORE_ID + OIDC, with BLOB_READ_WRITE_TOKEN as a static fallback. Server uploads are bound by the same 4.5 MB request limit. *(source: https://vercel.com/docs/vercel-blob/server-upload)*
- **Supabase JS** — @supabase/supabase-js latest is 2.117.2. `supabase.from(t).upsert(row, { onConflict })` and `supabase.storage.from(bucket).upload(path, body, { contentType, upsert, cacheControl })` are the current signatures. *(source: https://supabase.com/docs/reference/javascript/upsert ; https://supabase.com/docs/reference/javascript/storage-from-upload)*
- **Next.js 16 async request APIs** — In Next 16 synchronous access to params, searchParams, cookies(), headers(), draftMode() is fully removed. Route handler context is `{ params: Promise<{...}> }`; a global `RouteContext<'/users/[id]'>` helper (and PageProps/LayoutProps) is generated by next dev / next build / next typegen. *(source: https://nextjs.org/docs/app/guides/upgrading/version-16 ; https://nextjs.org/docs/app/api-reference/file-conventions/route)*
- **Next.js 16 build and tooling** — Turbopack is the default for both `next dev` and `next build`; a custom `webpack` config makes `next build` FAIL unless you pass --webpack. `next lint` is removed and `next build` no longer lints. Minimum Node 20.9, TypeScript 5.1. `next dev` writes to .next/dev and a lockfile prevents multiple `next dev` or `next build` instances on the same project directory. *(source: https://nextjs.org/docs/app/guides/upgrading/version-16)*
- **Next.js 16 middleware and caching** — middleware.ts is deprecated and renamed proxy.ts (export `proxy`, nodejs runtime only). GET route handlers are dynamic (uncached) by default since v15. `revalidateTag` now requires a second argument. Route segment config `dynamic`, `dynamicParams`, `revalidate`, `fetchCache` are removed when `cacheComponents` is enabled; `runtime = 'edge'` and `preferredRegion` are deprecated; `maxDuration` is supported. *(source: https://nextjs.org/docs/app/guides/upgrading/version-16 ; https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config ; https://nextjs.org/docs/app/api-reference/file-conventions/route)*
- **Next.js body size config** — `experimental.serverActions.bodySizeLimit` only limits Server Action request bodies (default 1 MB). It does not apply to Route Handlers, which read the body with request.json()/formData() and need no bodyParser config. *(source: https://nextjs.org/docs/app/api-reference/config/next-config-js/serverActions ; https://nextjs.org/docs/app/api-reference/file-conventions/route)*
- **Next.js dev server via tunnel** — Next.js blocks cross-origin requests to dev-only assets and endpoints by default. Only localhost, its subdomains and the start hostname are allowed; a tunnel hostname needs `allowedDevOrigins: ['*.tunnel.example.com']` (hostname only, no scheme/port; `*` = one label, `**` = many). *(source: https://nextjs.org/docs/app/api-reference/config/next-config-js/allowedDevOrigins)*
- **Next.js agent docs** — The AGENTS.md block in the starter is the official managed block: it is re-added by `next dev`, and version-matched docs are bundled at node_modules/next/dist/docs/ (16.2+). Commit it so the tree stays clean. *(source: https://nextjs.org/docs/app/guides/upgrading/version-16)*
- **getDisplayMedia options** — Options: `video.displaySurface: 'browser'|'window'|'monitor'` pre-selects the picker pane (Chrome 107+); `selfBrowserSurface: 'include'|'exclude'` (107+); `surfaceSwitching: 'include'|'exclude'` shows the 'Share this tab instead' button (107+); `systemAudio` (105+); `monitorTypeSurfaces: 'include'|'exclude'` hides whole-screen sharing (119+, TypeError if combined with displaySurface 'monitor'); `preferCurrentTab`; `controller: CaptureController`. Explicit selfBrowserSurface 'exclude' is mutually exclusive with preferCurrentTab true. Options are hints and cannot restrict the user's choice. *(source: https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getDisplayMedia ; https://developer.chrome.com/docs/web-platform/screen-sharing-controls/)*
- **getDisplayMedia security** — Requires a secure context and transient user activation; permission is never persisted (prompt every time). Constraints using min/exact throw TypeError. InvalidStateError if not called from a user gesture or the document lacks focus; NotAllowedError if the user cancels. *(source: https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getDisplayMedia)*
- **Capture focus control** — `CaptureController.setFocusBehavior('focus-captured-surface' | 'no-focus-change')` decides whether the captured tab/window takes focus when getDisplayMedia resolves. It must be set before the call or immediately after the promise resolves; throws InvalidStateError for monitor capture. Experimental, not Baseline. *(source: https://developer.mozilla.org/en-US/docs/Web/API/CaptureController/setFocusBehavior)*
- **Chrome timer throttling** — Visible pages or pages that made sound in the last 30 s: timers unthrottled. Hidden pages: timers checked once per second. Intensive throttling (once per minute) applies when hidden >5 min AND chain count >=5 AND silent >=30 s AND WebRTC not in use (an RTCPeerConnection with an open RTCDataChannel or a live MediaStreamTrack exempts the page). The article does not mention Web Workers. *(source: https://developer.chrome.com/blog/timer-throttling-in-chrome-88)*
- **Chrome window occlusion** — On Windows, Chrome treats the foreground tab of a window that is fully covered by other windows as a background tab: rendering stops and JavaScript is throttled. *(source: https://blog.chromium.org/2021/12/chrome-windows-performance-improvements-native-window-occlusion.html)*
- **MediaStreamTrackProcessor** — A video MediaStreamTrack is transferable to a dedicated worker (`worker.postMessage({ track }, [track])`); `new MediaStreamTrackProcessor({ track }).readable` yields VideoFrame objects that must be `close()`d. Limited availability, and browsers differ on whether it is exposed on window or only in workers. *(source: https://developer.mozilla.org/en-US/docs/Web/API/MediaStreamTrackProcessor)*
- **Document Picture-in-Picture** — Feasible on Chrome/Edge 116+ desktop (Firefox 151+, no Safari). `await documentPictureInPicture.requestWindow({ width, height })` returns an always-on-top window you populate by appending DOM (styles must be copied manually); it rejects without a user gesture. One PiP window per tab, it cannot be navigated or positioned, and it closes when the opener closes or navigates. `pagehide` on the PiP window signals close. *(source: https://developer.chrome.com/docs/web-platform/document-picture-in-picture/ ; https://developer.mozilla.org/en-US/docs/Web/API/Document_Picture-in-Picture_API/Using)*
- **BroadcastChannel scope** — BroadcastChannel only connects windows, tabs, frames and workers on the same origin and in the same storage partition. So the ERP tab and the capture tab must be on the exact same origin in the same browser profile (localhost:3000 and 127.0.0.1:3000 are different origins; so are a Vercel preview URL and the production alias). *(source: https://developer.mozilla.org/en-US/docs/Web/API/Broadcast_Channel_API)*
- **Presidio** — Presidio is Python only (3.10 to 3.13): presidio-analyzer, presidio-anonymizer, presidio-image-redactor. It needs an NLP model (spaCy en_core_web_lg by default) and Tesseract OCR for image redaction. Docker images now live at ghcr.io/data-privacy-stack/presidio-analyzer | -anonymizer | -image-redactor (run with -p 5002:3000 / 5001:3000 / 5003:3000). No JavaScript, TypeScript, browser or WASM package exists. *(source: https://presidio.dataprivacystack.org/installation/)*
- **Cloudflare quick tunnel** — `cloudflared tunnel --url http://localhost:3000` gives a random https://*.trycloudflare.com URL with no account. Limits: no uptime guarantee, 200 in-flight requests (429 beyond), no Server-Sent Events, hostname changes every run. *(source: https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/trycloudflare/)*
- **ngrok free plan** — 1 GB data transfer and 20,000 HTTP requests per month, one assigned *.ngrok-free.app dev domain, and an interstitial warning page before HTML content (skippable only with the ngrok-skip-browser-warning header). *(source: https://ngrok.com/docs/pricing-limits/free-plan-limits/)*
- **Railway** — Deploy with `railway init` + `railway up` or from a GitHub repo; public HTTPS URL via Settings > Networking > Generate Domain. Railway's Next.js guide tells you to set `output: 'standalone'` and start with `node .next/standalone/server.js`. Volumes: app lives in /app, volumes mount at runtime only (not build), one volume per service, no replicas with a volume, redeploys cause brief downtime, 0.5 GB on trial / 5 GB on Hobby. *(source: https://docs.railway.com/guides/nextjs ; https://docs.railway.com/reference/volumes)*
- **Render free tier** — Free web services spin down after 15 minutes without traffic (about one minute to wake, with a loading page) and have an ephemeral filesystem with no persistent disks. *(source: https://render.com/docs/free)*

