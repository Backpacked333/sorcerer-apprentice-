# 03 · Contracts — the interfaces between lanes

> These are the seams that let four swarms build in parallel. They describe the code **as it is on `main`**.
> Rules: **additive changes only**; the owner updates this file in the same PR and posts `CONTRACT:` in chat; breaking changes need every consuming lane's OK and are forbidden after M2. If this doc and `main` disagree, `main` wins — fix the doc.

Legend: **Owner** = the only lane that edits the defining file. **Consumers** = lanes that depend on it.

---

## 1. The Work Map — `lib/workmap.ts` · Owner **C** · Consumers A, B, D

The single artifact. Capture writes its inputs, Map confirms it, Teach executes it, exports serialize it. Everything is Zod-validated (`WorkMapSchema`).

```ts
type InvoiceState = {                // what vision / ERP telemetry report about the invoice on screen
  invoice?: string; supplier?: string; entity?: string;            // entity: "parent" | "subsidiary"
  amount?: number; category?: string; invoiceMonth?: number;       // 1..12
  invoiceDate?: string; costCenter?: string; route?: string;       // route: "single" | "second_approval"
  status?: string;                                                 // "open" | "approved" | "hold" | "posted"
  hasAssetNumber?: boolean; knownSupplier?: boolean; hasPO?: boolean; description?: string;
};

type Quote = { text: string; t: number; audioId?: string;          // VERBATIM expert words; t = seconds since session start
               source: "live" | "narration" | "debrief" | "counterfactual"; translation?: string;
               evidence?: "demonstrated" | "described" };

type Cond = { all: Cond[] } | { any: Cond[] } | { not: Cond }
          | { field: string; op: ">"|">="|"<"|"<="|"=="|"!="|"in"|"matches"|"exists";
              value?: string | number | boolean | string[] };
type Act  = { set: Record<string, string> } | { route: string } | { status: "hold"|"approved"|"posted" };

type Guardrail = { id: string; kind: "limit"|"exception"|"escalation"; text: string; quote?: Quote; ruleId?: string };

type Step = { id: string; index: number; title: string; invoice?: string;
  screenMoment: { t: number; frameId?: string; region?: { x: number; y: number; w: number; h: number } };
  action: { field: string; from?: string; to: string } | { type: "open"|"hold"|"route"|"save"|"approve"|"close" };
  decision: string; judgment: boolean; reason?: Quote; guardrails: Guardrail[];
  confidence: "high"|"medium"|"low" };

type Rule = { id: string; stepId?: string; title: string; when: Cond; then: Act; unless?: Cond;
  stopAndAsk?: { who?: string; when: Cond; quote?: Quote }; quotes: Quote[];
  confidence: "high"|"medium"|"low"; confirmedBy: ("live"|"counterfactual"|"debrief"|"teachback")[] };

type Slot = { id: string; kind: "reason"|"limit"|"exception"|"escalation"|"counterfactual"|"novel";
  stepId?: string; ruleId?: string; question: string; status: "open"|"filled"|"skipped"; filledBy?: Quote };

type WorkMap = { sessionId: string; task: string; expert: { name: string; language: string };
  onet?: { code: string; occupation: string; task: string };
  steps: Step[]; rules: Rule[]; slots: Slot[];
  seen?: { categories: string[]; entities: string[]; suppliers: string[] };
  privacy: { framesSeen: number; framesKept: number; entitiesRedacted: number; offRecord: { from: number; to: number }[] };
  notes: { topic: string; question: string; quote: Quote }[];   // debrief answers about cases not seen today
  revision: number;                                             // bumped by saveMap() on every save
  compiledAt?: number; confirmedAt?: number;                    // confirmedAt is set ONLY by the confirm route on an explicit yes
  corrections: { t: number; text: string }[] };
```

Exported helpers (stable signatures): `evalCond(cond, state): boolean` · `describeCond(cond): string` · `describeAct(act): string` · `actionMatchesRule(rule, state): boolean | undefined` (`undefined` = nothing decided yet) · `openSlots(map): Slot[]` · `understanding(map): number` (0..1) · `isComplete(map): boolean` · `emptyMap(sessionId, task, expertName)` · `uid(prefix)`.

P-6/P-16/P-17 compatibility: legacy maps and quotes still parse without new fields. Absence of `evidence` does not mean demonstrated; absence of `seen` means unrecorded, not an empty observed universe. `stopAndAsk.quote` is the stop-specific evidence, distinct from the main rule's quotes. An absent `who` remains unknown, never a default person or role. Producers and consumers adopt these fields in follow-up work; this schema change alone does not establish provenance or novelty behavior.

**Invariants every lane relies on**

1. A `Quote.text` is always a verbatim substring of something the expert said (transcript segment or window answer). Paraphrases live in `Step.decision`, `Rule.title`, `Guardrail.text` — never in a `Quote`.
2. A `Rule` exists only if the expert stated its trigger. No stated trigger → the step keeps an open `Slot` and the tutor cannot use it.
3. `Cond.field` ∈ `amount, category, supplier, entity, invoiceMonth, costCenter, hasAssetNumber, knownSupplier, hasPO, route, status` (the fields the sandbox exposes). The compile validator rejects anything else.
4. The tutor, the save guard and the exports only ever load a map with `confirmedAt` set. A correction after confirmation clears it (C to enforce).
5. "Done understanding" = `openSlots(map).length === 0 && !!map.confirmedAt` (`isComplete`). Nothing but the expert's words can fill a slot.

---

## 2. Screen events and the session log — `lib/events.ts` · Owner **B** · Consumers A, C, D

