import type { TailwindSection } from "@/lib/ai/tailwind-sections-schema";

/**
 * Detecteert of een sectie als footer telt: expliciete `semanticRole`/`id`
 * of een root-`<footer>`-tag in de HTML (model zet die consistent neer).
 */
function sectionIsFooter(section: TailwindSection): boolean {
  if (section.semanticRole === "footer") return true;
  const id = (section.id ?? "").trim().toLowerCase();
  if (id === "footer" || id.startsWith("footer-")) return true;
  return /<footer\b/i.test(section.html);
}

/** Zoekt de (laatste) footer-sectie in de landingspagina-lijst — basis voor subpagina-herhaling. */
export function findLandingFooterSection(
  landingSections: readonly TailwindSection[] | null | undefined,
): TailwindSection | null {
  if (!landingSections || landingSections.length === 0) return null;
  for (let i = landingSections.length - 1; i >= 0; i -= 1) {
    const s = landingSections[i];
    if (s && sectionIsFooter(s)) return s;
  }
  return null;
}

/**
 * Gentrix-contract: **elke** publieke pagina toont onderaan de footer van de landing.
 * Voegt de landings-footer toe aan subpagina-secties (contact / marketingPages[*]) als
 * die pagina er zelf geen footer bij heeft. Idempotent: als er al een footer staat,
 * blijft de volgorde ongewijzigd.
 */
export function ensureFooterAppendedFromLanding(
  subpageSections: readonly TailwindSection[],
  landingSections: readonly TailwindSection[] | null | undefined,
): TailwindSection[] {
  const base = [...subpageSections];
  if (base.some(sectionIsFooter)) return base;
  const footer = findLandingFooterSection(landingSections);
  if (!footer) return base;
  return [...base, footer];
}
