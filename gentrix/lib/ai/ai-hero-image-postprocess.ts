import { randomBytes } from "crypto";
import type { ContentBlockParam } from "@anthropic-ai/sdk/resources/messages";
import type { DesignGenerationContract } from "@/lib/ai/design-generation-contract";
import type {
  GeneratedTailwindPage,
  MasterPromptPageConfig,
  TailwindSection,
} from "@/lib/ai/tailwind-sections-schema";
import { findHtmlOpenTagEnd, replaceAllOpenTagsByLocalName } from "@/lib/site/html-open-tag";
import { buildHeroResponsiveWebpVariants } from "@/lib/ai/hero-responsive-webp-variants";
import { tryEncodeHeroRasterAsWebp } from "@/lib/ai/hero-raster-encode-webp";
import { SITE_ASSETS_UPLOAD_CACHE_CONTROL_MAX_AGE } from "@/lib/site/site-assets-storage-upload";
import { inferHeroImgSizesFromAttrs } from "@/lib/site/supabase-storage-delivery-url";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { isValidSubfolderSlug } from "@/lib/slug";

const OPENAI_IMAGE_URL = "https://api.openai.com/v1/images/generations";
const GEMINI_GENERATE_CONTENT_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const PLACEHOLDER_GIF_PREFIX = "data:image/gif;base64,";
const HERO_IMG_MARKER = 'data-gentrix-ai-hero-img="1"';

export type StudioHeroImageRasterMime = "image/png" | "image/jpeg" | "image/webp";

/** `string` = enkelvoudige `src`; object = vaste publish-varianten met `srcset`. */
export type AiHeroInjectUrls =
  | string
  | {
      variants: readonly { width: number; url: string }[];
      defaultSrc: string;
    };

export type StudioHeroImageUploadResult = {
  /** Één URL voor Claude asset-first footer (`promptUrl`). */
  promptUrl: string;
  inject: AiHeroInjectUrls;
};

/** Parallel hero-fetch vóór/e tijdens Claude; bevat base64 + MIME zodat Google Gemini (JPEG/WEBP) en OpenAI (PNG) hetzelfde pad delen. */
export type StudioHeroImageRasterPrefetch = {
  base64: string;
  mime: StudioHeroImageRasterMime;
};

// ─── Briefing-signaaldetectie ─────────────────────────────────────────────────

/**
 * Trefwoorden die aangeven dat de gebruiker expliciet een AI-gegenereerde
 * hero-afbeelding wil. Wanneer dit waar is, worden klantfoto's uit de hero
 * gestript zodat de server-side hero-injectie niet wordt geblokkeerd.
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

/**
 * Site-chat: ruimere detectie dan {@link briefingWantsAiGeneratedHeroImage} zodat prompts als
 * "Maak de hero luxer (high-end)" óók de server-side Gemini/OpenAI-hero-pipeline starten,
 * zonder valse triggers op bv. "verwijder de hero" (geen visueel upgrade-signaal).
 */
export function siteChatMessageSuggestsAiHeroRaster(message: string): boolean {
  const lower = message.toLowerCase();
  /** `briefingWantsAiGeneratedHeroImage` matcht ook "hero foto" — dat zit in "verwijder de hero foto". */
  const removalOnly =
    /\b(verwijder|weghaal|verberg|hide)\b/.test(lower) &&
    !/\b(maak|nieuw|nieuwe|genereer|vervang|door|met|via|stock|pexels)\b/.test(lower);
  if (removalOnly) return false;

  if (briefingWantsAiGeneratedHeroImage(message)) return true;

  /**
   * Opvolgberichten over de **server**-hero zonder het woord "hero" (veel voorkomend na inject).
   * Let op: alleen als het niet duidelijk over footer/logo/galerij gaat.
   */
  const nonHeroImageScope = /\b(footer|team|logo|galerij|gallery|favicon|cookie|avatar)\b/i.test(lower);
  const wantsFreshRaster =
    /\b(opnieuw\s+genereren|opnieuw\s+laten\s+genereren|regenereer|opnieuw\s+een\s+(beeld|afbeelding|foto)|ververs\s+(de\s+)?(foto|afbeelding|preview))\b/i.test(
      lower,
    ) ||
    /\b(nieuwe|andere|betere)\s+(generatie|variant|versie)\b/i.test(lower) ||
    /\b(nieuwe|andere)\s+render\b/i.test(lower) ||
    /\b(exact\s+)?dezelfde\s+(afbeelding|foto|beeld|image|picture|output|render)\b/i.test(lower) ||
    /\b(identieke|zelfde)\s+(afbeelding|foto|render|output)\b/i.test(lower) ||
    /\b(geen|niet)\s+(een\s+)?(nieuwe|andere)\s+(afbeelding|foto)\b/i.test(lower);
  if (wantsFreshRaster && !nonHeroImageScope) return true;

  if (!/\bhero\b/.test(lower)) return false;
  if (/\b(another|different|new)\s+hero\b/i.test(message)) return true;
  if (/\b(impressive|stunning)\s+hero\b/i.test(message)) return true;
  if (/\bindrukwekkend[ea]?\s+hero\b/i.test(lower)) return true;
  if (/\bhero\s+(photo|picture|shot|visual|image)\b/i.test(lower)) return true;
  const visual =
    /\b(luxe|luxer|high.end|high-end|premium|exclusief|exclusievere?|zakelijke?\s+sfeer|institutioneel|corporate|sfeerbeeld|achtergrond|fotografie|foto|beeld|stijl|look|atmosfeer|mood|zwart.?wit|motion blur|close.up|close-up|macro|materiaal|lichtlijn|rim.?light|chiaroscuro|scheer|scheermes|barbier|gegenereerde|genereer|ai.?beeld|stock|pexels)\b/.test(
      lower,
    );
  /** Onder andere `genereer` — anders matcht bv. "Genereer een close-up ... voor mijn hero" niet en start de server-pipeline niet. */
  const change = /\b(maak|vervang|update|wijzig|wijziging|nieuw|nieuwe|andere|betere|verbeter|verbeteren|frisser|frisse|genereer|creëer|creer)\b/.test(
    lower,
  );
  if (visual && change) return true;
  return false;
}

