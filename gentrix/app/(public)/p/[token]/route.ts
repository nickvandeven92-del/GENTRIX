import { type NextRequest, NextResponse } from "next/server";
import { recordFlyerScanByToken } from "@/lib/data/record-flyer-scan";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { isPostgrestUnknownColumnError } from "@/lib/supabase/postgrest-unknown-column";
import { isFlyerPublicTokenFormat, resolveFlyerPublicLink } from "@/lib/data/resolve-flyer-public-link";

type Ctx = { params: Promise<{ token: string }> };

function json404(code: string, error: string) {
  return NextResponse.json({ ok: false as const, code, error }, { status: 404 });
}

export async function GET(request: NextRequest, context: Ctx) {
  const { token: raw } = await context.params;
  const token = raw?.trim() ?? "";
  if (!isFlyerPublicTokenFormat(token)) {
    return json404("ONGELDIG", "Ongeldige flyer-link (geen geldige code).");
  }

  const resolved = await resolveFlyerPublicLink(token);

  if (resolved) {
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

  const supabase = createServiceRoleClient();
  const { data: probeRow, error: probeErr } = await supabase
    .from("clients")
    .select("id")
    .eq("flyer_public_token", token)
    .maybeSingle();

  if (probeErr && isPostgrestUnknownColumnError(probeErr, "flyer_public_token")) {
    return json404(
      "FLYER_KOLOM_ONTBREEKT",
      "Flyer-links zijn op deze server nog niet geactiveerd (databasekolom ontbreekt). Voer de migratie uit op Supabase.",
    );
  }

  if (probeErr) {
    return NextResponse.json(
      { ok: false as const, code: "DB_FOUT", error: probeErr.message || "Databasefout." },
      { status: 500 },
    );
  }

  if (!probeRow) {
    return json404(
      "CODE_ONBEKEND",
      "Deze flyer-code hoort bij geen klant in deze database. Controleer of je de QR van de juiste omgeving scant, of dat dezelfde Supabase wordt gebruikt als waar de flyer is gemaakt.",
    );
  }

  return json404(
    "NIET_BEREIKBAAR",
    "Deze link kan nu niet worden geopend (bijv. concept zonder werkende preview). Open de site vanuit de admin of sla het concept opnieuw op.",
  );
}
