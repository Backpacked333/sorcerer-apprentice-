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
               source: "live" | "narration" | "debrief" | "counterfactual"; translation?: string };

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
  stopAndAsk?: { who: string; when: Cond }; quotes: Quote[];
  confidence: "high"|"medium"|"low"; confirmedBy: ("live"|"counterfactual"|"debrief"|"teachback")[] };

type Slot = { id: string; kind: "reason"|"limit"|"exception"|"escalation"|"counterfactual"|"novel";
  stepId?: string; ruleId?: string; question: string; status: "open"|"filled"|"skipped"; filledBy?: Quote };

type WorkMap = { sessionId: string; task: string; expert: { name: string; language: string };
  onet?: { code: string; occupation: string; task: string };
  steps: Step[]; rules: Rule[]; slots: Slot[];
  privacy: { framesSeen: number; framesKept: number; entitiesRedacted: number; offRecord: { from: number; to: number }[] };
  notes: { topic: string; question: string; quote: Quote }[];   // debrief answers about cases not seen today
  revision: number;                                             // bumped by saveMap() on every save
  compiledAt?: number; confirmedAt?: number;                    // confirmedAt is set ONLY by the confirm route on an explicit yes
  corrections: { t: number; text: string }[] };
```

Exported helpers (stable signatures): `evalCond(cond, state): boolean` · `describeCond(cond): string` · `describeAct(act): string` · `actionMatchesRule(rule, state): boolean | undefined` (`undefined` = nothing decided yet) · `openSlots(map): Slot[]` · `understanding(map): number` (0..1) · `isComplete(map): boolean` · `emptyMap(sessionId, task, expertName)` · `uid(prefix)`.

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
               | "route_changed" | "save_clicked" | "save_blocked" | "typing";
type EventSource = "vision" | "dom";          // "dom" = the sandbox ERP's own telemetry. NEVER disguise one as the other.

interface ScreenEvent { id: string; t: number;               // t = seconds since session start
  source: EventSource; kind: EventKind;
  invoice?: string; field?: string; from?: string; to?: string;
  state?: InvoiceState;                                       // merged invoice state after the event
  uiActivity?: "typing"|"reading"|"navigating"|"idle";
  frameId?: string; confidence?: number;
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
  openedAt: number; askedAt?: number; answeredAt?: number; closedAt?: number;
  outcome?: "answered"|"timeout"|"aborted"|"off_record";
  answerText?: string; answerAudioId?: string;
  logged?: { reason?: string; guardrail?: string; kind?: string }; }   // from the agent's log_answer call

interface Frame { id: string; t: number; dataUrl: string; width: number; height: number; piiRegionsBlurred: number; }

interface SessionLog { id: string; mode: "capture"|"teach"; task: string; expertName: string;
  startedAt: number; endedAt?: number;                         // epoch ms
  events: ScreenEvent[]; transcript: TranscriptSegment[]; windows: QuestionWindow[]; frames: Frame[];
  offRecord: { from: number; to: number }[]; metrics?: Record<string, number>;
  mastery?: { ruleId: string; outcome: string; t: number }[]; flagged?: { t: number; context: string }[];
  sourceMapSessionId?: string; sourceMapRevision?: number; }   // teach only
```

Helpers: `emptySession(id, mode, task, expertName)` · `describeEvent(e): string` (the one-line rendering used for agent context and feeds) · `labelField(f)`.

`stepRef` format is `"<invoice>:<field ?? kind>"` and is the join key between a live question, its answer, and the compiled `Step` (`compile.ts: stepRefOf`). Do not change it.

### Telemetry channel — `lib/telemetry.ts` · Owner **B**

