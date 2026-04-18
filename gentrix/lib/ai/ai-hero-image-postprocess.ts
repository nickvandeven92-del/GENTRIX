import { randomBytes } from "crypto";
import type { ContentBlockParam } from "@anthropic-ai/sdk/resources/messages";
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

export type OpenAiHeroPrefetchInput = {
  businessName: string;
  description: string;
  designContract: DesignGenerationContract | null;
  /**
   * `true` = geen prefetch: klant-uploads aanwezig en briefing vraagt niet expliciet om AI-hero —
   * de hero krijgt dan meestal een klant-`<img>` en zou `shouldAttemptAiHeroImageForHtml` blokkeren.
   */
  skipPrefetchBecauseLikelyClientHero: boolean;
};

/**
 * Zelfde drempel als `startOpenAiHeroImagePrefetch`: wanneer `false`, geen server-side hero-beeld
 * (meestal klantfoto's voor de hero, tenzij briefing expliciet AI-hero vraagt).
 */
export function shouldRunStudioHeroImagePipeline(
  description: string,
  clientImageCount: number,
): boolean {
  if (!isAiHeroImagePostProcessEnabled()) return false;
  const skipPrefetchBecauseLikelyClientHero =
    clientImageCount > 0 && !briefingWantsAiGeneratedHeroImage(description);
  return !skipPrefetchBecauseLikelyClientHero;
}

/**
 * DALL-E + upload **vóór** de grote HTML/JSON-run (Lovable-achtig: asset eerst, daarna compositie).
 * Retourneert `null` bij uitgeschakelde pipeline of OpenAI/upload-fout.
 */
export async function generateStudioHeroImagePublicUrl(ctx: {
  businessName: string;
  description: string;
  designContract: DesignGenerationContract | null;
  subfolderSlug?: string | null;
}): Promise<string | null> {
  if (!isAiHeroImagePostProcessEnabled()) return null;
  const prompt = buildOpenAiHeroPrompt(ctx.businessName, ctx.description, ctx.designContract);
  const b64 = await openAiCreateHeroPngBase64(prompt);
  if (!b64) return null;
  let png: Buffer;
  try {
    png = Buffer.from(b64, "base64");
  } catch {
    return null;
  }
  if (png.length < 500) return null;
  return uploadPngToSiteAssets(png, ctx.subfolderSlug);
}

function buildPrebakedHeroImagePromptFooter(publicUrl: string): string {
  const u = publicUrl.trim();
  if (!u) return "";
  return (
    "\n\n=== SERVER: HERO-SFEERFOTO (AL KLAAR — ASSET-FIRST) ===\n\n" +
    "Er is **nu al** één AI-sfeerbeeld geüpload. **Geen Unsplash/Pexels of andere stock-URL** voor dit hoofdbeeld — gebruik **exact** deze URL (letterlijk copy-paste, geen query-params wijzigen):\n\n" +
    `\`${u}\`\n\n` +
    "**In de landings-`hero`-sectie (`id: \"hero\"`):**\n" +
    "- Buitenste wrapper **moet** `<section id=\"hero\" …>` zijn met `relative` in de `class` (stacking voor overlays).\n" +
    "- Zet **minstens één** `<img … src=\"…\" …>` **of** een zichtbare **background-image** (inline `style` of Tailwind arbitrary property) met **exact** bovenstaande HTTPS-URL in een geldige CSS-`url`-waarde — de hero mag **niet** een leeg wit/grijs vlak zijn.\n" +
    "- Gradient/overlays (`bg-black/30`, `from-black/60`, …) zijn oké zolang het beeld zichtbaar blijft; **niet** een effen ondoorzichtige `bg-white` over de hele fotovlak zonder doorzichtigheid.\n\n" +
    "Dit blok is leidend voor het grote herobeeld; andere secties volgen de normale stock-regels.\n"
  );
}

