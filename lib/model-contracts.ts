import { z } from "zod";
import { getVercelOidcTokenSync } from "@vercel/oidc";
import type { Act, Cond, InvoiceState } from "./workmap";

export const RuleFieldSchema = z.enum(["amount", "category", "supplier", "entity", "invoiceMonth", "costCenter", "hasAssetNumber", "knownSupplier", "hasPO", "route", "status"]);
const AtomSchema = z.object({
  field: RuleFieldSchema,
  op: z.enum([">", ">=", "<", "<=", "==", "!=", "in", "matches", "exists"]),
  value: z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]).nullable(),
});
// A finite disjunction of conjunctions, rather than recursive JSON Schema.
const ConditionSchema = z.object({ anyOf: z.array(z.object({ allOf: z.array(AtomSchema) })) });
const ActionSchema = z.object({
  kind: z.enum(["set", "route", "status"]),
  field: z.enum(["costCenter", "assetNumber"]).nullable(),
  value: z.string(),
});

export const RefinementSchema = z.object({
  rules: z.array(z.object({
    stepId: z.string(), title: z.string(), when: ConditionSchema, then: ActionSchema,
    unless: ConditionSchema.nullable(),
    stopAndAsk: z.object({ who: z.string(), when: ConditionSchema }).nullable(),
    quoteTexts: z.array(z.string()), confidence: z.enum(["high", "medium", "low"]),
  })),
  guardrails: z.array(z.object({ stepId: z.string(), kind: z.enum(["limit", "exception", "escalation"]), text: z.string(), quoteText: z.string() })),
  slots: z.array(z.object({ stepId: z.string().nullable(), kind: z.enum(["reason", "limit", "exception", "escalation", "counterfactual", "novel"]), question: z.string() })),
  stepReasons: z.array(z.object({ stepId: z.string(), quoteText: z.string() })),
});

export function modelCondition(value: z.infer<typeof ConditionSchema>): Cond {
  if (!value.anyOf.length || value.anyOf.some((group) => !group.allOf.length)) throw new Error("Empty rule trigger");
  return { any: value.anyOf.map((group) => ({ all: group.allOf.map((atom): Cond => {
    if (atom.op !== "exists" && atom.value === null) throw new Error("Missing rule value");
    if ([">", ">=", "<", "<="].includes(atom.op) && typeof atom.value !== "number") throw new Error("Invalid numeric rule");
    if (atom.op === "in" && !Array.isArray(atom.value)) throw new Error("Invalid membership rule");
    // Provider-generated regular expressions are unnecessary and unsafe; match literal text.
    const value = atom.op === "matches" && typeof atom.value === "string"
      ? atom.value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") : atom.value;
    return { field: atom.field, op: atom.op, ...(value === null ? {} : { value }) };
  }) })) };
}

export function modelAction(value: z.infer<typeof ActionSchema>): Act {
  if (value.kind === "set" && value.field && value.value) return { set: { [value.field]: value.value } };
  if (value.kind === "route" && ["single", "second_approval"].includes(value.value)) return { route: value.value };
  if (value.kind === "status" && ["hold", "approved", "posted"].includes(value.value)) return { status: value.value as "hold" | "approved" | "posted" };
  throw new Error("Unsupported action");
}

export const VisionSchema = z.object({
  screen: z.enum(["invoice_list", "invoice_detail", "confirm_dialog", "other"]),
  state: z.object({
    invoice: z.string().nullable(), supplier: z.string().nullable(), entity: z.string().nullable(),
    amount: z.number().nullable(), category: z.string().nullable(), invoiceMonth: z.number().nullable(),
    invoiceDate: z.string().nullable(), costCenter: z.string().nullable(), route: z.string().nullable(),
    status: z.string().nullable(), hasAssetNumber: z.boolean().nullable(), knownSupplier: z.boolean().nullable(),
    hasPO: z.boolean().nullable(), description: z.string().nullable(),
  }),
  uiActivity: z.enum(["typing", "reading", "navigating", "idle"]),
  piiRegions: z.array(z.object({ x: z.number(), y: z.number(), w: z.number(), h: z.number(), kind: z.string() })),
  confidence: z.number(),
});

export function visibleState(state: z.infer<typeof VisionSchema>["state"]): InvoiceState {
  return Object.fromEntries(Object.entries(state).filter(([, value]) => value !== null));
}

export function gatewayConfigured(): boolean {
  if (process.env.AI_GATEWAY_API_KEY) return true;
  try {
    return Boolean(getVercelOidcTokenSync());
  } catch {
    return false;
  }
}
