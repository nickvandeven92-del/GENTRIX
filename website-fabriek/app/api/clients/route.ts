import { NextResponse } from "next/server";
import { z } from "zod";
import { STUDIO_GENERATION_PACKAGE } from "@/lib/ai/generation-packages";
import { requireAdminApiAuth } from "@/lib/auth/require-admin-api";
import { isValidSubfolderSlug } from "@/lib/slug";
import { tailwindSectionsPayloadSchema } from "@/lib/ai/tailwind-sections-schema";
import { parseStoredSiteData } from "@/lib/site/parse-stored-site-data";
import { generateClientNumber } from "@/lib/commercial/document-numbering";
import { syncKameleonShopTenant } from "@/lib/shop/sync-kameleon-tenant";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { isPostgrestUnknownColumnError } from "@/lib/supabase/postgrest-unknown-column";
import type { Json } from "@/lib/types/database";
import { mapSnapshotSourceToCreatedBy } from "@/lib/site/snapshot-created-by";
import type { SiteSnapshotSource } from "@/lib/site/site-project-model";

const bodySchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(4000).optional().nullable(),
  subfolder_slug: z.string().min(1).max(64),
  site_data_json: z.unknown(),
  status: z.enum(["draft", "active", "paused", "archived"]).optional(),
  snapshot_source: z.enum(["editor", "generator", "ai_command"]).optional(),
  /** Fase 4: optionele metadata op de snapshot-rij. */
  snapshot_label: z.string().max(200).optional().nullable(),
  snapshot_notes: z.string().max(4000).optional().nullable(),
});