```ts
type EventKind = "screen_changed" | "invoice_opened" | "invoice_closed" | "field_changed" | "status_changed"
               | "route_changed" | "save_intent" | "save_clicked" | "save_blocked" | "typing";
type EventSource = "vision" | "dom";          // "dom" = the sandbox ERP's own telemetry. NEVER disguise one as the other.

interface ScreenEvent { id: string; t: number;               // t = seconds since session start
  source: EventSource; kind: EventKind;
  invoice?: string; field?: string; from?: string; to?: string;
  state?: InvoiceState;                                       // merged invoice state after the event
  uiActivity?: "typing"|"reading"|"navigating"|"idle";
  frameId?: string; confidence?: number; latencyMs?: number;  // change → event latency in ms
  alsoSeenBy?: EventSource;                                   // set when the second source confirmed the same change
  mode?: "coached"|"independent";                             // teach only, reported by the sandbox per case
  blocked?: { ruleId: string; title: string; quote?: string; who?: string };  // save_blocked only
  boundary?: boolean;                                         // natural step boundary (save, close, back to list)
  redacted?: boolean; }                                       // struck from the record: tombstone, content removed

interface TranscriptSegment { id: string; t: number; tEnd?: number; text: string;
  speaker: "expert"|"agent"|"newhire"; final: boolean; redacted?: boolean; }

interface QuestionWindow { id: string; candidateId: string;
  kind: "why"|"counterfactual"|"limit"|"stop"|"who"|"debrief"|"intervene"|"predict";
  question: string; stepRef?: string;                          // "<invoice>:<field|kind>", e.g. "4471:costCenter"
  openedAt: number; spokeAt?: number;                         // agent started speaking
  askedAt?: number; answeredAt?: number; closedAt?: number;   // askedAt: question finished, listening mic opened
  closedBy?: "tool"|"scribe_fallback"|"timeout"|"user";
  outcome?: "answered"|"timeout"|"aborted"|"off_record";
  answerText?: string; answerAudioId?: string;
  logged?: { reason?: string; guardrail?: string; kind?: string }; }   // from the agent's log_answer call

interface Frame { id: string; t: number; dataUrl?: string; url?: string; width: number; height: number; piiRegionsBlurred: number; }

interface SessionLog { id: string; mode: "capture"|"teach"; task: string; expertName: string;
  startedAt: number; endedAt?: number;                         // epoch ms
  events: ScreenEvent[]; transcript: TranscriptSegment[]; windows: QuestionWindow[]; frames: Frame[];
  offRecord: { from: number; to: number }[]; metrics?: Record<string, number>;
  deferred?: { kind: string; question: string; stepRef: string }[];
  sample?: boolean; ws?: string;
  mastery?: { ruleId: string; outcome: string; t: number }[]; flagged?: { t: number; context: string }[];
  sourceMapSessionId?: string; sourceMapRevision?: number; }   // teach only
```

Helpers: `emptySession(id, mode, task, expertName)` · `describeEvent(e): string` (the one-line rendering used for agent context and feeds) · `labelField(f)`.

All added fields are optional; existing logs remain valid. `save_intent` describes a save requested but not yet posted, unlike `save_clicked`. `Frame.dataUrl` is now optional so URL-only frames are valid; consumers must render `frame.url ?? frame.dataUrl`. `sample` marks sample sessions; `ws` is metadata, not automatic session isolation. Adding fields does not wire their producers or consumers.

`stepRef` format is `"<invoice>:<field ?? kind>"` and is the join key between a live question, its answer, and the compiled `Step` (`compile.ts: stepRefOf`). Do not change it.

### Telemetry channel — `lib/telemetry.ts` · Owner **B**

`BroadcastChannel("tacit-erp")`, same-origin, same browser profile. `TelemetryMessage`: `{ kind: EventKind; at: number /*epoch ms*/; invoice?; field?; from?; to?; state?: InvoiceState; boundary?; mode?; blocked?; queue?: Queue; sandboxSession?: string; reannounce?: boolean }`. `Queue` is `"expert" | "newhire" | "autopilot"` from `lib/erp-model.ts`; **queue is optional**, preserving existing publishers.

```ts
interface TelemetryHello { type: "hello"; at: number; sessionId: string; queues?: Queue[] }
postTelemetry(msg: Omit<TelemetryMessage, "at">): void;
subscribeTelemetry(handler: (m: TelemetryMessage) => void): () => void;
postHello(h: { sessionId: string; queues?: Queue[] }): void;
subscribeHello(handler: (h: TelemetryHello) => void): () => void;
```

Both post helpers stamp epoch-ms `at`. `subscribeTelemetry` excludes messages with `type === "hello"`; `subscribeHello` receives only those control messages. Subscriptions return channel-closing cleanup functions. Without a browser/BroadcastChannel the helpers are no-ops. The hello/reannounce contracts enable ERP resynchronization; producers and consumers still need their lane integrations.

### The screen pipeline hook — `components/useScreenPipeline.ts` · Owner **B** · Consumers A (Capture), C (Teach), D (views)

```ts
useScreenPipeline({ sessionStart: number /*epoch ms*/, source: "vision"|"dom"|"both",
                    onEvent: (e: ScreenEvent, frame?: Frame) => void, onVision?: (info) => void })
→ { videoRef, sharing, start(), stop(),
    signals: Ref<{ lastScreenChangeAt, lastTypingAt, lastBoundaryAt, lastInvoiceOpenedAt, activity }>,  // seconds since session start
    currentState: Ref<InvoiceState>,
    framesSeen, framesSent, dropped, piiBlurred, visionLatency, visionError, activity,
    masks, addMask(region), clearMasks(), paused, setPaused(bool), bumpEpoch() }
```

- `source: "both"` (default): vision is primary; an ERP telemetry event waits 2.5 s for vision to report the same change and only fills in what vision missed. Events vision saw first carry `source: "vision"` (+ `alsoSeenBy: "dom"` when the ERP agreed).
- `setPaused(true)` and `bumpEpoch()` advance a **consent epoch**; any vision result from an older epoch is discarded. Masks are painted before a frame leaves the browser.
- The governor (A) reads `signals`; the matcher (C) reads `currentState`. B must keep both refs' meaning stable.

---

## 3. Voice — `components/voice.tsx` · Owner **A** · Consumers C (Map, Teach controllers), D (status badges)

