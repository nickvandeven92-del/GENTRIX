import { NextResponse } from "next/server";
import { z } from "zod";
import {
  PAYMENT_STATUSES,
  PIPELINE_STAGES,
  PLAN_TYPES,
} from "@/lib/commercial/client-commercial";
import { requireAdminApiAuth } from "@/lib/auth/require-admin-api";
import { isValidSubfolderSlug } from "@/lib/slug";
import {
  sendPortalInviteForClientSlug,
  shouldTriggerAutoPortalInvite,
} from "@/lib/portal/portal-invite";
import { syncKameleonShopTenant } from "@/lib/shop/sync-kameleon-tenant";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { isPostgrestUnknownColumnError } from "@/lib/supabase/postgrest-unknown-column";

const optionalString = z.union([z.string().max(8000), z.literal("")]).optional().nullable();

const emptyableEmail = z
  .union([z.string().email().max(320), z.literal(""), z.null()])
  .optional();

/** Browser datetime-local / date; leeg = null. Postgres timestamptz accepteert veel ISO-achtige strings. */
const dateTimeField = z.union([z.string().max(50), z.literal(""), z.null()]).optional();

const patchSchema = z.object({
  billing_email: emptyableEmail,
  phone: z.string().max(80).optional().nullable().or(z.literal("")),
  company_legal_name: z.string().max(200).optional().nullable().or(z.literal("")),
  vat_number: z.string().max(40).optional().nullable().or(z.literal("")),
  billing_address: optionalString,
  plan_type: z
    .union([z.enum(PLAN_TYPES), z.literal(""), z.null()])
    .optional()
    .transform((v) => (v === "" ? null : v)),
  plan_label: z.string().max(120).optional().nullable().or(z.literal("")),
  payment_status: z.enum(PAYMENT_STATUSES).optional(),
  payment_provider: z.string().max(40).optional().nullable().or(z.literal("")),
  payment_reference: z.string().max(200).optional().nullable().or(z.literal("")),
  subscription_renews_at: dateTimeField,
  delivered_at: dateTimeField,
  contract_accepted_at: dateTimeField,
  internal_notes: optionalString,
  pipeline_stage: z.enum(PIPELINE_STAGES).optional(),
  custom_domain: z.union([z.string().max(253), z.literal(""), z.null()]).optional(),
  domain_verified: z.boolean().optional(),
  domain_dns_target: z.string().max(500).optional().nullable().or(z.literal("")),
  appointments_enabled: z.boolean().optional(),
  webshop_enabled: z.boolean().optional(),
  portal_invoices_enabled: z.boolean().optional(),
  portal_account_enabled: z.boolean().optional(),
  subscription_cancel_at_period_end: z.boolean().optional(),
  subscription_cancel_requested_at: dateTimeField,
  /** Supabase Auth user id; leeg = koppeling verwijderen. */
  portal_user_id: z.union([z.string().uuid(), z.literal(""), z.null()]).optional(),
});

type RouteContext = { params: Promise<{ subfolder_slug: string }> };

type PortalCommercialSnapshot = {
  billing_email: string | null;
  portal_user_id: string | null;
  payment_status: string;
  pipeline_stage: string;
};

async function loadCommercialPortalSnapshot(
  supabase: ReturnType<typeof createServiceRoleClient>,
  subfolder_slug: string,
): Promise<PortalCommercialSnapshot | null> {
  const full = await supabase
    .from("clients")
    .select("billing_email, portal_user_id, payment_status, pipeline_stage")
    .eq("subfolder_slug", subfolder_slug)
    .maybeSingle();

  if (!full.error && full.data) {
    const r = full.data as Record<string, unknown>;
    return {
      billing_email: (r.billing_email as string | null) ?? null,
      portal_user_id: (r.portal_user_id as string | null) ?? null,
      payment_status: String(r.payment_status ?? "none"),
      pipeline_stage: String(r.pipeline_stage ?? "lead"),
    };
  }

  if (full.error && isPostgrestUnknownColumnError(full.error, "portal_user_id")) {
    const partial = await supabase
      .from("clients")
      .select("billing_email, payment_status, pipeline_stage")
      .eq("subfolder_slug", subfolder_slug)
      .maybeSingle();
    if (partial.error || !partial.data) return null;
    const r = partial.data as Record<string, unknown>;
    return {
      billing_email: (r.billing_email as string | null) ?? null,
      portal_user_id: null,
      payment_status: String(r.payment_status ?? "none"),
      pipeline_stage: String(r.pipeline_stage ?? "lead"),
    };
  }

  return null;
}

