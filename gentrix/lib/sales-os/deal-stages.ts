/** Canonieke deal-stages (DB + UI) — labels in het Nederlands voor de interface. */
export const SALES_DEAL_STAGES = [
  "new_lead",
  "qualified",
  "proposal_sent",
  "negotiation",
  "won",
  "at_risk",
  "lost",
] as const;

export type SalesDealStage = (typeof SALES_DEAL_STAGES)[number];

export const DEAL_STAGE_LABELS: Record<SalesDealStage, string> = {
  new_lead: "Nieuwe lead",
  qualified: "Gekwalificeerd",
  proposal_sent: "Offerte verstuurd",
  negotiation: "Onderhandeling",
  won: "Gewonnen",
  at_risk: "Risico",
  lost: "Verloren",
};

export function isClosedDealStage(stage: string): boolean {
  return stage === "won" || stage === "lost";
}
