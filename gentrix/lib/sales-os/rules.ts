/**
 * Sales OS — regelbeschrijvingen (transparant, geen verborgen AI).
 * De uitvoerende logica voor signalen staat in signals.ts + scoring.ts.
 * Automatisch taken aanmaken (materialize) is bewust nog uit — voorkomt duplicaten
 * tot er een vaste dedupe-strategie (bijv. hash op rule+entity) is.
 */
export const SALES_RULE_DESCRIPTIONS = [
  "payment_status = failed → kritiek signaal (prioriteitenrail)",
  "open deal: next_step_due_at > 3 dagen geleden OF (geen volgende stap en waarde ≥ €500) → verouderd signaal",
  "website_ops: review pending + ops review → reviewwachtrij-signaal",
  "subscription_renews_at binnen 30 dagen → verlenging-signaal",
  "lead: next_follow_up_at in het verleden (status niet lost/converted) → te-laat-signaal",
  "website_ops: blocker_status ≠ none → geblokkeerde sites",
  "open deal: at_risk = true → risico-signaal",
] as const;
