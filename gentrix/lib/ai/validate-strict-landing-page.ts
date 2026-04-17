import type { TailwindSection } from "@/lib/ai/tailwind-sections-schema";

/** Ticker/marquee in class/id-tekst (model gebruikt vaak `marquee-strip` i.p.v. `studio-marquee`). */
const MARQUEE_OR_TICKER_RE =
  /(\bstudio-marquee(?:-track)?\b|\bmarquee-strip\b|\bmarquee-ticker\b|\blogo-ticker\b|<\s*marquee\b)/i;

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
  /** Homepage max. 4 secties — FAQ alleen in `marketingPages["faq"]`. */
  "faq",
]);

/**
 * Harde checks voor de **landings-`sections`** (studio-contract) bij nieuwe sites.
 * **3** = ultra-compact (`hero` → `features`|`steps` → `footer`); **4** = bewijsband + middenblok + `footer` (geen `faq` op de landing).
 */
export function validateStrictLandingPageContract(sections: TailwindSection[]): string[] {
  const errors: string[] = [];
  const n = sections.length;

  if (n !== 3 && n !== 4) {
    errors.push(`Strikte landingspagina: **3** (ultra-compact) of **4** (standaard compact); nu ${n}.`);
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

  if (n === 3) {
    if (ids[1] !== "features" && ids[1] !== "steps") {
      errors.push('Tweede sectie (3-sectieplan): `id` moet `features` of `steps` zijn — het kernblok onder de hero.');
    }
    if (ids.includes("stats") || ids.includes("brands")) {
      errors.push("Bij 3 landings-secties mag geen aparte `stats`- of `brands`-sectie — trust hoort in `features`.");
    }
  } else if (n === 4) {
    const proofId = ids[1];
    if (proofId !== "stats" && proofId !== "brands") {
      errors.push('Tweede sectie: `id` moet `stats` (cijfers/KPI) of `brands` (logo-partners) zijn — precies één type bewijs.');
    }

    const middleId = ids[2];
    if (middleId !== "steps" && middleId !== "features") {
      errors.push('Derde sectie: `id` moet `steps` (werkwijze) of `features` (diensten) zijn — kies één van de twee.');
    }

    if (ids.filter((x) => x === "stats").length + ids.filter((x) => x === "brands").length > 1) {
      errors.push('Niet meerdere bewijs-secties: maximaal één `stats` of één `brands` in de hele `sections`-array.');
    }
    if (ids.filter((x) => x === "steps").length + ids.filter((x) => x === "features").length > 1) {
      errors.push('Niet meerdere werkwijze/diensten-secties: maximaal één `steps` of één `features`.');
    }
  }

  for (const id of ids) {
    if (id && FORBIDDEN_STRICT_LANDING_IDS.has(id)) {
      errors.push(
        `Verboden sectie-id op strikte landingspagina: "${id}" (geen over-ons, team, pricing, shop, galerij, testimonials, landing-faq of aparte CTA-sectie).`,
      );
    }
  }

  const joined = sections.map((s) => s.html).join("\n");
  if (MARQUEE_OR_TICKER_RE.test(joined)) {
    errors.push(
      "Verboden: scrollende tekst-/logo-banners (marquee/ticker: `studio-marquee`, `studio-marquee-track` of `<marquee>`).",
    );
  }

  return errors;
}
