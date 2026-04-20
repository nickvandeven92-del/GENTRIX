import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createAnonServerClient } from "@/lib/supabase/anon-server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { isPostgrestUnknownColumnError } from "@/lib/supabase/postgrest-unknown-column";
import {
  fetchSiteSnapshotPayloadJson,
  resolveDraftSitePayloadJson,
  resolvePublishedSitePayloadJson,
} from "@/lib/data/resolve-site-payload-json";
import { ensureTailwindCompiledCssOnPublishedPayload } from "@/lib/data/tailwind-compiled-css-attach";
import { previewSecretsEqual } from "@/lib/preview/preview-secret-crypto";
import {
  publishedPayloadFromSiteJson,
  type PublishedSitePayload,
} from "@/lib/site/project-published-payload";
import { parseStoredSiteData } from "@/lib/site/parse-stored-site-data";

export type { PublishedSitePayload };

function devLogPublishedSite(slug: string, message: string, detail?: unknown) {
  if (process.env.NODE_ENV !== "development") return;
  if (detail !== undefined) {
    console.warn(`[publieke site /${slug}] ${message}`, detail);
  } else {
    console.warn(`[publieke site /${slug}] ${message}`);
  }
}

/**
 * Live payload komt uit `published_snapshot_id`; concept kan nieuwer zijn (`draft_snapshot_id` + kolom).
 * Ontbrekende `marketingPages`-keys worden aangevuld vanuit extra JSON (kolom en/of concept-snapshot).
 */
function mergeTailwindMarketingPagesFromAlternateJson(
  payload: PublishedSitePayload,
  alternateJson: unknown,
  slug: string,
): PublishedSitePayload {
  if (payload.kind !== "tailwind") return payload;
  const col = parseStoredSiteData(alternateJson);
  if (col?.kind !== "tailwind" || !col.marketingPages) return payload;
  const colMp = col.marketingPages;
  if (Object.keys(colMp).length === 0) return payload;

  const snapMp = payload.marketingPages ?? {};
  const merged = { ...snapMp };
  let changed = false;
  for (const [k, v] of Object.entries(colMp)) {
    if (!Array.isArray(v) || v.length === 0) continue;
    const cur = merged[k];
    if (!cur || cur.length === 0) {
      merged[k] = v;
      changed = true;
    }
  }
  if (!changed) return payload;
  devLogPublishedSite(
    slug,
    "marketingPages aangevuld vanuit site_data_json of concept-snapshot (published miste niet-lege marketing-keys).",
  );
  return { ...payload, marketingPages: merged };
}

type ActiveClientRow = {
  site_data_json: unknown;
  name: string;
  generation_package?: string | null;
  published_snapshot_id?: string | null;
  draft_snapshot_id?: string | null;
  appointments_enabled?: boolean;
  webshop_enabled?: boolean;
};

type ClientRowWithPreviewMeta = ActiveClientRow & {
  preview_secret?: string | null;
  status?: string;
};

/** Zelfde `?token=`-contract als concept; `paused` heeft geen actieve `/site`-rij maar wél vaak een werkversie. */
const SITE_PREVIEW_TOKEN_STATUSES = ["draft", "paused", "archived"] as const;

function rowAllowsSitePreviewToken(status: string | undefined | null): boolean {
  return status === "draft" || status === "paused" || status === "archived";
}

/**
 * Concept of gepauzeerde site alleen met geldig `preview_secret` — zelfde kolommen als actieve site voor payload.
 */
