// DEMO MODE ONLY. Fictional copy for /demo/companion: Tier-2 support escalations at
// "Larkspur Telecom (fictional)" (lead decision D4). Nothing here was learned by Tacit, and no
// live module may import this file (lib/demo/companion-fixtures.test.ts enforces that).
// Copy is gender-neutral and contains none of the sandbox ERP's business rules.
import type { OrbMood } from "@/lib/ui/moods";

export const DEMO_COMPANY = "Larkspur Telecom (fictional)";
export const DEMO_ROLE = "Tier-2 support escalation lead";

export type DemoMode = "capsule" | "ask" | "teachback" | "teach";

/** One card per mood: what the companion says in that state. */
export interface GalleryEntry {
  mood: OrbMood;
  name: string;
  when: string;
  title: string;
  sub: string;
  meta: string;
}

export const MOOD_GALLERY: GalleryEntry[] = [
  { mood: "quiet", name: "Quiet", when: "Watching, saying nothing.", title: "Reading ticket TKT-20418", sub: "Connectivity · business account", meta: "Nothing new yet" },
  { mood: "notice", name: "Noticed", when: "A change the screen cannot explain on its own.", title: "Noticed: priority P3 → P1", sub: "Holding one question for your next pause", meta: "1 waiting" },
  { mood: "typing", name: "Typing", when: "The expert is typing. The glass dims and the orb slows.", title: "Quiet — you're typing", sub: "I won't interrupt while you type", meta: "1 waiting" },
  { mood: "reading", name: "Reading", when: "Scrolling and dwell time are not a pause.", title: "Quiet — you're reading", sub: "Customer history, page 2 · I'll wait", meta: "1 waiting" },
  { mood: "holding", name: "Holding", when: "On a call with someone else. The question is held.", title: "You're on a call — not now", sub: "1 question held until you hang up", meta: "1 held" },
  { mood: "pausing", name: "Pause found", when: "Typing stopped, no speech, no click — the ring fills.", title: "You paused…", sub: "Waiting 1.5 s to be sure", meta: "1 waiting" },
  { mood: "asking", name: "Asking", when: "One short question about something on screen.", title: "What made you raise this one to P1?", sub: "Asking at a 1.6 s pause", meta: "asked 1" },
  { mood: "listening", name: "Listening", when: "Mic open only for the answer.", title: "Listening to your answer", sub: "Your words become the reason", meta: "mic open" },
  { mood: "understood", name: "Understood", when: "A slot is filled with the expert's own words.", title: "Understood · reason", sub: "Linked to the screen moment at 00:41", meta: "1 reason" },
  { mood: "heard", name: "Reason heard", when: "Explained in passing, so that question is dropped.", title: "Reason heard — not asking", sub: "Same outage → one parent ticket", meta: "1 heard" },
  { mood: "off", name: "Off the record", when: "Struck: transcript, events and frames are gone.", title: "Struck from the record", sub: "That exchange and its frames are gone", meta: "struck" },
  { mood: "step", name: "Steps in", when: "Teach only: before a decision is saved.", title: "Before you save", sub: "Not saved · new hire, learning from the expert", meta: "coached" },
  { mood: "correct", name: "Correct", when: "The new hire got it.", title: "Correct without help", sub: "Routed to network on-call", meta: "1 handled" },
];

/** Layout examples (capsule / ask / teach-back / teach), all demo copy. */
export const LAYOUTS = {
  capsule: { mood: "quiet" as OrbMood, title: "Reading ticket TKT-20418", sub: "Connectivity · business account", meta: "Nothing new yet", budget: "asked 0 of a budget of 4" },
  ask: {
    mood: "asking" as OrbMood,
    eyebrow: "WHY · PRIORITY",
    sub: "You paused 1.6 s · seen on screen",
    question: "What made you raise this one to P1?",
  },
  listen: {
    mood: "listening" as OrbMood,
    eyebrow: "WHY · PRIORITY",
    sub: "Listening to your answer",
    question: "What made you raise this one to P1?",
    answer: "Three sites on the same business line went down at once, so it is an outage, not a single fault.",
  },
  teachback: {
    mood: "understood" as OrbMood,
    eyebrow: "TEACH-BACK · ROUND 1",
    sub: "Here's how I understand it",
    sentences: [
      "A new escalation is read top to bottom before anything changes.",
      "When several sites on one business line fail together, it is raised to P1.",
      "An outage is routed to network on-call, not worked in the Tier-2 queue.",
      "If the customer has a named account manager, they are told within the hour.",
    ],
    meta: "4 of 4 rules · 0 unsure · demo data",
  },
  teach: {
    mood: "step" as OrbMood,
    eyebrow: "BEFORE YOU SAVE",
    sub: "Not saved · new hire, learning from the expert",
    prompt: "Several sites are down on one line. Where would the expert send this before saving?",
    because: "Three sites on the same business line went down at once, so it is an outage, not a single fault.",
  },
};

export const HEARD_EXAMPLE = {
  quote: "These all come from the same street cabinet, so they hang off one parent ticket.",
  meta: "on the call",
};

/** The fake support console used by the scripted tour. Fictional values only. */
export const TICKET = {
  app: "Support console",
  id: "TKT-20418",
  customer: "Example Co. (fictional) · business",
  category: "Connectivity",
  sites: "3 sites affected",
  opened: "08:12",
};

export type TourTarget = "ticket" | "priority" | "note" | "queue" | "save" | null;

