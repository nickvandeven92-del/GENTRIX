import { randomBytes } from "crypto";
import type { DesignGenerationContract } from "@/lib/ai/design-generation-contract";
import type { GeneratedTailwindPage, TailwindSection } from "@/lib/ai/tailwind-sections-schema";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { isValidSubfolderSlug } from "@/lib/slug";

const OPENAI_IMAGE_URL = "https://api.openai.com/v1/images/generations";
const PLACEHOLDER_GIF_PREFIX = "data:image/gif;base64,";
const HERO_IMG_MARKER = 'data-gentrix-ai-hero-img="1"';

// ─── Briefing-signaaldetectie ─────────────────────────────────────────────────

/**
 * Trefwoorden die aangeven dat de gebruiker expliciet een AI-gegenereerde
 * hero-afbeelding wil. Wanneer dit waar is, worden klantfoto's uit de hero
 * gestript zodat de DALL-E 3-injectie niet wordt geblokkeerd.
 */
const GENERATED_HERO_KEYWORDS = [
  "hero afbeelding",
  "hero-afbeelding",
  "hero image",
  "hero foto",
  "ai hero",
  "gegenereerde hero",
  "genereer hero",
  "hero genereer",
  "hero generate",
  "generate hero",
] as const;

export function briefingWantsAiGeneratedHeroImage(description: string): boolean {
  const lower = description.toLowerCase();
  return GENERATED_HERO_KEYWORDS.some((kw) => lower.includes(kw));
}

// ─── Strip helper ─────────────────────────────────────────────────────────────

/** Verwijdert alle `<img>` tags uit een HTML-fragment (voor geforceerde AI-hero). */
function stripImgTagsFromHtml(html: string): string {
  return html.replace(/<img\b[^>]*(?:\/>|>)/gi, "");
}

/**
 * Mensleesbare reden waarom de AI-hero-pipeline uit staat (`null` = aan).
 * Gebruikt o.a. statusregels in de site-generatiestroom.
 */
export function getAiHeroImagePostProcessSkipReason(): string | null {
  if (process.env.STUDIO_AI_HERO_IMAGE === "0") {
    return "uitgeschakeld met STUDIO_AI_HERO_IMAGE=0.";
  }
  if (!process.env.OPENAI_API_KEY?.trim()) {
    return "OPENAI_API_KEY ontbreekt.";
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || !process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    return "NEXT_PUBLIC_SUPABASE_URL en SUPABASE_SERVICE_ROLE_KEY zijn nodig om de PNG naar de bucket «site-assets» te uploaden.";
  }
  return null;
}

/** `STUDIO_AI_HERO_IMAGE=0` schakelt uit; anders aan wanneer OpenAI + Supabase storage beschikbaar zijn. */
export function isAiHeroImagePostProcessEnabled(): boolean {
  return getAiHeroImagePostProcessSkipReason() === null;
}

function isHeroLikeSection(sec: TailwindSection, _index: number): boolean {
  const id = String(sec.id ?? "").toLowerCase();
  return id === "hero" || id.startsWith("hero");
}

function heroHtmlHasVideo(html: string): boolean {
  return /<video\b/i.test(html);
}

function heroHtmlHasRealImage(html: string): boolean {
  const re = /<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const src = (m[1] ?? "").trim();
    if (!src || src.startsWith(PLACEHOLDER_GIF_PREFIX)) continue;
    if (/^data:image\//i.test(src)) continue;
    if (/^javascript:/i.test(src)) return true;
    if (src.startsWith("http://") || src.startsWith("https://") || src.startsWith("/")) return true;
  }
  return false;
}

/**
 * Alleen `id="hero"` / `id='hero'` op de **buitenste `<section>`** is injecteerbaar.
 * Buiten die match: geen OpenAI-call — anders betaal je wel en faalt `injectAiHeroImageIntoHeroSectionHtml`
 * (bijv. `id="hero"` alleen op een inner `<div>`).
 */
