# 05 · Demo, Pitch & Submission — owner: Lane D

> The product is judged through this document. Every feature in the repo exists to make one of the beats below land **with a stranger driving**. If a beat is flaky at a checkpoint, that is a P0 for the lane that owns it.

---

## 1. What the judges will do (the brief's own script)

From the brief, "What good looks like": *a judge playing Sabine shares their screen and processes three invoices while talking. At a pause a calm voice asks "You moved that one to capex. What made you do that?" … In the debrief it asks "You held the December invoice. Is that for every supplier, and who decides when to release it?" Then it explains the whole process back in under a minute, and the judge corrects one detail. The Work Map shows seven steps, three judgment calls and four guardrails, each linked to its moment on screen. Then a second judge, playing a new hire, opens a fresh €7,200 equipment invoice and reaches for the opex code. The tutor says "Sabine would stop here. Why do you think?" It replays her screen moment and lets them fix it.*

Our demo is that paragraph, beat for beat, plus the five Apprentice Test answers made visible. Nothing else goes in the main flow.

| # | Beat | Brief requirement it proves | Req ID | Owner if it fails |
|---|---|---|---|---|
| 1 | Re-code 4471 to capex, pause → calm grounded "why" | Capture: question at a natural pause about something on screen | C1 C2 C3 A1 A2 | A (timing/voice), B (event) |
| 2 | Second approval on 4472 → guardrail question | ≥ 1 live question about a guardrail | C3 A2 | A |
| 3 | Hold 4473, say "scratch that" mid-sentence → red band, ledger ticks → third question | Trust: off the record; ≥ 3 live questions | C3 A5 | A (tool), B (strike/ledger) |
| 4 | Done → debrief asks ≥ 3 things not answered live ("Is that for every supplier, and who decides when to release it?") | Map: debrief closes gaps | M1 A3 | C (slots), A (voice) |
| 5 | Teach-back < 60 s → judge corrects one detail → changed sentence re-read → "yes" → bar locks | Map: teach-back the expert confirms | M2 A3 | C (patch), A (voice) |
| 6 | Click through the Work Map: steps, judgment calls, guardrails, each with frame + verbatim quote | Map: every step and guardrail links to a screen moment and her words | M3 | C (data), D (view), B (frames) |
| 7 | New hire opens 4490 (€7,200), picks the opex code, and goes for Post → "Sabine would stop here. Why do you think?" → replay of the still and the voice → they fix it | Teach: unseen case, caught before save, expert's reasoning | T1 T2 | C (matcher/guard), A (voice), B (events) |
| 8 | 4491 passes untouched (tutor quiet: the hold is Bäcker-only) → independent case 4493 → outcome card | Teach: learned the boundary; can handle a new case alone | T3 A4 | C |
| + | One click: `policy.json` → agent runs the routine queue and halts on the unknown supplier | Stretch: agent-ready guardrails → the moonshot | X1 P1 | B |

---

## 2. Stage setup (do this the same way every time)

**Hardware:** two laptops if possible (expert + new hire), **headphones on both** (the apprentice must not hear itself). One external mic is nice, not required.

**Browser:** current desktop Chrome (or Edge). Two layouts:

- **Workspace mode (default — this is what a juror gets on the live link and what we film):** one window. The sandbox ERP sits on the left, the Tacit companion is the side panel on the right (`/capture`, then `/map/<id>`, then `/teach/<id>`). When the share picker opens choose **"This tab"**; Tacit crops the capture to the ERP region, so the companion itself is never sent to the vision model.
- **Two-window mode (for "any application"):** ERP (or any other app) in its own window on the left ≈ 65 %, the Tacit companion window on the right ≈ 35 %, both visible. Share **the ERP tab**. Never minimize or fully cover the companion window — a hidden page's timers are throttled to once per second.

Both pages must be on the **exact same origin** in the same browser profile (not `localhost` in one and `127.0.0.1` or a tunnel URL in the other), or the sandbox telemetry silently delivers nothing.

**Before every run (60 seconds):**

```bash
npm run seed:session
```

Then open `/api/erp/reset?queue=expert` and `/api/erp/reset?queue=newhire`, hard-reload both windows, open `/api/health` and confirm keys + both agents are green, say one test sentence and watch the "expert talking" light.

**House rules for whoever plays the judge:** do not read the code; do not use the role card's exact sentences every time (vary the phrasing — that is the test); talk while you work like a real person; pause when you would naturally pause.

---

