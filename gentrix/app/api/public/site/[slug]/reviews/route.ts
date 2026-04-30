import { NextResponse } from "next/server";
import { checkPublicRateLimit } from "@/lib/api/public-rate-limit";
import { extractClientIp } from "@/lib/api/request-client-ip";
import { parseReviewSourceItems, parseReviewSourceSettings } from "@/lib/reviews/review-source";
import { decodeRouteSlugParam } from "@/lib/slug";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

type RouteCtx = { params: Promise<{ slug: string }> };

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: RouteCtx) {
  const { slug: raw } = await context.params;
  const slug = decodeRouteSlugParam(raw);
  if (!slug) {
    return NextResponse.json({ ok: false, error: "Ongeldige slug." }, { status: 400 });
  }
  const ip = extractClientIp(request.headers);
  if (!checkPublicRateLimit(ip, `site-reviews:${slug}`, 120)) {
    return NextResponse.json({ ok: false, error: "Te veel verzoeken." }, { status: 429 });
  }
  try {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from("clients")
      .select("review_source_settings, review_source_items")
      .eq("subfolder_slug", slug)
      .eq("status", "active")
      .maybeSingle();
    if (error || !data) {
      return NextResponse.json({ ok: true, items: [] });
    }
    const settings = parseReviewSourceSettings(data.review_source_settings);
    const items = parseReviewSourceItems(data.review_source_items);
    const visible = settings.enabled ? items.slice(0, 12) : [];
    return NextResponse.json({
      ok: true,
      items: visible,
      source: settings.enabled ? settings.platform : "placeholder",
      syncedAt: settings.lastSyncAt,
    });
  } catch {
    return NextResponse.json({ ok: true, items: [] });
  }
}
