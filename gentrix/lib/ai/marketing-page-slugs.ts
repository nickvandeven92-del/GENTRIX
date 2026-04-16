import { isReservedMarketingPageSlug } from "@/lib/ai/tailwind-sections-schema";

/** Standaard dienstverlening / leadgen — geen productcatalog. */
export const DEFAULT_SERVICE_MARKETING_SLUGS = ["wat-wij-doen", "werkwijze", "over-ons", "faq"] as const;

/** Webshop / productgericht — kortere set zonder verplicht “over ons”. */
export const DEFAULT_RETAIL_MARKETING_SLUGS = ["collectie", "service-retour", "faq"] as const;

const ECOMMERCE_PROBE_RE =
  /\b(webshop|webwinkel|e-?commerce|woocommerce|shopify|online\s*(winkel|shop)|winkelwagen|productcatalog|producten\s*(bestellen|kopen)|\bsnelle\s*levering\b)\b/i;

/** Branche-id’s met fysieke / online productfocus (compact; uitbreidbaar). */
const RETAIL_MARKETING_INDUSTRY_IDS = new Set<string>([
  "retail_electronics",
  "mens_fashion",
  "womens_fashion",
  "kids_clothing",
  "shoes",
  "jewelry",
  "florist",
  "interior",
  "bike_shop",
  "pet_store",
  "optician",
  "sports_store",
  "angling_shop",
  "bakery",
  "butcher",
  "liquor_store",
  "bookstore",
  "ice_cream",
  "car_dealer",
  "car_detailing",
  "car_rental",
]);

function normalizeSlugList(slugs: readonly string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of slugs) {
    const s = raw.trim().toLowerCase();
    if (!s || seen.has(s)) continue;
    if (isReservedMarketingPageSlug(s)) {
      throw new Error(`Gereserveerde marketing-slug niet toegestaan: "${raw.trim()}"`);
    }
    seen.add(s);
    out.push(s);
  }
  return out;
}

function prefersRetailMarketingSlugs(industryId: string | null | undefined, probe: string): boolean {
  if (industryId && RETAIL_MARKETING_INDUSTRY_IDS.has(industryId.trim())) return true;
  return ECOMMERCE_PROBE_RE.test(probe);
}

/**
 * Bepaalt welke `marketingPages`-keys deze run moet leveren (prompt + Zod + default-contactnav).
 * Override via API/generator-opties wint; anders retail-detectie of service-default.
 */
export function resolveMarketingPageSlugsForGeneration(options: {
  combinedProbe: string;
  detectedIndustryId?: string | null;
  override?: readonly string[] | null;
}): readonly string[] {
  if (options.override?.length) {
    const n = normalizeSlugList(options.override);
    if (n.length === 0 || n.length > 8) {
      throw new Error("marketingPageSlugs override: 1 t/m 8 slugs vereist.");
    }
    return n;
  }
  if (prefersRetailMarketingSlugs(options.detectedIndustryId, options.combinedProbe)) {
    return [...DEFAULT_RETAIL_MARKETING_SLUGS];
  }
  return [...DEFAULT_SERVICE_MARKETING_SLUGS];
}

/** Korte NL-labels voor default contact-nav (fallback). */
export function marketingPageNavLabel(slug: string): string {
  const s = slug.trim().toLowerCase();
  const map: Record<string, string> = {
    "wat-wij-doen": "Wat wij doen",
    werkwijze: "Werkwijze",
    "over-ons": "Over ons",
    faq: "FAQ",
    collectie: "Collectie",
    "service-retour": "Service & retour",
  };
  return map[s] ?? s.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}