async function fetchConceptDraftSiteRow(
  slug: string,
  previewToken: string,
): Promise<{ data: ActiveClientRow | null; error: { message: string } | null }> {
  const trimmed = previewToken.trim();
  if (!trimmed) return { data: null, error: null };

  try {
    const supabase = createServiceRoleClient();
    const fullSel =
      "site_data_json, name, generation_package, published_snapshot_id, draft_snapshot_id, appointments_enabled, webshop_enabled, preview_secret, status";
    const { data, error } = await supabase
      .from("clients")
      .select(fullSel)
      .eq("subfolder_slug", slug)
      .in("status", [...SITE_PREVIEW_TOKEN_STATUSES])
      .maybeSingle();

    if (error && isPostgrestUnknownColumnError(error, "preview_secret")) {
      return { data: null, error: null };
    }

    if (error && isPostgrestUnknownColumnError(error, "draft_snapshot_id")) {
      const second = await supabase
        .from("clients")
        .select(
          "site_data_json, name, generation_package, published_snapshot_id, appointments_enabled, webshop_enabled, preview_secret, status",
        )
        .eq("subfolder_slug", slug)
        .in("status", [...SITE_PREVIEW_TOKEN_STATUSES])
        .maybeSingle();
      if (second.error || !second.data) {
        return { data: null, error: second.error ?? { message: "Onbekende fout." } };
      }
      const row = second.data as ClientRowWithPreviewMeta;
      if (!rowAllowsSitePreviewToken(row.status) || !previewSecretsEqual(row.preview_secret ?? null, trimmed)) {
        return { data: null, error: null };
      }
      const { preview_secret: stripPs0, status: stripSt0, ...rest0 } = row;
      void stripPs0;
      void stripSt0;
      return { data: rest0 as ActiveClientRow, error: null };
    }

    if (error && isPostgrestUnknownColumnError(error, "webshop_enabled")) {
      const second = await supabase
        .from("clients")
        .select(
          "site_data_json, name, generation_package, published_snapshot_id, draft_snapshot_id, appointments_enabled, preview_secret, status",
        )
        .eq("subfolder_slug", slug)
        .in("status", [...SITE_PREVIEW_TOKEN_STATUSES])
        .maybeSingle();
      if (second.error || !second.data) {
        return { data: null, error: second.error ?? { message: "Onbekende fout." } };
      }
      const row = second.data as ClientRowWithPreviewMeta;
      if (!rowAllowsSitePreviewToken(row.status) || !previewSecretsEqual(row.preview_secret ?? null, trimmed)) {
        return { data: null, error: null };
      }
      const { preview_secret: stripPs, status: stripSt, ...rest } = row;
      void stripPs;
      void stripSt;
      return {
        data: { ...(rest as ActiveClientRow), webshop_enabled: false },
        error: null,
      };
    }

    if (error && isPostgrestUnknownColumnError(error, "appointments_enabled")) {
      let second = await supabase
        .from("clients")
        .select(
          "site_data_json, name, generation_package, published_snapshot_id, draft_snapshot_id, webshop_enabled, preview_secret, status",
        )
        .eq("subfolder_slug", slug)
        .in("status", [...SITE_PREVIEW_TOKEN_STATUSES])
        .maybeSingle();
      if (second.error && isPostgrestUnknownColumnError(second.error, "webshop_enabled")) {
        second = await supabase
          .from("clients")
          .select("site_data_json, name, generation_package, published_snapshot_id, draft_snapshot_id, preview_secret, status")
          .eq("subfolder_slug", slug)
          .in("status", [...SITE_PREVIEW_TOKEN_STATUSES])
          .maybeSingle();
      }
      if (second.error || !second.data) {
        return { data: null, error: second.error ?? { message: "Onbekende fout." } };
      }
      const row = second.data as ClientRowWithPreviewMeta & { webshop_enabled?: boolean };
      if (!rowAllowsSitePreviewToken(row.status) || !previewSecretsEqual(row.preview_secret ?? null, trimmed)) {
        return { data: null, error: null };
      }
      const { preview_secret: stripPs2, status: stripSt2, ...rest2 } = row;
      void stripPs2;
      void stripSt2;
      return {
        data: {
          ...(rest2 as ActiveClientRow),
          appointments_enabled: false,
          webshop_enabled: Boolean(row.webshop_enabled),
        },
        error: null,
      };
    }

    if (error && isPostgrestUnknownColumnError(error, "published_snapshot_id")) {
      const second = await supabase
        .from("clients")
        .select("site_data_json, name, generation_package, draft_snapshot_id, preview_secret, status")
        .eq("subfolder_slug", slug)
        .in("status", [...SITE_PREVIEW_TOKEN_STATUSES])
        .maybeSingle();
      if (second.error || !second.data) {
        return { data: null, error: second.error ?? { message: "Onbekende fout." } };
      }
      const row = second.data as ClientRowWithPreviewMeta;
      if (!rowAllowsSitePreviewToken(row.status) || !previewSecretsEqual(row.preview_secret ?? null, trimmed)) {
        return { data: null, error: null };
      }
      const { preview_secret: stripPs3, status: stripSt3, ...rest3 } = row;
      void stripPs3;
      void stripSt3;
      return {
        data: {
          ...(rest3 as ActiveClientRow),
          published_snapshot_id: null,
          appointments_enabled: false,
          webshop_enabled: false,
        },
        error: null,
      };
    }

    if (error && isPostgrestUnknownColumnError(error, "generation_package")) {
      let second = await supabase
        .from("clients")
        .select("site_data_json, name, draft_snapshot_id, preview_secret, status")
        .eq("subfolder_slug", slug)
        .in("status", [...SITE_PREVIEW_TOKEN_STATUSES])
        .maybeSingle();
      if (second.error && isPostgrestUnknownColumnError(second.error, "draft_snapshot_id")) {
        second = await supabase
          .from("clients")
          .select("site_data_json, name, preview_secret, status")
          .eq("subfolder_slug", slug)
          .in("status", [...SITE_PREVIEW_TOKEN_STATUSES])
          .maybeSingle();
      }
      if (second.error || !second.data) {
        return { data: null, error: second.error ?? { message: "Onbekende fout." } };
      }
      const row = second.data as ClientRowWithPreviewMeta;
      if (!rowAllowsSitePreviewToken(row.status) || !previewSecretsEqual(row.preview_secret ?? null, trimmed)) {
        return { data: null, error: null };
      }
      const { preview_secret: stripPs4, status: stripSt4, ...rest4 } = row;
      void stripPs4;
      void stripSt4;
      return {
        data: {
          ...(rest4 as ActiveClientRow),
          generation_package: null,
          published_snapshot_id: null,
          draft_snapshot_id: (rest4 as ActiveClientRow).draft_snapshot_id ?? null,
          appointments_enabled: false,
          webshop_enabled: false,
        },
        error: null,
      };
    }

    if (error || !data) {
      return { data: null, error: error ?? null };
    }

    const row = data as ClientRowWithPreviewMeta;
    if (!rowAllowsSitePreviewToken(row.status) || !previewSecretsEqual(row.preview_secret ?? null, trimmed)) {
      return { data: null, error: null };
    }
    const { preview_secret: stripPs5, status: stripSt5, ...rest5 } = row;
    void stripPs5;
    void stripSt5;
    return { data: rest5 as ActiveClientRow, error: null };
  } catch {
    return { data: null, error: null };
  }
}

