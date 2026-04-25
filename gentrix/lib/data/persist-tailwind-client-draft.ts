import { revalidatePublishedSiteBundleCacheForSlug } from "@/lib/data/revalidate-published-site-bundle-cache";
import { STUDIO_GENERATION_PACKAGE } from "@/lib/ai/generation-packages";
import type { DesignGenerationContract } from "@/lib/ai/design-generation-contract";
import type { TailwindSectionsPayload } from "@/lib/ai/tailwind-sections-schema";
import { generateClientNumber } from "@/lib/commercial/document-numbering";
import { attachCompiledTailwindCssToPayloadWithColdStartRetry } from "@/lib/data/tailwind-compiled-css-attach";
import { ensureCanonicalModuleSectionsForCrmFlags } from "@/lib/site/append-booking-section-to-payload";
import {
  projectSnapshotFromTailwindPayload,
  projectSnapshotToJson,
} from "@/lib/site/project-snapshot-io";
import { parseStoredSiteData } from "@/lib/site/parse-stored-site-data";
import { getPersistSiteValidationErrors } from "@/lib/site/site-ir-compose-validation";
import { describeTailwindMarketingNavPayloadIssues } from "@/lib/site/tailwind-marketing-nav-consistency";
import type { PublicSiteModuleFlags } from "@/lib/site/public-site-modules-registry";
import type { ProjectSnapshotFromTailwindOptions } from "@/lib/site/project-snapshot-schema";
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

async function readDesignContractFromExistingSiteJson(
  supabase: Supabase,
  subfolderSlug: string,
): Promise<DesignGenerationContract | null> {
  const { data, error } = await supabase
    .from("clients")
    .select("site_data_json")
    .eq("subfolder_slug", subfolderSlug)
    .maybeSingle();
  if (error || !data) return null;
  const raw = (data as { site_data_json?: unknown }).site_data_json;
  const parsed = raw != null ? parseStoredSiteData(raw) : null;
  return parsed?.kind === "tailwind" && parsed.designContract != null ? parsed.designContract : null;
}

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
    /** Optioneel: blueprint / branche voor `siteIr` in project_snapshot_v1. */
    siteIrHints?: ProjectSnapshotFromTailwindOptions["siteIrHints"];
    /** Optioneel: zet `project_snapshot_v1.designContract`. Weggelaten: overname uit huidige `site_data_json`. */
    designContract?: DesignGenerationContract;
    /** Optioneel: voorkomt extra DB-read; gebruikt voor IR/CRM-compose-validatie. */
    moduleFlags?: PublicSiteModuleFlags;
  },
): Promise<PersistTailwindDraftResult> {
  const generationSource =
    options.snapshotSource === "generator"
      ? "generator"
      : options.snapshotSource === "ai_command"
        ? "ai_command"
        : "editor";

  let flags: PublicSiteModuleFlags =
    options.moduleFlags ?? { appointmentsEnabled: false, webshopEnabled: false };
  if (!options.moduleFlags) {
    const { data: modRow } = await supabase
      .from("clients")
      .select("appointments_enabled, webshop_enabled")
      .eq("subfolder_slug", existing.subfolder_slug)
      .maybeSingle();
    flags = {
      appointmentsEnabled: Boolean((modRow as { appointments_enabled?: boolean } | null)?.appointments_enabled),
      webshopEnabled: Boolean((modRow as { webshop_enabled?: boolean } | null)?.webshop_enabled),
    };
  }

  const docTitle = options.documentTitle?.trim() || existing.name?.trim() || "Website";
  const withCss = await attachCompiledTailwindCssToPayloadWithColdStartRetry(tailwindPayload, docTitle);
  const withCanonicalModules = ensureCanonicalModuleSectionsForCrmFlags(withCss, flags);
  const navPayloadIssue = describeTailwindMarketingNavPayloadIssues({
    sections: withCanonicalModules.sections,
    contactSections: withCanonicalModules.contactSections,
    marketingPages: withCanonicalModules.marketingPages,
  });
  if (navPayloadIssue) {
    return { ok: false, error: navPayloadIssue, status: 422 };
  }

  let designContractForSnapshot: DesignGenerationContract | undefined = options.designContract;
  if (designContractForSnapshot === undefined) {
    const fromExisting = await readDesignContractFromExistingSiteJson(supabase, existing.subfolder_slug);
    if (fromExisting != null) designContractForSnapshot = fromExisting;
  }

  const snapshot = projectSnapshotFromTailwindPayload(withCanonicalModules, {
    generationSource,
    documentTitle: docTitle,
    ...(options.siteIrHints != null ? { siteIrHints: options.siteIrHints } : {}),
    ...(designContractForSnapshot != null ? { designContract: designContractForSnapshot } : {}),
  });

  const persistErrors = getPersistSiteValidationErrors(snapshot, flags);
  if (persistErrors.length > 0) {
    return { ok: false, error: persistErrors.join(" "), status: 422 };
  }

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
      revalidatePublishedSiteBundleCacheForSlug(existing.subfolder_slug);
      return { ok: true, snapshot_id: snapRow.id };
    }
    return { ok: false, error: `Pointers bijwerken mislukt: ${ptrErr.message}`, status: 500 };
  }

  revalidatePublishedSiteBundleCacheForSlug(existing.subfolder_slug);
  return { ok: true, snapshot_id: snapRow.id };
}
