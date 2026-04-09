import { cache } from "react";
import { createAnonServerClient } from "@/lib/supabase/anon-server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { isPostgrestUnknownColumnError } from "@/lib/supabase/postgrest-unknown-column";
import { resolvePublishedSitePayloadJson } from "@/lib/data/resolve-site-payload-json";
import {
  publishedPayloadFromSiteJson,
  type PublishedSitePayload,
} from "@/lib/site/project-published-payload";

export type { PublishedSitePayload };

function devLogPublishedSite(slug: string, message: string, detail?: unknown) {
  if (process.env.NODE_ENV !== "development") return;
  if (detail !== undefined) {
    console.warn(`[publieke site /${slug}] ${message}`, detail);
  } else {
    console.warn(`[publieke site /${slug}] ${message}`);
  }
}

type ActiveClientRow = {
  site_data_json: unknown;
  name: string;
  generation_package?: string | null;
  published_snapshot_id?: string | null;
  appointments_enabled?: boolean;
  webshop_enabled?: boolean;
};

async function fetchActiveClientRow(
  slug: string,
): Promise<{ data: ActiveClientRow | null; error: { message: string } | null }> {
  const selectFull =
    "site_data_json, name, generation_package, published_snapshot_id, appointments_enabled, webshop_enabled";
  const selectFullNoWebshop =
    "site_data_json, name, generation_package, published_snapshot_id, appointments_enabled";
  const selectFullNoAppt =
    "site_data_json, name, generation_package, published_snapshot_id";
  const selectFullNoApptWithShop =
    "site_data_json, name, generation_package, published_snapshot_id, webshop_enabled";
  const selectWithPkg = "site_data_json, name, generation_package";
  const selectMinimal = "site_data_json, name";

  async function tryServiceSelect(
    supabase: ReturnType<typeof createServiceRoleClient>,
    sel: string,
  ) {
    return supabase.from("clients").select(sel).eq("subfolder_slug", slug).eq("status", "active").maybeSingle();
  }

  try {
    const supabase = createServiceRoleClient();
    const first = await tryServiceSelect(supabase, selectFull);
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
      };
      data = { ...row, published_snapshot_id: null, appointments_enabled: false, webshop_enabled: false };
      error = null;
    }

    if (error && isPostgrestUnknownColumnError(error, "generation_package")) {
      const second = await tryServiceSelect(supabase, selectMinimal);
      if (second.error || !second.data) {
        return { data: null, error: second.error ?? { message: "Onbekende fout." } };
      }
      const row = second.data as unknown as { site_data_json: unknown; name: string };
      data = {
        ...row,
        generation_package: null,
        published_snapshot_id: null,
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
      const anonFirst = await supabase
        .from("clients")
        .select(selectFull)
        .eq("subfolder_slug", slug)
        .eq("status", "active")
        .maybeSingle();

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
        };
        data = { ...row, published_snapshot_id: null, appointments_enabled: false, webshop_enabled: false };
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
        const row = second.data as unknown as { site_data_json: unknown; name: string };
        data = {
          ...row,
          generation_package: null,
          published_snapshot_id: null,
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

/**
 * Gepubliceerde site (`status = active`). Server-side met service role zodat RLS anon-policies
 * niet vereist zijn; fallback anon als key ontbreekt.
 *
 * Wrapped in `cache()` zodat `generateMetadata` + page in dezelfde request **één** Supabase-roundtrip doen.
 */
export type PublishedSiteBundle = {
  payload: PublishedSitePayload;
  /** `false` = boekingslinks en booking-sectie worden op `/site/{slug}` verborgen. */
  appointmentsEnabled: boolean;
  /** `false` = webshop-links en shop-sectie worden op `/site/{slug}` verborgen. */
  webshopEnabled: boolean;
};

export const getPublishedSiteBySlug = cache(async function getPublishedSiteBySlug(
  slug: string,
): Promise<PublishedSiteBundle | null> {
  try {
    const { data, error } = await fetchActiveClientRow(slug);

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
        "Geen actieve rij: slug, status 'active', en schema (na migratie) controleren.",
      );
      return null;
    }

    const siteJson = await resolvePublishedSitePayloadJson({
      site_data_json: data.site_data_json,
      draft_snapshot_id: null,
      published_snapshot_id: data.published_snapshot_id ?? null,
    });

    const payload = publishedPayloadFromSiteJson(siteJson, data.name, data.generation_package);
    if (!payload) {
      devLogPublishedSite(
        slug,
        "Site-payload is leeg of ongeldig (tailwind_sections, react_sections of legacy JSON).",
      );
      return null;
    }
    const appointmentsEnabled = Boolean(data.appointments_enabled);
    const webshopEnabled = Boolean(data.webshop_enabled);
    return { payload, appointmentsEnabled, webshopEnabled };
  } catch {
    return null;
  }
});