async function fetchActiveClientRow(
  slug: string,
): Promise<{ data: ActiveClientRow | null; error: { message: string } | null }> {
  const selectFull =
    "site_data_json, name, generation_package, published_snapshot_id, draft_snapshot_id, appointments_enabled, webshop_enabled";
  const selectFullNoWebshop =
    "site_data_json, name, generation_package, published_snapshot_id, draft_snapshot_id, appointments_enabled";
  const selectFullNoAppt =
    "site_data_json, name, generation_package, published_snapshot_id, draft_snapshot_id";
  const selectFullNoApptWithShop =
    "site_data_json, name, generation_package, published_snapshot_id, draft_snapshot_id, webshop_enabled";
  const selectWithPkg = "site_data_json, name, generation_package, draft_snapshot_id, published_snapshot_id";
  const selectMinimal = "site_data_json, name, draft_snapshot_id";

  async function tryServiceSelect(
    supabase: ReturnType<typeof createServiceRoleClient>,
    sel: string,
  ) {
    return supabase.from("clients").select(sel).eq("subfolder_slug", slug).eq("status", "active").maybeSingle();
  }

  try {
    const supabase = createServiceRoleClient();
    let first = await tryServiceSelect(supabase, selectFull);
    if (first.error && isPostgrestUnknownColumnError(first.error, "draft_snapshot_id")) {
      first = await tryServiceSelect(
        supabase,
        "site_data_json, name, generation_package, published_snapshot_id, appointments_enabled, webshop_enabled",
      );
    }
    let data: ActiveClientRow | null =
      first.error == null && first.data != null ? (first.data as unknown as ActiveClientRow) : null;
    let error = first.error;

    if (error && isPostgrestUnknownColumnError(error, "webshop_enabled")) {
      const second = await tryServiceSelect(supabase, selectFullNoWebshop);
      if (second.error || !second.data) {
        return { data: null, error: second.error ?? { message: "Onbekende fout." } };
      }
      const row = second.data as unknown as Omit<ActiveClientRow, "webshop_enabled">;
      data = { ...row, webshop_enabled: false };
      error = null;
    }

    if (error && isPostgrestUnknownColumnError(error, "appointments_enabled")) {
      let second = await tryServiceSelect(supabase, selectFullNoApptWithShop);
      if (second.error && isPostgrestUnknownColumnError(second.error, "webshop_enabled")) {
        second = await tryServiceSelect(supabase, selectFullNoAppt);
      }
      if (second.error || !second.data) {
        return { data: null, error: second.error ?? { message: "Onbekende fout." } };
      }
      const row = second.data as unknown as Omit<ActiveClientRow, "appointments_enabled"> & {
        webshop_enabled?: boolean;
      };
      data = {
        ...row,
        appointments_enabled: false,
        webshop_enabled: Boolean(row.webshop_enabled),
      };
      error = null;
    }

    if (error && isPostgrestUnknownColumnError(error, "published_snapshot_id")) {
      const second = await tryServiceSelect(supabase, selectWithPkg);
      if (second.error || !second.data) {
        return { data: null, error: second.error ?? { message: "Onbekende fout." } };
      }
      const row = second.data as unknown as {
        site_data_json: unknown;
        name: string;
        generation_package?: string | null;
        draft_snapshot_id?: string | null;
      };
      data = {
        ...row,
        published_snapshot_id: null,
        draft_snapshot_id: row.draft_snapshot_id ?? null,
        appointments_enabled: false,
        webshop_enabled: false,
      };
      error = null;
    }

    if (error && isPostgrestUnknownColumnError(error, "generation_package")) {
      const second = await tryServiceSelect(supabase, selectMinimal);
      if (second.error || !second.data) {
        return { data: null, error: second.error ?? { message: "Onbekende fout." } };
      }
      const row = second.data as unknown as {
        site_data_json: unknown;
        name: string;
        draft_snapshot_id?: string | null;
      };
      data = {
        ...row,
        generation_package: null,
        published_snapshot_id: null,
        draft_snapshot_id: row.draft_snapshot_id ?? null,
        appointments_enabled: false,
        webshop_enabled: false,
      };
      error = null;
    }

    return { data, error };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("SUPABASE_SERVICE_ROLE_KEY")) {
      devLogPublishedSite(
        slug,
        "Geen SUPABASE_SERVICE_ROLE_KEY: read via anon (RLS moet anon toe staan). Zet de service role key in .env.local.",
      );
      const supabase = createAnonServerClient();
      let anonFirst = await supabase
        .from("clients")
        .select(selectFull)
        .eq("subfolder_slug", slug)
        .eq("status", "active")
        .maybeSingle();
      if (anonFirst.error && isPostgrestUnknownColumnError(anonFirst.error, "draft_snapshot_id")) {
        anonFirst = await supabase
          .from("clients")
          .select(
            "site_data_json, name, generation_package, published_snapshot_id, appointments_enabled, webshop_enabled",
          )
          .eq("subfolder_slug", slug)
          .eq("status", "active")
          .maybeSingle();
      }

      let data: ActiveClientRow | null =
        anonFirst.error == null && anonFirst.data != null
          ? (anonFirst.data as unknown as ActiveClientRow)
          : null;
      let error = anonFirst.error;

      if (error && isPostgrestUnknownColumnError(error, "webshop_enabled")) {
        const second = await supabase
          .from("clients")
          .select(selectFullNoWebshop)
          .eq("subfolder_slug", slug)
          .eq("status", "active")
          .maybeSingle();
        if (second.error || !second.data) {
          return { data: null, error: second.error ?? { message: "Onbekende fout." } };
        }
        const row = second.data as unknown as Omit<ActiveClientRow, "webshop_enabled">;
        data = { ...row, webshop_enabled: false };
        error = null;
      }

      if (error && isPostgrestUnknownColumnError(error, "appointments_enabled")) {
        let second = await supabase
          .from("clients")
          .select(selectFullNoApptWithShop)
          .eq("subfolder_slug", slug)
          .eq("status", "active")
          .maybeSingle();
        if (second.error && isPostgrestUnknownColumnError(second.error, "webshop_enabled")) {
          second = await supabase
            .from("clients")
            .select(selectFullNoAppt)
            .eq("subfolder_slug", slug)
            .eq("status", "active")
            .maybeSingle();
        }
        if (second.error || !second.data) {
          return { data: null, error: second.error ?? { message: "Onbekende fout." } };
        }
        const row = second.data as unknown as Omit<ActiveClientRow, "appointments_enabled"> & {
          webshop_enabled?: boolean;
        };
        data = {
          ...row,
          appointments_enabled: false,
          webshop_enabled: Boolean(row.webshop_enabled),
        };
        error = null;
      }

      if (error && isPostgrestUnknownColumnError(error, "published_snapshot_id")) {
        const second = await supabase
          .from("clients")
          .select(selectWithPkg)
          .eq("subfolder_slug", slug)
          .eq("status", "active")
          .maybeSingle();
        if (second.error || !second.data) {
          return { data: null, error: second.error ?? { message: "Onbekende fout." } };
        }
        const row = second.data as unknown as {
          site_data_json: unknown;
          name: string;
          generation_package?: string | null;
          draft_snapshot_id?: string | null;
        };
        data = {
          ...row,
          published_snapshot_id: null,
          draft_snapshot_id: row.draft_snapshot_id ?? null,
          appointments_enabled: false,
          webshop_enabled: false,
        };
        error = null;
      }

      if (error && isPostgrestUnknownColumnError(error, "generation_package")) {
        const second = await supabase
          .from("clients")
          .select(selectMinimal)
          .eq("subfolder_slug", slug)
          .eq("status", "active")
          .maybeSingle();
        if (second.error || !second.data) {
          return { data: null, error: second.error ?? { message: "Onbekende fout." } };
        }
        const row = second.data as unknown as {
          site_data_json: unknown;
          name: string;
          draft_snapshot_id?: string | null;
        };
        data = {
          ...row,
          generation_package: null,
          published_snapshot_id: null,
          draft_snapshot_id: row.draft_snapshot_id ?? null,
          appointments_enabled: false,
          webshop_enabled: false,
        };
        error = null;
      }

      return { data, error };
    }
    throw e;
  }
}