/** Minimale `config` alleen voor {@link applyAiHeroImageToGeneratedPage} in site-chat (veld wordt niet teruggeschreven). */
const SITE_CHAT_AI_HERO_STUB_MASTER_CONFIG: MasterPromptPageConfig = {
  style: "studio_site_chat",
  font: "system-ui, sans-serif",
  theme: {
    primary: "#18181b",
    accent: "#c9a227",
    primaryLight: "#27272a",
    primaryMain: "#18181b",
    primaryDark: "#09090b",
  },
};

// ─── Strip helper ─────────────────────────────────────────────────────────────

/** Verwijdert alle `<img>` tags uit een HTML-fragment (voor geforceerde AI-hero). */
function stripImgTagsFromHtml(html: string): string {
  return replaceAllOpenTagsByLocalName(html, "img", () => "");
}

/** Geen letterlijke `bg-` + `[url` in één regex-bron: Tailwind content-scan maakt daar utilities van (Vercel/Turbopack). */
const STRIP_TAILWIND_ARBITRARY_BG_URL_CLASS = new RegExp(
  "\\bbg-" + "\\[url\\(" + "[^\\]]*" + "\\)\\]",
  "gi",
);

/**
 * Site-chat: Claude zet geüploade schermafbeeldingen nogal eens als `<img src=…>` of
 * inline background-image / Tailwind arbitrary bg-url — dan blokkeert
 * {@link shouldAttemptAiHeroImageForHtml} de Gemini/OpenAI-pijplijn en blijft de screenshot staan.
 */
export function stripHeroRasterPlaceholdersForSiteChatAiHero(html: string): string {
  let out = stripImgTagsFromHtml(html);
  out = out.replace(STRIP_TAILWIND_ARBITRARY_BG_URL_CLASS, "bg-transparent");
  out = out.replace(/\sstyle=(["'])([^"']*)\1/gi, (full, q: string, st: string) => {
    let s = String(st)
      .replace(/background-image\s*:\s*[^;]+;?/gi, "")
      .replace(/background\s*:\s*url\s*\([^)]*\)[^;]*;?/gi, "")
      .replace(/;\s*;/g, ";")
      .trim();
    s = s.replace(/^;+|;+$/g, "").trim();
    if (!s) return "";
    return ` style=${q}${s}${q}`;
  });
  return out;
}

/**
 * Mensleesbare reden waarom de AI-hero-pipeline uit staat (`null` = aan).
 * Gebruikt o.a. statusregels in de site-generatiestroom.
 */
/** Eén key volstaat; meerdere namen omdat AI Studio / docs / hosting verschillende env-namen gebruiken. */
function getGoogleAiStudioApiKey(): string | undefined {
  const k =
    process.env.GOOGLE_AI_STUDIO_API?.trim() ||
    process.env.GOOGLE_AI_STUDIO_API_KEY?.trim() ||
    process.env.GEMINI_API_KEY?.trim() ||
    process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim();
  return k || undefined;
}

function hasAnyHeroImageUpstreamKey(): boolean {
  return Boolean(getGoogleAiStudioApiKey() || process.env.OPENAI_API_KEY?.trim());
}

/** Gebruikt in UI/diagnostiek: is er minstens één upstream image-key gezet (Google of OpenAI)? */
export function isStudioHeroImageProviderKeyPresent(): boolean {
  return hasAnyHeroImageUpstreamKey();
}

export function getAiHeroImagePostProcessSkipReason(): string | null {
  if (process.env.STUDIO_AI_HERO_IMAGE === "0") {
    return "uitgeschakeld met STUDIO_AI_HERO_IMAGE=0.";
  }
  if (!hasAnyHeroImageUpstreamKey()) {
    return (
      "Geen Gemini/OpenAI-beeldkey in de server-omgeving. Zet één van: GOOGLE_AI_STUDIO_API, GOOGLE_AI_STUDIO_API_KEY, " +
      "GEMINI_API_KEY of GOOGLE_GENERATIVE_AI_API_KEY (key van https://aistudio.google.com/apikey). " +
      "Zonder deze key wordt generativelanguage.googleapis.com niet aangeroepen — geen usage in AI Studio. " +
      "OPENAI_API_KEY alleen voor DALL·E-fallback of STUDIO_AI_HERO_IMAGE_PROVIDER=openai."
    );
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || !process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    return (
      "NEXT_PUBLIC_SUPABASE_URL en SUPABASE_SERVICE_ROLE_KEY zijn nodig om de hero naar de bucket «site-assets» te uploaden. " +
      "Zonder service role-key draait de AI-hero-pipeline niet en wordt Gemini/OpenAI niet aangeroepen."
    );
  }
  return null;
}

/** `STUDIO_AI_HERO_IMAGE=0` schakelt uit; anders aan wanneer Google AI Studio (voorkeur) of OpenAI + Supabase storage beschikbaar zijn. */
export function isAiHeroImagePostProcessEnabled(): boolean {
  return getAiHeroImagePostProcessSkipReason() === null;
}

