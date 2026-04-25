import { randomBytes } from "crypto";
import sharp from "sharp";
import type { DesignGenerationContract } from "@/lib/ai/design-generation-contract";
import type { GeneratedTailwindPage, StudioRasterBrandSet } from "@/lib/ai/tailwind-sections-schema";
import {
  isAiHeroImagePostProcessEnabled,
  studioGeminiCreateImageRaster,
  studioHeroImageProviderMode,
} from "@/lib/ai/ai-hero-image-postprocess";
import type { StudioHeroImageRasterPrefetch } from "@/lib/ai/ai-hero-image-postprocess";
import { applyRasterBrandMarkToSections } from "@/lib/site/brand-raster-inject";
import { SITE_ASSETS_UPLOAD_CACHE_CONTROL_MAX_AGE } from "@/lib/site/site-assets-storage-upload";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { isValidSubfolderSlug } from "@/lib/slug";

const OPENAI_IMAGE_URL = "https://api.openai.com/v1/images/generations";

function storageFolderForGeneration(subfolderSlug?: string | null): string {
  const s = typeof subfolderSlug === "string" ? subfolderSlug.trim().toLowerCase() : "";
  if (s && isValidSubfolderSlug(s)) return s;
  return "concept";
}

/** Zelfde upstream + storage als AI-hero; uitschakelbaar met `STUDIO_AI_BRAND_IMAGE=0`. */
export function getStudioRasterBrandImageSkipReason(): string | null {
  if (process.env.STUDIO_AI_BRAND_IMAGE?.trim() === "0") {
    return "uitgeschakeld met STUDIO_AI_BRAND_IMAGE=0.";
  }
  return isAiHeroImagePostProcessEnabled() ? null : "zelfde vereisten als AI-hero (Gemini/OpenAI-key + Supabase site-assets).";
}

export function isStudioRasterBrandImageEnabled(): boolean {
  return getStudioRasterBrandImageSkipReason() === null;
}

function buildPremiumBrandMarkPrompt(
  businessName: string,
  description: string,
  contract: DesignGenerationContract | null,
): string {
  const bn = businessName.trim().slice(0, 80);
  const parts: string[] = [
    "Create a **single premium brand lockup** on a **clean solid or very soft gradient background** (square 1:1).",
    "Composition: **distinctive abstract monogram or lettermark** + **refined wordmark** for the business — **high-end editorial** look (think luxury consultancy, architecture studio, private banking collateral).",
    "Materials: subtle metallic foil, soft emboss, or precision-cut gem-like geometry — **tasteful**, not gamer RGB or clip-art.",
    "**Strict:** no photorealistic people, faces, hands, or stock lifestyle. No watermarks, no UI mockups, no QR codes.",
    "**Strict:** do **not** imitate famous global brands, luxury fashion houses, or recognizable third-party trademarks — invent an **original** mark for this client only.",
    "The business name may appear as **stylized lettering** in the image — spelling must match the briefing name exactly when shown.",
    "Leave comfortable margin at the edges; the mark must stay **readable when scaled down** to a browser favicon.",
  ];
  if (bn) parts.push(`Business name (exact when typeset): ${bn}.`);
  if (contract?.referenceVisualAxes?.paletteIntent?.trim()) {
    parts.push(`Palette direction: ${contract.referenceVisualAxes.paletteIntent.trim().slice(0, 220)}`);
  }
  const desc = description.trim().slice(0, 700);
  if (desc) parts.push(`Brief (tone and sector — reflect in symbol and typography, not as a wall of text): ${desc}`);
  const p = parts.join(" ");
  return p.length > 3600 ? p.slice(0, 3600) : p;
}

type OpenAiImageGenResponse = {
  data?: { b64_json?: string; url?: string }[];
  error?: { message?: string };
};

async function openAiCreateBrandSquareRaster(prompt: string): Promise<StudioHeroImageRasterPrefetch | null> {
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
        size: "1024x1024",
        response_format: "b64_json",
        quality:
          process.env.STUDIO_AI_HERO_IMAGE_QUALITY?.trim().toLowerCase() === "standard" ? "standard" : "hd",
      }),
    });
    const json = (await res.json()) as OpenAiImageGenResponse;
    if (!res.ok) {
      console.warn("[ai-brand] OpenAI images error:", res.status, json?.error?.message ?? json);
      return null;
    }
    const b64 = json.data?.[0]?.b64_json;
    return b64 ? { base64: b64, mime: "image/png" } : null;
  } catch (e) {
    console.warn("[ai-brand] OpenAI request failed:", e instanceof Error ? e.message : e);
    return null;
  } finally {
    clearTimeout(t);
  }
}

async function createBrandMarkRasterB64(prompt: string): Promise<StudioHeroImageRasterPrefetch | null> {
  const mode = studioHeroImageProviderMode();
  if (mode === "openai") {
    return openAiCreateBrandSquareRaster(prompt);
  }
  if (mode === "google") {
    return studioGeminiCreateImageRaster(prompt, "1:1", "[ai-brand]");
  }
  const g = await studioGeminiCreateImageRaster(prompt, "1:1", "[ai-brand]");
  if (g) return g;
  return openAiCreateBrandSquareRaster(prompt);
}