export async function POST(request: Request) {
  const auth = await requireAdminApiAuth();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.message }, { status: auth.status });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Ongeldige JSON-body." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues.map((i) => i.message).join(" ") },
      { status: 400 },
    );
  }

  if (!isValidSubfolderSlug(parsed.data.subfolder_slug)) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Ongeldige URL-slug: alleen kleine letters, cijfers en koppeltekens; 2–64 tekens.",
      },
      { status: 400 },
    );
  }

  const siteParsed = parseStoredSiteData(parsed.data.site_data_json);
  if (!siteParsed) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "site_data_json: ongeldig of onbekend. Vereist tailwind_sections (aanbevolen), react_sections of erkende legacy JSON.",
      },
      { status: 400 },
    );
  }

  let jsonToStore: Json;
  if (siteParsed.kind === "react") {
    jsonToStore = siteParsed.doc as unknown as Json;
  } else if (siteParsed.kind === "tailwind") {
    const twParsed = tailwindSectionsPayloadSchema.safeParse({
      format: "tailwind_sections",
      sections: siteParsed.sections,
      ...(siteParsed.config != null ? { config: siteParsed.config } : {}),
      ...(siteParsed.pageType != null ? { pageType: siteParsed.pageType } : {}),
      ...(siteParsed.customCss != null && siteParsed.customCss !== "" ? { customCss: siteParsed.customCss } : {}),
      ...(siteParsed.customJs != null && siteParsed.customJs !== "" ? { customJs: siteParsed.customJs } : {}),
      ...(siteParsed.logoSet != null ? { logoSet: siteParsed.logoSet } : {}),
    });
    if (!twParsed.success) {
      return NextResponse.json(
        { ok: false, error: `tailwind_sections ongeldig: ${twParsed.error.message}` },
        { status: 400 },
      );
    }
    jsonToStore = twParsed.data as unknown as Json;
  } else {
    jsonToStore = siteParsed.site as unknown as Json;
  }

  try {
    const supabase = createServiceRoleClient();

    const { data: existingForNumber, error: exNumErr } = await supabase
      .from("clients")
      .select("client_number")
      .eq("subfolder_slug", parsed.data.subfolder_slug)
      .maybeSingle();

    let clientNumberPayload: { client_number?: string } = {};
    if (exNumErr && isPostgrestUnknownColumnError(exNumErr, "client_number")) {
      /* migratie nog niet uitgevoerd */
    } else if (exNumErr) {
      return NextResponse.json({ ok: false, error: exNumErr.message }, { status: 500 });
    } else {
      const existingNum = (existingForNumber as { client_number?: string | null } | null)?.client_number?.trim();
      if (existingNum) {
        clientNumberPayload = { client_number: existingNum };
      } else {
        try {
          clientNumberPayload = { client_number: await generateClientNumber(supabase) };
        } catch (e) {
          return NextResponse.json(
            { ok: false, error: e instanceof Error ? e.message : "Klantnummer genereren mislukt." },
            { status: 500 },
          );
        }
      }
    }

    const row = {
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      subfolder_slug: parsed.data.subfolder_slug,
      site_data_json: jsonToStore,
      status: parsed.data.status ?? "draft",
      generation_package: STUDIO_GENERATION_PACKAGE,
      ...clientNumberPayload,
    };

    const { error: upErr } = await supabase.from("clients").upsert(row, { onConflict: "subfolder_slug" });
    if (upErr) {
      return NextResponse.json({ ok: false, error: upErr.message }, { status: 500 });
    }

    let { data, error } = await supabase
      .from("clients")
      .select("id, subfolder_slug, status, draft_snapshot_id")
      .eq("subfolder_slug", parsed.data.subfolder_slug)
      .single();

    if (error && isPostgrestUnknownColumnError(error, "draft_snapshot_id")) {
      const second = await supabase
        .from("clients")
        .select("id, subfolder_slug, status")
        .eq("subfolder_slug", parsed.data.subfolder_slug)
        .single();
      if (second.error || !second.data) {
        return NextResponse.json({ ok: false, error: second.error?.message ?? "Klant niet gevonden na upsert." }, { status: 500 });
      }
      data = { ...second.data, draft_snapshot_id: null };
      error = null;
    }

    if (error || !data) {
      return NextResponse.json({ ok: false, error: error?.message ?? "Klant niet gevonden na upsert." }, { status: 500 });
    }

    const snapshotSource = (parsed.data.snapshot_source ?? "editor") as SiteSnapshotSource;
    const label = parsed.data.snapshot_label?.trim() || null;
    const notes = parsed.data.snapshot_notes?.trim() || null;
    const createdBy = mapSnapshotSourceToCreatedBy(snapshotSource);

    let snapRes = await supabase
      .from("site_snapshots")
      .insert({
        client_id: data.id,
        source: snapshotSource,
        created_by: createdBy,
        label,
        notes,
        payload_json: jsonToStore,
        parent_snapshot_id: data.draft_snapshot_id ?? null,
      })
      .select("id")
      .single();

    if (
      snapRes.error &&
      (isPostgrestUnknownColumnError(snapRes.error, "created_by") ||
        isPostgrestUnknownColumnError(snapRes.error, "label"))
    ) {
      snapRes = await supabase
        .from("site_snapshots")
        .insert({
          client_id: data.id,
          source: snapshotSource,
          payload_json: jsonToStore,
          parent_snapshot_id: data.draft_snapshot_id ?? null,
        })
        .select("id")
        .single();
    }

    const snapRow = snapRes.data;
    const snapErr = snapRes.error;

    if (snapErr || !snapRow) {
      return NextResponse.json(
        {
          ok: false,
          error: `Snapshot opslaan mislukt (${snapErr?.message ?? "onbekend"}). Voer de Supabase-migraties voor site_snapshots uit.`,
        },
        { status: 500 },
      );
    }

    /** Fase 3: alleen concept bijwerken; live = expliciete publish-actie (`POST .../publish`). */
    const pointerUpdate = { draft_snapshot_id: snapRow.id };

    const { error: ptrErr } = await supabase.from("clients").update(pointerUpdate).eq("id", data.id);

    if (ptrErr) {
      if (isPostgrestUnknownColumnError(ptrErr, "draft_snapshot_id")) {
        const kameleon_shop_sync = await syncKameleonShopTenant({
          subfolderSlug: parsed.data.subfolder_slug,
          displayName: parsed.data.name,
          webshopEnabled: false,
        });
        return NextResponse.json({
          ok: true,
          data: { id: data.id, subfolder_slug: data.subfolder_slug, status: data.status, snapshot_id: snapRow.id },
          kameleon_shop_sync,
        });
      }
      return NextResponse.json(
        { ok: false, error: `Pointers bijwerken mislukt: ${ptrErr.message}` },
        { status: 500 },
      );
    }

    const kameleon_shop_sync = await syncKameleonShopTenant({
      subfolderSlug: parsed.data.subfolder_slug,
      displayName: parsed.data.name,
      webshopEnabled: false,
    });

    return NextResponse.json({
      ok: true,
      data: { ...data, snapshot_id: snapRow.id },
      kameleon_shop_sync,
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
