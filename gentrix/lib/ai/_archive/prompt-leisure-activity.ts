/**
 * Korte briefing-signalen voor B2C leisure (zwemmen, park, watersport).
 * Gebruikt voor layout-pool breedte + logo-richting — geen harde business rules.
 */
export function isLeisureFamilyActivityBriefing(text: string): boolean {
  const t = text.toLowerCase();
  return (
    /\b(zwem|zwembad|zwempartij|aquatic|aquapark|waterpark|glijbaan|glijbanen)\b/.test(t) ||
    /\b(watersport|waterski|waterpret|duik|snorkel|sup\b|paddle|kano|kayak|roeien|splash)\b/.test(t) ||
    /\b(pretpark|attractiepark|familiepark|recreatie|speeltuin)\b/.test(t)
  );
}
