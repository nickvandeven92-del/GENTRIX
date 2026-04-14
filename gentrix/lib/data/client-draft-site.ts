import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { isPostgrestUnknownColumnError } from "@/lib/supabase/postgrest-unknown-column";
import { resolveDraftSitePayloadJson } from "@/lib/data/resolve-site-payload-json";
import { ensureTailwindCompiledCssOnPublishedPayload } from "@/lib/data/tailwind-compiled-css-attach";
import {
  publishedPayloadFromSiteJson,
  type PublishedSitePayload,
} from "@/lib/site/project-published-payload";
import { parseStoredSiteData, type ParsedStoredSite } from "@/lib/site/parse-stored-site-data";

async function fetchClientDraftRow(slug: string): Promise<{
  site_data_json: unknown;
  draft_snapshot_id: string | null;
  published_snapshot_id: string | null;
  name: string;
  generation_package: string | null;
} | null> {
  const supabase = createServiceRoleClient();
  const selectFull =
    "site_data_json, draft_snapshot_id, published_snapshot_id, name, generation_package";
  let { data, error } = await supabase
    .from("clients")
    .select(selectFull)
    .eq("subfolder_slug", slug)
    .maybeSingle();

  if (error && isPostgrestUnknownColumnError(error, "draft_snapshot_id")) {
    const second = await supabase
      .from("clients")
      .select("site_data_json, name, generation_package")
      .eq("subfolder_slug", slug)
      .maybeSingle();
    if (second.error || !second.data) return null;
    data = {
      ...second.data,
      draft_snapshot_id: null,
      published_snapshot_id: null,
    };
    error = null;
  }

  if (error && isPostgrestUnknownColumnError(error, "published_snapshot_id")) {
    const second = await supabase
      .from("clients")
      .select("site_data_json, draft_snapshot_id, name, generation_package")
      .eq("subfolder_slug", slug)
      .maybeSingle();
    if (second.error || !second.data) return null;
    data = { ...second.data, published_snapshot_id: null };
    error = null;
  }

  if (error || !data) return null;
  const row = data as {
    site_data_json: unknown;
    draft_snapshot_id?: string | null;
    published_snapshot_id?: string | null;
    name: string;
    generation_package?: string | null;
  };
  return {
    site_data_json: row.site_data_json,
    draft_snapshot_id: row.draft_snapshot_id ?? null,
    published_snapshot_id: row.published_snapshot_id ?? null,
    name: row.name,
    generation_package: row.generation_package ?? null,
  };
}

/** Ruwe JSON (zelfde vorm als `site_data_json`) — o.a. voor `serializeExistingSiteForUpgradePrompt`. */
export async function getDraftSiteJsonBySlug(slug: string): Promise<unknown | null> {
  try {
    const row = await fetchClientDraftRow(slug);
    if (!row) return null;
    return resolveDraftSitePayloadJson({
      site_data_json: row.site_data_json,
      draft_snapshot_id: row.draft_snapshot_id,
      published_snapshot_id: row.published_snapshot_id,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("SUPABASE_SERVICE_ROLE_KEY")) return null;
    throw e;
  }
}

/**
 * Werkversie site-data voor editor / ZIP-export (service role — snapshots).
 */
export async function getParsedSiteDraftBySlug(slug: string): Promise<ParsedStoredSite | null> {
  try {
    const row = await fetchClientDraftRow(slug);
    if (!row) return null;
    const raw = await resolveDraftSitePayloadJson({
      site_data_json: row.site_data_json,
      draft_snapshot_id: row.draft_snapshot_id,
      published_snapshot_id: row.published_snapshot_id,
    });
    const parsed = parseStoredSiteData(raw);
    if (!parsed || parsed.kind !== "tailwind") return parsed;
    if (parsed.tailwindCompiledCss != null && parsed.tailwindCompiledCss.trim() !== "") return parsed;
    const payload = publishedPayloadFromSiteJson(raw, row.name, row.generation_package);
    if (!payload || payload.kind !== "tailwind") return parsed;
    const ensured = await ensureTailwindCompiledCssOnPublishedPayload(payload, row.name);
    if (
      ensured.kind !== "tailwind" ||
      ensured.tailwindCompiledCss == null ||
      ensured.tailwindCompiledCss.trim() === ""
    ) {
      return parsed;
    }
    return { ...parsed, tailwindCompiledCss: ensured.tailwindCompiledCss };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("SUPABASE_SERVICE_ROLE_KEY")) return null;
    throw e;
  }
}

/** Admin preview: zelfde render-pad als live, maar data uit concept-snapshot. */
export async function getDraftPublishedSitePayloadBySlug(slug: string): Promise<PublishedSitePayload | null> {
  try {
    const row = await fetchClientDraftRow(slug);
    if (!row) return null;
    const raw = await resolveDraftSitePayloadJson({
      site_data_json: row.site_data_json,
      draft_snapshot_id: row.draft_snapshot_id,
      published_snapshot_id: row.published_snapshot_id,
    });
    const payload = publishedPayloadFromSiteJson(raw, row.name, row.generation_package);
    if (!payload) return null;
    return ensureTailwindCompiledCssOnPublishedPayload(payload, row.name);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("SUPABASE_SERVICE_ROLE_KEY")) return null;
    throw e;
  }
}
