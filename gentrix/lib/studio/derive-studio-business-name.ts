import { STUDIO_UNDECIDED_BRAND_SENTINEL } from "@/lib/studio/studio-brand-sentinel";

function clampStudioBrandName(v: string): string {
  const t = v.trim().replace(/^['"«»\s]+|['"»\s]+$/g, "");
  if (!t) return "";
  return t.length <= 200 ? t : t.slice(0, 200);
}

/** Kapt gangbare wrappers vóór de echte merknaam af (NL/EN). */
function stripLeadingBrandNoise(v: string): string {
  let t = v.trim();
  t = t.replace(/^(?:het|de|ons|onze|mijn|jouw)\s+(?:merk|bedrijf|zaak|handelsnaam|winkel|shop)\s+/i, "");
  t = t.replace(/^(?:merk|bedrijf)\s+/i, "");
  return t.trim();
}

/**
 * Leidt een vaste bedrijfsnaam af uit vrije briefingtekst (Site-studio).
 * Herkent o.a. `Bedrijfsnaam: …`, en gangbare zinnen als "website voor MoSham …".
 */
export function deriveStudioBusinessNameFromBriefing(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return "";

  if (/^https?:\/\/\S+$/i.test(trimmed)) {
    try {
      const host = new URL(trimmed).hostname.replace(/^www\./i, "");
      if (!host) return "Website";
      return host.length <= 200 ? host : host.slice(0, 200);
    } catch {
      return "Website";
    }
  }

  const labelMatch = trimmed.match(
    /(?:^|\n)\s*(?:bedrijfsnaam|bedrijf|handelsnaam|naam\s+van\s+het\s+bedrijf|merk|klant|company\s+name|company)\s*[:：]\s*([^\n]+)/i,
  );
  if (labelMatch?.[1]) {
    const v = clampStudioBrandName(labelMatch[1]);
    if (v) return v;
  }

  const heetNl = trimmed.match(
    /\b(?:het\s+)?(?:bedrijf|merk|merknaam|onze\s+zaak)\s+(?:heet|heten)\s+([^.!?;\n]+)/i,
  );
  if (heetNl?.[1]) {
    const v = clampStudioBrandName(stripLeadingBrandNoise(heetNl[1]));
    if (v) return v;
  }

  const merknaamIs = trimmed.match(/\bmerknaam\s+(?:is|wordt)\s+([^.!?;\n]+)/i);
  if (merknaamIs?.[1]) {
    const v = clampStudioBrandName(stripLeadingBrandNoise(merknaamIs[1]));
    if (v) return v;
  }

  const voorQuoted = trimmed.match(/\bvoor\s+["'«]([^"'»]{2,120})["'»]/i);
  if (voorQuoted?.[1]) {
    const v = clampStudioBrandName(voorQuoted[1]);
    if (v) return v;
  }

  const makenVoorNl = trimmed.match(
    /\b(?:website|webshop|webpagina|site|pagina|landing\s*page)\s+(?:maken|bouwen|genereren|creëren|creeren|ontwerpen|laten\s+maken)\s+voor\s+([\s\S]+?)(?=\s+met\b|\n|$)/i,
  );
  if (makenVoorNl?.[1]) {
    const v = clampStudioBrandName(stripLeadingBrandNoise(makenVoorNl[1]));
    if (v) return v;
  }

  const voorNl = trimmed.match(
    /\b(?:website|webshop|webpagina|site|pagina|landing\s*page)\s+voor\s+([\s\S]+?)(?=\s+met\b|\n|$)/i,
  );
  if (voorNl?.[1]) {
    const v = clampStudioBrandName(stripLeadingBrandNoise(voorNl[1]));
    if (v) return v;
  }

  const buildForEn = trimmed.match(
    /\b(?:build|create|design|make)\s+(?:a\s+)?(?:website|webshop|site|page|landing\s*page)\s+for\s+([\s\S]+?)(?=\s+with\b|\n|$)/i,
  );
  if (buildForEn?.[1]) {
    const v = clampStudioBrandName(stripLeadingBrandNoise(buildForEn[1]));
    if (v) return v;
  }

  const voorEn = trimmed.match(
    /\b(?:website|webshop|site|page|landing\s*page)\s+for\s+([\s\S]+?)(?=\s+with\b|\n|$)/i,
  );
  if (voorEn?.[1]) {
    const v = clampStudioBrandName(stripLeadingBrandNoise(voorEn[1]));
    if (v) return v;
  }

  return STUDIO_UNDECIDED_BRAND_SENTINEL;
}