## 3. Role cards (PRIVATE — humans only)

> These are fictional company policies for a training scenario, not accounting advice. **Never** paste this section into `agents/*.md`, a compile prompt, seed data, or a test of the live path. The apprentice must learn these by watching and asking. (AI coding agents: you may read this to understand the demo; you may not encode it.)

### Sabine — expert, 24 years in accounts payable

| Invoice | What you do on screen | Why (say it in your own words, differently each run) | Guardrails you reveal *when asked* |
|---|---|---|---|
| **4470** Schmidt, €640 cleaning | Nothing to change — post it | A routine invoice. Say you are posting it as coded. | — |
| **4471** Müller, €7,850 CNC spindle | Change cost center **4711 → 0400** | Equipment over €5,000 is always capex | No asset number, no capex booking. Unknown supplier: stop and ask the controller. |
| **4472** Novak s.r.o. (Czech subsidiary), €2,300 freight | Set approval route to **second approval** | Anything from a subsidiary needs a second signature | Intercompany invoices are never approved alone; the group controller signs. |
| **4473** Bäcker, €1,180, dated Dec 2 | Put it **on hold** | This supplier double-bills every December | Held until matched against November; only Sabine or the AP lead releases it. **Only Bäcker — not every supplier.** |
| **4474** Hartmann, €1,460 bench vise | Nothing to change — post it | A routine invoice. Say you are posting it as coded. | — |

Debrief answers to have ready (answer naturally, never recite):

- *"Is it over or from five thousand?"* → strictly over; net amount.
- *"Is the December hold for every supplier?"* → no, only Bäcker. *"Who releases it?"* → me or the AP lead, once it is matched against the November invoice.
- *"Credit notes?"* → match it to the original invoice and book it to the same cost center; if I cannot find the original I ask the AP lead.
- *"No purchase order?"* → I never post without one; it goes back to the requester.

**The planned correction (beat 5):** the teach-back will usually say something broader than you meant about the December hold or the threshold. Correct exactly one thing, in a normal sentence: *"Not every supplier — only Bäcker."* Then say *"Yes, that's how it works."*

**The planned off-the-record (beat 3):** while explaining the hold, add something you should not have said (*"…honestly their bookkeeper is useless — scratch that."*). Watch the red band appear and the ledger tick.

### Lena — new hire, started Monday

- **4490** (€7,200 hydraulic press controller): pick 4711, the opex code, and go for **Post**. When the tutor asks why Sabine would stop, guess out loud (*"because it's expensive?"*). Watch the replay. Fix it to 0400. If asked about the asset number, say you would ask.
- **4491** (Schmidt cleaning, Dec 4): pick 4300 and post. The tutor should stay quiet (or briefly confirm): the December hold is Bäcker-only.
- **4492** (credit note): open it. The tutor either quotes what Sabine said in the debrief, or says nobody taught it and flags it — it never guesses.
- **4493 / 4494** (independent): do them alone. The tutor is silent; the guard is the only backstop. Try to get them right.
- End the session → read the outcome card aloud.

---

## 4. The run of show (target: under 6 minutes live; the video is a cut of this)

| Time | What happens | What we say (one line, max) | On screen proof |
|---|---|---|---|
| 0:00 | Capture page. Consent tick, Start. Open 4470. Nothing to change — post it. The apprentice stays quiet. | "The routine one teaches the hands, not a rule." | Presence stays quiet |
| 0:30 | Sabine opens 4471, changes 4711 → 0400, stops. Lights go green. Voice: *"You moved 4471 from 4711 to 0400. What made you do that?"* She answers. | — (let the voice land) | Event badge `seen`; quote card pinned to the frame |
| 1:30 | 4472 → second approval. At the pause: *"Is there a kind of invoice you would never approve alone?"* | "That one was a guardrail question — it asks for the limit, not the click." | Candidate queue: `limit` picked |
| 2:30 | 4473 → hold. Mid-explanation: "…scratch that." | "Off the record is a mechanism, not a promise." | Red struck band; ledger "seconds struck" ticks |
| 3:30 | Done → debrief. Understanding bar ≈ 60 %. *"You held the December invoice. Is that for every supplier, and who decides when to release it?"* + two more. | "The debrief is literally the list of empty slots." | Slots filling one by one |
| 4:30 | Teach-back (< 60 s). Sabine: "Only Bäcker, not every supplier." Agent re-reads the changed sentence. "Yes." | — | Rule diff; bar locks; "confirmed" |
| 5:00 | Work Map: click a judgment step → frame, decision, her words, guardrails. | "Every claim links to a moment and a quote. No quote, no rule." | Timeline; counts: steps / judgment calls / guardrails |
| 5:30 | Lena shares her screen, opens 4490, reaches for Save. *"Sabine would stop here. Why do you think?"* Replay with her voice. She fixes it. 4491 passes. Outcome card. | "Same eyes, same map — now on the new hire's screen." | Intervention before save; replay; card |
| 6:15 | (if time) Export → policy.json → agent halts on the unknown supplier. | "The same map an agent can load. That is the moonshot." | Autopilot list, `halted` |