/** Cache-tag voor targeted invalidatie bij publiceren: `revalidateTag(publishedSiteTag(slug))`. */
export function publishedSiteTag(slug: string): string {
  return `published-site:${slug}`;
}

/**
 * Gecachede variant van `fetchActiveClientRow` — Vercel Data Cache, 60 seconden.
 * Alleen voor live sites (geen preview-token). Elke unieke slug heeft zijn eigen cache-entry.
 */
const fetchActiveClientRowCached = unstable_cache(
  (slug: string) => fetchActiveClientRow(slug),
  ["active-client-row"],
  {
    revalidate: 60,
    tags: ["published-site"],
  },
);

/**
 * Publieke site (`status = active`) óf **concept/gepauzeerd** met geldige `?token=` (zelfde routes als live, niet indexeerbaar).
 * Server-side met service role; fallback anon als key ontbreekt.
 *
 * Wrapped in `cache()` zodat `generateMetadata` + page in dezelfde request **één** Supabase-roundtrip doen.
 */
export type PublishedSiteBundle = {
  payload: PublishedSitePayload;
  /** `false` = boekingslinks en booking-sectie worden op `/site/{slug}` verborgen. */
  appointmentsEnabled: boolean;
  /** `false` = webshop-links en shop-sectie worden op `/site/{slug}` verborgen. */
  webshopEnabled: boolean;
  /** `true` wanneer geladen via concept-token (`?token=`); iframe krijgt dezelfde token voor subnav. */
  isConceptTokenAccess?: boolean;
  conceptPreviewToken?: string | null;
};

