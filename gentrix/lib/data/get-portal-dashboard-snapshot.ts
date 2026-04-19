import type { ActivePortalClient } from "@/lib/data/get-portal-client";
import { getClientCommercialBySlug } from "@/lib/data/get-client-commercial-by-slug";
import { listInvoices, type InvoiceWithClient } from "@/lib/data/list-invoices";
import {
  formatCurrencyEUR,
  formatDocumentDateTime,
  getInvoiceListStatusLabel,
  isInvoiceStatusVisibleInPortal,
  parseInvoiceAmount,
  type InvoiceStoredStatus,
} from "@/lib/commercial/billing-helpers";
import { PAYMENT_STATUS_LABELS, PLAN_TYPE_LABELS } from "@/lib/commercial/client-commercial";
import type { PaymentStatus, PlanType } from "@/lib/commercial/client-commercial";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type PortalDashboardSnapshot = {
  statusLine1: string;
  statusLine2: string;
  latestInvoice: {
    id: string;
    number: string;
    amountLabel: string;
    statusLabel: string;
    href: string;
  } | null;
  nextAppointment: {
    id: string;
    title: string;
    whenLabel: string;
    href: string;
  } | null;
  /** Afspraken-module: vandaag gepland + komende 7 dagen (status scheduled). */
  appointmentStats: { todayScheduled: number; upcomingWeekScheduled: number } | null;
};

function pickLatestPortalInvoice(rows: InvoiceWithClient[]): InvoiceWithClient | null {
  const visible = rows.filter((inv) => isInvoiceStatusVisibleInPortal(inv.status as InvoiceStoredStatus));
  return visible[0] ?? null;
}

