import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { GenerationPackageId } from "@/lib/ai/generation-packages";
import { isPostgrestUnknownColumnError } from "@/lib/supabase/postgrest-unknown-column";
import type { PaymentStatus, PipelineStage, PlanType } from "@/lib/commercial/client-commercial";

export type ClientCommercialRow = {
  id: string;
  name: string;
  description: string | null;
  subfolder_slug: string;
  status: "draft" | "active" | "paused" | "archived";
  generation_package: GenerationPackageId | null;
  billing_email: string | null;
  phone: string | null;
  company_legal_name: string | null;
  vat_number: string | null;
  billing_address: string | null;
  plan_type: PlanType | null;
  plan_label: string | null;
  payment_status: PaymentStatus;
  payment_provider: string | null;
  payment_reference: string | null;
  subscription_renews_at: string | null;
  delivered_at: string | null;
  contract_accepted_at: string | null;
  internal_notes: string | null;
  pipeline_stage: PipelineStage;
  custom_domain: string | null;
  domain_verified: boolean;
  domain_dns_target: string | null;
  updated_at: string;
  client_number: string | null;
  appointments_enabled: boolean;
  webshop_enabled: boolean;
  portal_invoices_enabled: boolean;
  portal_account_enabled: boolean;
  subscription_cancel_at_period_end: boolean;
  subscription_cancel_requested_at: string | null;
  /** Supabase Auth user id; voor /home → /portal redirect. */
  portal_user_id: string | null;
};

function defaultPortalModules(p: {
  portal_invoices_enabled?: boolean;
  portal_account_enabled?: boolean;
}): Pick<ClientCommercialRow, "portal_invoices_enabled" | "portal_account_enabled"> {
  return {
    portal_invoices_enabled:
      p.portal_invoices_enabled !== undefined ? Boolean(p.portal_invoices_enabled) : true,
    portal_account_enabled:
      p.portal_account_enabled !== undefined ? Boolean(p.portal_account_enabled) : true,
  };
}

const COMMERCIAL_COLUMNS_WITH_PKG = [
  "id",
  "name",
  "description",
  "subfolder_slug",
  "status",
  "generation_package",
  "billing_email",
  "phone",
  "company_legal_name",
  "vat_number",
  "billing_address",
  "plan_type",
  "plan_label",
  "payment_status",
  "payment_provider",
  "payment_reference",
  "subscription_renews_at",
  "delivered_at",
  "contract_accepted_at",
  "internal_notes",
  "pipeline_stage",
  "custom_domain",
  "domain_verified",
  "domain_dns_target",
  "updated_at",
  "client_number",
  "appointments_enabled",
  "webshop_enabled",
  "portal_invoices_enabled",
  "portal_account_enabled",
  "subscription_cancel_at_period_end",
  "subscription_cancel_requested_at",
  "portal_user_id",
] as const;

const COMMERCIAL_COLUMNS_WITHOUT_PKG = COMMERCIAL_COLUMNS_WITH_PKG.filter((c) => c !== "generation_package");
const COMMERCIAL_COLUMNS_WITHOUT_APPT = COMMERCIAL_COLUMNS_WITH_PKG.filter((c) => c !== "appointments_enabled");
const COMMERCIAL_COLUMNS_WITHOUT_WEBSHOP = COMMERCIAL_COLUMNS_WITH_PKG.filter((c) => c !== "webshop_enabled");
const COMMERCIAL_COLUMNS_WITHOUT_SUB_CANCEL = COMMERCIAL_COLUMNS_WITH_PKG.filter(
  (c) => c !== "subscription_cancel_at_period_end" && c !== "subscription_cancel_requested_at",
);
const COMMERCIAL_COLUMNS_WITHOUT_PORTAL_USER = COMMERCIAL_COLUMNS_WITH_PKG.filter((c) => c !== "portal_user_id");

