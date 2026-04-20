import { getInvoiceStatusLabel, type InvoiceStoredStatus } from "@/lib/commercial/billing-helpers";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export type ClientActivityItem = {
  id: string;
  at: string;
  kind: "invoice_audit" | "site_generation" | "appointment" | "subscription";
  title: string;
  detail: string;
  href?: string;
};

export type ClientActivityResult = {
  items: ClientActivityItem[];
  /** Service role ontbreekt — tijdlijn kan niet worden opgebouwd. */
  error: "missing_service_role" | null;
};

type AuditRow = {
  id: string;
  created_at: string;
  action: string;
  previous_status: string | null;
  next_status: string | null;
  invoice_number_after: string | null;
  reason_code: string | null;
  source: string | null;
  entity_id: string;
};

type GenRow = {
  id: string;
  created_at: string;
  operation: string;
  status: string | null;
  outcome: string | null;
  prompt_excerpt: string | null;
};

type ApptRow = {
  id: string;
  created_at: string;
  updated_at: string;
  title: string;
  status: string;
  starts_at: string;
};

function labelOutcome(o: string | null): string {
  switch (o) {
    case "published":
      return "gepubliceerd";
    case "kept":
      return "concept behouden";
    case "abandoned":
      return "afgebroken";
    default:
      return o ?? "—";
  }
}

function labelGenStatus(s: string | null): string {
  switch (s) {
    case "success":
      return "gelukt";
    case "failure":
      return "mislukt";
    case "partial":
      return "gedeeltelijk";
    default:
      return s ?? "—";
  }
}

function formatAuditEvent(row: AuditRow, invoiceNumberHint: string | null): ClientActivityItem {
  const num = row.invoice_number_after?.trim() || invoiceNumberHint || "Concept";
  let title: string;
  let detail: string;

  if (row.action === "invoice_number_assigned") {
    title = "Factuurnummer toegekend";
    detail = row.invoice_number_after?.trim() ? `Nummer: ${row.invoice_number_after}` : "Nummer bijgewerkt";
  } else if (row.action === "transition_denied") {
    title = "Factuur: statuswijziging geweigerd";
    detail = row.reason_code ? `Reden: ${row.reason_code}` : "Geen details";
  } else if (row.action === "status_changed") {
    const prev = row.previous_status
      ? getInvoiceStatusLabel(row.previous_status as InvoiceStoredStatus)
      : "—";
    const next = row.next_status
      ? getInvoiceStatusLabel(row.next_status as InvoiceStoredStatus)
      : "—";
    title = `Factuur ${num}`;
    detail = `Status: ${prev} → ${next}`;
  } else {
    title = `Factuur (${row.action})`;
    detail = row.reason_code ?? "";
  }

  if (row.source) {
    detail = detail ? `${detail} · bron: ${row.source}` : `Bron: ${row.source}`;
  }

  return {
    id: `audit-${row.id}`,
    at: row.created_at,
    kind: "invoice_audit",
    title,
    detail,
    href: `/admin/invoices/${row.entity_id}`,
  };
}

/**
 * Tijdlijn voor klantdossier. Alleen server-side onder /admin aanroepen.
 * Vereist SUPABASE_SERVICE_ROLE_KEY (anders `error: missing_service_role`).
 */
