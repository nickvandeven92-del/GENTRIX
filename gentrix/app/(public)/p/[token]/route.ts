import { type NextRequest, NextResponse } from "next/server";
import { ensureClientPreviewSecret } from "@/lib/data/ensure-client-preview-secret";
import { recordFlyerScanByToken } from "@/lib/data/record-flyer-scan";
import {
  isFlyerPublicTokenFormat,
  resolveFlyerPublicLink,
  type FlyerPublicLinkResolution,
} from "@/lib/data/resolve-flyer-public-link";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { isPostgrestUnknownColumnError } from "@/lib/supabase/postgrest-unknown-column";

type FlyerResolved = NonNullable<FlyerPublicLinkResolution>;

type Ctx = { params: Promise<{ token: string }> };

function json404(code: string, error: string, details?: Record<string, unknown>) {
  return NextResponse.json({ ok: false as const, code, error, ...(details ? { details } : {}) }, { status: 404 });
}

async function respondWithResolution(request: NextRequest, token: string, resolved: FlyerResolved) {
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

export async function GET(request: NextRequest, context: Ctx) {
  const { token: raw } = await context.params;
  const token = raw?.trim() ?? "";
  if (!isFlyerPublicTokenFormat(token)) {
    return json404("ONGELDIG", "Ongeldige flyer-link (geen geldige code).");
  }

  const resolvedFirst = await resolveFlyerPublicLink(token);
  if (resolvedFirst) {
    return respondWithResolution(request, token, resolvedFirst);
  }

  const supabase = createServiceRoleClient();
  /** Geen `preview_secret` in deze select: kolom kan in oudere DB ontbreken — dan geen harde 500. */
  const { data: row, error: rowErr } = await supabase
    .from("clients")
    .select("id, subfolder_slug, status")
    .eq("flyer_public_token", token)
    .maybeSingle();

  if (rowErr && isPostgrestUnknownColumnError(rowErr, "flyer_public_token")) {
    return json404(
      "FLYER_KOLOM_ONTBREEKT",
      "Flyer-links zijn op deze server nog niet geactiveerd (databasekolom ontbreekt). Voer de migratie uit op Supabase.",
    );
  }

  if (rowErr) {
    return NextResponse.json(
      { ok: false as const, code: "DB_FOUT", error: rowErr.message || "Databasefout." },
      { status: 500 },
    );
  }

  if (!row) {
    return json404(
      "CODE_ONBEKEND",
      "Deze flyer-code hoort bij geen klant in deze database. Controleer of je de QR van de juiste omgeving scant, of dat dezelfde Supabase wordt gebruikt als waar de flyer is gemaakt.",
    );
  }

  const slug = String((row as { subfolder_slug: string }).subfolder_slug ?? "").trim();
  const statusNorm = String((row as { status: string }).status ?? "")
    .trim()
    .toLowerCase();

  if (statusNorm === "active" && slug) {
    return respondWithResolution(request, token, { kind: "live", slug });
  }

  const clientId = String((row as { id: string }).id ?? "").trim();
  if (clientId) {
    await ensureClientPreviewSecret(clientId);
    const resolvedRetry = await resolveFlyerPublicLink(token);
    if (resolvedRetry) {
      return respondWithResolution(request, token, resolvedRetry);
    }
  }

  let previewColumnMissing = false;
  if (clientId) {
    const { error: colErr } = await supabase.from("clients").select("preview_secret").eq("id", clientId).maybeSingle();
    previewColumnMissing = Boolean(colErr && isPostgrestUnknownColumnError(colErr, "preview_secret"));
  }

  return json404(
    previewColumnMissing ? "PREVIEW_SECRET_ONTBREEKT" : "NIET_BEREIKBAAR",
    previewColumnMissing
      ? "Kolom `preview_secret` ontbreekt op `clients`. Voer in Supabase de migratie uit: `supabase/migrations/20260410150000_clients_preview_secret.sql` (of: alter table … add column preview_secret text)."
      : "Deze link kan nu niet worden geopend: er is geen geldige preview-token voor dit concept. Sla opnieuw op vanuit de site-studio of controleer `SUPABASE_SERVICE_ROLE_KEY`.",
    {
      clientStatus: (row as { status: string }).status,
      previewSecretColumnMissing: previewColumnMissing,
    },
  );
}
