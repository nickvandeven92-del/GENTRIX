import { STUDIO_GENERATION_PACKAGE } from "@/lib/ai/generation-packages";
import type { TailwindSectionsPayload } from "@/lib/ai/tailwind-sections-schema";
import { generateClientNumber } from "@/lib/commercial/document-numbering";
import {
  projectSnapshotFromTailwindPayload,
  projectSnapshotToJson,
} from "@/lib/site/project-snapshot-io";
import { mapSnapshotSourceToCreatedBy } from "@/lib/site/snapshot-created-by";
import type { SiteSnapshotSource } from "@/lib/site/site-project-model";
import { isPostgrestUnknownColumnError } from "@/lib/supabase/postgrest-unknown-column";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import type { Json } from "@/lib/types/database";

export type PersistTailwindDraftResult =
  | { ok: true; snapshot_id: string }
  | { ok: false; error: string; status: number };

type Supabase = ReturnType<typeof createServiceRoleClient>;

type ExistingClientRow = {
  id: string;
  name: string;
  description: string | null;
  subfolder_slug: string;
  status: string;
  draft_snapshot_id: string | null;
  client_number?: string | null;
  generation_package?: string | null;
};

/**
 * Schrijft Tailwind-payload naar `clients.site_data_json` + nieuwe draft-snapshot (zelfde pad als `POST /api/clients`).
 */
export async function persistTailwindDraftForExistingClient(
  supabase: Supabase,
  existing: ExistingClientRow,
  tailwindPayload: TailwindSectionsPayload,
  options: {
    snapshotSource: SiteSnapshotSource;
    snapshotLabel?: string | null;
    snapshotNotes?: string | null;
    documentTitle?: string;
  },
): Promise<PersistTailwindDraftResult> {
  const generationSource =
    options.snapshotSource === "generator"
      ? "generator"
      : options.snapshotSource === "ai_command"
        ? "ai_command"
        : "editor";

  const snapshot = projectSnapshotFromTailwindPayload(tailwindPayload, {
    generationSource,
    documentTitle: options.documentTitle?.trim() || existing.name?.trim(),
  });
  const jsonToStore = projectSnapshotToJson(snapshot) as Json;

  const { data: existingForNumber, error: exNumErr } = await supabase
    .from("clients")
    .select("client_number")
    .eq("subfolder_slug", existing.subfolder_slug)
    .maybeSingle();

  let clientNumberPayload: { client_number?: string } = {};
  if (exNumErr && isPostgrestUnknownColumnError(exNumErr, "client_number")) {
    /* migratie nog niet uitgevoerd */
  } else if (exNumErr) {
    return { ok: false, error: exNumErr.message, status: 500 };
  } else {
    const existingNum = (existingForNumber as { client_number?: string | null } | null)?.client_number?.trim();
    if (existingNum) {
      clientNumberPayload = { client_number: existingNum };
    } else {
      try {
        clientNumberPayload = { client_number: await generateClientNumber(supabase) };
      } catch (e) {
        return {
          ok: false,
          error: e instanceof Error ? e.message : "Klantnummer genereren mislukt.",
          status: 500,
        };
      }
    }
  }

  const genPkg =
    existing.generation_package?.trim() && existing.generation_package.trim().length > 0
      ? existing.generation_package.trim()
      : STUDIO_GENERATION_PACKAGE;

  const row = {
    name: existing.name,
    description: existing.description ?? null,
    subfolder_slug: existing.subfolder_slug,
    site_data_json: jsonToStore,
    status: existing.status,
    generation_package: genPkg,
    ...clientNumberPayload,
  };

  const { error: upErr } = await supabase.from("clients").upsert(row, { onConflict: "subfolder_slug" });
  if (upErr) {
    return { ok: false, error: upErr.message, status: 500 };
  }

  let { data, error } = await supabase
    .from("clients")
    .select("id, subfolder_slug, status, draft_snapshot_id")
    .eq("subfolder_slug", existing.subfolder_slug)
    .single();

  if (error && isPostgrestUnknownColumnError(error, "draft_snapshot_id")) {
    const second = await supabase
      .from("clients")
      .select("id, subfolder_slug, status")
      .eq("subfolder_slug", existing.subfolder_slug)
      .single();
    if (second.error || !second.data) {
      return {
        ok: false,
        error: second.error?.message ?? "Klant niet gevonden na upsert.",
        status: 500,
      };
    }
    data = { ...second.data, draft_snapshot_id: null };
    error = null;
  }

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Klant niet gevonden na upsert.", status: 500 };
  }

  const snapshotSource = options.snapshotSource;
  const label = options.snapshotLabel?.trim() || null;
  const notes = options.snapshotNotes?.trim() || null;
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
    return {
      ok: false,
      error: `Snapshot opslaan mislukt (${snapErr?.message ?? "onbekend"}). Voer de Supabase-migraties voor site_snapshots uit.`,
      status: 500,
    };
  }

  const pointerUpdate = { draft_snapshot_id: snapRow.id };
  const { error: ptrErr } = await supabase.from("clients").update(pointerUpdate).eq("id", data.id);

  if (ptrErr) {
    if (isPostgrestUnknownColumnError(ptrErr, "draft_snapshot_id")) {
      return { ok: true, snapshot_id: snapRow.id };
    }
    return { ok: false, error: `Pointers bijwerken mislukt: ${ptrErr.message}`, status: 500 };
  }

  return { ok: true, snapshot_id: snapRow.id };
}