/**
 * Wire-sectie voor AI-hero: JSON-`id` is niet altijd `hero` (bv. `section-0`); `sectionName` kan "Hero" zijn
 * of de HTML bevat `<section id="hero">` op de eerste sectie.
 */
function isHeroLikeSection(sec: TailwindSection, index: number): boolean {
  const id = String(sec.id ?? "").toLowerCase();
  if (id === "hero" || id.startsWith("hero")) return true;
  const name = sec.sectionName.trim().toLowerCase();
  if (name === "hero" || name.startsWith("hero")) return true;
  if (index === 0 && heroSectionOpenTagHasInjectableHeroId(sec.html)) return true;
  return false;
}

function heroHtmlHasVideo(html: string): boolean {
  return /<video\b/i.test(html);
}

function heroHtmlHasRealImage(html: string): boolean {
  const re = /<img\b/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const start = m.index;
    const end = findHtmlOpenTagEnd(html, start);
    const tag = html.slice(start, end);
    const srcM = tag.match(/\bsrc\s*=\s*["']([^"']+)["']/i);
    const src = (srcM?.[1] ?? "").trim();
    re.lastIndex = end;
    if (!src || src.startsWith(PLACEHOLDER_GIF_PREFIX)) continue;
    if (/^data:image\//i.test(src)) continue;
    if (/^javascript:/i.test(src)) return true;
    if (src.startsWith("http://") || src.startsWith("https://") || src.startsWith("/")) return true;
  }
  return false;
}

/**
 * De **buitenste** hero-`<section>` moet `id="hero"` of `data-section="hero"` (hoofdletters via `/i`) hebben.
 * Zonder match: geen upstream hero-call / geen inject.
 */
export function heroSectionOpenTagHasInjectableHeroId(heroHtml: string): boolean {
  return /<section[^>]*\b(?:id|data-section)\s*=\s*["']hero["'][^>]*>/i.test(heroHtml);
}

export function shouldAttemptAiHeroImageForHtml(heroHtml: string): boolean {
  if (!heroSectionOpenTagHasInjectableHeroId(heroHtml)) return false;
  if (heroHtml.includes(HERO_IMG_MARKER)) return false;
  if (heroHtmlHasVideo(heroHtml)) return false;
  if (heroHtmlHasRealImage(heroHtml)) return false;
  return true;
}

export type BuildOpenAiHeroPromptOptions = {
  /**
   * Site-assistent / opvolgbeurt: unieke seed zodat Gemini niet telkens quasi-dezelfde compositie levert
   * bij gelijkwaardige korte prompts.
   */
  variationSeed?: string;
};

/** Brief + contract: web/software studio / site-builder — extra sturing voor de raster-API (Gemini/OpenAI). */
const WEB_SOFTWARE_HERO_SIGNAL =
  /\b(webdesign|webbureau|web\s*agency|digital\s*agency|websites?\s+(?:automatisch\s+)?(?:genereren|maken|bouwen|ontwikkelen|genereert|worden\s+gegenereerd)|genereren.{0,40}\bwebsites?\b|sites?\s+genereren|websitegenerator|site[-\s]?generator|webontwikkeling|webdevelopment|software\s*studio|(?:maakt|bouwt|genereert)\s+websites?|website[-\s]?(builder|bouwer)|site[-\s]?builder|no[-\s]?code|platform\s+(?:voor\s+)?websites?|site[-\s]?studio|webshop\s*laten\s*maken|SEO\s*bureau|UX\s*design|UI\s*design)\b/i;

function buildWebSoftwareStudioHeroBiasParagraph(
  businessName: string,
  description: string,
  contract: DesignGenerationContract | null,
): string | null {
  const heroSubj = contract?.heroVisualSubject?.trim() ?? "";
  const reflect = (contract?.imageryMustReflect ?? []).join(" ");
  const probe = `${businessName}\n${description}\n${heroSubj}\n${reflect}`;
  if (!WEB_SOFTWARE_HERO_SIGNAL.test(probe)) return null;
  return (
    "**Sector cue — digital / web product or creative studio (from brief or contract):** prioritize **digital-atelier or institutional-tech** mood — e.g. **macro on large display glass** with soft abstract reflections (screen off or uniform grey; **no UI, text, or logos**), **precision-milled aluminum** studio hardware, **dark cable-harness / patch-panel** abstract with restrained bokeh, **fiber-optic light brushes** on matte black, **empty creative-studio interior fragment** (concrete + acoustic baffle; crop furniture to abstraction), **night glass façade** compression with cool practicals. **Hard ban for this sector:** **no** marble desk still-life where the main read is **spiral notebook + pen + mystery gadget / thick phone-on-stand / minimalist hub** (reads as generic “productivity” stock, not web/software). **No** stationery-as-hero unless the brief literally names that prop set."
  );
}

export function buildOpenAiHeroPrompt(
  businessName: string,
  description: string,
  contract: DesignGenerationContract | null,
  options?: BuildOpenAiHeroPromptOptions,
): string {
  const webBias = buildWebSoftwareStudioHeroBiasParagraph(businessName, description, contract);
  const parts: string[] = [
    "Photorealistic **environment / materials / still-life** photograph for a **wide 16:9** commercial website hero background — must read as a real photo, not an illustration or 3D render.",
    "**Default composition (unless the brief explicitly demands a full room):** prefer **macro or tight close-up** (macro to ~135mm lens feel): **texture- and light-led** — brushed or bead-blasted metal, smoked/tinted glass with speculars, carbon weave, fine stone/concrete grain, precision hardware, folded paper edges, **or** real architectural fragments (mullions, stair geometry, ceiling louvers, boardroom joinery) with **directional / rim light**. Wide airy **establishing shots** of whole desks/rooms are **second choice** — they read generic fast.",
    "**Hard ban on lazy B2B stock tropes** (unless the brief names that exact scene): **no** bright Scandinavian home-office clichés — **laptop on pale wood + ceramic mug + spiral notebook + pen + felt desk pad** as the main read; **also ban** the close cousin **marble desk + spiral notebook + pen + cryptic slab gadget / phone dock** as the hero centerpiece (generic AI productivity still-life). If electronics appear, show **abstract detail** (keyboard edge, hinge metal, brushed lid corner) — not a hero product shot of a consumer laptop.",
    "**Creative mandate — site-specific, not a reusable template:** one **bespoke** photoreal frame for *this* brief only — not an interchangeable \"default AI site hero.\" **Avoid** formula output: centered overhead flatlays, tame symmetry, vague office still-life, or the same prop recipe you would reuse for unrelated clients. **Prefer a daring but honest** read of the brief: aggressive crop (subject cut by frame edges), oblique camera, dominant diagonal massing, **specific** light (blue hour, single hard practical, raking sun), or an unexpected material **when the brief allows** — still believable and **zero people**.",
  ];
  /** Vroeg in de prompt: anders valt het weg bij de 3800-teken cap als de briefing lang is. */
  if (webBias) parts.push(webBias);
  parts.push(
    "Lighting: **controlled drama is encouraged** — single strong key, narrow window beam, corridor perspective, justified deep shadows, specular edge light on glass/metal. Still **natural photographic** integrity: **no** HDR halos, oversharpening, neon oversaturation, or \"AI poster\" grading; **no** blown-out white wall + flat fill as the default look.",
    "Subject = **branche mood without people**: believable interior **empty of people**, or **abstracted real architecture**, or **still-life props** filling most of the frame (no hands) — **institutional / advisory / craft** calm, **not** lifestyle bloggers, **not** domestic cozy.",
    "**Strict ban — no exceptions:** no people, no faces, no human silhouettes, no crowd, no customers or staff, no mannequins that read as humans, no body parts (hands, arms, legs). If the business is people-centric, show only **setting + props + materials** that imply the trade.",
    "Avoid illustration, vector, coloring-book, comic, game cinematic, or airbrushed glamour retouching.",
    "Props and tools: plausible real-world objects, slightly imperfect staging — never arranged around an invisible human actor.",
    "No text, no logos, no watermarks, no UI mockups.",
    "Optional subtle film grain; restrained color grade — photographic, not stylized fantasy.",
  );
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
  if (desc) parts.push(`Brief (primary creative direction — follow this literally for subject, props, and mood): ${desc}`);
  const seed = options?.variationSeed?.trim();
  if (seed) {
    parts.push(
      `Composition variation id: ${seed}. Use a clearly different camera angle, distance, and prop placement than a generic centered “AI product” shot; still **zero people** — vary environment, surface, and light only.`,
    );
  }
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

type GeminiGenerateContentResponse = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string; inlineData?: { mimeType?: string; data?: string } }> };
    finishReason?: string;
  }>;
  promptFeedback?: { blockReason?: string };
  error?: { message?: string; code?: number; status?: string };
};

