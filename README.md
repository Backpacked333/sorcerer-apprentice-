# Tacit · the AI Apprentice

Tacit sits beside an expert while they work, asks why at the pauses, and turns what it learns into a tutor that stops a new hire before a wrong decision is saved.

One pipeline. One artifact, the Work Map. Three readers: the expert who confirms it, the new hire who is tutored from it, and an agent that can load the same rules.

## Run it

```bash
npm install
npm run seed:session
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

1. **See a finished Work Map** and try the tutor from the front page. No microphone.
2. **Run it yourself.** `/capture` is one window: the sandbox ERP on the left, Tacit on the right. Tick consent, start, and in the share dialog choose **This tab**. Work the expert queue, then **Done · start the debrief**. Answer the open slots, confirm the teach-back, and open Teach.
3. **Two windows.** `/capture?layout=companion` plus **Open the ERP window**. Both pages must be the same origin.
4. **Presenter reset.** `/demo` resets the three queues and disarms the save guard. Sample sessions come back with `npm run seed:session`.

`?share=0` skips screen sharing. The ERP still reports exact events. Headphones, once voice is on: the apprentice must not hear itself.

The ERP tab is titled **MB-ERP · Accounts payable**. Posting period 12/2025. A normal save commits **posted**.

## Keys

Copy `.env.example` to `.env.local`. With no keys, browser speech, ERP telemetry and a deterministic compile keep every beat runnable. The screen says when a path is a fallback.

| Key | What it unlocks |
| --- | --- |
| `ELEVENLABS_API_KEY` | Scribe v2 Realtime, and `npm run agents:create` |
| `NEXT_PUBLIC_INTERVIEWER_AGENT_ID`, `NEXT_PUBLIC_TUTOR_AGENT_ID` | The two ElevenAgents voices |
| `AI_GATEWAY_API_KEY` | Vision and the LLM compile pass |
| `NEXT_PUBLIC_EVENT_SOURCE` | `vision`, `both` (default), or `dom` |

## The Apprentice Test

| Question | Where to look |
| --- | --- |
| When to ask | The companion's glow, and the Governor under Show the mechanism. Timing is code, not a prompt. |
| What to ask | Candidate questions, under Show the mechanism. It never asks what the screen already shows. |
| When it has understood | Gaps closed, on the map. Only the expert's words fill a slot, and only an explicit yes locks it. |
| Whether the new hire learned | The mastery card. Rescued and learned are different labels. |
| Trust | Struck from the record, and the Privacy ledger. In the workspace, masks are painted before a frame leaves the browser. |

## Product tour / Demo mode

- `/` is the landing page: an animated hero labelled "Illustration" (generic beats, no business rules), the two doors (a finished sample Work Map and tutor, or a live capture), the Apprentice Test and honest limits. The status strip reads `/api/health` and the event source; it never claims a live voice without agent ids.
- `/demo` is the presenter room: reset, launch links, cue card.
- `/demo/companion` is **demo mode**: every companion state (13 moods, the capsule, ask, teach-back and teach layouts) plus a "Play states" scripted tour over a fake support console. All copy is fictional (Larkspur Telecom, fictional), labelled as demo data, and never imported by the live product. Under reduced motion, Play jumps to the end state.
- `/platform/demo` shows the platform pages with a fictional company. Everything outside demo mode runs on real session data only.

Screenshots in the submission are taken from these routes.

## Honest limits

- Vision events are badged `seen`. ERP telemetry is badged `erp`. They are never presented as the same source.
- "Off the record" strikes the transcript, the events, the frames and the clips in this app. The voice provider keeps conversation data under that account's retention settings. The consent screen says so.
- Only a map the expert confirmed can teach. The model does not confirm its own output.
- The business rules are whatever the expert says in that session. They are not hardcoded into the product.
- Prevention before save is guaranteed in this sandbox. On a third-party application it is a warning, unless that application is integrated.

## Repo

Public repository: [github.com/Backpacked333/sorcerer-apprentice-](https://github.com/Backpacked333/sorcerer-apprentice-).

Team, videos and the live link are on the submission form. The closing frame is [public/moonshot.svg](public/moonshot.svg): People first, then agents, then a living memory.
