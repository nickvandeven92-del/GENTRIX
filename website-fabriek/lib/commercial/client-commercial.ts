/** Waarden in sync met supabase/migrations/20260330140000_clients_commercial_fields.sql */

export const PLAN_TYPES = ["one_time", "subscription", "trial", "custom"] as const;
export type PlanType = (typeof PLAN_TYPES)[number];

export const PAYMENT_STATUSES = ["none", "pending", "paid", "refunded", "failed"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PIPELINE_STAGES = ["lead", "paid", "building", "delivered", "live", "support"] as const;
export type PipelineStage = (typeof PIPELINE_STAGES)[number];

export const PLAN_TYPE_LABELS: Record<PlanType, string> = {
  one_time: "Eenmalige aanschaf",
  subscription: "Abonnement",
  trial: "Proefperiode",
  custom: "Maatwerk / overig",
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  none: "N.v.t.",
  pending: "Openstaand",
  paid: "Betaald",
  refunded: "Terugbetaald",
  failed: "Mislukt",
};

export const PIPELINE_STAGE_LABELS: Record<PipelineStage, string> = {
  lead: "Lead",
  paid: "Betaald",
  building: "In bouw",
  delivered: "Afgeleverd",
  live: "Live",
  support: "Support / onderhoud",
};