Do **not** compress natural pauses into rapid-fire questions for the video; cut between beats instead.

---

## 5. The five Apprentice Test answers (memorize; one sentence + where to point)

| Question | Our mechanism | Point at | One-liner |
|---|---|---|---|
| 1. When to ask | A governor outside the agent fuses speech silence (Scribe v2 Realtime), screen stillness (frame diff), no typing, "not reading a new invoice", and a question budget. The agent's mic is shut outside a window, so it *cannot* interrupt. | The lights in the side panel | "Timing is code, not a prompt." |
| 2. What to ask | Screen events are scored for judgment value (an edit of a prefilled value, a hold, a reroute). Each yields a why plus limit / stop / who probes filled from the event's own values; narration that already answers one fills it silently; by the third window a guardrail question is forced. | The candidate queue | "It never asks what happened — the screen shows that." |
| 3. When it has understood | A slot ledger: every judgment needs a reason, every rule a limit or exception, every stop an owner. Debrief = the open slots. Teach-back is generated from the map, and done means zero open slots **and** an explicit yes. | The understanding bar | "It can't reach 100 % by summarizing — only her words fill a slot." |
| 4. Whether the new hire learned | The same rules run against the new hire's screen; intervention before save; then an independent case with the tutor silent; outcomes labeled *correct without help / after a hint / after intervention / not tested*. | The outcome card | "We separate rescued from learned." |
| 5. Trust | Consent first; masks painted before a frame leaves the browser; only decision frames kept; "scratch that" strikes transcript, events, frames and audio and invalidates in-flight work; a live ledger. | The red band + ledger | "It sees the screen a second at a time and keeps only what explains a decision." |

---

## 6. The deck (NOT a submission item — it is for the live finalist pitch on Oct 10; its content doubles as the storyboard for the Tech video)

The portal does not take slides. The brief still says to *end the pitch with one moonshot slide*: slide 7 below is the closing frame of the Demo video and of the Tech video. Draft the copy by M2 (it feeds the videos and the README); build the actual deck only if we are finalists (precedent: ~3 minutes live on Zoom).

1. **We know more than we can tell.** Sabine, 24 years, 18 months left. The 2019 process doc covers half of what she does.
2. **A recorder shows what. An apprentice asks why.** The three failure modes from the brief → one thesis: knowledge is slots; voice fills them.
3. **Live demo** (the run of show above, or the video).
4. **How it passes the Apprentice Test.** Five rows, one screenshot each (§5).
5. **One map, three readers.** Expert confirms it · new hire is tutored from it · an agent loads it as guardrails (show `policy.json` + the halted run).
6. **What we measured.** From `lib/metrics.ts`, real numbers from a real run: questions per 10 min, interruptions while typing (target 0), slots filled live vs. debrief, pause → first word, intervention latency on 4490. No invented percentages.
7. **The moonshot — People first, then agents, then a living memory.** Today's rules already compile to a policy an agent can load → an agent runs the routine 80 % and stops exactly where Sabine would, handing those cases to Lena with the replay attached → the same matcher knows when an event matches *no* rule, the only moment the always-on apprentice needs to ask → every expert, every workflow, one map that stays current. The path is three components we just demoed: the matcher, the export, the question window.

Pitch line: **"We don't record how experts click. We learn when their decisions should change — and prove someone else can make them."**

---

## 7. The three videos (owner D) — each a **file upload**, MP4 (H.264) or MOV, **≤ 60 seconds**, ≤ 1 GB

The first judging round is asynchronous and fast: jurors watch three one-minute videos, open the live link, glance at the repo. "Communication" is one of the three stated criteria. **These three minutes are most of our score.** Record raw takes from M3 onward; never wait for "final".

