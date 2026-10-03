import { describe, expect, it } from "vitest";

import { AgentSpeechTimeline, classifySegment } from "./voice-protocol";

describe("voice protocol echo attribution", () => {
  it("classifies an exact in-window echo as agent speech", () => {
    const timeline = new AgentSpeechTimeline([{ start: 10, end: 12, text: "What made you choose the blue option?" }]);

    expect(classifySegment({ text: "What made you choose the blue option", tStart: 10.4, tEnd: 11.8 }, timeline)).toMatchObject({
      kind: "agent",
      text: "",
    });
  });

  it("uses the whole segment interval when speech begins just before agent audio", () => {
    const timeline = new AgentSpeechTimeline([{ start: 10, end: 12, text: "What made you choose the blue option?" }]);

    expect(classifySegment({ text: "What made you choose the blue option", tStart: 9.7, tEnd: 11 }, timeline).kind).toBe("agent");
  });

  it("strips a leading echo and preserves the human answer in a mixed segment", () => {
    const timeline = new AgentSpeechTimeline([{ start: 4, end: 6, text: "Why did you change the category?" }]);

    expect(classifySegment({ text: "Why did you change the category because the request was urgent", tStart: 5.7, tEnd: 7 }, timeline)).toMatchObject({
      kind: "mixed",
      text: "because the request was urgent",
    });
  });

  it("preserves a two-token answer suffix before whole-echo classification", () => {
    const timeline = new AgentSpeechTimeline([{ start: 4, end: 6, text: "Why did you choose this?" }]);

    expect(classifySegment({ text: "Why did you choose this because policy", tStart: 5.5, tEnd: 6.5 }, timeline)).toMatchObject({
      kind: "mixed",
      text: "because policy",
    });
  });

  it("preserves an answer after a near-complete ordered prompt", () => {
    const timeline = new AgentSpeechTimeline([{ start: 4, end: 6, text: "Why did you choose this?" }]);

    expect(classifySegment({ text: "Why did you choose because policy", tStart: 5.5, tEnd: 6.5 }, timeline)).toMatchObject({
      kind: "mixed",
      text: "because policy",
    });
  });

  it("keeps a headphone barge-in as human speech", () => {
    const timeline = new AgentSpeechTimeline([{ start: 20, end: 23, text: "When would you stop and ask someone?" }]);

    expect(classifySegment({ text: "I would check with my team lead", tStart: 21, tEnd: 22 }, timeline)).toMatchObject({
      kind: "human",
      text: "I would check with my team lead",
    });
  });

  it("does not mistake shared ordered words in a headphone barge-in for echo", () => {
    const timeline = new AgentSpeechTimeline([{ start: 20, end: 23, text: "When would you stop and ask someone?" }]);

    expect(classifySegment({ text: "I would ask someone", tStart: 21, tEnd: 22 }, timeline)).toMatchObject({
      kind: "human",
      text: "I would ask someone",
    });
  });

  it("classifies a high-containment echo up to four seconds late", () => {
    const timeline = new AgentSpeechTimeline([{ start: 1, end: 3, text: "Would that apply every time?" }]);

    expect(classifySegment({ text: "Would that apply every time", tStart: 6.8, tEnd: 7.1 }, timeline).kind).toBe("agent");
    expect(classifySegment({ text: "Would that apply every time", tStart: 7.1, tEnd: 7.4 }, timeline).kind).toBe("human");
  });

  it("classifies all speech during a clip interval as agent audio", () => {
    const timeline = new AgentSpeechTimeline();
    const id = timeline.start(30, "", "clip");
    timeline.end(34, id);

    expect(classifySegment({ text: "These words do not resemble a prompt", tStart: 31, tEnd: 32 }, timeline).kind).toBe("agent");
    expect(classifySegment({ text: "Ends at playback", tStart: 29, tEnd: 30 }, timeline).kind).toBe("human");
    expect(classifySegment({ text: "Starts after playback", tStart: 34, tEnd: 35 }, timeline).kind).toBe("human");
    expect(classifySegment({ text: "Human speech after playback", tStart: 34.1, tEnd: 35 }, timeline).kind).toBe("human");
  });

  it("allocates unique generated ids after explicit constructor ids", () => {
    const timeline = new AgentSpeechTimeline([{ id: "speech_1", start: 1, end: 2, text: "first" }]);
    const generated = timeline.start(3, "second");
    timeline.end(4, generated);

    expect(generated).toBe("speech_2");
    expect(timeline.all()).toEqual([
      { id: "speech_1", start: 1, end: 2, text: "first", kind: "agent" },
      { id: "speech_2", start: 3, end: 4, text: "second", kind: "agent" },
    ]);
  });
});