/** Voegt het asset-first hero-blok toe net vóór de Claude HTML/JSON-stream (string of multimodal user content). */
export function appendPrebakedHeroImageToUserContent(
  userContent: string | ContentBlockParam[],
  publicUrl: string,
): string | ContentBlockParam[] {
  const footer = buildPrebakedHeroImagePromptFooter(publicUrl);
  if (!footer) return userContent;

  if (typeof userContent === "string") {
    return `${userContent}${footer}`;
  }
  if (userContent.length === 0) {
    return [{ type: "text", text: footer.trim() }];
  }
  const last = userContent[userContent.length - 1];
  if (last?.type === "text" && "text" in last && typeof (last as { text: string }).text === "string") {
    const lt = last as { type: "text"; text: string };
    return [...userContent.slice(0, -1), { type: "text", text: `${lt.text}${footer}` }];
  }
  return [...userContent, { type: "text", text: footer.trim() }];
}

/**
 * Start DALL-E **parallel** aan de grote Claude HTML-stream, zodra naam + briefing + (optioneel)
 * designcontract bekend zijn. `applyAiHeroImageToGeneratedPage` hergebruikt het resultaat en valt
 * terug op een verse OpenAI-call als prefetch `null` opleverde of overgeslagen was.
 *
 * Bij **asset-first** (`generateStudioHeroImagePublicUrl` vóór HTML) niet starten: geef
 * `Promise.resolve(null)` door en zet `prebakedHeroPublicUrl` op de apply-context.
 */
export function startOpenAiHeroImagePrefetch(input: OpenAiHeroPrefetchInput): Promise<string | null> {
  if (!isAiHeroImagePostProcessEnabled()) return Promise.resolve(null);
  if (input.skipPrefetchBecauseLikelyClientHero) return Promise.resolve(null);
  const prompt = buildOpenAiHeroPrompt(
    input.businessName,
    input.description,
    input.designContract,
  );
  return openAiCreateHeroPngBase64(prompt);
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
  /** `z-0` (niet negatief): negatieve z-index verdween vaak achter sibling-kolommen met effen `bg-*`, waardoor de injectie “onzichtbaar” leek. */
  const img = `<img ${HERO_IMG_MARKER} src="${escUrl}" alt="" class="pointer-events-none absolute inset-0 z-0 h-full w-full object-cover md:left-1/2 md:right-0 md:w-1/2" loading="eager" fetchpriority="high" />`;

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
  /** Parallel gestart vóór/e tijdens Claude — bij `null` na await: opnieuw OpenAI. */
  prefetchedHeroB64Promise?: Promise<string | null>;
  /**
   * Zelfde PNG als asset-first stap vóór HTML: injecteer zonder tweede DALL-E-call.
   * Bij mislukte inject (geen `<section id="hero">`) geen fallback-OpenAI — asset staat al op CDN.
   */
  prebakedHeroPublicUrl?: string | null;
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

  const preUrl = ctx.prebakedHeroPublicUrl?.trim();
  if (preUrl) {
    const injectedEarly = injectAiHeroImageIntoHeroSectionHtml(heroHtmlForCheck, preUrl);
    if (injectedEarly != null) {
      const nextSections = [...data.sections];
      nextSections[idx] = { ...sec, html: injectedEarly };
      return { ...data, sections: nextSections };
    }
    console.warn(
      "[ai-hero] prebaked URL present but hero HTML has no injectable <section id=\"hero\"> — skipping second OpenAI call (asset already on CDN):",
      preUrl.slice(0, 120),
    );
    return data;
  }

  const prompt = buildOpenAiHeroPrompt(ctx.businessName, ctx.description, ctx.designContract);
  let b64: string | null =
    ctx.prefetchedHeroB64Promise != null ? await ctx.prefetchedHeroB64Promise : null;
  if (!b64) {
    b64 = await openAiCreateHeroPngBase64(prompt);
  }
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