function emptyToNull<T extends string | null | undefined>(v: T): T | null {
  if (v === "" || v === undefined) return null;
  return v;
}

function normalizeHostname(s: string | null | undefined): string | null {
  if (s == null || s === "") return null;
  const h = s
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .split("/")[0];
  return h || null;
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireAdminApiAuth();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.message }, { status: auth.status });
  }

  const { subfolder_slug: raw } = await context.params;
  const subfolder_slug = decodeURIComponent(raw);
  if (!isValidSubfolderSlug(subfolder_slug)) {
    return NextResponse.json({ ok: false, error: "Ongeldige slug." }, { status: 400 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Ongeldige JSON." }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues.map((i) => i.message).join(" ") },
      { status: 400 },
    );
  }

  const p = parsed.data;
  const row: Record<string, unknown> = {};

  if (p.billing_email !== undefined) row.billing_email = emptyToNull(p.billing_email);
  if (p.phone !== undefined) row.phone = emptyToNull(p.phone);
  if (p.company_legal_name !== undefined) row.company_legal_name = emptyToNull(p.company_legal_name);
  if (p.vat_number !== undefined) row.vat_number = emptyToNull(p.vat_number);
  if (p.billing_address !== undefined) row.billing_address = emptyToNull(p.billing_address);
  if (p.plan_type !== undefined) row.plan_type = p.plan_type;
  if (p.plan_label !== undefined) row.plan_label = emptyToNull(p.plan_label);
  if (p.payment_status !== undefined) row.payment_status = p.payment_status;
  if (p.payment_provider !== undefined) row.payment_provider = emptyToNull(p.payment_provider);
  if (p.payment_reference !== undefined) row.payment_reference = emptyToNull(p.payment_reference);
  if (p.subscription_renews_at !== undefined) {
    row.subscription_renews_at = p.subscription_renews_at === "" ? null : p.subscription_renews_at;
  }
  if (p.delivered_at !== undefined) row.delivered_at = p.delivered_at === "" ? null : p.delivered_at;
  if (p.contract_accepted_at !== undefined) {
    row.contract_accepted_at = p.contract_accepted_at === "" ? null : p.contract_accepted_at;
  }
  if (p.internal_notes !== undefined) row.internal_notes = emptyToNull(p.internal_notes);
  if (p.pipeline_stage !== undefined) row.pipeline_stage = p.pipeline_stage;
  if (p.custom_domain !== undefined) row.custom_domain = normalizeHostname(p.custom_domain);
  if (p.domain_verified !== undefined) row.domain_verified = p.domain_verified;
  if (p.domain_dns_target !== undefined) row.domain_dns_target = emptyToNull(p.domain_dns_target);
  if (p.appointments_enabled !== undefined) row.appointments_enabled = p.appointments_enabled;
  if (p.webshop_enabled !== undefined) row.webshop_enabled = p.webshop_enabled;
  if (p.portal_invoices_enabled !== undefined) row.portal_invoices_enabled = p.portal_invoices_enabled;
  if (p.portal_account_enabled !== undefined) row.portal_account_enabled = p.portal_account_enabled;
  if (p.subscription_cancel_at_period_end !== undefined) {
    row.subscription_cancel_at_period_end = p.subscription_cancel_at_period_end;
  }
  if (p.subscription_cancel_requested_at !== undefined) {
    row.subscription_cancel_requested_at =
      p.subscription_cancel_requested_at === "" ? null : p.subscription_cancel_requested_at;
  }
  if (p.portal_user_id !== undefined) {
    row.portal_user_id = p.portal_user_id === "" || p.portal_user_id === null ? null : p.portal_user_id;
  }

  if (Object.keys(row).length === 0) {
    return NextResponse.json({ ok: false, error: "Geen velden om bij te werken." }, { status: 400 });
  }

  row.commercial_unlinked_at = null;

  try {
    const supabase = createServiceRoleClient();
    const beforeSnapshot = await loadCommercialPortalSnapshot(supabase, subfolder_slug);

    const { data: beforeActivation } = await supabase
      .from("clients")
      .select("payment_status, status")
      .eq("subfolder_slug", subfolder_slug)
      .maybeSingle();

    let { error } = await supabase.from("clients").update(row).eq("subfolder_slug", subfolder_slug);

    if (error && isPostgrestUnknownColumnError(error, "commercial_unlinked_at")) {
      const { commercial_unlinked_at: _drop, ...rest } = row;
      ({ error } = await supabase.from("clients").update(rest).eq("subfolder_slug", subfolder_slug));
    }

    if (error) {
      if (error.message.includes("clients_generation_package_check")) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "Database weigert generation_package. Voer migratie uit: 20260403180000_single_studio_generation_package.sql (kolom moet `studio` zijn).",
          },
          { status: 400 },
        );
      }
      if (error.message.includes("clients_plan_type_check") || error.message.includes("check constraint")) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "Database weigert de waarde. Controleer of migratie 20260330140000_clients_commercial_fields.sql is uitgevoerd.",
          },
          { status: 400 },
        );
      }
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    if (
      p.payment_status === "paid" &&
      beforeActivation &&
      String(beforeActivation.payment_status ?? "none") !== "paid" &&
      beforeActivation.status === "draft"
    ) {
      await supabase
        .from("clients")
        .update({ status: "active", updated_at: new Date().toISOString() })
        .eq("subfolder_slug", subfolder_slug);
    }

    const afterSnapshot = await loadCommercialPortalSnapshot(supabase, subfolder_slug);

    let portal_invite:
      | { status: "sent"; email: string; email_dispatched: boolean }
      | { status: "skipped"; reason: string }
      | { status: "error"; error: string }
      | undefined;

    if (
      afterSnapshot &&
      shouldTriggerAutoPortalInvite(beforeSnapshot, afterSnapshot)
    ) {
      const inv = await sendPortalInviteForClientSlug(subfolder_slug);
      if (inv.ok && inv.status === "sent") {
        portal_invite = {
          status: "sent",
          email: inv.email,
          email_dispatched: inv.emailDispatched,
        };
      } else if (inv.ok && inv.status === "skipped") {
        portal_invite = { status: "skipped", reason: inv.reason };
      } else if (!inv.ok) {
        portal_invite = { status: "error", error: inv.error };
      }
    }

    let kameleon_shop_sync: Awaited<ReturnType<typeof syncKameleonShopTenant>> | undefined;
    if (p.webshop_enabled !== undefined) {
      const { data: nameRow } = await supabase
        .from("clients")
        .select("name")
        .eq("subfolder_slug", subfolder_slug)
        .maybeSingle();
      const displayName =
        typeof nameRow?.name === "string" && nameRow.name.trim() !== ""
          ? nameRow.name
          : subfolder_slug;
      kameleon_shop_sync = await syncKameleonShopTenant({
        subfolderSlug: subfolder_slug,
        displayName,
        webshopEnabled: p.webshop_enabled,
      });
    }

    return NextResponse.json({
      ok: true,
      ...(portal_invite ? { portal_invite } : {}),
      ...(kameleon_shop_sync ? { kameleon_shop_sync } : {}),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Onbekende fout";
    if (message.includes("SUPABASE_SERVICE_ROLE_KEY")) {
      return NextResponse.json(
        { ok: false, error: "SUPABASE_SERVICE_ROLE_KEY ontbreekt (server-only)." },
        { status: 503 },
      );
    }
    return NextResponse.json({ ok: false, error: message }, { status: 503 });
  }
}
