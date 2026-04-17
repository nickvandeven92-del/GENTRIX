/**
 * Model / handmatige nav gebruikt vaak andere URL-segmenten dan de canonieke
 * `marketingPages`-keys in JSON. Zonder mapping: `/site/x/wat-wij-doen` → 404/redirect naar landing.
 *
 * Map: **kleine letters, decoded** segment → **exacte** key uit `marketingSlugs` (eerste match).
 */
const MARKETING_SLUG_URL_ALIASES: Readonly<Record<string, readonly string[]>> = {
  "wat-wij-doen": ["diensten", "services", "aanbod", "offerte", "wat-wij-doen"],
  "what-we-do": ["diensten", "services", "wat-wij-doen"],
  services: ["diensten", "wat-wij-doen"],
  "our-services": ["diensten", "services"],
  aanbod: ["diensten", "wat-wij-doen"],
  about: ["over-ons"],
  "about-us": ["over-ons"],
  overons: ["over-ons"],
  "our-process": ["werkwijze"],
  "how-we-work": ["werkwijze"],
  process: ["werkwijze"],
  "veelgestelde-vragen": ["faq"],
  "veelgestelde-vragen-en-antwoorden": ["faq"],
  questions: ["faq"],
  "q-a": ["faq"],
  help: ["faq"],
};

function normalizeSegment(seg: string): string {
  const t = seg.trim();
  if (!t) return "";
  try {
    return decodeURIComponent(t).toLowerCase();
  } catch {
    return t.toLowerCase();
  }
}

function findCanonicalForCandidate(
  candidateLower: string,
  marketingSlugs: readonly string[],
): string | null {
  for (const slug of marketingSlugs) {
    if (slug.toLowerCase() === candidateLower) return slug;
  }
  return null;
}

/**
 * Bouwt `segmentLower → canonieke slug` voor gebruik in iframe-nav (`mseg`).
 * Alleen sleutels die naar een bestaande marketing-key resolven.
 */
export function buildMarketingSlugSegmentResolutionMap(
  marketingSlugs: readonly string[],
): Record<string, string> {
  const out: Record<string, string> = {};
  if (!marketingSlugs.length) return out;

  for (const slug of marketingSlugs) {
    const k = normalizeSegment(slug);
    if (k) out[k] = slug;
  }

  for (const [wrongLower, candidates] of Object.entries(MARKETING_SLUG_URL_ALIASES)) {
    if (out[wrongLower]) continue;
    for (const c of candidates) {
      const hit = findCanonicalForCandidate(c.toLowerCase(), marketingSlugs);
      if (hit) {
        out[wrongLower] = hit;
        break;
      }
    }
  }

  return out;
}
