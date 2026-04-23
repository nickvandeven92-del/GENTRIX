import { revalidateTag } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { injectTailwindCompiledCssIntoStoredPayloadJson } from "@/lib/data/inject-tailwind-compiled-css-into-stored-json";

function publishedSiteSlugTag(slug: string): string {
  return `published-site:${slug}`;
}

export type PersistPublicTailwindCompiledCssInput = {
  subfolderSlug: string;
  /** Concept-token route: draft-bron; live: published-bron. */
  conceptAccess: boolean;
  draftSnapshotId: string | null;
  publishedSnapshotId: string | null;
  /** Huidige `clients.site_data_json` (fallback-bron als er geen snapshot-id is). */
  siteDataJson: unknown;
  tailwindCompiledCss: string;
};

/**
 * Schrijft server-gecompileerde Tailwind-CSS terug naar dezelfde bron als `resolveDraftSitePayloadJson` /
 * `resolvePublishedSitePayloadJson` — zodat volgende page loads geen CLI-build + geen Play CDN nodig hebben.
 * Best-effort: fouten worden genegeerd (preview mag nooit 500’en).
 */
export async function persistPublicTailwindCompiledCssBestEffort(
  input: PersistPublicTailwindCompiledCssInput,
): Promise<void> {
  const css = input.tailwindCompiledCss.trim();
  if (!css) return;

  const draft = input.draftSnapshotId?.trim() || null;
  const published = input.publishedSnapshotId?.trim() || null;

  let snapshotId: string | null = null;
  if (input.conceptAccess) {
    snapshotId = draft;
  } else {
    snapshotId = published;
  }

  const useSiteDataOnly = !snapshotId;

  try {
    const supabase = createServiceRoleClient();

    const { data: clientRow, error: clientErr } = await supabase
      .from("clients")
      .select("id")
      .eq("subfolder_slug", input.subfolderSlug)
      .maybeSingle();
    if (clientErr || !clientRow?.id) return;
    const clientId = String((clientRow as { id: string }).id);

    if (!useSiteDataOnly) {
      const { data: snapRow, error: snapErr } = await supabase
        .from("site_snapshots")
        .select("payload_json, client_id")
        .eq("id", snapshotId!)
        .maybeSingle();

      if (snapErr || !snapRow) return;
      if (String((snapRow as { client_id?: string }).client_id ?? "") !== clientId) return;

      const merged = injectTailwindCompiledCssIntoStoredPayloadJson(
        (snapRow as { payload_json?: unknown }).payload_json,
        css,
      );
      if (!merged) return;

      const { error: upErr } = await supabase.from("site_snapshots").update({ payload_json: merged }).eq("id", snapshotId!);
      if (upErr) return;
    } else {
      const merged = injectTailwindCompiledCssIntoStoredPayloadJson(input.siteDataJson, css);
      if (!merged) return;
      const { error: upErr } = await supabase
        .from("clients")
        .update({ site_data_json: merged })
        .eq("subfolder_slug", input.subfolderSlug)
        .eq("id", clientId);
      if (upErr) return;
    }

    revalidateTag("site-snapshot", { expire: 0 });
    revalidateTag("published-site", { expire: 0 });
    revalidateTag(publishedSiteSlugTag(input.subfolderSlug), { expire: 0 });
  } catch {
    /* service role / schema — preview blijft werken met in-memory payload */
  }
}
