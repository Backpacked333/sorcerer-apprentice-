import type { InvoiceState } from "../workmap";

export type CorpusGroup = "A" | "B" | "C" | "K" | "D" | "variation" | "adverse";
export type CorpusOutcome = "RULE" | "SLOT" | "EITHER" | "PATCH" | "REJECT" | "NOTE" | "GUARDRAIL" | "UNCHANGED" | "CONFIRM" | "REASK" | "SKIPPED" | "THIN";

export interface CorpusContext {
  phase: "capture" | "correction" | "debrief";
  decision: "costCenter" | "route" | "status" | "any" | "noPO";
  state: Readonly<InvoiceState>;
  observed: string;
  suppliers: readonly string[];
  prior?: string;
  slot?: string;
}

export interface CorpusEvidence {
  speaker: "expert" | "agent";
  redacted: boolean;
  offRecord: boolean;
  questionEcho: boolean;
  question?: string;
}

export interface CorpusExpectation {
  // RULE must yield a rule; SLOT no rule + open question; EITHER permits both, subject to the oracle's "never" clause.
  outcome: CorpusOutcome;
  oracle: string;
  sameAs?: string;
  boundary?: { value: number; operator: "exclusive" | "inclusive" | "unresolved" };
  // Probe states overlay context.state. These are intended semantics, not observed compiler results.
  probes?: readonly { state: Readonly<InvoiceState>; fires: boolean }[];
  evidence?: "reject";
}

export interface CompileFixture {
  id: string;
  caseId: string;
  group: CorpusGroup;
  utterance: string;
  provenance: "synthetic";
  humanRecorded: false;
  liveProviderVerified: false;
  context: CorpusContext;
  evidence: CorpusEvidence;
  expected: CorpusExpectation;
}

export type FixtureOptions = Omit<Partial<CorpusExpectation>, "outcome" | "oracle"> & {
  context?: Partial<CorpusContext>;
  evidenceInput?: Partial<CorpusEvidence>;
};
export type CorpusRow = readonly [id: string, utterance: string, outcome: CorpusOutcome, oracle: string, options?: FixtureOptions];
