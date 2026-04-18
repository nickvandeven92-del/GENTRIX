import type { SiteConfig } from "@/lib/ai/build-site-config";
import { resolveBrandStyleToPresetId, type PresetId } from "@/lib/ai/design-presets";
import { isLeisureFamilyActivityBriefing } from "@/lib/ai/prompt-leisure-activity";
import { getPresetLogoDna, mergeAvoidLists } from "@/lib/branding/logo-style-maps";
import { brandIdentitySchema, type BrandIdentity } from "@/types/logo";

function inferIndustry(description: string, audience: string): string {
  const t = `${description} ${audience}`.toLowerCase();
  if (/\b(saas|software|api|cloud|dev|tech|it-dienst)\b/.test(t)) return "technology / SaaS";
  if (/\b(financ|bank|vermogen|accountant|fiscal)\b/.test(t)) return "finance & professional services";
  if (/\b(zorg|kliniek|fysio|welness|medisch|tand)\b/.test(t)) return "health & wellness";
  if (/\b(shop|winkel|e-?commerce|retail|mode)\b/.test(t)) return "commerce & retail";
  if (/\b(bouw|installatie|techniek|industrie|metaal)\b/.test(t)) return "industrial & built environment";
  if (/\b(jurid|advoc|notaris|legal)\b/.test(t)) return "legal & advisory";
  if (/\b(horeca|restaurant|catering|food)\b/.test(t)) return "hospitality & food";
  if (/\b(agency|creatief|design|studio|marketing)\b/.test(t)) return "creative & marketing services";
  if (/\b(onderwijs|training|coach|cursus)\b/.test(t)) return "education & coaching";
  if (isLeisureFamilyActivityBriefing(t)) return "leisure, sports & recreation";
  return "general business services";
}

function inferPositioning(siteConfig: SiteConfig, industry: string): string {
  const goal = siteConfig.primary_goal.replace(/_/g, " ");
  return `Trusted ${industry} brand focused on ${goal}; ${siteConfig.visual_style.replace(/_/g, " ")} visual language with ${siteConfig.layout_density} layout rhythm.`;
}

function pickVisualKeywords(
  presetId: PresetId,
  description: string,
  pool: string[],
): string[] {
  const lower = description.toLowerCase();
  const extra: string[] = [];
  if (lower.includes("duurzaam") || lower.includes("green")) extra.push("sustainable signal");
  if (lower.includes("lux") || lower.includes("premium")) extra.push("quiet premium");
  if (lower.includes("snel") || lower.includes("speed")) extra.push("velocity without noise");
  const merged = [...pool.slice(0, 3), ...extra, ...pool.slice(3)];
  const uniq: string[] = [];
  const seen = new Set<string>();
  for (const w of merged) {
    const k = w.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    uniq.push(w);
    if (uniq.length >= 8) break;
  }
  while (uniq.length < 4) uniq.push(pool[uniq.length % pool.length]!);
  return uniq.slice(0, 8);
}

function enrichLeisureBrandIdentity(base: BrandIdentity, description: string): BrandIdentity {
  if (!isLeisureFamilyActivityBriefing(description)) return base;
  const extraKw = ["wave motif", "fluid mark", "welcoming motion"];
  const mergedKw = [...extraKw, ...base.visualKeywords];
  const seen = new Set<string>();
  const visualKeywords: string[] = [];
  for (const w of mergedKw) {
    const k = w.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    visualKeywords.push(w);
    if (visualKeywords.length >= 8) break;
  }
  while (visualKeywords.length < 4) {
    visualKeywords.push(base.visualKeywords[visualKeywords.length % base.visualKeywords.length]!);
  }

  const sym = `${base.symbolDirection} Recreation/water: simple abstract wave or ripple mark beside the wordmark — readable at favicon size; not initials-only in a box as the whole logo.`;
  return {
    ...base,
    industry: "leisure, sports & recreation",
    logoStyle: base.logoStyle === "wordmark" ? "combination" : base.logoStyle,
    colorMode: base.colorMode === "monochrome" ? "brand-accent" : base.colorMode,
    symbolDirection: sym.length > 400 ? `${sym.slice(0, 397)}…` : sym,
    visualKeywords: visualKeywords.slice(0, 8),
    avoid: mergeAvoidLists(base.avoid, [
      "initials-only logo in a rounded square as the entire mark",
      "literal pool ladder or clipart swimmer",
    ]),
  };
}

/**
 * Deterministische merk-DNA vóór logo-creatie (geen extra API).
 * (Losse logo-generatorhelpers zijn uit de actieve codebase verwijderd.)
 */
export function buildBrandIdentity(
  businessName: string,
  description: string,
  siteConfig: SiteConfig,
): BrandIdentity {
  const presetId = resolveBrandStyleToPresetId(siteConfig.brand_style);
  const dna = getPresetLogoDna(presetId);
  const industry = inferIndustry(description, siteConfig.target_audience);
  const audience =
    siteConfig.target_audience.trim().slice(0, 400) ||
    `Professionals and decision-makers in ${industry}.`;
  const avoid = mergeAvoidLists(dna.extraAvoid, [
    "stock-logo tropes",
    "over-detailed pictograms",
    "gradients inside the mark unless full-brand mode explicitly allows subtle duo-tone",
  ]);

  const raw: BrandIdentity = {
    brandName: businessName.trim().slice(0, 120),
    industry,
    tone: dna.tone,
    positioning: inferPositioning(siteConfig, industry).slice(0, 400),
    audience: audience.slice(0, 400),
    visualKeywords: pickVisualKeywords(presetId, description, dna.visualKeywordPool),
    logoStyle: dna.logoStyle,
    typographyDirection: dna.typographyDirection,
    symbolDirection: dna.symbolDirection,
    avoid,
    colorMode: dna.colorMode,
  };

  const parsed = brandIdentitySchema.safeParse(raw);
  if (parsed.success) return enrichLeisureBrandIdentity(parsed.data, description);

  return enrichLeisureBrandIdentity(
    brandIdentitySchema.parse({
    brandName: businessName.trim().slice(0, 120) || "Merk",
    industry,
    tone: dna.tone,
    positioning: inferPositioning(siteConfig, industry).slice(0, 400),
    audience: audience.slice(0, 400),
    visualKeywords: dna.visualKeywordPool.slice(0, 6),
    logoStyle: dna.logoStyle,
    typographyDirection: dna.typographyDirection,
    symbolDirection: dna.symbolDirection,
    avoid: mergeAvoidLists(dna.extraAvoid, [
      "generic pictograms",
      "3d effects",
      "stock icons",
      "hairline strokes",
    ]),
    colorMode: dna.colorMode,
  }),
    description,
  );
}