export const getPublishedSiteBySlug = cache(async function getPublishedSiteBySlug(
  slug: string,
  previewToken?: string | null,
): Promise<PublishedSiteBundle | null> {
  try {
    const isPreview = Boolean(previewToken?.trim());
    const activeRow = isPreview ? await fetchActiveClientRow(slug) : await fetchActiveClientRowCached(slug);
    let data = activeRow.data;
    const { error } = activeRow;

    let conceptAccess = false;
    let conceptTokenOut: string | null = null;

    if (!error && !data && previewToken?.trim()) {
      const draft = await fetchConceptDraftSiteRow(slug, previewToken);
      if (!draft.error && draft.data) {
        data = draft.data;
        conceptAccess = true;
        conceptTokenOut = previewToken.trim();
      }
    }

    if (error) {
      devLogPublishedSite(
        slug,
        "Supabase-fout (kolommen subfolder_slug, site_data_json, name?).",
        error.message,
      );
      return null;
    }

    if (!data) {
      devLogPublishedSite(
        slug,
        previewToken?.trim()
          ? "Geen actieve of geldige concept-site voor deze slug/token."
          : "Geen actieve rij: slug, status 'active', en schema (na migratie) controleren.",
      );
      return null;
    }

    const siteJson = conceptAccess
      ? await resolveDraftSitePayloadJson({
          site_data_json: data.site_data_json,
          draft_snapshot_id: data.draft_snapshot_id ?? null,
          published_snapshot_id: data.published_snapshot_id ?? null,
        })
      : await resolvePublishedSitePayloadJson({
          site_data_json: data.site_data_json,
          draft_snapshot_id: null,
          published_snapshot_id: data.published_snapshot_id ?? null,
        });

    let payload = publishedPayloadFromSiteJson(siteJson, data.name, data.generation_package);
    if (!payload) {
      devLogPublishedSite(
        slug,
        "Site-payload is leeg of ongeldig (tailwind_sections, react_sections of legacy JSON).",
      );
      return null;
    }
    if (!conceptAccess && payload.kind === "tailwind") {
      payload = mergeTailwindMarketingPagesFromAlternateJson(payload, data.site_data_json, slug);
      const draftId = data.draft_snapshot_id?.trim();
      const pubId = data.published_snapshot_id?.trim();
      if (draftId && draftId !== pubId) {
        const draftJson = await fetchSiteSnapshotPayloadJson(draftId);
        if (draftJson != null) {
          payload = mergeTailwindMarketingPagesFromAlternateJson(payload, draftJson, slug);
        }
      }
    }
    const beforeEnsure =
      payload.kind === "tailwind" &&
      (payload.tailwindCompiledCss == null || payload.tailwindCompiledCss.trim() === "");
    payload = await ensureTailwindCompiledCssOnPublishedPayload(payload, data.name);
    if (
      process.env.NODE_ENV === "development" &&
      beforeEnsure &&
      payload.kind === "tailwind" &&
      payload.tailwindCompiledCss != null &&
      payload.tailwindCompiledCss.trim() !== ""
    ) {
      devLogPublishedSite(
        slug,
        "tailwindCompiledCss ontbrak in DB; server-build toegevoegd voor deze request (opslaan in studio schrijft voortaan mee).",
      );
    }
    const appointmentsEnabled = Boolean(data.appointments_enabled);
    const webshopEnabled = Boolean(data.webshop_enabled);
    return {
      payload,
      appointmentsEnabled,
      webshopEnabled,
      ...(conceptAccess
        ? { isConceptTokenAccess: true as const, conceptPreviewToken: conceptTokenOut }
        : {}),
    };
  } catch {
    return null;
  }
});