export interface TourStep {
  id: string;
  label: string;
  dur: number;
  mode: DemoMode;
  mood: OrbMood;
  target: TourTarget;
  eyebrow?: string;
  title: string;
  sub: string;
  /** Question shown in ask mode. */
  question?: string;
  /** Answer words streamed (listening) or shown in full (understood / struck). */
  answer?: "stream" | "full" | "struck";
  highlight?: string;
  understood?: { kind: string; text: string };
  learned?: { kind: "reason" | "guardrail" | "heard" | "learned" | "practice"; text: string }[];
  chip?: string;
  ringMs?: number;
  /** Field values in the fake console at this step. */
  fields: { priority: string; queue: string; note: string; typing?: boolean };
  caption: string;
}

const ANSWER = LAYOUTS.listen.answer;
const KEY = "Three sites on the same business line went down at once";
const BASE = { priority: "P3 · Normal", queue: "Tier 2 · general", note: "" };
const NOTE = "Customer reports outage at all sites";

export const TOUR_ANSWER = ANSWER;

export const TOUR: TourStep[] = [
  { id: "quiet", label: "Quiet", dur: 2600, mode: "capsule", mood: "quiet", target: "ticket", title: "Reading ticket TKT-20418", sub: "Connectivity · business account", fields: BASE, caption: "Quiet: it reads a still of the screen and says nothing." },
  { id: "notice", label: "Noticed", dur: 2800, mode: "capsule", mood: "notice", target: "priority", title: "Noticed: priority P3 → P1", sub: "Holding one question for your next pause", chip: "priority P3 → P1", fields: { ...BASE, priority: "P1 · Outage" }, caption: "What to ask: only what the screen cannot explain on its own." },
  { id: "typing", label: "Typing", dur: 3200, mode: "capsule", mood: "typing", target: "note", title: "Quiet — you're typing", sub: "I won't interrupt while you type", fields: { ...BASE, priority: "P1 · Outage", note: NOTE, typing: true }, caption: "When to ask: never while you type. The glass dims and the orb slows." },
  { id: "pausing", label: "Pause found", dur: 1700, mode: "capsule", mood: "pausing", target: "priority", title: "You paused…", sub: "Waiting 1.5 s to be sure", ringMs: 1500, fields: { ...BASE, priority: "P1 · Outage", note: NOTE }, caption: "A natural pause: typing stopped, no speech, no click." },
  { id: "asking", label: "Asking", dur: 2700, mode: "ask", mood: "asking", target: "priority", eyebrow: "WHY · PRIORITY", title: "Asking", sub: "You paused 1.6 s · seen on screen", question: "What made you raise this one to P1?", fields: { ...BASE, priority: "P1 · Outage", note: NOTE }, caption: "One short question, about the field that just changed." },
  { id: "listening", label: "Listening", dur: 5000, mode: "ask", mood: "listening", target: "priority", eyebrow: "WHY · PRIORITY", title: "Listening", sub: "Listening to your answer", question: "What made you raise this one to P1?", answer: "stream", fields: { ...BASE, priority: "P1 · Outage", note: NOTE }, caption: "Mic open only for the answer. Only the expert's words can fill a reason." },
  { id: "understood", label: "Understood", dur: 3600, mode: "ask", mood: "understood", target: "priority", eyebrow: "UNDERSTOOD · PRIORITY", title: "Understood", sub: "Linked to the screen moment at 00:41", question: "What made you raise this one to P1?", answer: "full", highlight: KEY, understood: { kind: "reason", text: KEY }, learned: [{ kind: "reason", text: "P1 when sites fail together" }], fields: { ...BASE, priority: "P1 · Outage", note: NOTE }, caption: "Understood: the reason is pinned to the screen moment." },
  { id: "strike", label: "Scratch that", dur: 1100, mode: "ask", mood: "off", target: null, eyebrow: "STRIKING IT", title: "Striking it", sub: "Scratch that", question: "What made you raise this one to P1?", answer: "struck", fields: { ...BASE, priority: "P1 · Outage", note: NOTE }, caption: "Trust: “Scratch that” strikes the transcript, the events and the frames." },
  { id: "off", label: "Off the record", dur: 2600, mode: "capsule", mood: "off", target: null, title: "Struck from the record", sub: "That exchange and its frames are gone", fields: { ...BASE, priority: "P1 · Outage", note: NOTE }, caption: "The learned chip is removed too. Nothing struck reaches the map." },
  { id: "step", label: "Steps in", dur: 4200, mode: "teach", mood: "step", target: "queue", eyebrow: "BEFORE YOU SAVE", title: "Steps in", sub: "Not saved · new hire, learning from the expert", fields: { priority: "P1 · Outage", queue: "Tier 2 · general", note: "" }, caption: "Teach: it steps in when the field changes, before the save." },
  { id: "correct", label: "Correct", dur: 3600, mode: "teach", mood: "correct", target: "queue", eyebrow: "NICE CALL", title: "Correct", sub: "Routed to network on-call", learned: [{ kind: "learned", text: "correct after a hint" }], fields: { priority: "P1 · Outage", queue: "Network on-call", note: "" }, caption: "Mastery labels stay honest: correct after a hint is not correct without help." },
  { id: "settle", label: "Settled", dur: 3000, mode: "capsule", mood: "quiet", target: null, title: "Tour complete", sub: "Every glow state, in order", learned: [{ kind: "learned", text: "correct after a hint" }], fields: { priority: "P1 · Outage", queue: "Network on-call", note: "" }, caption: "Scripted tour — demo data. In the product every state comes from real signals." },
];