export async function getClientCommercialBySlug(
  slug: string,
  /** Service role of andere client (bijv. studio-preview portaaldata). */
  supabaseOverride?: SupabaseClient,
): Promise<ClientCommercialRow | null> {
  const supabase = supabaseOverride ?? (await createSupabaseServerClient());
  let { data, error } = await supabase
    .from("clients")
    .select([...COMMERCIAL_COLUMNS_WITH_PKG].join(", "))
    .eq("subfolder_slug", slug)
    .maybeSingle();

  if (error && isPostgrestUnknownColumnError(error, "webshop_enabled")) {
    const r = await supabase
      .from("clients")
      .select(COMMERCIAL_COLUMNS_WITHOUT_WEBSHOP.join(", "))
      .eq("subfolder_slug", slug)
      .maybeSingle();
    data = r.data;
    error = r.error;
  }

  if (error && isPostgrestUnknownColumnError(error, "portal_user_id")) {
    const r = await supabase
      .from("clients")
      .select(COMMERCIAL_COLUMNS_WITHOUT_PORTAL_USER.join(", "))
      .eq("subfolder_slug", slug)
      .maybeSingle();
    data = r.data;
    error = r.error;
  }

  if (error && isPostgrestUnknownColumnError(error, "client_number")) {
    const sel = COMMERCIAL_COLUMNS_WITH_PKG.filter((c) => c !== "client_number").join(", ");
    const r = await supabase.from("clients").select(sel).eq("subfolder_slug", slug).maybeSingle();
    if (r.error || !r.data) return null;
    const partial = r.data as unknown as Omit<
      ClientCommercialRow,
      "client_number" | "appointments_enabled" | "webshop_enabled"
    > & {
      appointments_enabled?: boolean;
      webshop_enabled?: boolean;
    };
    return {
      ...partial,
      client_number: null,
      appointments_enabled: Boolean(partial.appointments_enabled),
      webshop_enabled: Boolean(partial.webshop_enabled),
      ...defaultPortalModules(partial as { portal_invoices_enabled?: boolean; portal_account_enabled?: boolean }),
      subscription_cancel_at_period_end: Boolean(
        (partial as { subscription_cancel_at_period_end?: boolean }).subscription_cancel_at_period_end,
      ),
      subscription_cancel_requested_at:
        (partial as { subscription_cancel_requested_at?: string | null }).subscription_cancel_requested_at ?? null,
      portal_user_id: (partial as { portal_user_id?: string | null }).portal_user_id ?? null,
    };
  }

  if (error && isPostgrestUnknownColumnError(error, "generation_package")) {
    const second = await supabase
      .from("clients")
      .select(COMMERCIAL_COLUMNS_WITHOUT_PKG.join(", "))
      .eq("subfolder_slug", slug)
      .maybeSingle();
    if (second.error || !second.data) return null;
    const partial = second.data as unknown as Omit<
      ClientCommercialRow,
      "generation_package" | "appointments_enabled" | "webshop_enabled"
    > & {
      appointments_enabled?: boolean;
      webshop_enabled?: boolean;
    };
    return {
      ...partial,
      generation_package: null,
      client_number: (second.data as { client_number?: string | null }).client_number ?? null,
      appointments_enabled: Boolean(partial.appointments_enabled),
      webshop_enabled: Boolean(partial.webshop_enabled),
      ...defaultPortalModules(partial as { portal_invoices_enabled?: boolean; portal_account_enabled?: boolean }),
      subscription_cancel_at_period_end: Boolean(
        (partial as { subscription_cancel_at_period_end?: boolean }).subscription_cancel_at_period_end,
      ),
      subscription_cancel_requested_at:
        (partial as { subscription_cancel_requested_at?: string | null }).subscription_cancel_requested_at ?? null,
      portal_user_id: (partial as { portal_user_id?: string | null }).portal_user_id ?? null,
    };
  }

  if (error && isPostgrestUnknownColumnError(error, "appointments_enabled")) {
    const r = await supabase
      .from("clients")
      .select(COMMERCIAL_COLUMNS_WITHOUT_APPT.join(", "))
      .eq("subfolder_slug", slug)
      .maybeSingle();
    if (r.error || !r.data) return null;
    const row = r.data as unknown as Omit<ClientCommercialRow, "appointments_enabled" | "webshop_enabled"> & {
      subscription_cancel_at_period_end?: boolean;
      subscription_cancel_requested_at?: string | null;
      webshop_enabled?: boolean;
    };
    return {
      ...row,
      appointments_enabled: false,
      webshop_enabled: Boolean(row.webshop_enabled),
      ...defaultPortalModules(row as { portal_invoices_enabled?: boolean; portal_account_enabled?: boolean }),
      subscription_cancel_at_period_end: Boolean(row.subscription_cancel_at_period_end),
      subscription_cancel_requested_at: row.subscription_cancel_requested_at ?? null,
      portal_user_id: (row as { portal_user_id?: string | null }).portal_user_id ?? null,
    };
  }

  if (error && isPostgrestUnknownColumnError(error, "portal_invoices_enabled")) {
    const cols = COMMERCIAL_COLUMNS_WITH_PKG.filter((c) => c !== "portal_invoices_enabled");
    const r = await supabase.from("clients").select(cols.join(", ")).eq("subfolder_slug", slug).maybeSingle();
    if (r.error && isPostgrestUnknownColumnError(r.error, "portal_account_enabled")) {
      const cols2 = cols.filter((c) => c !== "portal_account_enabled");
      const r2 = await supabase.from("clients").select(cols2.join(", ")).eq("subfolder_slug", slug).maybeSingle();
      if (r2.error || !r2.data) return null;
      const row2 = r2.data as unknown as Omit<
        ClientCommercialRow,
        "portal_invoices_enabled" | "portal_account_enabled"
      >;
      return {
        ...row2,
        portal_invoices_enabled: true,
        portal_account_enabled: true,
        appointments_enabled: Boolean((row2 as { appointments_enabled?: boolean }).appointments_enabled),
        webshop_enabled: Boolean((row2 as { webshop_enabled?: boolean }).webshop_enabled),
        subscription_cancel_at_period_end: Boolean(
          (row2 as { subscription_cancel_at_period_end?: boolean }).subscription_cancel_at_period_end,
        ),
        subscription_cancel_requested_at:
          (row2 as { subscription_cancel_requested_at?: string | null }).subscription_cancel_requested_at ?? null,
        portal_user_id: (row2 as { portal_user_id?: string | null }).portal_user_id ?? null,
      };
    }
    if (r.error || !r.data) return null;
    const pr = r.data as unknown as Omit<ClientCommercialRow, "portal_invoices_enabled"> & {
      portal_account_enabled?: boolean;
    };
    return {
      ...pr,
      portal_invoices_enabled: true,
      portal_account_enabled:
        pr.portal_account_enabled !== undefined ? Boolean(pr.portal_account_enabled) : true,
      appointments_enabled: Boolean((pr as { appointments_enabled?: boolean }).appointments_enabled),
      webshop_enabled: Boolean((pr as { webshop_enabled?: boolean }).webshop_enabled),
      subscription_cancel_at_period_end: Boolean(
        (pr as { subscription_cancel_at_period_end?: boolean }).subscription_cancel_at_period_end,
      ),
      subscription_cancel_requested_at:
        (pr as { subscription_cancel_requested_at?: string | null }).subscription_cancel_requested_at ?? null,
      portal_user_id: (pr as { portal_user_id?: string | null }).portal_user_id ?? null,
    };
  }

  if (error && isPostgrestUnknownColumnError(error, "portal_account_enabled")) {
    const cols = COMMERCIAL_COLUMNS_WITH_PKG.filter((c) => c !== "portal_account_enabled");
    const r = await supabase.from("clients").select(cols.join(", ")).eq("subfolder_slug", slug).maybeSingle();
    if (r.error || !r.data) return null;
    const pr = r.data as unknown as Omit<ClientCommercialRow, "portal_account_enabled"> & {
      portal_invoices_enabled?: boolean;
    };
    return {
      ...pr,
      portal_account_enabled: true,
      portal_invoices_enabled:
        pr.portal_invoices_enabled !== undefined ? Boolean(pr.portal_invoices_enabled) : true,
      appointments_enabled: Boolean((pr as { appointments_enabled?: boolean }).appointments_enabled),
      webshop_enabled: Boolean((pr as { webshop_enabled?: boolean }).webshop_enabled),
      subscription_cancel_at_period_end: Boolean(
        (pr as { subscription_cancel_at_period_end?: boolean }).subscription_cancel_at_period_end,
      ),
      subscription_cancel_requested_at:
        (pr as { subscription_cancel_requested_at?: string | null }).subscription_cancel_requested_at ?? null,
      portal_user_id: (pr as { portal_user_id?: string | null }).portal_user_id ?? null,
    };
  }

  if (error && isPostgrestUnknownColumnError(error, "subscription_cancel_at_period_end")) {
    const r = await supabase
      .from("clients")
      .select(COMMERCIAL_COLUMNS_WITHOUT_SUB_CANCEL.join(", "))
      .eq("subfolder_slug", slug)
      .maybeSingle();
    if (r.error || !r.data) return null;
    const row = r.data as unknown as Omit<
      ClientCommercialRow,
      "subscription_cancel_at_period_end" | "subscription_cancel_requested_at"
    >;
    return {
      ...row,
      ...defaultPortalModules(row as { portal_invoices_enabled?: boolean; portal_account_enabled?: boolean }),
      webshop_enabled: Boolean((row as { webshop_enabled?: boolean }).webshop_enabled),
      subscription_cancel_at_period_end: false,
      subscription_cancel_requested_at: null,
      portal_user_id: (row as { portal_user_id?: string | null }).portal_user_id ?? null,
    };
  }

  if (error || !data) return null;
  const row = data as unknown as ClientCommercialRow;
  return {
    ...row,
    appointments_enabled: Boolean(row.appointments_enabled),
    webshop_enabled: Boolean(row.webshop_enabled),
    ...defaultPortalModules(row),
    subscription_cancel_at_period_end: Boolean(row.subscription_cancel_at_period_end),
    subscription_cancel_requested_at: row.subscription_cancel_requested_at ?? null,
    portal_user_id: row.portal_user_id ?? null,
  };
}