export async function listClientActivityForDossier(
  clientId: string,
  options?: { limit?: number },
): Promise<ClientActivityResult> {
  const limit = Math.min(options?.limit ?? 80, 200);

  let supabase: ReturnType<typeof createServiceRoleClient>;
  try {
    supabase = createServiceRoleClient();
  } catch {
    return { items: [], error: "missing_service_role" };
  }

  const items: ClientActivityItem[] = [];

  const { data: clientMeta } = await supabase
    .from("clients")
    .select("subfolder_slug, subscription_cancel_requested_at")
    .eq("id", clientId)
    .maybeSingle();
  const meta = clientMeta as { subfolder_slug?: string | null; subscription_cancel_requested_at?: string | null } | null;
  const slug = meta?.subfolder_slug?.trim() ?? null;
  const studioHref = slug ? `/admin/ops/studio?slug=${encodeURIComponent(slug)}` : undefined;
  const snapshotsHref = slug ? `/admin/clients/${encodeURIComponent(slug)}/snapshots` : undefined;

  const { data: invoiceRows } = await supabase.from("invoices").select("id, invoice_number").eq("client_id", clientId);
  const invoiceIds = (invoiceRows ?? []).map((r) => r.id as string);
  const numberById = new Map((invoiceRows ?? []).map((r) => [r.id as string, (r.invoice_number as string | null) ?? null]));

  if (invoiceIds.length > 0) {
    const { data: audits } = await supabase
      .from("invoice_audit_events")
      .select(
        "id, created_at, action, previous_status, next_status, invoice_number_after, reason_code, source, entity_id",
      )
      .in("entity_id", invoiceIds)
      .order("created_at", { ascending: false })
      .limit(120);

    for (const row of (audits ?? []) as unknown as AuditRow[]) {
      items.push(formatAuditEvent(row, numberById.get(row.entity_id) ?? null));
    }
  }

  const { data: runs, error: runErr } = await supabase
    .from("site_generation_runs")
    .select("id, created_at, operation, status, outcome, prompt_excerpt")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(60);

  if (!runErr && runs?.length) {
    for (const r of runs as GenRow[]) {
      const excerpt = r.prompt_excerpt?.trim().slice(0, 120);
      items.push({
        id: `gen-${r.id}`,
        at: r.created_at,
        kind: "site_generation",
        title: `Site: ${r.operation}`,
        detail: [
          r.outcome ? `Uitkomst: ${labelOutcome(r.outcome)}` : null,
          r.status ? `Run: ${labelGenStatus(r.status)}` : null,
          excerpt ? `“${excerpt}${r.prompt_excerpt && r.prompt_excerpt.length > 120 ? "…" : ""}”` : null,
        ]
          .filter(Boolean)
          .join(" · "),
        href: studioHref ?? snapshotsHref,
      });
    }
  }

  const { data: appts, error: apptErr } = await supabase
    .from("client_appointments")
    .select("id, created_at, updated_at, title, status, starts_at")
    .eq("client_id", clientId)
    .order("updated_at", { ascending: false })
    .limit(40);

  if (!apptErr && appts?.length) {
    const apptPortalHref = slug ? `/agenda/${encodeURIComponent(slug)}?tab=afspraken` : undefined;
    for (const a of appts as ApptRow[]) {
      const start = new Date(a.starts_at);
      const when = Number.isNaN(start.getTime()) ? a.starts_at : start.toLocaleString("nl-NL", { dateStyle: "short", timeStyle: "short" });
      const isNew = a.updated_at === a.created_at || Math.abs(new Date(a.updated_at).getTime() - new Date(a.created_at).getTime()) < 2000;
      items.push({
        id: `appt-${a.id}`,
        at: a.updated_at || a.created_at,
        kind: "appointment",
        title: isNew ? `Afspraak gepland: ${a.title}` : `Afspraak bijgewerkt: ${a.title}`,
        detail: `${a.status === "cancelled" ? "Geannuleerd" : "Gepland"} · ${when}`,
        href: apptPortalHref,
      });
    }
  }

  const cancelAt = meta?.subscription_cancel_requested_at ?? null;
  if (cancelAt && slug) {
    items.push({
      id: `sub-cancel-${clientId}`,
      at: cancelAt,
      kind: "subscription",
      title: "Opzegging abonnement (portaal)",
      detail: "Klant heeft opzeggen bevestigd voor einde lopende periode.",
      href: `/portal/${encodeURIComponent(slug)}/account`,
    });
  }

  items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  return { items: items.slice(0, limit), error: null };
}