function formatAppointmentWhen(startsAt: string, endsAt: string): string {
  const s = new Date(startsAt);
  const e = new Date(endsAt);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return startsAt;
  const datePart = new Intl.DateTimeFormat("nl-NL", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(s);
  const endPart = new Intl.DateTimeFormat("nl-NL", { hour: "2-digit", minute: "2-digit" }).format(e);
  return `${datePart} – ${endPart}`;
}

async function fetchAppointmentStats(
  clientId: string,
  supabase: SupabaseClient,
): Promise<{ todayScheduled: number; upcomingWeekScheduled: number } | null> {
  try {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfWeek = new Date(startOfToday);
    endOfWeek.setDate(endOfWeek.getDate() + 8);
    const todayIso = startOfToday.toISOString();
    const weekIso = endOfWeek.toISOString();

    const { count: todayCount, error: e1 } = await supabase
      .from("client_appointments")
      .select("id", { count: "exact", head: true })
      .eq("client_id", clientId)
      .eq("status", "scheduled")
      .gte("starts_at", todayIso)
      .lt("starts_at", new Date(startOfToday.getTime() + 86400000).toISOString());

    const { count: weekCount, error: e2 } = await supabase
      .from("client_appointments")
      .select("id", { count: "exact", head: true })
      .eq("client_id", clientId)
      .eq("status", "scheduled")
      .gte("starts_at", now.toISOString())
      .lt("starts_at", weekIso);

    if (e1 || e2) {
      if (e1?.message?.includes("client_appointments") || e1?.code === "42P01") return null;
      return null;
    }
    return {
      todayScheduled: todayCount ?? 0,
      upcomingWeekScheduled: weekCount ?? 0,
    };
  } catch {
    return null;
  }
}

async function fetchNextScheduledAppointment(
  clientId: string,
  supabase: SupabaseClient,
): Promise<{ id: string; title: string; starts_at: string; ends_at: string } | null> {
  try {
    const nowIso = new Date().toISOString();
    const { data, error } = await supabase
      .from("client_appointments")
      .select("id, title, starts_at, ends_at, status")
      .eq("client_id", clientId)
      .eq("status", "scheduled")
      .gte("starts_at", nowIso)
      .order("starts_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) {
      if (error.message?.includes("client_appointments") || error.code === "42P01") {
        return null;
      }
      return null;
    }
    if (!data) return null;
    const row = data as { id: string; title: string; starts_at: string; ends_at: string };
    return row;
  } catch {
    return null;
  }
}

function subscriptionLinesFromCommercial(
  accountEnabled: boolean,
  row: Awaited<ReturnType<typeof getClientCommercialBySlug>>,
): { line1: string; line2: string } {
  if (!accountEnabled) {
    return {
      line1: "Account en abonnement staan in dit portaal uit.",
      line2: "Voor facturatie of contract neem je contact op met je contactpersoon.",
    };
  }
  if (!row || row.status !== "active") {
    return {
      line1: "Geen actief abonnementsprofiel gekoppeld aan dit portaal.",
      line2: "Neem contact op als dit niet klopt.",
    };
  }

  const planType = row.plan_type && row.plan_type in PLAN_TYPE_LABELS ? row.plan_type as PlanType : null;
  const planLabel =
    row.plan_label?.trim() ||
    (planType ? PLAN_TYPE_LABELS[planType] : row.plan_type ?? "—");
  const payLabel =
    row.payment_status in PAYMENT_STATUS_LABELS
      ? PAYMENT_STATUS_LABELS[row.payment_status as PaymentStatus]
      : row.payment_status;

  const line1 = `${planLabel} · ${payLabel}`;

  let line2: string;
  if (row.subscription_cancel_at_period_end) {
    line2 = "Opzegging geregistreerd; het abonnement loopt door tot de afgesproken einddatum.";
  } else if (row.plan_type === "subscription" && row.subscription_renews_at) {
    line2 = `Volgende verlenging: ${formatDocumentDateTime(row.subscription_renews_at)}`;
  } else if (row.plan_type === "subscription") {
    line2 = "Abonnement actief; geen verlengingsdatum bekend in dit portaal.";
  } else {
    line2 = "Details over betaling en opzeggen vind je onder Account.";
  }

  return { line1, line2 };
}

/**
 * Serverdata voor het portaal-dashboard (abonnement, laatste factuur, volgende afspraak).
 */
export async function getPortalDashboardSnapshot(
  slug: string,
  client: ActivePortalClient,
  options?: {
    /** Zelfde client voor alle portaal-leesqueries (sessie of service role bij studio-preview). */
    supabaseForReads?: SupabaseClient;
  },
): Promise<PortalDashboardSnapshot> {
  const enc = encodeURIComponent(slug);
  const base = `/portal/${enc}`;

  const dataClient: SupabaseClient = options?.supabaseForReads ?? (await createSupabaseServerClient());

  const [commercial, invoices, nextAppt, apptStats] = await Promise.all([
    client.portal_account_enabled ? getClientCommercialBySlug(slug, dataClient) : Promise.resolve(null),
    client.portal_invoices_enabled ? listInvoices({ clientId: client.id, supabase: dataClient }) : Promise.resolve([]),
    client.appointments_enabled ? fetchNextScheduledAppointment(client.id, dataClient) : Promise.resolve(null),
    client.appointments_enabled ? fetchAppointmentStats(client.id, dataClient) : Promise.resolve(null),
  ]);

  const { line1: statusLine1, line2: statusLine2 } = subscriptionLinesFromCommercial(
    client.portal_account_enabled,
    commercial,
  );

  const latest = client.portal_invoices_enabled ? pickLatestPortalInvoice(invoices) : null;
  const latestInvoice = latest
    ? {
        id: latest.id,
        number: latest.invoice_number?.trim() || "—",
        amountLabel: formatCurrencyEUR(parseInvoiceAmount(latest.amount)),
        statusLabel: getInvoiceListStatusLabel(latest),
        href: `${base}/facturen/${encodeURIComponent(latest.id)}`,
      }
    : null;

  const nextAppointment =
    nextAppt && client.appointments_enabled
      ? {
          id: nextAppt.id,
          title: nextAppt.title?.trim() || "Afspraak",
          whenLabel: formatAppointmentWhen(nextAppt.starts_at, nextAppt.ends_at),
          href: `/agenda/${enc}?tab=afspraken`,
        }
      : null;

  return {
    statusLine1,
    statusLine2,
    latestInvoice,
    nextAppointment,
    appointmentStats: client.appointments_enabled ? apptStats : null,
  };
}