**Recording setup:** 1080p screen capture with **system audio and mic** (OBS, or QuickTime + an audio loopback) — the agent's voice must be audible, it is the product. Workspace mode, browser zoom 110–125 % so text survives compression. Burned-in captions for every spoken line (jurors may watch muted). Do not speed up or fake pauses: cut *between* beats instead. Label nothing as live that is not.

### 7.1 Demo video (60 s) — "watch it work"

| Sec | Shot | Caption |
|---|---|---|
| 0–5 | Title card: *We know more than we can tell.* Sabine retires in 18 months. | The problem in one line |
| 5–17 | Sabine re-codes 4471, stops; presence goes quiet → asking; the voice: *"You moved that one to capex — what made you do that?"*; she answers; the quote pins to the frame | Asks at a natural pause, about what is on screen |
| 17–24 | Guardrail follow-up (*"Is there an amount where you'd do it differently?"*) → *"…scratch that"* → red band, ledger ticks | A guardrail question · Off the record |
| 24–36 | Debrief question (*"Is that for every supplier, and who decides when to release it?"*) → teach-back → *"Only Bäcker."* → changed sentence re-read → *"Yes."* → bar locks | The debrief closes gaps · Teach-back, corrected, confirmed |
| 36–43 | Click a Work Map step: frame + her words + guardrails | Every step links to a screen moment and her own words |
| 43–56 | Lena picks opex on the €7,200 invoice → *"Sabine would stop here. Why do you think?"* → replay with Sabine's voice → she fixes it → outcome card | Caught before save, in the expert's reasoning |
| 56–60 | Moonshot frame: *People first, then agents, then a living memory.* | — |

### 7.2 Tech video (60 s) — "why it is real"

| Sec | Shot | Line |
|---|---|---|
| 0–8 | Diagram: one pipeline, one Work Map, three readers | "An apprentice is a slot-filling machine, not a recorder." |
| 8–20 | Governor lights going red → green; candidate queue | "When to ask is code, not a prompt: Scribe v2 Realtime for silence, frame diffs for stillness, the agent gated in both directions." "What to ask: only why, limit, stop, who — never what the screen already shows." |
| 20–32 | Evidence matrix; a rule with its replay-check badge | "Understood means every slot filled by her words and a yes. Rules are extracted by an LLM and accepted only if they replay correctly on her own invoices." |
| 32–42 | Matcher + save guard; independent case; outcome card | "The same rules run on the new hire's screen. We separate rescued from learned." |
| 42–52 | Network tab: masked frame; struck band; ledger | "Masks before upload, strike purges everywhere, only decision frames kept." |
| 52–60 | `policy.json` → agent halts on the unknown supplier | "The same map an agent can load. ElevenAgents in both roles, Expressive Mode, Scribe v2 Realtime." |

### 7.3 Team video (60 s) — "why us"

Four faces, one sentence each (who you are, what you built in this project), then one shared line on why this problem (the retiring-expert gap) and the moonshot. Shoot on phones in good light; no slides needed. Record it early (before midnight) — it does not depend on the code.

### 7.4 Also required

A **team photo** (JPG / PNG / WebP ≤ 10 MB) — take it at kickoff. If remote, a clean 2×2 grid of headshots.

Insurance: at M4 record every module separately; the final cuts may splice them.

## 8. Rehearsal checklist (run three times between 3:30 and 6:30 AM; a different teammate plays each judge)

- [ ] Capture asks ≥ 3 questions, each at a visible pause, each naming the invoice and the change; ≥ 1 about a limit or a stop.
- [ ] Zero questions land while the judge is typing, scrolling, or talking.
- [ ] "Scratch that" strikes the window; the ledger updates; the struck sentence is not in the Work Map.
- [ ] Debrief asks ≥ 3 questions not answered live, and none that were.
- [ ] Teach-back < 60 s; the correction patches the map; only the changed sentence is re-read; the bar locks on yes.
- [ ] Work Map: every judgment step and guardrail opens a frame and a verbatim quote. Counts match the run.
- [ ] Teach intervenes on 4490 **before save**, replays the still + clip, and stays quiet on 4491.
- [ ] Independent case runs with the tutor silent; outcome card lists per-rule results with help disclosed.
- [ ] Export downloads `policy.json`; the autopilot halts on 4505.
- [ ] The phrasing was different from the last run and it still worked.
- [ ] The deployed URL passes the same run in a fresh Chrome profile. Raw recordings of every beat exist. A seeded confirmed map is on the deploy.

---

## 9. Q&A prep (answer honestly; these are our strengths)

