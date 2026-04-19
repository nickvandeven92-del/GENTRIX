import { randomBytes } from "crypto";
import type { ContentBlockParam } from "@anthropic-ai/sdk/resources/messages";
import type { DesignGenerationContract } from "@/lib/ai/design-generation-contract";
import type {
  GeneratedTailwindPage,
  MasterPromptPageConfig,
  TailwindSection,
} from "@/lib/ai/tailwind-sections-schema";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { isValidSubfolderSlug } from "@/lib/slug";

const OPENAI_IMAGE_URL = "https://api.openai.com/v1/images/generations";
const GEMINI_GENERATE_CONTENT_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const PLACEHOLDER_GIF_PREFIX = "data:image/gif;base64,";
const HERO_IMG_MARKER = 'data-gentrix-ai-hero-img="1"';

export type StudioHeroImageRasterMime = "image/png" | "image/jpeg" | "image/webp";

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
    !/\b(maak|nieuw|nieuwe|genereer|vervang|door|met|via|unsplash|stock|pexels)\b/.test(lower);
  if (removalOnly) return false;

  if (briefingWantsAiGeneratedHeroImage(message)) return true;
  if (!/\bhero\b/.test(lower)) return false;
  const visual = /\b(luxe|luxer|high.end|high-end|premium|sfeerbeeld|achtergrond|fotografie|foto|beeld|stijl|look|atmosfeer|mood|zwart.?wit|motion blur|close.up|close-up|gegenereerde|genereer|ai.?beeld|stock|unsplash|pexels)\b/.test(
    lower,
  );
  const change = /\b(maak|vervang|update|wijzig|wijziging|nieuw|nieuwe|andere|betere|verbeter|verbeteren|frisser|frisse)\b/.test(
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
  return html.replace(/<img\b[^>]*(?:\/>|>)/gi, "");
}

/**
 * Mensleesbare reden waarom de AI-hero-pipeline uit staat (`null` = aan).
 * Gebruikt o.a. statusregels in de site-generatiestroom.
 */
function getGoogleAiStudioApiKey(): string | undefined {
  const k =
    process.env.GOOGLE_AI_STUDIO_API?.trim() ||
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
    return "Geen beeld-API-key: zet GOOGLE_AI_STUDIO_API (of GEMINI_API_KEY), of als fallback OPENAI_API_KEY.";
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || !process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    return "NEXT_PUBLIC_SUPABASE_URL en SUPABASE_SERVICE_ROLE_KEY zijn nodig om de afbeelding naar de bucket «site-assets» te uploaden.";
  }
  return null;
}

/** `STUDIO_AI_HERO_IMAGE=0` schakelt uit; anders aan wanneer Google AI Studio (voorkeur) of OpenAI + Supabase storage beschikbaar zijn. */
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
 * Buiten die match: geen upstream hero-call — anders betaal je wel en faalt `injectAiHeroImageIntoHeroSectionHtml`
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
    "Photorealistic documentary photograph for a commercial website hero — must read as a real photo, not an illustration or 3D render.",
    "Shot like a full-frame DSLR / mirrorless still (35–50mm lens feel), natural dynamic range: avoid crushed blacks, blown highlights, HDR halos, oversharpening, or hyper-saturated 'AI poster' color.",
    "Believable workshop or service environment; soft window light or warm practicals; shallow depth of field with natural bokeh — like a premium editorial brand shoot (reference quality: high-end craft business photography).",
    "Natural skin texture and hair detail, realistic imperfections, not plastic or wax-doll; candid mid-action moment, not a stiff stock pose.",
    "Avoid illustration, vector, coloring-book, comic, game cinematic, or airbrushed glamour retouching.",
    "Hands and tools: anatomically plausible, slightly imperfect — not perfectly symmetrical staging.",
    "No text, no logos, no watermarks, no UI mockups.",
    "Optional subtle film grain; restrained color grade — photographic, not stylized fantasy.",
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

type GeminiGenerateContentResponse = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string; inlineData?: { mimeType?: string; data?: string } }> };
    finishReason?: string;
  }>;
  promptFeedback?: { blockReason?: string };
  error?: { message?: string; code?: number; status?: string };
};

function studioHeroImageProviderMode(): "auto" | "google" | "openai" {
  const m = process.env.STUDIO_AI_HERO_IMAGE_PROVIDER?.trim().toLowerCase();
  if (m === "google" || m === "gemini") return "google";
  if (m === "openai" || m === "dalle" || m === "dall-e") return "openai";
  return "auto";
}

