/**
 * Korte regels voor de studio-activiteitenlijst (Lovable-achtig: milestones i.p.v. lange serverzinnen).
 * De ruwe tekst blijft in state; dit is alleen voor weergave.
 */
export function briefGenerationActivityLabel(message: string): string {
  const m = message.trim();
  if (!m) return m;
  if (m.startsWith("Generatie via NDJSON")) return "";
  if (m.startsWith("Generatie gestart")) return "Voorbereiden: briefing & context…";
  if (m.startsWith("Denklijn uitschrijven")) return "Denklijn & designcontract…";
  if (m.startsWith("Compositieplan (structuur")) return "Compositieplan…";
  if (m.startsWith("Compositieplan:")) return m.length > 80 ? `${m.slice(0, 77)}…` : m;
  if (m.startsWith("Pagina genereren")) return "Pagina (HTML/JSON)…";
  if (m.startsWith("Kwaliteitscontrole:") || m.startsWith("Kwaliteitscontrole")) return "Zelfreview…";
  if (m.startsWith("Zelfreview toegepast")) return "Zelfreview: toegepast.";
  if (m.startsWith("Zelfreview afgerond")) return "Zelfreview: klaar.";
  if (m.startsWith("Zelfreview overgeslagen")) return "Zelfreview: overgeslagen.";
  if (m.startsWith("Hero AI-foto: niet actief")) return "Hero-AI: uit (config).";
  if (m.startsWith("Hero: AI-foto genereren")) return "Hero-foto (AI upstream)…";
  if (m.startsWith("Hero: AI-foto toegevoegd")) return "Hero-foto toegevoegd.";
  if (m.startsWith("Hero: geen AI-foto")) return "Geen hero-foto (zie serverlogs).";
  if (m.startsWith("Generatie voltooid") || m.startsWith("Klaar — stream afgerond")) return "Klaar.";
  if (m.startsWith("Geen complete-event")) return "Stream gestopt vóór «klaar».";
  if (m.startsWith("Diagnose (serverlogs)")) return "Diagnose: run-id in serverlogs.";
  if (m.startsWith("Diagnose: geen stream-trace")) return "Diagnose: geen trace (vroege drop).";
  return m.length > 96 ? `${m.slice(0, 93)}…` : m;
}
