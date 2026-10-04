/**
 * Claims workbench sandbox — "Kestrel Bay Mutual (fictional)".
 *
 * Fictional display data only. Every name, company, policy and amount is invented.
 * This file holds NO decision logic: no coverage rules, no thresholds, no automatic outcomes.
 * The person working the claim decides; the sandbox only shows the case and keeps their choice
 * in client state until reload. It is not imported by compile, matcher, the invoice ERP or the agents.
 */

export type ClaimStatus = "new" | "in_review" | "awaiting_documents";

export interface EstimateLine { item: string; amount: number }

export interface ClaimDocument {
  /** panel title, e.g. "Contractor estimate" */
  kind: string;
  file: string;
  page: number;
  pages: number;
  vendorBanner: string;
  heading: string;
  lines: EstimateLine[];
  findings: string;
  photos: number;
}

export interface Party { role: string; name: string; detail: string; pii?: "name" | "email" | "phone" }
export interface ActivityItem { when: string; what: string }
export interface Payment { when: string; payee: string; amount: number; state: string }
export interface Note { when: string; author: string; text: string }

export interface Claim {
  id: string;
  status: ClaimStatus;
  lossType: string;
  /** one-line summary shown in the queue and header */
  summary: string;
  reserve: number;
  policyholder: { name: string; email: string; phone: string };
  policy: string;
  lossDate: string;
  reported: string;
  /** prefilled from the first notice of loss; the adjuster can change it */
  intakeCause: string;
  /** shown as written; the sandbox draws no conclusion from it */
  priorClaims: string;
  document: ClaimDocument;
  activity: ActivityItem[];
  payments: Payment[];
  notes: Note[];
  parties: Party[];
  summaryText: string;
}

export const CLAIMS_COMPANY = "Kestrel Bay Mutual (fictional)";
export const CLAIMS_TITLE = `Claims workbench · ${CLAIMS_COMPANY}`;

export const STATUS_LABEL: Record<ClaimStatus, string> = {
  new: "NEW",
  in_review: "IN REVIEW",
  awaiting_documents: "AWAITING DOCS",
};

/** Options as shown in the sandbox's selects. Picking one triggers nothing. */
export const CAUSE_OPTIONS = [
  "Burst pipe (sudden)",
  "Slow leak (gradual)",
  "Storm — wind",
  "Storm — hail",
  "Fallen tree",
  "Impact — vehicle",
  "Accidental breakage",
  "Theft",
  "Fire — kitchen",
  "Other / unclear",
] as const;

export const COVERAGE_OPTIONS = ["Not yet assessed", "Covered", "Partially covered", "Not covered"] as const;

export const NEXT_STEPS = [
  { id: "approve", label: "Approve payment" },
  { id: "deny", label: "Deny claim" },
  { id: "escalate", label: "Escalate to senior adjuster" },
] as const;
export type NextStepId = (typeof NEXT_STEPS)[number]["id"];

