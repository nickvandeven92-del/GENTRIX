import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { extractBriefingReferenceImagesWithVision } from "@/lib/ai/extract-briefing-reference-images-vision";
import { getAnthropicApiKey } from "@/lib/ai/anthropic-env";
import { STUDIO_SITE_GENERATION } from "@/lib/ai/studio-generation-fixed-config";
import { checkPortalRateLimit } from "@/lib/api/portal-rate-limit";
import { requirePortalApiAccessForSlug } from "@/lib/auth/require-portal-api-access";
import { isPostgrestUnknownColumnError } from "@/lib/supabase/postgrest-unknown-column";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import {
  buildPlaceholderReviewsFromVisionText,
  parseReviewSourceItems,
  parseReviewSourceSettings,
  reviewSourceSettingsSchema,
  toPublicReviewSourceSettings,
  validateReviewSourceIdentifier,
} from "@/lib/reviews/review-source";
import { fetchGooglePlaceReviews, fetchTrustpilotReviews } from "@/lib/reviews/review-fetchers";

type RouteContext = { params: Promise<{ slug: string }> };

type RequestJsonWithBriefingImages = {
  briefingReferenceImages?: Array<{ url?: string; label?: string }>;
  clientImages?: Array<{ url?: string; label?: string }>;
};

const patchBodySchema = z
  .object({
    settings: reviewSourceSettingsSchema
      .pick({ enabled: true, platform: true, identifier: true, businessName: true })
      .partial(),
    disconnect: z.boolean().optional(),
  })
  .strict();

async function resolveAccess(context: RouteContext) {
  const { slug: raw } = await context.params;
  const slug = decodeURIComponent(raw);
  const access = await requirePortalApiAccessForSlug(slug);
  if (!access.ok) {
    return {
      ok: false as const,
      slug,
      response: NextResponse.json({ ok: false, error: access.message }, { status: access.status }),
    };
  }
  return { ok: true as const, slug, userId: access.userId, clientId: access.clientId };
}

