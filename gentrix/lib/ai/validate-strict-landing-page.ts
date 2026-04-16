import type { TailwindSection } from "@/lib/ai/tailwind-sections-schema";

const MARQUEE_OR_TICKER_RE = /(\bstudio-marquee(?:-track)?\b|<\s*marquee\b)/i;

/** Sectie-id's die op een strikte one-pager niet voorkomen. */
const FORBIDDEN_STRICT_LANDING_IDS = new Set([
  "about",
  "over-ons",
  "overons",
  "cta",
  "contact",
  "team",
  "pricing",
  "shop",
  "gallery",
  "testimonials",
]);

/**
 * Harde checks voor **landingPageOnly** one-pagers (studio-contract).
 * **4** secties = zonder `faq`; **5** = met `faq` vóór `footer`.
 */
export function validateStrictLandingPageContract(sections: TailwindSection[]): string[] {
  const errors: string[] = [];
  const n = sections.length;

  if (n !== 4 && n !== 5) {
    errors.push(
      `Strikte landingspagina: **4** secties (zonder FAQ) of **5** (met FAQ vóór footer); nu ${n}.`,
    );
    return errors;
  }

  const ids = sections.map((s) => (s.id ?? "").trim().toLowerCase());

  if (ids[0] !== "hero") {
    errors.push('Eerste sectie moet `id: "hero"` zijn (buitenste `<section id="hero">`).');
  }

  const last = n - 1;
  if (ids[last] !== "footer") {
    errors.push('Laatste sectie moet `id: "footer"` zijn met eind-CTA in hetzelfde blok (geen aparte `cta`-sectie).');
  }

  const proofId = ids[1];
  if (proofId !== "stats" && proofId !== "brands") {
    errors.push('Tweede sectie: `id` moet `stats` (cijfers/KPI) of `brands` (logo-partners) zijn — precies één type bewijs.');
  }

  const middleId = ids[2];
  if (middleId !== "steps" && middleId !== "features") {
    errors.push('Derde sectie: `id` moet `steps` (werkwijze) of `features` (diensten) zijn — kies één van de twee.');
  }

  if (n === 5) {
    if (ids[3] !== "faq") {
      errors.push('Bij 5 secties moet de vierde `id: "faq"` zijn (max. 6 vragen in de HTML).');
    }
  } else {
    if (ids.includes("faq")) {
      errors.push('Bij 4 secties mag geen `faq`-sectie voorkomen (verwijder `faq` of voeg geen FAQ-blok toe).');
    }
  }

  if (ids.filter((x) => x === "stats").length + ids.filter((x) => x === "brands").length > 1) {
    errors.push('Niet meerdere bewijs-secties: maximaal één `stats` of één `brands` in de hele `sections`-array.');
  }
  if (ids.filter((x) => x === "steps").length + ids.filter((x) => x === "features").length > 1) {
    errors.push('Niet meerdere werkwijze/diensten-secties: maximaal één `steps` of één `features`.');
  }

  for (const id of ids) {
    if (id && FORBIDDEN_STRICT_LANDING_IDS.has(id)) {
      errors.push(
        `Verboden sectie-id op strikte landingspagina: "${id}" (geen over-ons, team, pricing, shop, galerij, testimonials of aparte CTA-sectie).`,
      );
    }
  }

  const joined = sections.map((s) => s.html).join("\n");
  if (MARQUEE_OR_TICKER_RE.test(joined)) {
    errors.push(
      "Verboden: scrollende tekst-/logo-banners (marquee/ticker: `studio-marquee`, `studio-marquee-track` of `<marquee>`).",
    );
  }

  const faqSection = sections.find((s) => (s.id ?? "").trim().toLowerCase() === "faq");
  if (faqSection) {
    const detailsCount = (faqSection.html.match(/<\s*details\b/gi) ?? []).length;
    const dtCount = (faqSection.html.match(/<\s*dt\b/gi) ?? []).length;
    const h3Faqish = (faqSection.html.match(/<\s*h3\b/gi) ?? []).length;
    const qCount = Math.max(detailsCount, dtCount > 0 ? dtCount : 0, h3Faqish);
    if (qCount > 6) {
      errors.push(`FAQ-sectie: maximaal 6 vragen; geschat ${qCount} op basis van <details>/<dt>/<h3>-telling.`);
    }
  }

  return errors;
}