export const CLAIMS: Claim[] = [
  {
    id: "CLM-30412",
    status: "in_review",
    lossType: "Water damage · kitchen",
    summary: "Water under the sink, kitchen floor lifted",
    reserve: 12600,
    policyholder: { name: "Rowan Achterberg", email: "rowan.achterberg@example.net", phone: "+1 555 0142" },
    policy: "HO-3 · KB-71-22816",
    lossDate: "2026-09-14",
    reported: "2026-09-16 · by phone",
    intakeCause: "Burst pipe (sudden)",
    priorClaims: "1 water claim · 2026-02",
    document: {
      kind: "Contractor estimate",
      file: "Alder & Finch Restoration.pdf",
      page: 2,
      pages: 4,
      vendorBanner: "ALDER & FINCH · RESTORATION",
      heading: "Estimate AF-7731 · Kitchen water remediation",
      lines: [
        { item: "Moisture survey, kitchen and hallway", amount: 520 },
        { item: "Remove and replace subfloor, 11 m²", amount: 3780 },
        { item: "Base cabinet under sink, remove and refit", amount: 2350 },
        { item: "Dehumidifiers and fans, 6 days", amount: 1260 },
        { item: "Supply line and valve replacement", amount: 610 },
      ],
      findings:
        "Water found around the supply line fitting under the sink. Subfloor boards are dark and soft across a wide area; staining extends under the adjacent cabinet. Cabinet side panels swollen.",
      photos: 3,
    },
    activity: [
      { when: "Today", what: "Estimate uploaded · contractor" },
      { when: "Today", what: "3 photos added" },
      { when: "Sep 16", what: "First notice of loss, by phone" },
    ],
    payments: [{ when: "Sep 17", payee: "Alder & Finch Restoration", amount: 450, state: "Emergency call-out · paid" }],
    notes: [
      { when: "Sep 16", author: "Intake desk", text: "Caller reports water on the kitchen floor in the morning, main valve closed." },
      { when: "Sep 18", author: "Field inspector", text: "Site visited. Photos uploaded. Contractor estimate requested." },
    ],
    parties: [
      { role: "Policyholder", name: "Rowan Achterberg", detail: "Named insured", pii: "name" },
      { role: "Contractor", name: "Alder & Finch Restoration", detail: "Estimate AF-7731" },
      { role: "Field inspector", name: "D. Marsh", detail: "Kestrel Bay Mutual" },
    ],
    summaryText: "Kitchen floor damaged by water from under the sink. Contractor estimate received; decision pending.",
  },
  {
    id: "CLM-30427",
    status: "new",
    lossType: "Roof · storm",
    summary: "Shingles lifted after a windstorm",
    reserve: 7400,
    policyholder: { name: "Sam Okafor-Reyes", email: "sam.okafor-reyes@example.org", phone: "+1 555 0177" },
    policy: "HO-3 · KB-64-90153",
    lossDate: "2026-09-21",
    reported: "2026-09-22 · online",
    intakeCause: "Storm — wind",
    priorClaims: "None on file",
    document: {
      kind: "Contractor estimate",
      file: "Tidewater Roofing.pdf",
      page: 1,
      pages: 2,
      vendorBanner: "TIDEWATER ROOFING CO.",
      heading: "Estimate TR-1189 · Roof repair, south slope",
      lines: [
        { item: "Remove damaged shingles, south slope", amount: 980 },
        { item: "Underlayment, 18 m²", amount: 1120 },
        { item: "Architectural shingles, supply and fit", amount: 3640 },
        { item: "Ridge cap and flashing", amount: 720 },
        { item: "Scaffold and disposal", amount: 690 },
      ],
      findings:
        "Around 20 shingles missing or creased on the south slope. Underlayment exposed in two places. No water staining visible in the attic at the time of inspection.",
      photos: 4,
    },
    activity: [
      { when: "Today", what: "Estimate uploaded · contractor" },
      { when: "Sep 22", what: "First notice of loss, online form" },
    ],
    payments: [],
    notes: [{ when: "Sep 22", author: "Intake desk", text: "Online report with two phone photos of the roof." }],
    parties: [
      { role: "Policyholder", name: "Sam Okafor-Reyes", detail: "Named insured", pii: "name" },
      { role: "Contractor", name: "Tidewater Roofing Co.", detail: "Estimate TR-1189" },
    ],
    summaryText: "Wind damage to the south roof slope. Estimate received; not yet reviewed.",
  },
  {
    id: "CLM-30433",
    status: "in_review",
    lossType: "Glass · living room",
    summary: "Picture window cracked",
    reserve: 2150,
    policyholder: { name: "Jordan Whitlock", email: "j.whitlock@example.com", phone: "+1 555 0118" },
    policy: "HO-5 · KB-38-11742",
    lossDate: "2026-09-25",
    reported: "2026-09-25 · by phone",
    intakeCause: "Accidental breakage",
    priorClaims: "1 glass claim · 2024-06",
    document: {
      kind: "Repair quote",
      file: "Brightline Glass.pdf",
      page: 1,
      pages: 1,
      vendorBanner: "BRIGHTLINE GLASS",
      heading: "Quote BG-0592 · Window replacement",
      lines: [
        { item: "Double-glazed unit, 1.8 × 1.2 m", amount: 1240 },
        { item: "Removal of cracked unit", amount: 180 },
        { item: "Fitting and sealing", amount: 360 },
        { item: "Temporary board-up (completed)", amount: 140 },
      ],
      findings: "Single crack running corner to corner on the inner pane. Frame intact. Unit is a standard size.",
      photos: 2,
    },
    activity: [
      { when: "Yesterday", what: "Quote uploaded · glazier" },
      { when: "Sep 25", what: "First notice of loss, by phone" },
    ],
    payments: [],
    notes: [{ when: "Sep 25", author: "Intake desk", text: "Caller says a ball hit the window. Board-up arranged the same day." }],
    parties: [
      { role: "Policyholder", name: "Jordan Whitlock", detail: "Named insured", pii: "name" },
      { role: "Glazier", name: "Brightline Glass", detail: "Quote BG-0592" },
    ],
    summaryText: "Cracked living-room window. Repair quote received.",
  },
  {
    id: "CLM-30441",
    status: "awaiting_documents",
    lossType: "Water damage · basement",
    summary: "Basement carpet wet after heavy rain",
    reserve: 5800,
    policyholder: { name: "Avery Lindqvist", email: "avery.lindqvist@example.net", phone: "+1 555 0163" },
    policy: "HO-3 · KB-52-67309",
    lossDate: "2026-09-28",
    reported: "2026-09-29 · by email",
    intakeCause: "Other / unclear",
    priorClaims: "None on file",
    document: {
      kind: "Contractor estimate",
      file: "Harrow Plumbing Services.pdf",
      page: 1,
      pages: 3,
      vendorBanner: "HARROW PLUMBING SERVICES",
      heading: "Estimate HP-2207 · Basement dry-out",
      lines: [
        { item: "Water extraction, basement", amount: 640 },
        { item: "Carpet and pad removal, 24 m²", amount: 880 },
        { item: "Drying equipment, 4 days", amount: 960 },
        { item: "Sump pit inspection", amount: 210 },
      ],
      findings:
        "Standing water along the north wall. Sump pump found switched off. Wall base shows a tide line about 5 cm high. Source not confirmed.",
      photos: 5,
    },
    activity: [
      { when: "Today", what: "Requested: photos of the sump pump" },
      { when: "Sep 30", what: "Estimate uploaded · contractor" },
      { when: "Sep 29", what: "First notice of loss, by email" },
    ],
    payments: [],
    notes: [{ when: "Sep 30", author: "Adjuster", text: "Asked the policyholder for photos of the sump pump and the outside drain." }],
    parties: [
      { role: "Policyholder", name: "Avery Lindqvist", detail: "Named insured", pii: "name" },
      { role: "Contractor", name: "Harrow Plumbing Services", detail: "Estimate HP-2207" },
    ],
    summaryText: "Wet basement after rain. Waiting on photos before review.",
  },
  {
    id: "CLM-30456",
    status: "in_review",
    lossType: "Fire · kitchen",
    summary: "Stovetop fire, cabinets and ceiling smoke",
    reserve: 18900,
    policyholder: { name: "Morgan Delacroix", email: "morgan.delacroix@example.org", phone: "+1 555 0129" },
    policy: "HO-5 · KB-90-35528",
    lossDate: "2026-09-19",
    reported: "2026-09-19 · by phone",
    intakeCause: "Fire — kitchen",
    priorClaims: "None on file",
    document: {
      kind: "Contractor estimate",
      file: "Copperline Rebuild.pdf",
      page: 3,
      pages: 5,
      vendorBanner: "COPPERLINE REBUILD",
      heading: "Estimate CR-4410 · Kitchen fire restoration",
      lines: [
        { item: "Smoke cleaning, kitchen and dining", amount: 2300 },
        { item: "Upper cabinets, remove and replace", amount: 5900 },
        { item: "Ceiling drywall and paint", amount: 2750 },
        { item: "Range hood replacement", amount: 840 },
        { item: "Odour treatment", amount: 760 },
      ],
      findings:
        "Burn damage limited to the cabinets above the stove and the range hood. Smoke residue on the ceiling and dining walls. Electrical checked by a licensed electrician, no faults noted.",
      photos: 6,
    },
    activity: [
      { when: "Today", what: "Electrician report attached" },
      { when: "Sep 24", what: "Estimate uploaded · contractor" },
      { when: "Sep 19", what: "First notice of loss, by phone" },
    ],
    payments: [{ when: "Sep 20", payee: "Policyholder", amount: 1500, state: "Living expenses advance · paid" }],
    notes: [{ when: "Sep 19", author: "Intake desk", text: "Fire service attended. Caller staying with family for now." }],
    parties: [
      { role: "Policyholder", name: "Morgan Delacroix", detail: "Named insured", pii: "name" },
      { role: "Contractor", name: "Copperline Rebuild", detail: "Estimate CR-4410" },
      { role: "Electrician", name: "Voltwise Electrical", detail: "Inspection report" },
    ],
    summaryText: "Kitchen fire on the stovetop. Estimate and electrician report received.",
  },
];

export function getClaim(id: string): Claim | undefined {
  const key = id.trim().toUpperCase();
  return CLAIMS.find((c) => c.id === key);
}

export const estimateTotal = (doc: ClaimDocument) => doc.lines.reduce((sum, l) => sum + l.amount, 0);

export const eur = (n: number) =>
  `€${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
