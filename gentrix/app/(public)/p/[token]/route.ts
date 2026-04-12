import { type NextRequest, NextResponse } from "next/server";
import { ensureClientPreviewSecretBySlug } from "@/lib/data/ensure-client-preview-secret";
import { recordFlyerScanByToken } from "@/lib/data/record-flyer-scan";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { isPostgrestUnknownColumnError } from "@/lib/supabase/postgrest-unknown-column";
import { isFlyerPublicTokenFormat, resolveFlyerPublicLink } from "@/lib/data/resolve-flyer-public-link";

type Ctx = { params: Promise<{ token: string }> };

export async function GET(request: NextRequest, context: Ctx) {
  const { token: raw } = await context.params;
  const token = raw?.trim() ?? "";
  if (!isFlyerPublicTokenFormat(token)) {
    return NextResponse.json({ ok: false, error: "Ongeldige link." }, { status: 404 });
  }

  let resolved = await resolveFlyerPublicLink(token);
  if (!resolved) {
    try {
      const supabase = createServiceRoleClient();
      const { data, error } = await supabase
        .from("clients")
        .select("subfolder_slug, status")
        .eq("flyer_public_token", token)
        .maybeSingle();
      if (!error && data && (data as { status: string }).status !== "active") {
        const slug = String((data as { subfolder_slug: string }).subfolder_slug ?? "").trim();
        if (slug) {
          await ensureClientPreviewSecretBySlug(slug);
          resolved = await resolveFlyerPublicLink(token);
        }
      }
      if (error && isPostgrestUnknownColumnError(error, "flyer_public_token")) {
        return NextResponse.json({ ok: false, error: "Niet gevonden." }, { status: 404 });
      }
    } catch {
      return NextResponse.json({ ok: false, error: "Niet gevonden." }, { status: 404 });
    }
  }

  if (!resolved) {
    return NextResponse.json({ ok: false, error: "Niet gevonden." }, { status: 404 });
  }

  await recordFlyerScanByToken({
    flyerPublicToken: token,
    userAgent: request.headers.get("user-agent"),
    referer: request.headers.get("referer"),
  });

  const origin = request.nextUrl.origin;
  const enc = encodeURIComponent(resolved.slug);

  if (resolved.kind === "live") {
    return NextResponse.redirect(new URL(`/site/${enc}`, origin), 302);
  }

  const u = new URL(`/site/${enc}`, origin);
  u.searchParams.set("token", resolved.previewSecret);
  u.searchParams.set("flyer", "1");
  return NextResponse.redirect(u, 302);
}