```ts
interface VoiceApi {
  mode: "agent" | "fallback";              // agent = ElevenAgents; fallback = browser speech (keyless)
  connected: boolean; status: string; isSpeaking: boolean; micMuted: boolean;
  messages: { role: "user"|"agent"; text: string; t: number }[];
  degraded: boolean; lastError?: string;    // true/reason when voice or STT is on a labeled fallback
  connect(opts?: { firstMessage?: string; prompt?: string; language?: string; dynamicVariables?: Record<string,string>; sessionStartMs?: number; keyterms?: string[] }): Promise<void>;
  disconnect(): void;
  getId(): string | undefined;              // safe before/after a live agent session
  say(tag: string, text: string, spoken?: string): void;   // agent mode: sends "[TAG] text" as a user message; fallback: speaks `spoken ?? text`
  setMicMuted(muted: boolean): void;
  sendContext(text: string): void;                          // contextual update: adds context, never triggers speech
  gateOpen: boolean;                                       // remote agent output is audible only inside an authorized window
  noteUserActivity(): void;                                // additive human-activity signal; safe before/after keyed fallback
  turn(opts: TurnOptions): Promise<TurnResult>;             // never rejects; one tagged utterance plus optional listening window
  cancelTurn(reason?: TurnResult["abortReason"]): void;
  submitTyped(text: string): void;
  setSessionStart(epochMs: number): void;
  lastHumanSpeechAt(): number;
  turnPhase: TurnPhase; partial: string;
  stt: { engine: "scribe"|"webspeech"|"none"; connected: boolean };
}
type VoiceDebugEvent = { at: number; src: "agent"|"scribe"|"turn"|"gate"|"tool"; type: string; data?: unknown };
interface VoiceProviderProps { agentId?: string; tools: MutableRefObject<ToolHandlers>; onDebugEvent?: (event: VoiceDebugEvent) => void }
<VoiceProvider agentId={id} tools={ref} onDebugEvent={callback}>…</VoiceProvider>
useVoice(): VoiceApi
type TranscriptMeta = { startedAtMs: number; endedAtMs: number; speaker: "human"|"agent" };
useTranscriber({ enabled, onPartial(text), onCommitted(text, startSecs?, endSecs?, meta?), onAgentEcho?(text, startSecs?, endSecs?, meta?), onCommand?(command, text, meta), language? })
  → { engine: "scribe"|"webspeech"|"none", connected, partial }
type ToolHandlers = Partial<Record<ToolName, (params) => string | void | Promise<string | void>>>;   // pages assign tools.current = {…}

type TurnPhase = "idle"|"sending"|"waiting_for_speech"|"speaking"|"listening"|"closing";
interface TurnOptions {
  tag: string; text: string; spoken?: string; listen?: boolean; timeoutSecs?: number; maxSecs?: number;
  recordClip?: { sessionId: string }; abortOnHumanSpeech?: boolean; watchdogSecs?: number;
  silenceCloseSecs?: number; ackMaxSecs?: number; onPhase?: (phase: TurnPhase, at: number) => void;
}
interface TurnResult {
  spoke: boolean; heard: string; via: "tool"|"scribe"|"typed"|"timeout"|"aborted"|"spoken";
  tool?: { name: ToolName; params: Record<string, unknown> }; audioId?: string;
  sentAt: number; spokeAt?: number; askedAt: number; answeredAt?: number; closedAt: number;
  spokenBy?: "agent"|"fallback"; spokenText?: string; heardSource?: "scribe"|"agent_asr"|"typed";
  command?: "off_record"|"not_now";
  abortReason?: "resumed"|"user"|"superseded"|"paused"|"disconnected"|"silent";
}
```