- **"Is it hardcoded to these invoices?"** No: rules are compiled from what the expert said in that session; change one explanation in the debrief and the tutor changes with it, same map id and revision. Offer to say a different threshold live.
- **"Would it work on SAP, not your sandbox?"** Watching and asking: yes, that is the vision path (events badged `seen`). Guaranteed *prevention before save* needs an authorized integration; on third-party screens it is a best-effort warning. Our sandbox adds telemetry (`erp` badge) and a server-side guard as a backstop, and we label which is which.
- **"Why a separate Scribe stream?"** The agent's mic is closed while she works, so it cannot hear pauses; Scribe listens the whole time for the silence clock and the verbatim transcript.
- **"What do you store?"** Only frames tied to a decision, masked and blurred, plus the transcript minus anything struck. The voice provider keeps conversation data per account retention settings — we say so on the consent screen.
- **"How do you know it understood?"** It doesn't claim to: it reports open slots, and "ready to teach" is scoped to this task and requires her explicit yes.

---

## 10. README (final version, owner D; ≤ 2 screens)

What it is (3 lines) · 30-second run instructions (keyless) · keys table · how it answers the five questions (the §5 table) · architecture diagram (one pipeline, one map, three readers) · honest limits · team.

---

## 11. Submission checklist — HackOS (`app.hack-nation.ai`), target 7:30 AM ET, hard deadline 9:00 AM ET (13:00 UTC)

Source: the organizers' official FAQ assistant + Luma page, checked Oct 3 (details in `docs/01-SPEC.md` §13). **One person (D) must log into HackOS at kickoff and read the real form** — required text fields are not listed publicly.

**At kickoff (do not leave for 7 AM):**
- [ ] All four accepted the team invite on HackOS (invited members only count once accepted).
- [ ] Challenge selected: **01 · The AI Apprentice (ElevenLabs)** — exactly one challenge.
- [ ] ElevenLabs and Anthropic credit codes claimed on the platform (first-come, first-served).
- [ ] Team photo taken.

**Required items:**
- [ ] **Demo video** — file, MP4/MOV, ≤ 60 s, ≤ 1 GB (§7.1).
- [ ] **Tech video** — file, ≤ 60 s (§7.2).
- [ ] **Team video** — file, ≤ 60 s (§7.3).
- [ ] **Live demo link** — a deployed, working product; a video link does not count. Opens in a fresh Chrome profile, no login, mic + screen permissions work on HTTPS, `/api/health` green, seeded sample session present so Map and Teach are explorable in one click. Keep it up through **Oct 10**.
- [ ] **Public GitHub repo** — public at submission time (private does not count); README final; CI green; history contains no secrets.
- [ ] **Team photo** — JPG/PNG/WebP ≤ 10 MB.
- [ ] Any text fields the form asks for (title, description): draft at M2 from §5 and §6.

**Submitting:**
- [ ] Click **Submit project**, not just Save. Confirm the page says *"Your project is submitted"* and the button reads *"Project submitted"*. Screenshot it.
- [ ] Submit a complete first version by **7:30 AM**; edits are allowed until 9:00 AM — use them only for a better video cut.
- [ ] After submitting: **nobody pushes to `main`** and nobody redeploys. Watch email (and spam) Oct 7–8 for the finalist notice; finalists pitch live Oct 10, 12:00 PM ET.

## 12. Disaster plan

| If… | Then… |
|---|---|
| Vision is slow or flaky | Set `NEXT_PUBLIC_EVENT_SOURCE=both` (default) and say so; the `erp` badge stays honest. Last resort `dom`. |
| ElevenLabs is down / rate-limited | Leave agent ids empty → browser-speech fallback keeps every beat runnable; say it is the fallback; use the M4 recordings for voice. |
| Compile's LLM pass fails | The deterministic map still renders steps and quotes; rules need the role-card phrasing; say so. |
| The deploy is broken | A live link is a **required** submission item, so this is a P0 for B at any hour. Fallback: the demo laptop serving a production build through a `cloudflared` quick tunnel (stays up only while that laptop is awake; the URL changes on restart) — submit that URL, then move back to the host and edit the submission before 9:00 AM. |
| ElevenLabs credits run low | Cap session length on the public link, keep the seeded sample explorable without voice, and let the labeled browser-speech fallback take over rather than failing. Protect enough credit for the recordings. |
| A judge's phrasing breaks a rule | That is the product working: the slot stays open and the debrief asks again. Do not patch the regex at 6 AM. |