export function heroSectionOpenTagHasInjectableHeroId(heroHtml: string): boolean {
  return /<section[^>]*\bid\s*=\s*["']hero["'][^>]*>/i.test(heroHtml);
}

export function shouldAttemptAiHeroImageForHtml(heroHtml: string): boolean {
  if (!heroSectionOpenTagHasInjectableHeroId(heroHtml)) return false;
  if (heroHtml.includes(HERO_IMG_MARKER)) return false;
  if (heroHtmlHasVideo(heroHtml)) return false;
  if (heroHtmlHasRealImage(heroHtml)) return false;
  return true;
}

export function buildOpenAiHeroPrompt(
  businessName: string,
  description: string,
  contract: DesignGenerationContract | null,
): string {
  const parts: string[] = [
    "High-end editorial photograph for a commercial website hero background.",
    "No text, no logos, no watermarks, no UI mockups.",
    "Natural light, shallow depth of field, tasteful color grading.",
  ];
  const bn = businessName.trim();
  if (bn) parts.push(`Business context (mood only, do not render the name as text): ${bn.slice(0, 120)}.`);
  if (contract?.heroVisualSubject?.trim()) {
    parts.push(`Scene: ${contract.heroVisualSubject.trim().slice(0, 700)}`);
  }
  if (contract?.imageryMustReflect?.length) {
    parts.push(`Must reflect: ${contract.imageryMustReflect.join("; ").slice(0, 400)}`);
  }
  if (contract?.referenceVisualAxes?.paletteIntent?.trim()) {
    parts.push(`Palette: ${contract.referenceVisualAxes.paletteIntent.trim().slice(0, 200)}`);
  }
  const desc = description.trim().slice(0, 900);
  if (desc) parts.push(`Brief: ${desc}`);
  const p = parts.join(" ");
  return p.length > 3800 ? p.slice(0, 3800) : p;
}

type OpenAiImageGenResponse = {
  data?: { b64_json?: string; url?: string }[];
  error?: { message?: string };
};

async function openAiCreateHeroPngBase64(prompt: string): Promise<string | null> {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) return null;
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 55_000);
  try {
    const res = await fetch(OPENAI_IMAGE_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "dall-e-3",
        prompt,
        n: 1,
        size: "1792x1024",
        response_format: "b64_json",
        quality: "standard",
      }),
    });
    const json = (await res.json()) as OpenAiImageGenResponse;
    if (!res.ok) {
      console.warn("[ai-hero] OpenAI images error:", res.status, json?.error?.message ?? json);
      return null;
    }
    const b64 = json.data?.[0]?.b64_json;
    if (b64) return b64;
    console.warn("[ai-hero] OpenAI response without b64_json");
    return null;
  } catch (e) {
    console.warn("[ai-hero] OpenAI request failed:", e instanceof Error ? e.message : e);
    return null;
  } finally {
    clearTimeout(t);
  }
}

function storageFolderForGeneration(subfolderSlug?: string | null): string {
  const s = typeof subfolderSlug === "string" ? subfolderSlug.trim().toLowerCase() : "";
  if (s && isValidSubfolderSlug(s)) return s;
  return "concept";
}

async function uploadPngToSiteAssets(png: Buffer, subfolderSlug?: string | null): Promise<string | null> {
  try {
    const supabase = createServiceRoleClient();
    const folder = storageFolderForGeneration(subfolderSlug);
    const id = randomBytes(8).toString("hex");
    const path = `${folder}/ai-hero/${Date.now()}-${id}.png`;
    const { error } = await supabase.storage.from("site-assets").upload(path, png, {
      contentType: "image/png",
      upsert: false,
    });
    if (error) {
      console.warn("[ai-hero] Storage upload failed:", error.message);
      return null;
    }
    const { data: pub } = supabase.storage.from("site-assets").getPublicUrl(path);
    return pub.publicUrl ?? null;
  } catch (e) {
    console.warn("[ai-hero] Storage unavailable:", e instanceof Error ? e.message : e);
    return null;
  }
}

/**
 * Voegt één full-bleed hero-beeld toe (desktop: rechts 50% i.v.m. split-layouts).
 * Retourneert `null` wanneer er geen passende `<section id="hero">` is.
 */
