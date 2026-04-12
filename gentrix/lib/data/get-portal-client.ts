import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isPostgrestUnknownColumnError } from "@/lib/supabase/postgrest-unknown-column";

export type ActivePortalClient = {
  id: string;
  name: string;
  subfolder_slug: string;
  appointments_enabled: boolean;
  webshop_enabled: boolean;
  portal_invoices_enabled: boolean;
  portal_account_enabled: boolean;
  /** Supabase Auth user gekoppeld aan dit dossier; voor studio-preview-detectie. */
  portal_user_id: string | null;
  custom_domain: string | null;
  domain_verified: boolean;
  domain_dns_target: string | null;
  draft_snapshot_id: string | null;
  published_snapshot_id: string | null;
};

const PORTAL_COLS_BASE = ["id", "name", "subfolder_slug"] as const;
const PORTAL_OPTIONAL = [
  "appointments_enabled",
  "webshop_enabled",
  "portal_invoices_enabled",
  "portal_account_enabled",
  "portal_user_id",
  "custom_domain",
  "domain_verified",
  "domain_dns_target",
  "draft_snapshot_id",
  "published_snapshot_id",
] as const;

function normalizePortalRow(
  row: Record<string, unknown>,
  present: Set<string>,
): ActivePortalClient {
  const puid = row.portal_user_id;
  return {
    id: String(row.id),
    name: String(row.name),
    subfolder_slug: String(row.subfolder_slug ?? ""),
    appointments_enabled: present.has("appointments_enabled")
      ? Boolean(row.appointments_enabled)
      : false,
    webshop_enabled: present.has("webshop_enabled") ? Boolean(row.webshop_enabled) : false,
    portal_invoices_enabled: present.has("portal_invoices_enabled")
      ? Boolean(row.portal_invoices_enabled)
      : true,
    portal_account_enabled: present.has("portal_account_enabled")
      ? Boolean(row.portal_account_enabled)
      : true,
    portal_user_id:
      present.has("portal_user_id") && (typeof puid === "string" || puid === null)
        ? (puid as string | null)
        : null,
    custom_domain: present.has("custom_domain")
      ? row.custom_domain == null
        ? null
        : String(row.custom_domain)
      : null,
    domain_verified: present.has("domain_verified") ? Boolean(row.domain_verified) : false,
    domain_dns_target: present.has("domain_dns_target")
      ? row.domain_dns_target == null
        ? null
        : String(row.domain_dns_target)
      : null,
    draft_snapshot_id: present.has("draft_snapshot_id")
      ? row.draft_snapshot_id == null
        ? null
        : String(row.draft_snapshot_id)
      : null,
    published_snapshot_id: present.has("published_snapshot_id")
      ? row.published_snapshot_id == null
        ? null
        : String(row.published_snapshot_id)
      : null,
  };
}

/**
 * Actieve klant voor /portal/{slug}: zelfde basis als live site (status active).
 * Ontbrekende DB-kolommen → veilige defaults (afspraken uit, factuur/account aan).
 */
export async function getActivePortalClient(subfolderSlug: string): Promise<ActivePortalClient | null> {
  const supabase = await createSupabaseServerClient();

  let selectList = [...PORTAL_COLS_BASE, ...PORTAL_OPTIONAL];
  const maxAttempts = 8;

  for (let i = 0; i < maxAttempts; i++) {
    const sel = selectList.join(", ");
    const { data, error } = await supabase
      .from("clients")
      .select(sel)
      .eq("subfolder_slug", subfolderSlug)
      .eq("status", "active")
      .maybeSingle();

    if (!error && data) {
      return normalizePortalRow(data as unknown as Record<string, unknown>, new Set(selectList));
    }

    if (!error && !data) return null;

    let stripped = false;
    for (const col of PORTAL_OPTIONAL) {
      if (error && isPostgrestUnknownColumnError(error, col)) {
        selectList = selectList.filter((c) => c !== col);
        stripped = true;
        break;
      }
    }
    if (stripped) continue;

    return null;
  }

  return null;
}
