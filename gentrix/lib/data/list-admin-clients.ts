import { createSupabaseServerClient } from "@/lib/supabase/server";
import { escapeForIlike, searchTerms } from "@/lib/commercial/ilike-search";
import { isPostgrestUnknownColumnError } from "@/lib/supabase/postgrest-unknown-column";

export type AdminClientRow = {
  id: string;
  name: string;
  subfolder_slug: string;
  status: "draft" | "active" | "paused" | "archived";
  updated_at: string;
  generation_package: string | null;
  plan_type: string | null;
  plan_label: string | null;
  payment_status: string;
  pipeline_stage: string;
  subscription_renews_at: string | null;
  billing_email: string | null;
  custom_domain: string | null;
  /** Ontbreekt op oudere callers die een deelselectie doorgeven. */
  client_number?: string | null;
  /** Gezet wanneer commercieel dossier is losgekoppeld; site blijft bestaan. */
  commercial_unlinked_at?: string | null;
  /**
   * Gezet op de server (Sites-overzicht): beste URL voor Site in nieuw tabblad — live of publieke
   * concept-preview zonder admin-layout.
   */
  siteOpenAbsoluteUrl?: string;
};

const TAIL_SEL =
  "plan_type, plan_label, payment_status, pipeline_stage, subscription_renews_at, billing_email, custom_domain";
const NUM_SUFFIX = ", client_number";
const UNLINK_SUFFIX = ", commercial_unlinked_at";

function selectFields(opts: { pkg: boolean; num: boolean; unlink: boolean }): string {
  const pkgPart = opts.pkg ? ", generation_package" : "";
  const numPart = opts.num ? NUM_SUFFIX : "";
  const unlPart = opts.unlink ? UNLINK_SUFFIX : "";
  return `id, name, subfolder_slug, status, updated_at${pkgPart}, ${TAIL_SEL}${numPart}${unlPart}`;
}

/** Overzichten: standaard actieve werkset zonder archief, of alleen archief. */
export type AdminClientListStatusScope = "all" | "active_workspace" | "archived_only";

export type ListAdminClientsOptions = {
  search?: string | null;
  /**
   * true = ook “losse websites” (commercieel dossier verwijderd) tonen, o.a. Sites-overzicht.
   * Standaard false: alleen rijen met actief dossier (Klanten, offertes, …).
   */
  includeOrphanWebsites?: boolean;
  /**
   * Filter op `clients.status`. Standaard `all` (bestaande callers: export, Sales OS, dropdowns).
   * `active_workspace` = alles behalve `archived`. `archived_only` = alleen archief.
   */
  statusScope?: AdminClientListStatusScope;
  /** @internal schema zonder commercial_unlinked_at (oude DB). */
  _skipCommercialUnlinkedColumn?: boolean;
};

type RawRow = Record<string, unknown>;

function toAdminRows(raw: RawRow[], includeOrphanWebsites: boolean): AdminClientRow[] {
  const includeOrphans = includeOrphanWebsites === true;
  const filtered = includeOrphans
    ? raw
    : raw.filter((r) => r.commercial_unlinked_at == null || r.commercial_unlinked_at === "");

  return filtered.map((row) => {
    const r = row as RawRow;
    return {
      id: String(r.id),
      name: String(r.name),
      subfolder_slug: String(r.subfolder_slug),
      status: r.status as AdminClientRow["status"],
      updated_at: String(r.updated_at),
      generation_package: (r.generation_package as string | null | undefined) ?? null,
      plan_type: (r.plan_type as string | null | undefined) ?? null,
      plan_label: (r.plan_label as string | null | undefined) ?? null,
      payment_status: String(r.payment_status ?? ""),
      pipeline_stage: String(r.pipeline_stage ?? ""),
      subscription_renews_at: (r.subscription_renews_at as string | null | undefined) ?? null,
      billing_email: (r.billing_email as string | null | undefined) ?? null,
      custom_domain: (r.custom_domain as string | null | undefined) ?? null,
      client_number: (r.client_number as string | null | undefined) ?? null,
      commercial_unlinked_at: (r.commercial_unlinked_at as string | null | undefined) ?? null,
    };
  });
}

export async function listAdminClients(options?: ListAdminClientsOptions): Promise<AdminClientRow[]> {
  const supabase = await createSupabaseServerClient();
  const order = { ascending: false } as const;
  const term = searchTerms(options?.search ?? undefined);
  const pattern = term ? `%${escapeForIlike(term)}%` : null;
  const includeOrphanWebsites = options?.includeOrphanWebsites === true;
  const useUnlinkCol = options?._skipCommercialUnlinkedColumn !== true;
  const statusScope = options?.statusScope ?? "all";

  const run = async (sel: string) => {
    let q = supabase.from("clients").select(sel).order("updated_at", order);
    if (statusScope === "active_workspace") {
      q = q.neq("status", "archived");
    } else if (statusScope === "archived_only") {
      q = q.eq("status", "archived");
    }
    if (pattern) {
      if (sel.includes("client_number")) {
        q = q.or(`name.ilike.${pattern},client_number.ilike.${pattern}`);
      } else {
        q = q.ilike("name", pattern);
      }
    }
    return q;
  };

  const selFull = selectFields({ pkg: true, num: true, unlink: useUnlinkCol });
  const { data, error } = await run(selFull);

  if (error && useUnlinkCol && isPostgrestUnknownColumnError(error, "commercial_unlinked_at")) {
    return listAdminClients({ ...options, _skipCommercialUnlinkedColumn: true });
  }

  if (error && isPostgrestUnknownColumnError(error, "client_number")) {
    const sel2 = selectFields({ pkg: true, num: false, unlink: useUnlinkCol });
    const second = await run(sel2);
    if (second.error && useUnlinkCol && isPostgrestUnknownColumnError(second.error, "commercial_unlinked_at")) {
      return listAdminClients({ ...options, _skipCommercialUnlinkedColumn: true });
    }
    if (second.error && isPostgrestUnknownColumnError(second.error, "generation_package")) {
      const sel3 = selectFields({ pkg: false, num: false, unlink: useUnlinkCol });
      const third = await run(sel3);
      if (third.error && useUnlinkCol && isPostgrestUnknownColumnError(third.error, "commercial_unlinked_at")) {
        return listAdminClients({ ...options, _skipCommercialUnlinkedColumn: true });
      }
      if (third.error || !third.data) return [];
      return toAdminRows(third.data as unknown as RawRow[], includeOrphanWebsites);
    }
    if (second.error || !second.data) return [];
    return toAdminRows(second.data as unknown as RawRow[], includeOrphanWebsites).map((r) => ({
      ...r,
      client_number: null,
    }));
  }

  if (error && isPostgrestUnknownColumnError(error, "generation_package")) {
    const sel2 = selectFields({ pkg: false, num: false, unlink: useUnlinkCol });
    const second = await run(sel2);
    if (second.error && useUnlinkCol && isPostgrestUnknownColumnError(second.error, "commercial_unlinked_at")) {
      return listAdminClients({ ...options, _skipCommercialUnlinkedColumn: true });
    }
    if (second.error || !second.data) return [];
    return toAdminRows(second.data as unknown as RawRow[], includeOrphanWebsites).map((r) => ({
      ...r,
      generation_package: null,
      client_number: null,
    }));
  }

  if (error || !data) return [];

  return toAdminRows(data as unknown as RawRow[], includeOrphanWebsites);
}
