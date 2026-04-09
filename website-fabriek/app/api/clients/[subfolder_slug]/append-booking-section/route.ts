import { NextResponse } from "next/server";
import { z } from "zod";
import { persistTailwindDraftForExistingClient } from "@/lib/data/persist-tailwind-client-draft";
import { resolveDraftSitePayloadJson } from "@/lib/data/resolve-site-payload-json";
import { requireAdminApiAuth } from "@/lib/auth/require-admin-api";
import type { TailwindSectionsPayload } from "@/lib/ai/tailwind-sections-schema";
import { isValidSubfolderSlug } from "@/lib/slug";
import { appendDefaultBookingSectionToSections } from "@/lib/site/append-booking-section-to-payload";
import { parseStoredSiteData } from "@/lib/site/parse-stored-site-data";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

type RouteContext = { params: Promise<{ subfolder_slug: string }> };

const bodySchema = z
  .object({
    replace_existing: z.boolean().optional(),
    headline: z.string().min(1).max(200).optional(),
  })
  .strict();

/**
 * Voegt alleen de canonieke booking-sectie toe aan de huidige draft-site (geen AI / geen volledige regenerate).
 */
export async function POST(request: Request, context: RouteContext) {
  const auth = await requireAdminApiAuth();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.message }, { status: auth.status });
  }

  const { subfolder_slug: raw } = await context.params;
  const subfolder_slug = decodeURIComponent(raw);
  if (!isValidSubfolderSlug(subfolder_slug)) {
    return NextResponse.json({ ok: false, error: "Ongeldige slug." }, { status: 400 });
  }

  let bodyJson: unknown = {};
  try {
    const text = await request.text();
    if (text.trim()) bodyJson = JSON.parse(text);
  } catch {
    return NextResponse.json({ ok: false, error: "Ongeldige JSON-body." }, { status: 400 });
  }

  const parsedBody = bodySchema.safeParse(bodyJson);
  if (!parsedBody.success) {
    return NextResponse.json(
      { ok: false, error: parsedBody.error.issues.map((i) => i.message).join(" ") },
      { status: 400 },
    );
  }

  try {
    const supabase = createServiceRoleClient();
    const { data: clientRow, error: fetchErr } = await supabase
      .from("clients")
      .select(
        "id, name, description, subfolder_slug, status, site_data_json, draft_snapshot_id, client_number, generation_package",
      )
      .eq("subfolder_slug", subfolder_slug)
      .maybeSingle();

    if (fetchErr) {
      return NextResponse.json({ ok: false, error: fetchErr.message }, { status: 500 });
    }
    if (!clientRow) {
      return NextResponse.json({ ok: false, error: "Klant niet gevonden." }, { status: 404 });
    }

    const payloadJson = await resolveDraftSitePayloadJson({
      site_data_json: clientRow.site_data_json,
      draft_snapshot_id: clientRow.draft_snapshot_id ?? null,
      published_snapshot_id: null,
    });

    const siteParsed = parseStoredSiteData(payloadJson);
    if (!siteParsed || siteParsed.kind !== "tailwind") {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Alleen Tailwind-studio sites ondersteunen dit. Gebruik voor legacy/React-sites de volledige studio-upgrade.",
        },
        { status: 422 },
      );
    }

    const merged = appendDefaultBookingSectionToSections(siteParsed.sections, {
      replaceExisting: parsedBody.data.replace_existing === true,
      headline: parsedBody.data.headline,
    });

    if (!merged.ok) {
      return NextResponse.json(
        {
          ok: false,
          code: "booking_exists",
          error:
            'Er staat al een sectie met id "booking". Stuur replace_existing: true om die te vervangen door de standaard-blok.',
        },
        { status: 409 },
      );
    }

    const twPayload: TailwindSectionsPayload = {
      format: "tailwind_sections",
      sections: merged.sections,
      ...(siteParsed.config ? { config: siteParsed.config } : {}),
      ...(siteParsed.pageType != null ? { pageType: siteParsed.pageType } : {}),
      customCss: siteParsed.customCss ?? "",
      customJs: siteParsed.customJs ?? "",
      ...(siteParsed.logoSet != null ? { logoSet: siteParsed.logoSet } : {}),
    };

    const persist = await persistTailwindDraftForExistingClient(
      supabase,
      {
        id: clientRow.id,
        name: clientRow.name,
        description: clientRow.description,
        subfolder_slug: clientRow.subfolder_slug,
        status: clientRow.status,
        draft_snapshot_id: clientRow.draft_snapshot_id ?? null,
        client_number: clientRow.client_number,
        generation_package: clientRow.generation_package,
      },
      twPayload,
      {
        snapshotSource: "editor",
        snapshotLabel: merged.replaced ? "Booking-sectie vervangen (standaard)" : "Booking-sectie toegevoegd (standaard)",
        snapshotNotes: "Zonder AI — vast sjabloon met __STUDIO_BOOKING_PATH__",
      },
    );

    if (!persist.ok) {
      return NextResponse.json({ ok: false, error: persist.error }, { status: persist.status });
    }

    return NextResponse.json({
      ok: true,
      data: {
        snapshot_id: persist.snapshot_id,
        replaced: merged.replaced,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Onbekende fout";
    if (message.includes("SUPABASE_SERVICE_ROLE_KEY")) {
      return NextResponse.json(
        { ok: false, error: "SUPABASE_SERVICE_ROLE_KEY ontbreekt in .env.local (server-only)." },
        { status: 503 },
      );
    }
    return NextResponse.json({ ok: false, error: message }, { status: 503 });
  }
}
