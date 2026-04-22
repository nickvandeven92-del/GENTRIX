import { NextResponse } from "next/server";
import { requireStudioAdminApiAuth } from "@/lib/auth/require-studio-admin-api";
import { getParsedSiteDraftBySlug } from "@/lib/data/client-draft-site";
import { getAdminClientBySlug } from "@/lib/data/get-admin-client-by-slug";
import { isValidSubfolderSlug } from "@/lib/slug";
import { buildFtpWebsiteZipBuffer } from "@/lib/site/build-ftp-website-zip";

type RouteContext = { params: Promise<{ subfolder_slug: string }> };

function safeZipBaseName(slug: string): string {
  const s = slug.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, "");
  return s.length >= 2 ? s : "site";
}

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireStudioAdminApiAuth();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.message }, { status: auth.status });
  }

  const { subfolder_slug: raw } = await context.params;
  const subfolder_slug = decodeURIComponent(raw);

  if (!isValidSubfolderSlug(subfolder_slug)) {
    return NextResponse.json({ ok: false, error: "Ongeldige slug." }, { status: 400 });
  }

  const row = await getAdminClientBySlug(subfolder_slug);
  if (!row) {
    return NextResponse.json({ ok: false, error: "Klant niet gevonden." }, { status: 404 });
  }

  const parsed = await getParsedSiteDraftBySlug(subfolder_slug);
  if (!parsed || parsed.kind !== "tailwind") {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Export als ZIP is alleen beschikbaar voor sites in het Tailwind-sectieformaat. Sla de site op vanuit de editor of regenereer in de Site studio, of gebruik de oude workflow handmatig.",
      },
      { status: 422 },
    );
  }

  const title = row.name?.trim() || subfolder_slug;
  const projectRoot = process.cwd();

  let zipBuffer: Buffer;
  try {
    zipBuffer = await buildFtpWebsiteZipBuffer({
      projectRoot,
      sections: parsed.sections,
      config: parsed.config ?? null,
      docTitle: title,
      customCss: parsed.customCss,
      customJs: parsed.customJs,
      logoSet: parsed.logoSet,
      subfolderSlug: subfolder_slug,
      appointmentsEnabled: row.appointments_enabled ?? false,
      webshopEnabled: row.webshop_enabled ?? false,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Onbekende fout bij ZIP-export.";
    return NextResponse.json(
      {
        ok: false,
        error: `Exporteren mislukt (${msg}). Controleer of @tailwindcss/cli werkt en probeer opnieuw.`,
      },
      { status: 500 },
    );
  }

  const base = safeZipBaseName(subfolder_slug);
  const filename = `${base}-website.zip`;

  return new NextResponse(new Uint8Array(zipBuffer), {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