`BroadcastChannel("tacit-erp")`, same-origin, same browser profile. Message: `{ kind: EventKind; at: number /*epoch ms*/; invoice?; field?; from?; to?; state?: InvoiceState; boundary?; mode?; blocked? }`. API: `postTelemetry(msg)` (ERP side, lane D's `InvoiceForm`) and `subscribeTelemetry(handler)` (pipeline side).

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
  connect(opts?: { firstMessage?: string; prompt?: string; language?: string; dynamicVariables?: Record<string,string> }): Promise<void>;
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
useTranscriber({ enabled, onPartial(text), onCommitted(text, startSecs?, endSecs?), language? })
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

**What A guarantees to C and D:** `connect()` always supplies safe `expert_name`, `newhire_name`, and `task` dynamic-variable defaults, resolves from SDK lifecycle events (not the non-awaitable `startSession` return), and resolves into a labeled browser fallback on connection failure. Empty override strings are omitted per the SDK guidance; suppressing a stored tutor greeting with an empty override is not supported until live behavior is verified. Remote agent audio is set to volume 0 before its audio element is attached and remains inaudible outside an authorized first-message, `say()`, legacy-mic or `turn()` window; a user-activity heartbeat prevents idle timeout turns. After `say(tag, …)` the line is spoken once, promptly, in the right voice; `isSpeaking` is truthful; anything transcribed while `isSpeaking` is never attributed to the human; the mic is closed unless the page opened it; the registered client tool for that tag fires (or A's timeout fallback closes the turn — see lane A). C never calls the ElevenLabs SDK directly.

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
| `POST /api/vision` | B | `{ seq, image: dataURL, prevState?, t? }` → `{ seq, screen, state, uiActivity, piiRegions, confidence, model, latencyMs }` · 503 without key | one frame in, state out |
| `GET /api/scribe-token` | A | → `{ token \| null }` | single-use Scribe token |
| `GET /api/erp/invoices?queue=` | C | → invoices | queues: `expert`, `newhire`, `autopilot` |
| `GET/PATCH /api/erp/invoices/:id` | C | PATCH `{ costCenter?, route?, status?, assetNumber?, notes? }` → `{ invoice, state }` · **409 `SaveVerdict`** when the armed guard blocks | the authoritative save path |
| `GET/POST /api/erp/reset?queue=` | C | resets a queue (GET redirects to `/erp`) | |
| `GET/POST /api/teach/guard` | C | POST `{ action: "arm"\|"disarm", mapSessionId?, teachSessionId? }` → `{ guard }` | arms the pre-save guard for a teach session |
| `GET /api/export?sessionId=&format=policy\|prompt\|sop` | B | → file download | stretch X1 |
| `POST /api/autopilot` | B | `{ sessionId, apply? }` → `{ steps, remaining }` | runs the policy over the `autopilot` queue, halts where she would |

`SaveVerdict` (`lib/matcher.ts`): `{ blocked: boolean; ruleId?; title?; quote?; who?; reason? }`. The guard enforces **only a confirmed map** and only learned rules.

---

## 5. Persistence — `lib/store.ts` · Owner **B**

```ts
getSession(id): Promise<SessionLog | undefined>     saveSession(s): Promise<void>
listSessions(): Promise<Pick<SessionLog,"id"|"mode"|"task"|"expertName"|"startedAt"|"endedAt">[]>
getMap(sessionId): Promise<WorkMap | undefined>     saveMap(map): Promise<void>      // saveMap bumps map.revision
saveClip(sessionId, audioId, bytes): Promise<string>     readClip(sessionId, audioId): Promise<Uint8Array | undefined>
```

Today: JSON files under `.data/{sessions,maps,clips}/` plus `.data/erp.json` and `.data/erp-guard.json` (written directly by `lib/erp.ts` — moving behind the store, P-21). Whatever B changes underneath for the deploy, **these signatures do not change**; other lanes import only these functions (and `lib/erp.ts`'s exports for the sandbox).

---

## 6. Environment — `.env.example` · Owner **B** (anyone may request a variable)

| Variable | Used by | Meaning |
|---|---|---|
| `ELEVENLABS_API_KEY` | server (A) | Scribe tokens, agent creation, KB sync. Server-side only. |
| `NEXT_PUBLIC_INTERVIEWER_AGENT_ID`, `NEXT_PUBLIC_TUTOR_AGENT_ID` | client (A) | empty → browser-speech fallback |
| `ELEVENLABS_VOICE_ID`, `AGENT_LLM` | `create-agents.ts` (A) | voice and agent LLM |
| `AI_GATEWAY_API_KEY` | server (B, C) | Vercel AI Gateway: vision + compile |
| `VISION_MODEL`, `COMPILE_MODEL` | server (B, C) | gateway model slugs |
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

Created by D's seam-split PR (protocol §3). Shape rule: a `vm` is a plain object of **render-ready state + callbacks**, no SDK objects, no refs except `videoRef`.

```ts
// capture.vm.ts (A) — minimum fields after the split; A adds more as needed
interface CaptureVM { started: boolean; expertName: string; task: string; consented: boolean;
  setExpertName, setTask, setConsented, start(): Promise<void>, endTask(): Promise<void>;
  sessionId: string; voice: Pick<VoiceApi,"mode"|"connected"|"status"|"isSpeaking">; sttEngine: "scribe"|"webspeech"|"none";
  pipeline: { videoRef, sharing, start(), activity, framesSeen, framesSent, dropped, visionLatency, visionError, masks, addMask, clearMasks, paused };
  decision?: Decision; questionsLast10Min: number; budget: number;          // the governor meter
  openWindow?: QuestionWindow & { phase: "asking"|"answering" }; partial: string;
  queued: Candidate[]; askedCount: number; guardrailAsked: boolean; toDebrief: number;
  events: ScreenEvent[]; candidateFor(eventId): Candidate | undefined; transcript: TranscriptSegment[];
  ledger: { framesSeen: number; framesKept: number; entitiesRedacted: number; secondsStruck: number };
  strike(): void; notNow(): void; holding: boolean; setHolding(b: boolean): void;
  submitTypedAnswer(text: string): void; synced: number | null; }
// map.vm.ts (C): map, session frames, phase, currentSlot, heard, teachback, rounds, metrics, autopilot state,
//                startDebrief(), submitAnswer(text), confirm(yes, correction?), recompile(llm), runAutopilot(), onMapChange(map)
// teach.vm.ts (C): log, map, started, ended, phase, decisions[], replay, card[], missed[], pipeline view, start(), endSession(), closeReplay()
```

D may *read* any field and call any callback. D never imports `lib/governor`, `lib/matcher`, the ElevenLabs SDK, or `fetch`es an API from a view.

---

## 8. Sandbox seed data — `lib/erp-model.ts` · Owner **D** · Consumers C (guard, matcher tests), B (smoke/seed scripts)

| Queue | Invoice | What it is | Role in the demo |
|---|---|---|---|
| expert | 4471 | Müller Werkzeugbau, €7,850 CNC spindle unit, prefilled 4711 | re-code to 0400 (capex) |
| expert | 4472 | Novak Logistik s.r.o. (subsidiary), €2,300 intercompany freight | send for second approval |
| expert | 4473 | Bäcker Elektrotechnik, €1,180, dated Dec 2 | put on hold |
| newhire (coached) | 4490 | Hoffmann Maschinen, **€7,200** hydraulic press controller, prefilled 4711 | the brief's unseen case: tutor intervenes before save |
| newhire (coached) | 4491 | Schmidt Reinigung, €640, dated Dec 4 | tutor stays quiet: the December hold is Bäcker-only |
| newhire (coached) | 4492 | Müller, −€420 credit note, no PO | never shown: tutor quotes the debrief or flags it |
| newhire (independent) | 4493 | Krüger Automation, €8,900 equipment | tutor silent; guard is the only backstop |
| newhire (independent) | 4494 | Novak (subsidiary), €2,750 freight | tutor silent |
| autopilot | 4501–4505 | four routine, one unknown supplier (4505) | stretch X1: agent halts where she would |

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
| P-10 | `GET /api/health` → `{ ok, keys: { elevenlabs, gateway }, agents: { interviewer, tutor }, store: "fs"\|"…" , commit }` | B | D (preflight screen) |
| P-11 | `EventKind` gains **`"save_intent"`**: posted by the ERP when the save-confirm opens, carrying the *proposed* `state`. A sandbox verdict like `save_blocked`: delivered in every source mode, never a vision event, never a compiled step. | B (type, pipeline) · D (`InvoiceForm` posts it) | C (matcher intervenes on it) |
| P-12 | **`VoiceApi.turn(opts): Promise<TurnResult>`** — the one way to “say a tagged line and (optionally) listen”; exact additive options/results are in §3 above. It owns the wait-for-speech watchdog, output gate, mic-open-after-speech rule, echo-filtered verbatim capture, speech-aware timeout, clip policy, acknowledgement grace and re-mute. It never rejects. `say()` stays for legacy/no-listen lines; `via: "spoken"` means a no-listen line finished. | A | C (Map + Teach controllers adopt by M2) |
| P-13 | `VoiceApi.connect(opts)` gains `dynamicVariables?: Record<string, string>` (`expert_name`, `newhire_name`, `task`) and resolves only when the session is connected | A | C passes names in Map and Teach |
| P-14 | `TelemetryMessage` gains `queue: Queue` and `sandboxSession?: string`; a `"hello"` message from a subscriber makes an open `InvoiceForm` re-announce `invoice_opened` | B · D | A, C |
| P-15 | `SessionLog.deferred?: { kind: string; question: string; stepRef: string }[]` — live candidates that were deferred, stale or never asked | B (type) · A (writes) | C (`buildSlots` asks them first) |
| P-16 | `Rule.stopAndAsk` gains `quote?: Quote`; `stopAndAsk.who` becomes optional (set only when the expert named someone); `SaveVerdict` gains `missing?: string` (human-readable failed condition) | C | D (held-save panel), A (tutor line) |
| P-17 | `WorkMap.seen?: { categories: string[]; entities: string[]; suppliers: string[] }` recorded at compile; novelty is derived from it | C | B (autopilot) |
| P-18 | `DELETE /api/sessions/:id/clips?audioId=` and `DELETE /api/sessions/:id/frames?frameId=`; `POST /api/demo/reset` → resets ERP queues, reseeds the sample sessions, disarms every guard | B | A (strike), D (`/demo`), C (Teach start) |
| P-19 | `POST /api/erp/invoices` (create a practice invoice in the `newhire` queue) | C | D (outcome card button) |
| P-20 | `canonicalSteps(map)` and `evidenceMatrix(map)` exported from `lib/workmap.ts` (pure, derived — no schema change) | C | D (Work Map view) |
| P-21 | `lib/store.ts` gains `getErpState/saveErpState`, `getGuard/saveGuard/clearGuard(teachSessionId)`; `lib/erp.ts` stops touching `fs` | B | C |
| P-22 | `QuestionWindow.spokeAt?: number` (agent started speaking); `askedAt` keeps meaning "question finished, mic open" | A | C (`metrics.ts`) |
| P-23 | **Workspace capture:** `useScreenPipeline().start(opts?: { mode?: "tab" \| "workspace"; cropTo?: HTMLElement })`. `"workspace"` uses current-tab capture cropped to `cropTo` (the ERP frame); if Region Capture is unavailable the pipeline paints out everything outside `cropTo`'s rectangle before any frame is sent or stored. Returns `surface: "browser" \| "window" \| "monitor"` on the hook | B | A (Capture), C (Teach), D (workspace layout passes the frame element through the `vm`) |
| P-24 | **DOM-published PII rectangles:** the ERP marks personal data with `data-pii="name\|email\|iban\|phone"` and broadcasts normalized rectangles on `BroadcastChannel("tacit-erp-pii")` `{ at, rects: PiiRegion[] }`; the pipeline paints them (offset by the frame's position in workspace mode) **before upload** when the surface is a browser tab | D (ERP marks + publisher) · B (pipeline) | A5 |
| P-25 | **Per-visitor workspace:** cookie `tacit_ws` (set on first visit); ERP state, guard and session listings are namespaced by it. `lib/erp.ts` functions take the workspace id from the request; store keys become `erp/<ws>/invoices`, `erp/<ws>/guard/<teachSessionId>` | B | C (`lib/erp.ts`, guard), D (ERP pages) |
| P-26 | `Signals.transcriberHealthy?: boolean` in `lib/governor.ts` (default true; `false` ⇒ the silence light is red: the governor fails closed) and `useTranscriber()` returns `healthy`, `setMuted(b)` | A | D (badge) |
| P-27 | `/api/compile` (and `…/slot`, `…/confirm`) responses always carry `llm: boolean` and `note?: string`; the Map `vm` exposes them so the UI shows which path produced the map | C | D |
