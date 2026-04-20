/** Waarden in sync met supabase/migrations/20260330140000_clients_commercial_fields.sql */

export const PLAN_TYPES = ["one_time", "subscription", "trial", "custom"] as const;
export type PlanType = (typeof PLAN_TYPES)[number];

export const PAYMENT_STATUSES = ["none", "pending", "paid", "refunded", "failed"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PIPELINE_STAGES = ["lead", "paid", "building", "delivered", "live", "support"] as const;
export type PipelineStage = (typeof PIPELINE_STAGES)[number];

/** Uitgebreide billing-status voor incasso-opvolging (Mollie-ready). */
export const BILLING_STATUSES = [
  "active",
  "pending_first_collection",
  "paid",
  "past_due",
  "retry_scheduled",
  "chargeback",
  "suspended",
  "cancelled",
] as const;
export type BillingStatus = (typeof BILLING_STATUSES)[number];

export const BILLING_INTERVALS = ["monthly", "quarterly", "yearly", "one_time"] as const;
export type BillingInterval = (typeof BILLING_INTERVALS)[number];

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

export const BILLING_STATUS_LABELS: Record<BillingStatus, string> = {
  active: "Actief",
  pending_first_collection: "Eerste incasso gepland",
  paid: "Betaald",
  past_due: "Achterstallig",
  retry_scheduled: "Herincasso ingepland",
  chargeback: "Stornering / chargeback",
  suspended: "Geschorst",
  cancelled: "Opgezegd",
};

/** Kleurcode per billing-status voor badges/UI. */
export const BILLING_STATUS_COLORS: Record<BillingStatus, "green" | "blue" | "amber" | "red" | "zinc"> = {
  active: "green",
  pending_first_collection: "blue",
  paid: "green",
  past_due: "amber",
  retry_scheduled: "amber",
  chargeback: "red",
  suspended: "red",
  cancelled: "zinc",
};

export const BILLING_INTERVAL_LABELS: Record<BillingInterval, string> = {
  monthly: "Maandelijks",
  quarterly: "Per kwartaal",
  yearly: "Jaarlijks",
  one_time: "Eenmalig",
};

export const PIPELINE_STAGE_LABELS: Record<PipelineStage, string> = {
  lead: "Lead",
  paid: "Betaald",
  building: "In bouw",
  delivered: "Afgeleverd",
  live: "Live",
  support: "Support / onderhoud",
};

/** Billing-event labels voor de auditlog UI. */
export const BILLING_EVENT_LABELS: Record<string, string> = {
  payment_paid: "Betaling geslaagd",
  payment_failed: "Betaling mislukt",
  retry_scheduled: "Herincasso ingepland",
  chargeback_received: "Stornering ontvangen",
  service_suspended: "Dienst geschorst",
  service_reactivated: "Dienst heractiveerd",
  manual_payment_received: "Handmatige betaling ontvangen",
  mandate_created: "Machtiging aangemaakt",
  mandate_revoked: "Machtiging ingetrokken",
  subscription_cancelled: "Abonnement opgezegd",
  billing_exception_granted: "Uitzondering verleend",
};

/** Payment-attempt statuslabels. */
export const PAYMENT_ATTEMPT_STATUS_LABELS: Record<string, string> = {
  paid: "Geslaagd",
  failed: "Mislukt",
  pending: "In behandeling",
  open: "Open",
  chargeback: "Gestorneerd",
  refunded: "Terugbetaald",
};

/** SEPA-machtigingsstatus labels. */
export const SEPA_MANDATE_STATUS_LABELS: Record<string, string> = {
  valid: "Geldig",
  pending: "In behandeling",
  invalid: "Ongeldig",
  revoked: "Ingetrokken",
};