export function studioHeroImageProviderMode(): "auto" | "google" | "openai" {
  const m = process.env.STUDIO_AI_HERO_IMAGE_PROVIDER?.trim().toLowerCase();
  if (m === "google" || m === "gemini") return "google";
  if (m === "openai" || m === "dalle" || m === "dall-e") return "openai";
  return "auto";
}

function geminiHttpStatusRetryable(status: number): boolean {
  return status === 429 || status === 502 || status === 503 || status === 504;
}

/**
 * Google Gemini image (`responseModalities: IMAGE`). Herbruikt voor hero (16:9) en merkmark (1:1).
 */
export async function studioGeminiCreateImageRaster(
  prompt: string,
  aspectRatio: string,
  logTag: "[ai-hero]" | "[ai-brand]",
): Promise<StudioHeroImageRasterPrefetch | null> {
  const apiKey = getGoogleAiStudioApiKey();
  if (!apiKey) return null;
  const model =
    process.env.STUDIO_AI_HERO_GEMINI_MODEL?.trim() ||
    /** Default: Gemini 2.5 Flash Image (“Nano Banana”); override in Vercel voor nieuwere previews. */
    "gemini-2.5-flash-image";
  const url = `${GEMINI_GENERATE_CONTENT_BASE}/${encodeURIComponent(model)}:generateContent`;
  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 120_000);
    try {
      const res = await fetch(url, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            responseModalities: ["IMAGE"],
            imageConfig: { aspectRatio },
          },
        }),
      });
      const json = (await res.json()) as GeminiGenerateContentResponse;
      if (!res.ok) {
        console.warn(logTag, "Gemini generateContent error:", res.status, json?.error ?? json);
        if (attempt < maxAttempts && geminiHttpStatusRetryable(res.status)) {
          await new Promise((r) => setTimeout(r, 700 * attempt));
          continue;
        }
        return null;
      }
      if (json.promptFeedback?.blockReason) {
        console.warn(logTag, "Gemini promptFeedback block:", json.promptFeedback.blockReason);
        return null;
      }
      const parts = json.candidates?.[0]?.content?.parts ?? [];
      for (const p of parts) {
        const mimeRaw = p.inlineData?.mimeType?.toLowerCase().trim();
        const data = p.inlineData?.data;
        if (!data || !mimeRaw) continue;
        if (mimeRaw === "image/png" || mimeRaw === "image/jpeg" || mimeRaw === "image/webp") {
          return { base64: data, mime: mimeRaw };
        }
      }
      console.warn(logTag, "Gemini response had no image inlineData in parts.");
      return null;
    } catch (e) {
      console.warn(logTag, "Gemini request failed:", e instanceof Error ? e.message : e);
      if (attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, 700 * attempt));
        continue;
      }
      return null;
    } finally {
      clearTimeout(t);
    }
  }
  return null;
}