**What A guarantees to C and D:** `connect()` always supplies safe `expert_name`, `newhire_name`, and `task` dynamic-variable defaults, resolves from SDK lifecycle events (not the non-awaitable `startSession` return), and resolves into a labeled browser fallback on connection failure. Empty override strings are omitted per the SDK guidance; suppressing a stored tutor greeting with an empty override is not supported until live behavior is verified. Remote ElevenLabs stream audio receives the current gate volume synchronously before LiveKit invokes `play()` and remains inaudible outside an authorized first-message, `say()`, legacy-mic or `turn()` window; ordinary clips/replays are not intercepted. A user-activity heartbeat prevents idle timeout turns, and an authorized response that does not start within 8 seconds is persistently gated closed and reported until another response is explicitly authorized or the voice disconnects. `VoiceInner` owns one shared Scribe connection while an enabled transcriber subscriber or voice session exists; `?stt=off` prevents microphone acquisition. One demand window mints at most one token; fatal Scribe errors latch a labeled WebSpeech fallback until demand stops, and a language/device/keyterm/background-filter change performs one controlled reconnect. Expected-close state is connection-generation scoped, so a suppressed old SDK CLOSE cannot mask a later replacement failure. Transcript times use the application clock once `sessionStartMs` is known. Agent/fallback echo is routed only to `onAgentEcho`; human barge-in and the human suffix of a mixed segment remain human. After `say(tag, …)` the line is spoken once, promptly, in the right voice; `isSpeaking` is truthful; the mic is closed unless the page opened it; the registered client tool for that tag fires (or A's timeout fallback closes the turn — see lane A). C never calls the ElevenLabs SDK directly.

### 3.1 Tag protocol (page → agent, via `say`)

The agents speak **only** when a message starts with a tag; otherwise they call `skip_turn`. Payload segments are separated by ` | `.

| Tag | Sent by | Payload | Agent does | Then calls |
|---|---|---|---|---|
| `[ASK]` | Capture (A) | `<question> \| stepRef=<ref> \| kind=<kind> \| on screen: <last 3 events> \| labels: <code=label; …> \| said: "<last expert sentence>" \| retro=<0\|1> \| followup=<0\|1> \| phrase=<natural\|exact>` | asks once in one natural sentence (≤ 22 words), preserving numbers/codes; `phrase=exact` is verbatim; `retro=1` names the item as “a moment ago” | `log_answer` |
| `[DEBRIEF]` | Map (C) | `slot=<slotId> <question>` | asks exactly that | `log_answer` (stepRef = slot id) |
| `[TEACHBACK]` | Map (C) | `<teach-back text>` (or `Understood. <changed sentences> Is that right now?`) | reads it as its own understanding | `confirm_teachback` |
| `[CONFIRMED]` | Map (C) | `<instruction>` | one short thank-you sentence, stops | — |
| `[PREDICT]` | Teach (C) | `<question> \| expert's words: "<quote>" \| ruleId=<id> \| rule: <title>` | asks, waits, judges the answer without revealing the quote first | `record_prediction` |
| `[INTERVENE]` | Teach (C) | `<message> \| expert's words: "<quote>" \| stepId=<id> \| ruleId=<id> \| rule: <title> \| clip=<yes\|no>` | says the message, waits, then teaches with either the quote or the app-played clip | `show_replay` (optional) |
| `[STOP]` | Teach (C) | `<message> \| expert's words: "<quote>" \| ruleId=<id> \| rule: <title> \| who=<name or empty> \| clip=<yes\|no>` | says it, waits, checks who they would ask without inventing a missing person | `record_mastery` |
| `[PRAISE]` | Teach (C) | `<message> \| expert's words: "<quote>"` | one short sentence, no wait | — |
| `[NOVEL_COVERED]` | Teach (C) | `<message> \| expert's words: "<quote>" \| clip=<yes\|no>` | says the message and teaches only from the expert's stated words | — |
| `[NOVEL_FLAG]` | Teach (C) | `<message>` | says it will not guess; the app has already flagged the case | — |
| `[NOVEL]` | Teach (C) | legacy form; covered when it carries `expert's words`, otherwise flagged | follows the corresponding covered/flagged behavior | — |

Screen context (never triggers speech): `sendContext("[SCREEN t=<secs>s] <describeEvent(e)>")`.

Application-injected messages (`[TAG] …`) are **application control, never expert testimony**: they must never be stored as an expert `TranscriptSegment` or become a `Quote`.

### 3.2 Client tools (agent → page) — `agents/tools.json` · Owner **A**; handlers live in the page that owns the flow

| Tool | Agent | Params | Handler (file → owner) | Effect |
|---|---|---|---|---|
| `log_answer` | interviewer | `stepRef: string, reason: string, guardrail?: string, kind?: string` | `CaptureClient` (A): closes the window as answered · `MapClient` (C): fills `currentSlot` with the **Scribe-heard** text (falls back to `reason`), asks next | answer recorded |
| `mark_off_record` | interviewer | `seconds?: number` | `CaptureClient` (A) → `strike()` | strikes window / last N s |
| `confirm_teachback` | interviewer | `confirmed: boolean, corrections?: string` | `MapClient` (C) → `POST …/confirm` | lock or patch + re-read |
| `end_task` | interviewer | — | `CaptureClient` (A) | ends capture → `/map/<id>` |
| `show_replay` | tutor | `stepId?: string, rule?: string` | `TeachClient` (C) | opens the replay panel |
| `record_prediction` | tutor | `ruleId?: string, rule?: string, correct: boolean` | `TeachClient` (C) | mastery ledger |
| `record_mastery` | tutor | `ruleId?: string, outcome: "escalation_recognized"\|"missed"` | `TeachClient` (C) | mastery ledger; `ruleId` may be absent when the tag has none |
| `flag_for_expert` | tutor | `context: string` | `TeachClient` (C) | adds a `novel` slot to the expert's map |
| `end_session` | tutor | — | `TeachClient` (C) | outcome card |

Every tool is registered once in `voice.tsx` (`TOOL_NAMES`) and dispatched to `tools.current[name]`. A new tool = A adds it to `tools.json` + `TOOL_NAMES` + re-runs `npm run agents:create`; the consuming lane writes the handler.

**The verbatim rule:** the page records the expert's words from **Scribe** (what was actually said), not from the tool's `reason` param (which the LLM may reword). `reason` is only a fallback when Scribe heard nothing.

---

## 4. HTTP API

All routes are Next.js route handlers; `params` is a Promise in Next 16 (`const { id } = await params`).

| Method · Path | Owner | Body → Response | Notes |
|---|---|---|---|
| `GET /api/sessions` | B | → `{ sessions: {id,mode,task,expertName,startedAt,endedAt}[] }` | newest first |
| `POST /api/sessions` | B | `{ mode?, task?, expertName?, sourceMapSessionId? }` → `{ session: SessionLog }` | ids: `s_…` capture, `t_…` teach |
| `GET /api/sessions/:id` | B | → `{ session, map \| null }` | |
| `PUT /api/sessions/:id` | B | `SessionLog` → `{ ok, events, frames }` | browser owns the log during a session; whole-log sync, last write wins |
| `POST /api/sessions/:id/clips` | B | multipart `audioId`, `file` (webm) → `{ ok, audioId }` | the expert's answer audio |
| `GET /api/sessions/:id/clips?audioId=` | B | → `audio/webm` | replay audio |
| `GET /api/sessions/:id/map` | C | → `{ map }` · 404 until compiled | |
| `PUT /api/sessions/:id/map` | C | `WorkMap` → `{ map }` | expert edits/deletes before confirming; Zod-validated |
| `POST /api/sessions/:id/slot` | C | `{ slotId, text, t?, audioId? }` → `{ map, understanding }` | a debrief answer fills one slot |
| `POST /api/sessions/:id/confirm` | C | `{ confirmed, correction?, t? }` → `{ map, teachback, understanding, open, knowledge }` | yes locks + syncs tutor KB; correction patches |
| `POST /api/compile` | C | `{ sessionId, llm?: boolean }` → `{ map, llm: boolean, note?, understanding, teachback }` | deterministic pass, then validated LLM refinement when a key is set |
| `POST /api/teachback` | C | `{ sessionId }` → `{ text, sure: string[], unsure: string[] }` | generated from the map, ≤ 130 words |
| `POST /api/vision` | B | `{ seq, image }` → `{ seq, screen, state, banner, uiActivity, piiRegions, confidence, model, latencyMs }` · 503 with `mock: true` without key | one frame in, visible state out; details below |
| `GET /api/scribe-token` | A | → `{ token \| null }` | single-use Scribe token |
| `GET /api/erp/invoices?queue=` | C | → invoices | queues: `expert`, `newhire`, `autopilot` |
| `GET/PATCH /api/erp/invoices/:id` | C | PATCH `{ costCenter?, route?, status?, assetNumber?, notes? }` → `{ invoice, state }` · **409 `SaveVerdict`** when the armed guard blocks | the authoritative save path |
| `GET/POST /api/erp/reset?queue=` | C | resets a queue (GET redirects to `/erp`) | |
| `GET/POST /api/teach/guard` | C | POST `{ action: "arm"\|"disarm", mapSessionId?, teachSessionId? }` → `{ guard }` | arms the pre-save guard for a teach session |
| `GET /api/export?sessionId=&format=policy\|prompt\|sop` | B | → file download | stretch X1 |
| `POST /api/autopilot` | B | `{ sessionId, apply? }` → `{ steps, remaining }` | runs the policy over the `autopilot` queue, halts where she would |

`SaveVerdict` (`lib/matcher.ts`): `{ blocked: boolean; ruleId?; title?; quote?; who?; reason?; missing?: string }`. `missing` is an optional human-readable failed condition (P-16). The guard enforces **only a confirmed map** and only learned rules.

### Vision response and wire schema — `lib/vision-schema.ts` · Owner **B** · Consumers A, C, D

- Request: nonnegative integer `seq`; `image` is nonempty JPEG base64, optionally prefixed with `data:image/jpeg;base64,` or `data:image/jpg;base64,`. The image string is bounded at `4 * 1024 * 1024` characters **before** prefix removal and stack-safe base64 validation. This is not a streaming HTTP-body limit or JPEG-content validation. Legacy `prevState` and `t` are ignored, not sent to the model.
- HTTP 200: echoes `seq`; `screen` is `invoice_list | invoice_detail | confirm_dialog | other`; `banner` is `none | posted | blocked`; `uiActivity` is `typing | reading | navigating | idle`; `piiRegions` contains `{ x, y, w, h, kind }`; `confidence` is clamped to 0..1; `model` is the selected gateway slug and `latencyMs` measures generation/normalization time. PII coordinates are prompted as image fractions, not schema-bounded.
- Provider `VisionWire` uses an explicit, nonrecursive object with no records, optional fields or numeric min/max constraints. Its 14 state fields are required but nullable: strings `invoice`, `supplier`, `entity`, `category`, `invoiceDate`, `costCenter`, `route`, `status`, `description`; numbers `amount`, `invoiceMonth`; booleans `hasAssetNumber`, `knownSupplier`, `hasPO`.
- API `state` is the cleaned `InvoiceState`, not the nullable provider object: unread/null fields are omitted, false/zero preserved, invoice prefixes removed, category/route/status tokenized (`on_hold` → `hold`), and selected cost-center codes retain leading zeros. List/other screens return `{}` even if the model filled state fields. Previous state must not supply missing observations.
- `banner: posted` means a visible successful saved/posted confirmation, never a Save button or an open dialog; `blocked` means held/not-posted. Consumers must not infer success from Cancel, a blocked banner or `approved` status alone. Full visual-save integration depends on pipeline [#33](https://github.com/Backpacked333/sorcerer-apprentice-/pull/33) and D's persistent Posted/status UI [#23](https://github.com/Backpacked333/sorcerer-apprentice-/issues/23); it is not live-verified.
- Execution: AI SDK 7 `generateText` + `Output.object`, `timeout.totalMs: 8000`, `maxRetries: 0`, `maxOutputTokens: 500`; route `maxDuration: 30`. The provider receives a JPEG file part with raw base64, no data-URL prefix. Screenshot text is explicitly untrusted; masks must not be guessed through. These are implementation/prompt safeguards, not a claim of evaluated prompt-injection resistance or provider accuracy.
- Errors: missing key is checked first and returns HTTP 503 `{ error: "AI_GATEWAY_API_KEY not set; use NEXT_PUBLIC_EVENT_SOURCE=dom", mock: true }` without a provider call. Invalid input with a configured key returns 400 `{ error: "invalid vision request" }`; a caught `TimeoutError` returns 504 `{ error: "vision timeout", seq }`; other generation errors return 502 `{ error: "vision unavailable", seq }`. Provider exception text/credentials are never returned. Mock 503 is not an observed frame; client shutdown/counters are supplied separately by #33.

---

## 5. Persistence — `lib/store.ts` · Owner **B**

```ts
dataDir(): string
getSession(id: string): Promise<SessionLog | undefined>
saveSession(s: SessionLog): Promise<void>
listSessions(): Promise<Pick<SessionLog,"id"|"mode"|"task"|"expertName"|"startedAt"|"endedAt">[]>
getMap(sessionId: string): Promise<WorkMap | undefined>
saveMap(map: WorkMap): Promise<void>               // bumps map.revision
saveClip(sessionId: string, audioId: string, bytes: Uint8Array): Promise<string>
readClip(sessionId: string, audioId: string): Promise<Uint8Array | undefined>
deleteClip(sessionId: string, audioId: string): Promise<boolean>
deleteClips(sessionId: string, audioIds: string[]): Promise<void>
saveFrame(sessionId: string, frameId: string, bytes: Uint8Array): Promise<string>
readFrame(sessionId: string, frameId: string): Promise<Uint8Array | undefined>
deleteFrame(sessionId: string, frameId: string): Promise<boolean>
deleteFrames(sessionId: string, frameIds: string[]): Promise<void>
listFrameIds(sessionId: string): Promise<string[]>
getErpState(ws?: string): Promise<Invoice[] | undefined>
saveErpState(invoices: Invoice[], ws?: string): Promise<void>
interface GuardRecord { mapSessionId: string; teachSessionId: string; armedAt: number; expiresAt: number }
getGuard(teachSessionId?: string, ws?: string): Promise<GuardRecord | undefined>
saveGuard(g: { mapSessionId: string; teachSessionId: string; ttlMs?: number }, ws?: string): Promise<GuardRecord>
clearGuard(teachSessionId?: string, ws?: string): Promise<void>
// lib/workspace.ts (B): local-only placeholder, no cookie/request lookup yet
currentWorkspace(): Promise<string>               // resolves to "local"
```

`dataDir()` reads `DATA_DIR` per call, defaulting to `<cwd>/.data`. Sessions/maps use `sessions/<id>.json` / `maps/<id>.json`; clips/frames use `clips/<sessionId>/<audioId>.webm` / `frames/<sessionId>/<frameId>.jpg`. Media saves return the filesystem path, not a browser URL. ERP and guards use `ws/<ws>/erp.json` and `ws/<ws>/guards.json`. Omitted `ws` resolves through the **local-only stub**; session/map/media paths and session listings are not workspace-scoped. P-25 cookie isolation is not implemented here.

All path IDs must match `/^[\w-]{1,64}$/`. Writes use temporary files plus atomic rename, serialized per file within one Node process; guard read-modify-write operations share that serialization. Bulk deletion validates every ID before deleting; single deletion returns `false` for a missing file. Missing lists return `[]`. Only ENOENT is treated as missing: corrupt JSON, invalid records and other I/O errors throw, without stale cache fallback or reseeding. ERP validation rejects non-array state and non-object entries; it is not a full invoice schema validator.

Guards are keyed by teach session. Saving re-arms that session with a default 30-minute TTL (or finite nonnegative `ttlMs`); validated input is snapshotted before awaiting. `getGuard(id)` excludes expired records; without an ID it returns the newest unexpired guard by `armedAt`, with persisted private sequence metadata breaking timestamp ties. No matching active guard returns `undefined`. `clearGuard(id)` clears one; `clearGuard()` clears all in the current workspace; `clearGuard(undefined, ws)` clears all in an explicit workspace. Clearing does not silently replace corrupt guard data.

**Lane C integration remains:** `lib/erp.ts` still writes legacy `.data/erp.json` and `.data/erp-guard.json` directly until migrated to these APIs ([#24](https://github.com/Backpacked333/sorcerer-apprentice-/issues/24)). Existing signatures are preserved; consumers import the store (and `lib/erp.ts`'s sandbox exports), not `fs`.

---

## 6. Environment — `.env.example` · Owner **B** (anyone may request a variable)

| Variable | Used by | Meaning |
|---|---|---|
| `ELEVENLABS_API_KEY` | server (A) | Scribe tokens, agent creation, KB sync. Server-side only. |
| `NEXT_PUBLIC_INTERVIEWER_AGENT_ID`, `NEXT_PUBLIC_TUTOR_AGENT_ID` | client (A) | empty → browser-speech fallback |
| `ELEVENLABS_VOICE_ID`, `AGENT_LLM` | `create-agents.ts` (A) | voice and agent LLM |
| `ELEVENLABS_PRIVATE_AGENTS`, `ELEVENLABS_TTS_MODEL` | server/voice integration (A) | Deployment examples use `1` and `eleven_v4_turbo`; lane A must provide server-issued conversation tokens. Flags alone do not implement private-agent authentication. |
| `DATA_DIR` | server filesystem store (B) | Local default `.data`; Railway `/app/.data` on a persistent volume with exactly one Node replica. |
| `AI_GATEWAY_API_KEY` | server (B, C) | Vercel AI Gateway: vision + compile; server-only. Missing key makes vision return 503 `mock: true`, without provider invocation. |
| `VISION_MODEL` | server (B) | vision gateway slug; defaults to `anthropic/claude-haiku-4.5` when unset. No model bake-off or fallback/eval env contract is introduced by #28. |
| `COMPILE_MODEL` | server (C) | compile gateway model slug; unchanged by the vision work |
| `NEXT_PUBLIC_EVENT_SOURCE` | client (B) | `vision` \| `both` (default) \| `dom` |
| `NEXT_PUBLIC_SILENCE_SECS` | client (A) | Expert-speech quiet period before a normal window may open; default `2.5` seconds. |
| `NEXT_PUBLIC_STILL_SECS` | client (A) | Screen-still period before a normal window may open; default `2` seconds. |
| `NEXT_PUBLIC_COOLDOWN_SECS` | client (A) | Minimum time between normal question windows; demo default `20` seconds. |
| `NEXT_PUBLIC_MAX_QUESTIONS_PER_10MIN` | client (A) | Maximum spoken-question budget in a trailing ten-minute window; default `5`. |
| `NEXT_PUBLIC_WARMUP_SECS` | client (A) | No-question period at the start of Capture; demo default `8` seconds. |
| `NEXT_PUBLIC_READING_SECS` | client (A) | No-question period after an invoice opens; demo default `5` seconds. |
| `NEXT_PUBLIC_TYPING_QUIET_SECS` | client (A) | Typing-free period before a window may open; default `3` seconds. |
| `NEXT_PUBLIC_WINDOW_TIMEOUT_SECS` | client (A) | Maximum unanswered question-window duration; default `20` seconds. |
| `NEXT_PUBLIC_MIN_VALUE` | client (A) | Minimum candidate value after any boundary bonus; default `0.6`. |
| `NEXT_PUBLIC_GRACE_SECS` | client (A) | Time a just-left invoice remains eligible via retro wording; default `18` seconds. |
| `NEXT_PUBLIC_MAX_CHAINED` | client (A) | Maximum chained guardrail follow-ups in Capture; default `2`. |

Anything prefixed `NEXT_PUBLIC_` ships to the browser: never a secret.

---

## 7. View-models — `components/views/*.vm.ts` · Owners **A** (capture), **C** (map, teach) · Consumer **D**

Created by D's seam-split PR (protocol §3). Shape rule: a `vm` is a plain object of **render-ready state + callbacks**, no SDK objects, no refs except `videoRef`. The TypeScript interfaces in the three `*.vm.ts` files are the source of truth. A client builds that object and returns `<XView vm={vm} />`. A view renders it and does not fetch.

Optional fields a view already reads, and which stay absent until the owning lane sets them:

| View-model | Field | Owner | What the view does when it is missing |
|---|---|---|---|
| `CaptureVM` | `voice.degraded`, `voice.lastError` | A | badges stay on `mode` / `connected` |
| `CaptureVM` | `reasonHeard` | A | the "reason heard" chip stays hidden |
| `CaptureVM` | `pipeline.setCropTarget`, `pipeline.surface` | A, from B's pipeline | real vision uses the companion layout |
| `MapVM` | `lastPatch`, `pending`, `canonical`, `matrix`, `knowledge`, `llm` | C | teach-back has no rule diff; confirm stays clickable; headline counts recorded steps; no matrix |
| `TeachVM` | `tutorState` | C | presence stays Watching or Speaking from `voice.isSpeaking`. The view never infers listening |
| `TeachVM` | `practice` | C | no "Practice this" button |
| `TeachVM` | `pipeline.setCropTarget` | C | same companion fallback as Capture |

`CropHandle` (`setCropTarget?`, `surface?`) lives on `capture.vm.ts` and is shared by the teach pipeline pick.

---

## 8. Sandbox seed data — `lib/erp-model.ts` · Owner **D** · Consumers C (guard, matcher tests), B (smoke/seed scripts)

| Queue | Invoice | What it is | Role in the demo |
|---|---|---|---|
| expert | 4470 | Schmidt Reinigung, €640 office cleaning, prefilled 4300, dated 2025-11-25 | routine warm-up: nothing to change, post it |
| expert | 4471 | Müller Werkzeugbau, €7,850 CNC spindle unit, prefilled 4711, dated 2025-11-26 | re-code to 0400 (capex) |
| expert | 4472 | Novak Logistik s.r.o. (subsidiary), €2,300 intercompany freight, dated 2025-11-27 | send for second approval |
| expert | 4473 | Bäcker Elektrotechnik, €1,180, dated 2025-12-02 | put on hold |
| expert | 4474 | Hartmann Werkzeuge, €1,460 bench vise, prefilled 4711, dated 2025-11-28 | routine: nothing to change, post it |
| newhire (coached) | 4490 | Hoffmann Maschinen, **€7,200** hydraulic press controller, cost center starts empty, dated 2025-12-03 | the brief's unseen case: tutor intervenes before save |
| newhire (coached) | 4491 | Schmidt Reinigung, €640, dated 2025-12-04, cost center starts empty | tutor stays quiet: the December hold is Bäcker-only |
| newhire (coached) | 4492 | Müller, −€420 credit note, no PO, cost center starts empty | never shown: tutor quotes the debrief or flags it |
| newhire (independent) | 4493 | Krüger Automation, €8,900 equipment, cost center starts empty | tutor silent; guard is the only backstop |
| newhire (independent) | 4494 | Novak (subsidiary), €2,750 freight, cost center starts empty | tutor silent |
| autopilot | 4501–4505 | four routine, one unknown supplier (4505); dates in 2025; 4502 asset `A-2025-117` | stretch X1: agent halts on the unknown supplier |

`Invoice` also carries `contactName`, `contactEmail`, `contactPhone` and `iban` on the expert and new-hire rows. Those fields never enter `InvoiceState`. `toInvoiceState` omits an empty `costCenter`. A normal save commits `status: "posted"`. Dates are all in 2025.

The **business reasoning is not in the code or any prompt** — only fields are. The expert's rules live on a private role card (`docs/05-DEMO-AND-SUBMISSION.md`) that must never be copied into `agents/*.md`, compile prompts, seed data or tests of the live path. Changing an invoice's id, amount, supplier, date or queue is a `CONTRACT:` change (D's script and video depend on them).

Cost centers: `4711` opex maintenance · `0400` capex machinery · `4120` opex freight · `4300` opex facilities · `4050` opex consumables.

---

## 9. Pre-approved additive changes (no further discussion needed; just announce `CONTRACT:` when landed)

See `docs/01-SPEC.md` §8 for why each exists. Field and route names here are binding so lanes can code against them before they land.

| # | Change | Owner | Consumers |
|---|---|---|---|
| P-1 | `POST /api/sessions/:id/frames` (multipart `frameId`, `file` jpeg) + `GET …/frames?frameId=`; `Frame.dataUrl` becomes optional and `Frame.url?: string` is added. Frames stop travelling inside the session JSON. | B | A (Capture sync), C (replay), D (WorkMapView, replay view) — render `frame.url ?? frame.dataUrl` |
| P-2 | `saveFrame(sessionId, frameId, bytes)` / `readFrame(sessionId, frameId)` in `lib/store.ts` | B | — |
| P-3 | `GET /api/agent-token?role=interviewer\|tutor` → `{ token \| signedUrl }` for private agents; `VoiceApi.connect` uses it transparently | A | — |
| P-4 | `QuestionWindow.closedBy?: "tool" \| "scribe_fallback" \| "timeout" \| "user"` | A | C (metrics) |
| P-5 | `POST /api/sessions/:id/slot` and `…/confirm` may take longer (LLM-backed patching) and return `{ …, patch?: { ruleId, before, after }[] }` | C | A (debrief pacing), D (shows the diff) |
| P-6 | `Quote.evidence?: "demonstrated" \| "described"` (an exception the expert described but did not demonstrate) | C | D (badge), B (export) |
| P-7 | `WorkMap.expert.language` is honored end to end; `Quote.translation` filled at compile when language ≠ `en` (stretch X2) | C + A | D |
| P-8 | `ScreenEvent.latencyMs?: number` (change → event) and `SessionLog.metrics.visionP50Ms` | B | D (measured slide) |
| P-9 | `VoiceApi.lastError?: string`, `VoiceApi.degraded: boolean` (voice or STT fell back mid-session) | A | D (honest badge) |
| P-10 | `GET /api/health` → `{ ok, keys: { elevenlabs, gateway }, agents: { interviewer, tutor, private, ttsModel }, sample: { present }, store: "fs", commit }`. Credential/agent presence is boolean; commit is a safe SHA or `unknown`. No-store; 200 only when both sample session/map pairs are complete and the Teach sample is confirmed, otherwise 503 without internal errors. | B | D (preflight screen) |
| P-11 | `EventKind` gains **`"save_intent"`**: posted by the ERP when the save-confirm opens, carrying the *proposed* `state`. A sandbox verdict like `save_blocked`: delivered in every source mode, never a vision event, never a compiled step. | B (type, pipeline) · D (`InvoiceForm` posts it) | C (matcher intervenes on it) |
| P-12 | **`VoiceApi.turn(opts): Promise<TurnResult>`** — the one way to “say a tagged line and (optionally) listen”; exact additive options/results are in §3 above. It owns the wait-for-speech watchdog, output gate, mic-open-after-speech rule, echo-filtered verbatim capture, speech-aware timeout, clip policy, acknowledgement grace and re-mute. It never rejects. `say()` stays for legacy/no-listen lines; `via: "spoken"` means a no-listen line finished. | A | C (Map + Teach controllers adopt by M2) |
| P-13 | `VoiceApi.connect(opts)` gains `dynamicVariables?: Record<string, string>` (`expert_name`, `newhire_name`, `task`), `sessionStartMs?: number`, and `keyterms?: string[]`; it resolves only when the agent session is connected | A | C passes names in Map and Teach; A/C pass the app clock and session vocabulary |
| P-14 | `TelemetryMessage` gains optional `queue?: Queue`, `sandboxSession?: string`, `reannounce?: boolean`; `postHello/subscribeHello` use the separate hello control contract (§2). ERP re-announcement of `invoice_opened` still requires publisher integration. | B · D | A, C |
| P-15 | `SessionLog.deferred?: { kind: string; question: string; stepRef: string }[]` — live candidates that were deferred, stale or never asked | B (type) · A (writes) | C (`buildSlots` asks them first) |
| P-16 | `Rule.stopAndAsk` gains `quote?: Quote`; `stopAndAsk.who` becomes optional (set only when the expert named someone); `SaveVerdict` gains `missing?: string` (human-readable failed condition) | C | D (held-save panel), A (tutor line) |
| P-17 | `WorkMap.seen?: { categories: string[]; entities: string[]; suppliers: string[] }` recorded at compile; novelty is derived from it | C | B (autopilot) |
| P-18 | `DELETE /api/sessions/:id/clips?audioId=` and `DELETE /api/sessions/:id/frames?frameId=`; `POST /api/demo/reset` → resets ERP queues, reseeds the sample sessions, disarms every guard | B | A (strike), D (`/demo`), C (Teach start) |
| P-19 | `POST /api/erp/invoices` (create a practice invoice in the `newhire` queue) | C | D (outcome card button) |
| P-20 | `canonicalSteps(map)` and `evidenceMatrix(map)` exported from `lib/workmap.ts` (pure, derived — no schema change) | C | D (Work Map view) |
| P-21 | `lib/store.ts` gains `getErpState/saveErpState`, `getGuard/saveGuard/clearGuard(teachSessionId?, ws?)` (§5); C still must migrate `lib/erp.ts` away from direct `fs` | B | C |
| P-22 | `QuestionWindow.spokeAt?: number` (agent started speaking); `askedAt` keeps meaning "question finished, mic open" | A | C (`metrics.ts`) |
| P-23 | **Workspace capture:** `useScreenPipeline().start(opts?: { mode?: "tab" \| "workspace"; cropTo?: HTMLElement })`. `"workspace"` uses current-tab capture cropped to `cropTo` (the ERP frame); if Region Capture is unavailable the pipeline paints out everything outside `cropTo`'s rectangle before any frame is sent or stored. Returns `surface: "browser" \| "window" \| "monitor"` on the hook | B | A (Capture), C (Teach), D (workspace layout passes the frame element through the `vm`) |
| P-24 | **DOM-published PII rectangles:** `data-pii="name\|email\|iban\|phone"` → `BroadcastChannel("tacit-erp-pii")` `{ sourceId: string, at: number, rects: PiiRegion[] }`. Required paired `sourceId`; rectangles are local to the publisher viewport, projected to the capture crop and painted **before encoding/upload/storage**. See helper API below; ERP/pipeline wiring is still separate. | D (ERP marks + publisher) · B (helpers + pipeline) | A5 |
| P-25 | **Per-visitor workspace:** cookie `tacit_ws` (set on first visit); ERP state, guard and session listings are namespaced by it. `lib/erp.ts` functions take the workspace id from the request; store keys become `erp/<ws>/invoices`, `erp/<ws>/guard/<teachSessionId>` | B | C (`lib/erp.ts`, guard), D (ERP pages) |
| P-26 | `Signals.transcriberHealthy?: boolean` in `lib/governor.ts` (default true; `false` ⇒ the silence light is red: the governor fails closed) and `useTranscriber()` returns `healthy`, `setMuted(b)` | A | D (badge) |
| P-27 | `/api/compile` (and `…/slot`, `…/confirm`) responses always carry `llm: boolean` and `note?: string`; the Map `vm` exposes them so the UI shows which path produced the map | C | D |

### P-24 helper API: source identity and capture coordinates

- `publishPiiRects(sourceId: string, doc?: Document): PiiRectsMessage | undefined` scans recognized markers and broadcasts `{ sourceId, at, rects }` (timestamp in epoch milliseconds). Default: current document; an explicitly supplied same-origin iframe document uses its **own** viewport, never its parent's. Rectangles are finite, positive, clipped and normalized to 0..1. Positioned subtrees conservatively retain viewport coverage when ancestor clips are uncertain.
- `subscribePiiRects(sourceId: string, handler): () => void` validates messages and returns cleanup. Both APIs require a nonempty ID uniquely paired between the selected ERP document and its capture consumer (e.g. shared UUID); missing/other-source messages are rejected. `sourceId` is not authentication or proof of capture-surface identity/freshness. Subscription is a no-op without BroadcastChannel; publishing returns `undefined` without usable document geometry.
- `projectPiiRects(rects, viewport, crop = viewport): PiiRegion[]` maps publisher-normalized rectangles into crop-normalized rectangles. `viewport` and `crop` are `{ x, y, w, h }` in the **captured tab's CSS pixels**. For an embedded ERP, `viewport` is its content box excluding iframe borders; `crop` is the actual workspace capture rectangle. Full iframe crop: `crop = viewport`. Standalone ERP tab: both equal `{ x: 0, y: 0, w: viewportWidth, h: viewportHeight }`. Invalid geometry throws; nonfinite/out-of-view rectangles are discarded or clipped.
- `paintPiiMasks(canvas, projectedRects): number` paints opaque black, outward-rounded pixels and returns the count; missing context/invalid canvas size throws. Use a fresh/resized, unclipped canvas: **draw → paint → encode/upload/store**. This applies to outgoing vision frames and stored stills.
- **Unwired / human-unverified:** D must mark actual fields and publish on layout/scroll/resize; B must pair the selected surface, reject stale/unpaired layout data, project the current crop and invoke masking before every relevant encode. Helpers alone make no end-to-end privacy guarantee. Human network/stored-frame checks remain required after integration; no such verification has been performed for this PR.