export async function GET(_request: Request, context: RouteContext) {
  const auth = await resolveAccess(context);
  if (!auth.ok) return auth.response;
  if (!checkPortalRateLimit(auth.userId, `portal:reviews:get:${auth.slug}`, 120)) {
    return NextResponse.json({ ok: false, error: "Te veel verzoeken." }, { status: 429 });
  }
  try {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from("clients")
      .select("review_source_settings, review_source_items")
      .eq("id", auth.clientId)
      .maybeSingle();
    if (error) {
      if (
        isPostgrestUnknownColumnError(error, "review_source_settings") ||
        isPostgrestUnknownColumnError(error, "review_source_items")
      ) {
        return NextResponse.json(
          { ok: false, error: "Migratie ontbreekt: voer reviews bron migratie uit." },
          { status: 503 },
        );
      }
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    const settings = parseReviewSourceSettings(data?.review_source_settings);
    const items = parseReviewSourceItems(data?.review_source_items);
    return NextResponse.json({
      ok: true,
      settings: toPublicReviewSourceSettings(settings),
      items,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Onbekende fout" },
      { status: 503 },
    );
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await resolveAccess(context);
  if (!auth.ok) return auth.response;
  if (!checkPortalRateLimit(auth.userId, `portal:reviews:patch:${auth.slug}`, 60)) {
    return NextResponse.json({ ok: false, error: "Te veel verzoeken." }, { status: 429 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Ongeldige JSON." }, { status: 400 });
  }
  const parsed = patchBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues.map((i) => i.message).join(" ") },
      { status: 400 },
    );
  }
  try {
    const supabase = createServiceRoleClient();
    const { data: current, error: readErr } = await supabase
      .from("clients")
      .select("review_source_settings")
      .eq("id", auth.clientId)
      .maybeSingle();
    if (readErr) {
      if (isPostgrestUnknownColumnError(readErr, "review_source_settings")) {
        return NextResponse.json(
          { ok: false, error: "Migratie ontbreekt: voer reviews bron migratie uit." },
          { status: 503 },
        );
      }
      return NextResponse.json({ ok: false, error: readErr.message }, { status: 500 });
    }
    const existing = parseReviewSourceSettings(current?.review_source_settings);
    const incoming = parsed.data.settings ?? {};
    const disconnect = parsed.data.disconnect === true;
    const next = disconnect
      ? { ...existing, enabled: false, identifier: "", businessName: "", lastSyncStatus: "Losgekoppeld" }
      : {
          ...existing,
          ...incoming,
          identifier: incoming.identifier?.trim() ?? existing.identifier,
          businessName: incoming.businessName?.trim() ?? existing.businessName,
        };
    const validation = validateReviewSourceIdentifier(next.platform, next.identifier);
    if (!disconnect && validation) {
      return NextResponse.json({ ok: false, error: validation }, { status: 400 });
    }
    const { error: upErr } = await supabase
      .from("clients")
      .update({ review_source_settings: next })
      .eq("id", auth.clientId);
    if (upErr) {
      if (isPostgrestUnknownColumnError(upErr, "review_source_settings")) {
        return NextResponse.json(
          { ok: false, error: "Migratie ontbreekt: voer reviews bron migratie uit." },
          { status: 503 },
        );
      }
      return NextResponse.json({ ok: false, error: upErr.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, settings: toPublicReviewSourceSettings(next) });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Onbekende fout" },
      { status: 503 },
    );
  }
}

export async function POST(_request: Request, context: RouteContext) {
  const auth = await resolveAccess(context);
  if (!auth.ok) return auth.response;
  if (!checkPortalRateLimit(auth.userId, `portal:reviews:sync:${auth.slug}`, 20)) {
    return NextResponse.json({ ok: false, error: "Te veel verzoeken." }, { status: 429 });
  }
  try {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from("clients")
      .select("review_source_settings, review_source_items")
      .eq("id", auth.clientId)
      .maybeSingle();
    if (error) {
      if (
        isPostgrestUnknownColumnError(error, "review_source_settings") ||
        isPostgrestUnknownColumnError(error, "review_source_items")
      ) {
        return NextResponse.json(
          { ok: false, error: "Migratie ontbreekt: voer reviews bron migratie uit." },
          { status: 503 },
        );
      }
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    const settings = parseReviewSourceSettings(data?.review_source_settings);
    const validation = validateReviewSourceIdentifier(settings.platform, settings.identifier);
    if (validation) {
      return NextResponse.json({ ok: false, error: validation }, { status: 400 });
    }
    const syncedAt = new Date().toISOString();
    let items = parseReviewSourceItems(data?.review_source_items);
    let status = "Gesynchroniseerd";
    let businessName = settings.businessName || settings.identifier;

    const liveResult =
      settings.platform === "google"
        ? await fetchGooglePlaceReviews(settings.identifier)
        : await fetchTrustpilotReviews(settings.identifier);

    if (liveResult.ok) {
      items = liveResult.items;
      status = liveResult.status;
      if (liveResult.businessName?.trim()) {
        businessName = liveResult.businessName.trim();
      }
    }

    // Active placeholder source: use latest generator screenshot references for review text first.
    if (!liveResult.ok || items.length === 0) {
      const { data: latestJob } = await supabase
        .from("site_generation_jobs")
        .select("request_json")
        .eq("client_id", auth.clientId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const reqJson = (latestJob?.request_json ?? null) as RequestJsonWithBriefingImages | null;
      const briefingImagesRaw = reqJson?.briefingReferenceImages ?? reqJson?.clientImages ?? [];
      const briefingImages = briefingImagesRaw
        .map((img) => ({ url: String(img?.url ?? "").trim(), label: img?.label?.trim() }))
        .filter((img) => img.url.length > 0);
      const anthropicKey = getAnthropicApiKey();
      if (briefingImages.length > 0 && anthropicKey) {
        try {
          const vision = await extractBriefingReferenceImagesWithVision({
            client: new Anthropic({ apiKey: anthropicKey }),
            model: STUDIO_SITE_GENERATION.supportModel,
            businessName: settings.businessName || settings.identifier,
            descriptionSnippet:
              "Extraheer korte review-zinnen uit deze briefing-screenshots voor tijdelijke website reviews.",
            images: briefingImages.slice(0, 6),
          });
          const extractedItems = buildPlaceholderReviewsFromVisionText({
            platform: settings.platform,
            text: vision.text,
          });
          if (extractedItems.length > 0) {
            items = extractedItems;
          }
        } catch {
          // ignore; we'll keep previous cache if available.
        }
      }
      status = liveResult.ok
        ? status
        : `Live fetch mislukt, fallback actief: ${liveResult.error.slice(0, 140)}`;
    }

    const nextSettings = {
      ...settings,
      enabled: true,
      businessName,
      lastSyncAt: syncedAt,
      lastSyncStatus: status,
    };
    const { error: upErr } = await supabase
      .from("clients")
      .update({
        review_source_settings: nextSettings,
        review_source_items: items,
      })
      .eq("id", auth.clientId);
    if (upErr) {
      return NextResponse.json({ ok: false, error: upErr.message }, { status: 500 });
    }
    return NextResponse.json({
      ok: true,
      settings: toPublicReviewSourceSettings(nextSettings),
      items,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Onbekende fout" },
      { status: 503 },
    );
  }
}
