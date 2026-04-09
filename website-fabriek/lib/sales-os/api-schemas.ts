import { z } from "zod";
import { SALES_DEAL_STAGES } from "@/lib/sales-os/deal-stages";

export const createDealBodySchema = z.object({
  company_name: z.string().min(1).max(500),
  title: z.string().max(500).optional().default(""),
  stage: z.enum(SALES_DEAL_STAGES).optional().default("new_lead"),
  value_cents: z.number().int().min(0).optional().default(0),
  currency: z.string().max(8).optional().default("EUR"),
  probability: z.number().int().min(0).max(100).nullable().optional(),
  next_step: z.string().max(2000).nullable().optional(),
  next_step_due_at: z.string().max(40).nullable().optional(),
  lead_id: z.string().uuid().nullable().optional(),
  client_id: z.string().uuid().nullable().optional(),
});

/** Legt één volgende stap + opvolgdatum vast; schrijft naar next_step_log en leegt actieve planning. */
export const dealPlanningCommitSchema = z.object({
  message: z.string().min(1).max(2000),
  due_at: z.string().min(1).max(40),
});

export const patchDealBodySchema = z
  .object({
    stage: z.enum(SALES_DEAL_STAGES).optional(),
    next_step: z.string().max(2000).nullable().optional(),
    next_step_due_at: z.string().max(40).nullable().optional(),
    /** Vastleggen van stap + datum (verplicht via UI). Eigenaar zet de server. */
    planning_commit: dealPlanningCommitSchema.optional(),
    at_risk: z.boolean().optional(),
    probability: z.number().int().min(0).max(100).nullable().optional(),
    value_cents: z.number().int().min(0).optional(),
    lost_reason: z.string().max(2000).nullable().optional(),
    company_name: z.string().min(1).max(500).optional(),
    title: z.string().max(500).optional(),
  })
  .strict();

export const createTaskBodySchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(5000).nullable().optional(),
  priority: z.enum(["low", "normal", "high", "urgent"]).optional().default("normal"),
  due_at: z.string().max(40).nullable().optional(),
  linked_entity_type: z.enum(["lead", "deal", "client", "website"]),
  linked_entity_id: z.string().uuid(),
  source_type: z.enum(["manual", "rule", "system"]).optional().default("manual"),
});

export const patchTaskBodySchema = z
  .object({
    title: z.string().min(1).max(500).optional(),
    description: z.string().max(5000).nullable().optional(),
    status: z.enum(["open", "done", "cancelled"]).optional(),
    priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
    due_at: z.string().max(40).nullable().optional(),
  })
  .strict();

export const createLeadBodySchema = z.object({
  company_name: z.string().min(1).max(500),
  contact_name: z.string().max(300).nullable().optional(),
  email: z
    .union([z.string().email().max(320), z.literal("")])
    .nullable()
    .optional()
    .transform((v) => (v === "" || v === undefined ? null : v)),
  phone: z.string().max(80).nullable().optional(),
  source: z.string().max(200).optional().default("unknown"),
  budget_estimate: z.string().max(200).nullable().optional(),
  notes: z.string().max(8000).nullable().optional(),
  next_follow_up_at: z.string().max(40).nullable().optional(),
});

export const patchLeadBodySchema = z
  .object({
    status: z.enum(["new", "working", "qualified", "lost", "converted"]).optional(),
    next_follow_up_at: z.string().max(40).nullable().optional(),
    last_contact_at: z.string().max(40).nullable().optional(),
    notes: z.string().max(8000).nullable().optional(),
    budget_estimate: z.string().max(200).nullable().optional(),
  })
  .strict();

export const patchWebsiteOpsBodySchema = z
  .object({
    ops_status: z
      .enum(["briefing", "generating", "review", "revisions", "ready", "live"])
      .optional(),
    review_status: z.enum(["none", "pending", "approved", "changes_requested"]).optional(),
    blocker_status: z.enum(["none", "content", "media", "technical", "billing", "other"]).optional(),
    blocker_reason: z.string().max(2000).nullable().optional(),
    quality_score: z.number().int().min(0).max(100).nullable().optional(),
    content_completeness: z.number().int().min(0).max(100).nullable().optional(),
    media_completeness: z.number().int().min(0).max(100).nullable().optional(),
    publish_ready: z.boolean().optional(),
    last_notes: z.string().max(5000).nullable().optional(),
  })
  .strict();