async function uploadPngBytes(path: string, bytes: Buffer): Promise<string | null> {
  try {
    const supabase = createServiceRoleClient();
    const { error } = await supabase.storage.from("site-assets").upload(path, bytes, {
      contentType: "image/png",
      upsert: false,
      cacheControl: SITE_ASSETS_UPLOAD_CACHE_CONTROL_MAX_AGE,
    });
    if (error) {
      console.warn("[ai-brand] Storage upload failed:", path, error.message);
      return null;
    }
    const { data: pub } = supabase.storage.from("site-assets").getPublicUrl(path);
    return pub.publicUrl ?? null;
  } catch (e) {
    console.warn("[ai-brand] Storage unavailable:", e instanceof Error ? e.message : e);
    return null;
  }
}

async function uploadWebpBytes(path: string, bytes: Buffer): Promise<string | null> {
  try {
    const supabase = createServiceRoleClient();
    const { error } = await supabase.storage.from("site-assets").upload(path, bytes, {
      contentType: "image/webp",
      upsert: false,
      cacheControl: SITE_ASSETS_UPLOAD_CACHE_CONTROL_MAX_AGE,
    });
    if (error) {
      console.warn("[ai-brand] Storage upload failed:", path, error.message);
      return null;
    }
    const { data: pub } = supabase.storage.from("site-assets").getPublicUrl(path);
    return pub.publicUrl ?? null;
  } catch (e) {
    console.warn("[ai-brand] Storage unavailable:", e instanceof Error ? e.message : e);
    return null;
  }
}

/**
 * Genereert 1:1 merkbeeld, deriveert header-WebP + favicon-PNG’s, upload naar `site-assets`.
 */
export async function generateStudioRasterBrandSetPublicUrls(ctx: {
  businessName: string;
  description: string;
  designContract: DesignGenerationContract | null;
  subfolderSlug?: string | null;
}): Promise<StudioRasterBrandSet | null> {
  if (!isStudioRasterBrandImageEnabled()) return null;
  const prompt = buildPremiumBrandMarkPrompt(ctx.businessName, ctx.description, ctx.designContract);
  const raster = await createBrandMarkRasterB64(prompt);
  if (!raster) return null;
  let src: Buffer;
  try {
    src = Buffer.from(raster.base64, "base64");
  } catch {
    return null;
  }
  if (src.length < 400) return null;

  let headerWebp: Buffer;
  try {
    headerWebp = await sharp(src, { failOn: "none" })
      .rotate()
      .resize(512, 512, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 90, effort: 5 })
      .toBuffer();
  } catch (e) {
    console.warn("[ai-brand] sharp header encode failed:", e instanceof Error ? e.message : e);
    return null;
  }

  let fav32: Buffer;
  let fav192: Buffer;
  try {
    fav32 = await sharp(src, { failOn: "none" })
      .rotate()
      .resize(32, 32, { fit: "cover", position: "centre" })
      .png({ compressionLevel: 9 })
      .toBuffer();
    fav192 = await sharp(src, { failOn: "none" })
      .rotate()
      .resize(192, 192, { fit: "cover", position: "centre" })
      .png({ compressionLevel: 9 })
      .toBuffer();
  } catch (e) {
    console.warn("[ai-brand] sharp favicon encode failed:", e instanceof Error ? e.message : e);
    return null;
  }

  const folder = storageFolderForGeneration(ctx.subfolderSlug);
  const stem = `${Date.now()}-${randomBytes(8).toString("hex")}`;
  const basePath = `${folder}/ai-brand/${stem}`;

  const headerPath = `${basePath}/header.webp`;
  const headerUrl = await uploadWebpBytes(headerPath, headerWebp);
  const fav32Url = await uploadPngBytes(`${basePath}/favicon-32.png`, fav32);
  const fav192Url = await uploadPngBytes(`${basePath}/favicon-192.png`, fav192);

  if (!headerUrl || !fav32Url || !fav192Url) return null;

  return {
    headerLogoUrl: headerUrl,
    favicon32Url: fav32Url,
    favicon192Url: fav192Url,
  };
}

export type StudioRasterBrandPrefetchInput = {
  businessName: string;
  description: string;
  designContract: DesignGenerationContract | null;
  subfolderSlug?: string | null;
};

/** Parallel met Claude-stream / hero-prefetch; retourneert `null` wanneer uit of upstream faalt. */
export function startStudioRasterBrandPrefetch(
  input: StudioRasterBrandPrefetchInput,
): Promise<StudioRasterBrandSet | null> {
  if (!isStudioRasterBrandImageEnabled()) return Promise.resolve(null);
  return generateStudioRasterBrandSetPublicUrls(input);
}

export type ApplyStudioRasterBrandContext = StudioRasterBrandPrefetchInput & {
  prefetchedRasterBrandPromise?: Promise<StudioRasterBrandSet | null>;
};

/**
 * Voegt `rasterBrandSet` toe en werkt nav/header bij (geen dubbele run wanneer al `data-gentrix-raster-brand` + URL).
 */
export async function applyStudioRasterBrandToGeneratedPage(
  data: GeneratedTailwindPage,
  ctx: ApplyStudioRasterBrandContext,
): Promise<GeneratedTailwindPage> {
  if (data.logoSet?.variants?.primary?.trim()) {
    return data;
  }
  if (data.rasterBrandSet?.headerLogoUrl?.trim()) {
    return data;
  }

  const set =
    ctx.prefetchedRasterBrandPromise != null
      ? await ctx.prefetchedRasterBrandPromise
      : await generateStudioRasterBrandSetPublicUrls({
          businessName: ctx.businessName,
          description: ctx.description,
          designContract: ctx.designContract,
          subfolderSlug: ctx.subfolderSlug,
        });

  if (!set) return data;

  const sections = applyRasterBrandMarkToSections(data.sections, set, ctx.businessName);
  return { ...data, sections, rasterBrandSet: set };
}