export function injectAiHeroImageIntoHeroSectionHtml(html: string, publicImageUrl: string): string | null {
  const escUrl = publicImageUrl.replace(/"/g, "&quot;");
  const img = `<img ${HERO_IMG_MARKER} src="${escUrl}" alt="" class="pointer-events-none absolute inset-0 -z-10 h-full w-full object-cover md:left-1/2 md:right-0 md:w-1/2" loading="eager" fetchpriority="high" />`;

  const out = html.replace(
    /<section(\s[^>]*?\bid\s*=\s*["']hero["'][^>]*?)>/i,
    (_full, attrs: string) => {
      let nextAttrs = String(attrs);
      if (/\bclass=["']/i.test(nextAttrs)) {
        nextAttrs = nextAttrs.replace(/\bclass=(["'])([^"']*)\1/i, (_m, q: string, cls: string) => {
          if (/\brelative\b/i.test(cls)) return `class=${q}${cls}${q}`;
          return `class=${q}relative ${cls}${q}`;
        });
      } else {
        nextAttrs = `${nextAttrs} class="relative"`;
      }
      return `<section${nextAttrs}>${img}`;
    },
  );
  return out === html ? null : out;
}

export type ApplyAiHeroImageContext = {
  businessName: string;
  description: string;
  designContract: DesignGenerationContract | null;
  /** Optioneel: Supabase-pad onder geldige subfolder_slug. */
  subfolderSlug?: string | null;
};

export async function applyAiHeroImageToGeneratedPage(
  data: GeneratedTailwindPage,
  ctx: ApplyAiHeroImageContext,
): Promise<GeneratedTailwindPage> {
  if (!isAiHeroImagePostProcessEnabled()) return data;

  const idx = data.sections.findIndex((s, i) => isHeroLikeSection(s, i));
  if (idx < 0) return data;
  const sec = data.sections[idx];

  // Wanneer de briefing expliciet een AI-hero vraagt én er al een klantfoto in de
  // hero zit, verwijder die img-tags zodat de shouldAttempt-check niet blokkeert.
  const wantsGenerated = briefingWantsAiGeneratedHeroImage(ctx.description);
  const heroHtmlForCheck =
    wantsGenerated && heroHtmlHasRealImage(sec.html)
      ? stripImgTagsFromHtml(sec.html)
      : sec.html;

  if (!shouldAttemptAiHeroImageForHtml(heroHtmlForCheck)) return data;

  const prompt = buildOpenAiHeroPrompt(ctx.businessName, ctx.description, ctx.designContract);
  const b64 = await openAiCreateHeroPngBase64(prompt);
  if (!b64) return data;

  let png: Buffer;
  try {
    png = Buffer.from(b64, "base64");
  } catch {
    return data;
  }
  if (png.length < 500) return data;

  const url = await uploadPngToSiteAssets(png, ctx.subfolderSlug);
  if (!url) return data;

  // Injecteer in de (eventueel gestripte) hero HTML zodat de AI-afbeelding
  // niet achter een klantfoto verdwijnt.
  const nextHtml = injectAiHeroImageIntoHeroSectionHtml(heroHtmlForCheck, url);
  if (nextHtml == null) {
    console.warn(
      "[ai-hero] Image generated and uploaded but hero HTML has no injectable <section id=\"hero\"> open tag — skipping inject (orphan asset):",
      url,
    );
    return data;
  }

  const nextSections = [...data.sections];
  nextSections[idx] = { ...sec, html: nextHtml };
  return { ...data, sections: nextSections };
}

export function generatedPageMayUseAiHeroImage(
  data: GeneratedTailwindPage,
  description = "",
): boolean {
  if (!isAiHeroImagePostProcessEnabled()) return false;
  const idx = data.sections.findIndex((s, i) => isHeroLikeSection(s, i));
  if (idx < 0) return false;
  const html = data.sections[idx].html;
  // Wanneer briefing een AI-hero vraagt, strippen we eerst de imgs — zelfde logica als applyAiHeroImageToGeneratedPage.
  const wantsGenerated = briefingWantsAiGeneratedHeroImage(description);
  const heroHtmlForCheck =
    wantsGenerated && heroHtmlHasRealImage(html) ? stripImgTagsFromHtml(html) : html;
  return shouldAttemptAiHeroImageForHtml(heroHtmlForCheck);
}