async function googleGeminiCreateHeroRaster(prompt: string): Promise<StudioHeroImageRasterPrefetch | null> {
  return studioGeminiCreateImageRaster(prompt, "16:9", "[ai-hero]");
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
        quality:
          process.env.STUDIO_AI_HERO_IMAGE_QUALITY?.trim().toLowerCase() === "standard" ? "standard" : "hd",
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

async function openAiCreateHeroRaster(prompt: string): Promise<StudioHeroImageRasterPrefetch | null> {
  const b64 = await openAiCreateHeroPngBase64(prompt);
  return b64 ? { base64: b64, mime: "image/png" } : null;
}

/**
 * Google AI Studio (Gemini image / “Nano Banana”) heeft voorrang; daarna optioneel OpenAI DALL·E 3.
 * `STUDIO_AI_HERO_IMAGE_PROVIDER=google|openai` forceert één backend; default `auto`.
 */
export async function createHeroImageRasterB64(prompt: string): Promise<StudioHeroImageRasterPrefetch | null> {
  const mode = studioHeroImageProviderMode();
  if (mode === "openai") {
    return openAiCreateHeroRaster(prompt);
  }
  if (mode === "google") {
    return googleGeminiCreateHeroRaster(prompt);
  }
  if (getGoogleAiStudioApiKey()) {
    const g = await googleGeminiCreateHeroRaster(prompt);
    if (g) return g;
  }
  return openAiCreateHeroRaster(prompt);
}

/**
 * Hero-raster + upload **vóór** de grote HTML/JSON-run (asset-first).
 * Retourneert `null` bij uitgeschakelde pipeline of upstream/upload-fout.
 */
export async function generateStudioHeroImagePublicUrl(ctx: {
  businessName: string;
  description: string;
  designContract: DesignGenerationContract | null;
  subfolderSlug?: string | null;
}): Promise<StudioHeroImageUploadResult | null> {
  if (!isAiHeroImagePostProcessEnabled()) return null;
  const prompt = buildOpenAiHeroPrompt(ctx.businessName, ctx.description, ctx.designContract);
  const raster = await createHeroImageRasterB64(prompt);
  if (!raster) return null;
  let bytes: Buffer;
  try {
    bytes = Buffer.from(raster.base64, "base64");
  } catch {
    return null;
  }
  if (bytes.length < 500) return null;
  return uploadHeroRasterToSiteAssets(bytes, raster.mime, ctx.subfolderSlug);
}

function buildPrebakedHeroImagePromptFooter(publicUrl: string): string {
  const u = publicUrl.trim();
  if (!u) return "";
  return (
    "\n\n=== SERVER: HERO-SFEERFOTO (AL KLAAR — ASSET-FIRST) ===\n\n" +
    "Er is **nu al** één AI-sfeerbeeld (omgeving/materiaal/stilleven — **geen** mensfiguren) geüpload. **Geen externe stock-foto-URL** voor dit hoofdbeeld — gebruik **exact** deze URL (letterlijk copy-paste, geen query-params wijzigen):\n\n" +
    `\`${u}\`\n\n` +
    "**In de landings-`hero`-sectie (`id: \"hero\"`):**\n" +
    "- Buitenste wrapper **moet** `<section id=\"hero\" …>` zijn met `relative` in de `class` (stacking voor overlays).\n" +
    "- Zet **minstens één** `<img … src=\"…\" …>` **of** een zichtbare **background-image** (inline `style` of Tailwind arbitrary property) met **exact** bovenstaande HTTPS-URL in een geldige CSS-`url`-waarde — de hero mag **niet** een leeg wit/grijs vlak zijn.\n" +
    "- Leesbaarheid: **lichte** overlay mag (`bg-black/25` … `bg-black/45`, of vergelijkbare gradient) — **geen** extreme `mix-blend-mode`, `contrast-125`, `saturate-200`, dubbele filters of ondoorzichtige vlakken over het hele beeld; het moet **fotografisch** blijven ogen (geen “HDR-kleurplaat”).\n" +
    "- Gradient/overlays zijn oké zolang het beeld zichtbaar blijft; **niet** een effen ondoorzichtige `bg-white` over de hele fotovlak zonder doorzichtigheid.\n\n" +
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
 * Start hero-beeldgeneratie **parallel** aan de grote Claude HTML-stream (Google AI Studio / Gemini
 * image eerst, daarna optioneel OpenAI). `applyAiHeroImageToGeneratedPage` hergebruikt het resultaat
 * en valt terug op `createHeroImageRasterB64` als prefetch `null` opleverde of overgeslagen was.
 *
 * Bij **asset-first** (`generateStudioHeroImagePublicUrl` vóór HTML) niet starten: geef
 * `Promise.resolve(null)` door en zet `prebakedHero` op de apply-context.
 */
export function startOpenAiHeroImagePrefetch(
  input: OpenAiHeroPrefetchInput,
): Promise<StudioHeroImageRasterPrefetch | null> {
  if (!isAiHeroImagePostProcessEnabled()) return Promise.resolve(null);
  if (input.skipPrefetchBecauseLikelyClientHero) return Promise.resolve(null);
  const prompt = buildOpenAiHeroPrompt(
    input.businessName,
    input.description,
    input.designContract,
  );
  return createHeroImageRasterB64(prompt);
}

function storageFolderForGeneration(subfolderSlug?: string | null): string {
  const s = typeof subfolderSlug === "string" ? subfolderSlug.trim().toLowerCase() : "";
  if (s && isValidSubfolderSlug(s)) return s;
  return "concept";
}

function fileExtForHeroMime(mime: StudioHeroImageRasterMime): string {
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/webp") return "webp";
  return "png";
}

function pickDefaultHeroSrcFromVariants(sorted: readonly { width: number; url: string }[]): string {
  const TARGET = 1280;
  if (!sorted.length) return "";
  const exact = sorted.find((v) => v.width === TARGET);
  if (exact) return exact.url;
  const le = sorted.filter((v) => v.width <= TARGET);
  if (le.length) return le[le.length - 1]!.url;
  return sorted[0]!.url;
}

/** Fallback: één bestand (WebP indien kleiner dan bron). */
async function uploadSingleRasterToSiteAssets(
  bytes: Buffer,
  mime: StudioHeroImageRasterMime,
  subfolderSlug?: string | null,
): Promise<string | null> {
  try {
    const encoded = await tryEncodeHeroRasterAsWebp(bytes, mime);
    const uploadBytes = encoded?.bytes ?? bytes;
    const uploadMime: StudioHeroImageRasterMime = encoded?.mime ?? mime;

    const supabase = createServiceRoleClient();
    const folder = storageFolderForGeneration(subfolderSlug);
    const id = randomBytes(8).toString("hex");
    const ext = fileExtForHeroMime(uploadMime);
    const path = `${folder}/ai-hero/${Date.now()}-${id}.${ext}`;
    const { error } = await supabase.storage.from("site-assets").upload(path, uploadBytes, {
      contentType: uploadMime,
      upsert: false,
      cacheControl: SITE_ASSETS_UPLOAD_CACHE_CONTROL_MAX_AGE,
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

async function uploadHeroRasterToSiteAssets(
  bytes: Buffer,
  mime: StudioHeroImageRasterMime,
  subfolderSlug?: string | null,
): Promise<StudioHeroImageUploadResult | null> {
  const variants = await buildHeroResponsiveWebpVariants(bytes, mime);
  if (variants != null && variants.length > 0) {
    try {
      const supabase = createServiceRoleClient();
      const folder = storageFolderForGeneration(subfolderSlug);
      const stem = `${Date.now()}-${randomBytes(8).toString("hex")}`;
      const basePath = `${folder}/ai-hero/${stem}`;

      const uploaded = (
        await Promise.all(
          variants.map(async (v) => {
            const path = `${basePath}/${v.width}.webp`;
            const { error } = await supabase.storage.from("site-assets").upload(path, v.bytes, {
              contentType: "image/webp",
              upsert: false,
              cacheControl: SITE_ASSETS_UPLOAD_CACHE_CONTROL_MAX_AGE,
            });
            if (error) {
              console.warn("[ai-hero] responsive variant upload failed:", path, error.message);
              return null;
            }
            const { data: pub } = supabase.storage.from("site-assets").getPublicUrl(path);
            return pub.publicUrl ? { width: v.width, url: pub.publicUrl } : null;
          }),
        )
      ).filter((x): x is { width: number; url: string } => x != null);

      if (uploaded.length > 0) {
        const sorted = [...uploaded].sort((a, b) => a.width - b.width);
        const defaultSrc = pickDefaultHeroSrcFromVariants(sorted);
        return {
          promptUrl: defaultSrc,
          inject: { variants: sorted, defaultSrc },
        };
      }
    } catch (e) {
      console.warn("[ai-hero] responsive upload failed:", e instanceof Error ? e.message : e);
    }
  }

  const single = await uploadSingleRasterToSiteAssets(bytes, mime, subfolderSlug);
  if (!single) return null;
  return { promptUrl: single, inject: single };
}

function stripTailwindGradientBackgroundTokens(classValue: string): string {
  return classValue
    .split(/\s+/)
    .filter((t) => {
      const x = t.trim();
      if (!x) return false;
      if (/^bg-gradient(?:$|-)/.test(x)) return false;
      if (/^from-/.test(x)) return false;
      if (/^via-/.test(x)) return false;
      if (/^to-/.test(x)) return false;
      return true;
    })
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function ensureRelativeOverflowHiddenClassValue(classValue: string): string {
  let c = classValue.trim();
  if (!/\brelative\b/i.test(c)) c = `relative ${c}`;
  if (!/\boverflow-hidden\b/i.test(c)) c = `${c} overflow-hidden`;
  return c.replace(/\s+/g, " ").trim();
}

function mutateFirstDivOpeningStripGradient(divOpen: string): string {
  if (!/\bclass\s*=/i.test(divOpen)) {
    return divOpen.replace(/^<div\b/i, '<div class="relative overflow-hidden"');
  }
  return divOpen.replace(/\bclass\s*=\s*(["'])([^"']*)\1/i, (_full, q: string, cls: string) => {
    const next = ensureRelativeOverflowHiddenClassValue(stripTailwindGradientBackgroundTokens(cls));
    return `class=${q}${next}${q}`;
  });
}

/**
 * Eerste `<section …>` met `id`/`data-section` = hero. Alleen de **open-tag** (quote-aware), geen naïeve `[^>]`.
 */
function findInjectableHeroSectionOpen(html: string): { start: number; endExclusive: number; openTag: string } | null {
  let i = 0;
  while (i < html.length) {
    const idx = html.toLowerCase().indexOf("<section", i);
    if (idx === -1) return null;
    const endExclusive = findHtmlOpenTagEnd(html, idx);
    const openTag = html.slice(idx, endExclusive);
    if (/\b(?:id|data-section)\s*=\s*["']hero["']/i.test(openTag)) {
      return { start: idx, endExclusive, openTag };
    }
    i = endExclusive;
  }
  return null;
}

function sectionOpenTagEnsureRelative(openTag: string): string {
  const m = openTag.match(/^<\s*section(\s[\s\S]*)>$/i);
  if (!m) return openTag;
  let attrs = m[1] ?? "";
  if (/\bclass=["']/i.test(attrs)) {
    attrs = attrs.replace(/\bclass=(["'])([^"']*)\1/i, (_full, q: string, cls: string) => {
      if (/\brelative\b/i.test(cls)) return `class=${q}${cls}${q}`;
      return `class=${q}relative ${cls}${q}`;
    });
  } else {
    attrs = `${attrs} class="relative"`;
  }
  return `<section${attrs}>`;
}

/**
 * Split-hero (`grid` / `md:grid-cols-2` op de `<section>`): full-bleed-injectie op sectie-niveau
 * verdwijnt onder een linkerkolom met effen `bg-gradient-*`. Zet het raster in de eerste kolom en strip gradient-`bg-*`.
 *
 * Gebruikt {@link findHtmlOpenTagEnd} voor `<div>` — naïeve `[^>]*` breekt op `>` in Tailwind (bv. `[&>svg]:size-6`)
 * en lekt fragmenten als `10">` als tekst op de pagina.
 */
function tryInjectAiHeroIntoSplitGridFirstColumn(html: string, imgTag: string): string | null {
  const hero = findInjectableHeroSectionOpen(html);
  if (!hero) return null;
  const { start, endExclusive, openTag } = hero;
  if (!/\b(?:(?:md|lg):)?grid-cols-2\b/i.test(openTag)) return null;

  let p = endExclusive;
  while (p < html.length && /\s/.test(html[p]!)) p++;
  if (!/^<div\b/i.test(html.slice(p))) return null;
  const divStart = p;
  const divEndExclusive = findHtmlOpenTagEnd(html, divStart);
  const divOpen = html.slice(divStart, divEndExclusive);
  const newDivOpen = mutateFirstDivOpeningStripGradient(divOpen);
  return `${html.slice(0, divStart)}${newDivOpen}${imgTag}${html.slice(divEndExclusive)}`;
}

function escapeHtmlAttrDoubleQuoted(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

function buildAiHeroImgTag(image: AiHeroInjectUrls): string {
  const baseClass =
    "pointer-events-none absolute inset-0 z-0 h-full w-full object-cover object-center";
  /** `z-0` (niet negatief): negatieve z-index verdween vaak achter sibling-kolommen met effen `bg-*`, waardoor de injectie “onzichtbaar” leek. */
  if (typeof image === "string") {
    const escUrl = escapeHtmlAttrDoubleQuoted(image);
    return `<img ${HERO_IMG_MARKER} src="${escUrl}" alt="" class="${baseClass}" loading="eager" fetchpriority="high" decoding="async" />`;
  }
  const srcEsc = escapeHtmlAttrDoubleQuoted(image.defaultSrc);
  const srcsetEsc = image.variants.map((v) => `${escapeHtmlAttrDoubleQuoted(v.url)} ${v.width}w`).join(", ");
  const sizesEsc = escapeHtmlAttrDoubleQuoted(inferHeroImgSizesFromAttrs(`class="${baseClass}"`));
  return `<img ${HERO_IMG_MARKER} src="${srcEsc}" srcset="${srcsetEsc}" sizes="${sizesEsc}" alt="" class="${baseClass}" loading="eager" fetchpriority="high" decoding="async" />`;
}

/**
 * Voegt één **full-bleed** hero-beeld toe (onder de overige inhoud, `z-0`).
 * Geen desktop-halve-breedte meer: `md:w-1/2` + complexe AI-grids met ondoorzichtige zijkolommen
 * liet het beeld alleen in een smalle strook zien (“drie kolommen”-bug in preview).
 * Retourneert `null` wanneer er geen passende `<section id="hero">` is.
 */
export function injectAiHeroImageIntoHeroSectionHtml(html: string, image: AiHeroInjectUrls): string | null {
  const img = buildAiHeroImgTag(image);

  const splitFirst = tryInjectAiHeroIntoSplitGridFirstColumn(html, img);
  if (splitFirst != null) return splitFirst;

  const hero = findInjectableHeroSectionOpen(html);
  if (!hero) return null;
  const newOpen = sectionOpenTagEnsureRelative(hero.openTag);
  return `${html.slice(0, hero.start)}${newOpen}${img}${html.slice(hero.endExclusive)}`;
}

export type ApplyAiHeroImageContext = {
  businessName: string;
  description: string;
  designContract: DesignGenerationContract | null;
  /** Optioneel: Supabase-pad onder geldige subfolder_slug. */
  subfolderSlug?: string | null;
  /** Parallel gestart vóór/e tijdens Claude — bij `null` na await: opnieuw `createHeroImageRasterB64`. */
  prefetchedHeroB64Promise?: Promise<StudioHeroImageRasterPrefetch | null>;
  /**
   * Asset-first: volledige upload (publish-varianten + `promptUrl`); injecteert zonder tweede upstream-call.
   * Heeft voorrang op {@link prebakedHeroPublicUrl}.
   */
  prebakedHero?: StudioHeroImageUploadResult | null;
  /**
   * Legacy: alleen prompt-URL (string-inject). Checkpoints vóór multi-width gebruikten dit veld.
   */
  prebakedHeroPublicUrl?: string | null;
  /**
   * Site-assistent: gebruiker wil server-side Gemini/OpenAI-hero — altijd bestaande hero-`<img>` én
   * `background-image` / Tailwind arbitrary background-url uit Claude-output strippen vóór inject (anders blijft een geplakte screenshot staan).
   */
  siteChatRequestedAiHeroRaster?: boolean;
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
  // Site-chat: zelfde strip altijd (incl. background-url), anders blijft een geüploade screenshot
  // als volledige achtergrond staan terwijl Gemini nooit draait.
  const siteChatAi = ctx.siteChatRequestedAiHeroRaster === true;
  const wantsBriefingStrip = briefingWantsAiGeneratedHeroImage(ctx.description);
  let heroHtmlForCheck = sec.html;
  if (siteChatAi) {
    heroHtmlForCheck = stripHeroRasterPlaceholdersForSiteChatAiHero(sec.html);
  } else if (wantsBriefingStrip && heroHtmlHasRealImage(sec.html)) {
    heroHtmlForCheck = stripImgTagsFromHtml(sec.html);
  }

  if (!shouldAttemptAiHeroImageForHtml(heroHtmlForCheck)) return data;

  const prebaked =
    ctx.prebakedHero ??
    (ctx.prebakedHeroPublicUrl?.trim()
      ? ({
          promptUrl: ctx.prebakedHeroPublicUrl.trim(),
          inject: ctx.prebakedHeroPublicUrl.trim(),
        } satisfies StudioHeroImageUploadResult)
      : null);
  if (prebaked) {
    const injectedEarly = injectAiHeroImageIntoHeroSectionHtml(heroHtmlForCheck, prebaked.inject);
    if (injectedEarly != null) {
      const nextSections = [...data.sections];
      nextSections[idx] = { ...sec, html: injectedEarly };
      return { ...data, sections: nextSections };
    }
    console.warn(
      "[ai-hero] prebaked URL present but hero HTML has no injectable <section id=\"hero\"> — skipping second hero API call (asset already on CDN):",
      prebaked.promptUrl.slice(0, 120),
    );
    return data;
  }

  const prompt = buildOpenAiHeroPrompt(ctx.businessName, ctx.description, ctx.designContract, {
    variationSeed: siteChatAi ? randomBytes(6).toString("hex") : undefined,
  });
  let prefetch: StudioHeroImageRasterPrefetch | null =
    ctx.prefetchedHeroB64Promise != null ? await ctx.prefetchedHeroB64Promise : null;
  if (!prefetch) {
    prefetch = await createHeroImageRasterB64(prompt);
  }
  if (!prefetch) {
    if (siteChatAi && heroHtmlForCheck !== sec.html) {
      const nextSections = [...data.sections];
      nextSections[idx] = { ...sec, html: heroHtmlForCheck };
      return { ...data, sections: nextSections };
    }
    return data;
  }

  let bytes: Buffer;
  try {
    bytes = Buffer.from(prefetch.base64, "base64");
  } catch {
    return data;
  }
  if (bytes.length < 500) return data;

  const uploaded = await uploadHeroRasterToSiteAssets(bytes, prefetch.mime, ctx.subfolderSlug);
  if (!uploaded) return data;

  // Injecteer in de (eventueel gestripte) hero HTML zodat de AI-afbeelding
  // niet achter een klantfoto verdwijnt.
  const nextHtml = injectAiHeroImageIntoHeroSectionHtml(heroHtmlForCheck, uploaded.inject);
  if (nextHtml == null) {
    console.warn(
      "[ai-hero] Image generated and uploaded but hero HTML has no injectable <section id=\"hero\"> open tag — skipping inject (orphan asset):",
      uploaded.promptUrl,
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

export type SiteChatAiHeroContext = {
  businessName: string;
  subfolderSlug?: string | null;
};

/**
 * Site-chat: bij passende gebruikerstekst hetzelfde AI-hero-raster als bij site-generatie (Google Gemini eerst, daarna OpenAI).
 * Stock-URL’s worden vóór deze stap al in {@link finalizeSiteChatWithAiHeroPipeline} gestript.
 */
export async function mergeSiteChatSectionsWithOptionalAiHero(
  sections: TailwindSection[],
  lastUserMessage: string,
  ctx: SiteChatAiHeroContext,
): Promise<TailwindSection[]> {
  if (!siteChatMessageSuggestsAiHeroRaster(lastUserMessage)) return sections;
  if (!isAiHeroImagePostProcessEnabled()) return sections;

  const page: GeneratedTailwindPage = {
    config: SITE_CHAT_AI_HERO_STUB_MASTER_CONFIG,
    sections,
  };
  const out = await applyAiHeroImageToGeneratedPage(page, {
    businessName: ctx.businessName.trim() || "Studio",
    description: lastUserMessage,
    designContract: null,
    subfolderSlug: ctx.subfolderSlug ?? undefined,
    siteChatRequestedAiHeroRaster: true,
  });
  return out.sections;
}