async function googleGeminiCreateHeroRaster(prompt: string): Promise<StudioHeroImageRasterPrefetch | null> {
  const apiKey = getGoogleAiStudioApiKey();
  if (!apiKey) return null;
  const model =
    process.env.STUDIO_AI_HERO_GEMINI_MODEL?.trim() ||
    /** Default: Gemini 2.5 Flash Image (“Nano Banana”); override in Vercel voor nieuwere previews. */
    "gemini-2.5-flash-image";
  const url = `${GEMINI_GENERATE_CONTENT_BASE}/${encodeURIComponent(model)}:generateContent`;
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
          imageConfig: { aspectRatio: "16:9" },
        },
      }),
    });
    const json = (await res.json()) as GeminiGenerateContentResponse;
    if (!res.ok) {
      console.warn("[ai-hero] Gemini generateContent error:", res.status, json?.error ?? json);
      return null;
    }
    if (json.promptFeedback?.blockReason) {
      console.warn("[ai-hero] Gemini promptFeedback block:", json.promptFeedback.blockReason);
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
    console.warn("[ai-hero] Gemini response had no image inlineData in parts.");
    return null;
  } catch (e) {
    console.warn("[ai-hero] Gemini request failed:", e instanceof Error ? e.message : e);
    return null;
  } finally {
    clearTimeout(t);
  }
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
}): Promise<string | null> {
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
  return uploadRasterToSiteAssets(bytes, raster.mime, ctx.subfolderSlug);
}

function buildPrebakedHeroImagePromptFooter(publicUrl: string): string {
  const u = publicUrl.trim();
  if (!u) return "";
  return (
    "\n\n=== SERVER: HERO-SFEERFOTO (AL KLAAR — ASSET-FIRST) ===\n\n" +
    "Er is **nu al** één AI-sfeerbeeld geüpload. **Geen externe stock-foto-URL** voor dit hoofdbeeld — gebruik **exact** deze URL (letterlijk copy-paste, geen query-params wijzigen):\n\n" +
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
 * `Promise.resolve(null)` door en zet `prebakedHeroPublicUrl` op de apply-context.
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

async function uploadRasterToSiteAssets(
  bytes: Buffer,
  mime: StudioHeroImageRasterMime,
  subfolderSlug?: string | null,
): Promise<string | null> {
  try {
    const supabase = createServiceRoleClient();
    const folder = storageFolderForGeneration(subfolderSlug);
    const id = randomBytes(8).toString("hex");
    const ext = fileExtForHeroMime(mime);
    const path = `${folder}/ai-hero/${Date.now()}-${id}.${ext}`;
    const { error } = await supabase.storage.from("site-assets").upload(path, bytes, {
      contentType: mime,
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
 * Voegt één **full-bleed** hero-beeld toe (onder de overige inhoud, `z-0`).
 * Geen desktop-halve-breedte meer: `md:w-1/2` + complexe AI-grids met ondoorzichtige zijkolommen
 * liet het beeld alleen in een smalle strook zien (“drie kolommen”-bug in preview).
 * Retourneert `null` wanneer er geen passende `<section id="hero">` is.
 */
export function injectAiHeroImageIntoHeroSectionHtml(html: string, publicImageUrl: string): string | null {
  const escUrl = publicImageUrl.replace(/"/g, "&quot;");
  /** `z-0` (niet negatief): negatieve z-index verdween vaak achter sibling-kolommen met effen `bg-*`, waardoor de injectie “onzichtbaar” leek. */
  const img = `<img ${HERO_IMG_MARKER} src="${escUrl}" alt="" class="pointer-events-none absolute inset-0 z-0 h-full w-full object-cover object-center" loading="eager" fetchpriority="high" />`;

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
  /** Parallel gestart vóór/e tijdens Claude — bij `null` na await: opnieuw `createHeroImageRasterB64`. */
  prefetchedHeroB64Promise?: Promise<StudioHeroImageRasterPrefetch | null>;
  /**
   * Zelfde raster als asset-first stap vóór HTML: injecteer zonder tweede upstream-call.
   * Bij mislukte inject (geen `<section id="hero">`) geen tweede generatie — asset staat al op CDN.
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
      "[ai-hero] prebaked URL present but hero HTML has no injectable <section id=\"hero\"> — skipping second hero API call (asset already on CDN):",
      preUrl.slice(0, 120),
    );
    return data;
  }

  const prompt = buildOpenAiHeroPrompt(ctx.businessName, ctx.description, ctx.designContract);
  let prefetch: StudioHeroImageRasterPrefetch | null =
    ctx.prefetchedHeroB64Promise != null ? await ctx.prefetchedHeroB64Promise : null;
  if (!prefetch) {
    prefetch = await createHeroImageRasterB64(prompt);
  }
  if (!prefetch) return data;

  let bytes: Buffer;
  try {
    bytes = Buffer.from(prefetch.base64, "base64");
  } catch {
    return data;
  }
  if (bytes.length < 500) return data;

  const url = await uploadRasterToSiteAssets(bytes, prefetch.mime, ctx.subfolderSlug);
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
  });
  return out.sections;
}
