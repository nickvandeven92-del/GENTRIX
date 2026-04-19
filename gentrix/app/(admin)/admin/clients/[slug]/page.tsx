import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FolderArchive } from "lucide-react";
import { PromoVideoDownloadButton } from "@/components/admin/promo-video-download-button";
import {
  formatCurrencyEUR,
  formatDocumentDate,
  getInvoiceListStatusLabel,
  parseInvoiceAmount,
  type InvoiceStoredStatus,
} from "@/lib/commercial/billing-helpers";
import {
  PAYMENT_STATUS_LABELS,
  PIPELINE_STAGE_LABELS,
  PLAN_TYPE_LABELS,
  type PaymentStatus,
  type PipelineStage,
  type PlanType,
} from "@/lib/commercial/client-commercial";
import { getClientFinancialSummary } from "@/lib/data/client-financial-summary";
import { AdminPortalInvoiceRowLink } from "@/components/admin/billing/admin-portal-invoice-links";
import { AdminBookingAgendaSummary } from "@/components/admin/admin-booking-agenda-summary";
import { ClientPortalModulesCard } from "@/components/admin/client-portal-modules-card";
import { ClientDossierNotes } from "@/components/admin/client-dossier-notes";
import { getClientCommercialBySlug } from "@/lib/data/get-client-commercial-by-slug";
import { listClientDossierNotes } from "@/lib/data/list-client-dossier-notes";
import { listInvoices } from "@/lib/data/list-invoices";
import { getPublicAppUrl } from "@/lib/site/public-app-url";
import { publicLiveBookingHref } from "@/lib/site/studio-section-visibility";
import { cn } from "@/lib/utils";

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const row = await getClientCommercialBySlug(decodeURIComponent(slug ?? ""));
  if (!row) return { title: "Klant" };
  return { title: `${row.name} — dossier` };
}

function statusLabel(status: string) {
  switch (status) {
    case "active":
      return "Actief";
    case "draft":
      return "Concept";
    case "paused":
      return "Gepauzeerd";
    case "archived":
      return "Archief";
    default:
      return status;
  }
}

export default async function ClientOverviewPage({ params }: PageProps) {
  const { slug } = await params;
  const decoded = decodeURIComponent(slug ?? "");
  if (!decoded) notFound();

  const row = await getClientCommercialBySlug(decoded);
  if (!row) notFound();

  const [summary, recentInvoices, dossierNotes] = await Promise.all([
    getClientFinancialSummary(row.id),
    listInvoices({ clientId: row.id }).then((all) => all.slice(0, 5)),
    listClientDossierNotes(row.id),
  ]);

  const enc = encodeURIComponent(row.subfolder_slug);
  const base = `/admin/clients/${enc}`;
  const appOrigin = getPublicAppUrl();
  const bookingAbsoluteUrl = `${appOrigin}${publicLiveBookingHref(row.subfolder_slug)}`;
  const shopAbsoluteUrl = `${appOrigin}/winkel/${encodeURIComponent(row.subfolder_slug)}`;

  const companyName = row.company_legal_name?.trim() || row.name;

  return (
    <div className="space-y-8">
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Openstaand</p>
          <p className="mt-1 text-lg font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
            {formatCurrencyEUR(summary.outstandingAmount)}
          </p>
          <Link href={`${base}/invoices`} className="mt-2 inline-block text-xs font-medium text-blue-700 hover:underline dark:text-blue-400">
            Naar facturen
          </Link>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Open offertes</p>
          <p className="mt-1 text-lg font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">{summary.openQuotesCount}</p>
          <Link href={`${base}/quotes`} className="mt-2 inline-block text-xs font-medium text-blue-700 hover:underline dark:text-blue-400">
            Naar offertes
          </Link>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Actieve deals</p>
          <p className="mt-1 text-lg font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">{summary.activeDealsCount}</p>
          <Link href={`${base}/deals`} className="mt-2 inline-block text-xs font-medium text-blue-700 hover:underline dark:text-blue-400">
            Naar deals
          </Link>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Laatste activiteit</p>
          <p className="mt-1 text-sm font-medium text-zinc-900 dark:text-zinc-50">
            {summary.lastActivityAt
              ? new Date(summary.lastActivityAt).toLocaleString("nl-NL", {
                  dateStyle: "short",
                  timeStyle: "short",
                })
              : "—"}
          </p>
          <Link href={`${base}/activity`} className="mt-2 inline-block text-xs font-medium text-blue-700 hover:underline dark:text-blue-400">
            Tijdlijn
          </Link>
        </div>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Bedrijf & contact</h2>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs text-zinc-500 dark:text-zinc-400">Klantnummer</dt>
            <dd className="mt-0.5 font-mono text-sm font-medium text-zinc-900 dark:text-zinc-50">
              {row.client_number ?? "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500 dark:text-zinc-400">Bedrijfsnaam</dt>
            <dd className="mt-0.5 text-sm font-medium text-zinc-900 dark:text-zinc-50">{companyName}</dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500 dark:text-zinc-400">Status</dt>
            <dd className="mt-0.5 text-sm font-medium text-zinc-900 dark:text-zinc-50">{statusLabel(row.status)}</dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500 dark:text-zinc-400">Factuur e-mail</dt>
            <dd className="mt-0.5 text-sm text-zinc-800 dark:text-zinc-200">{row.billing_email || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500 dark:text-zinc-400">Telefoon</dt>
            <dd className="mt-0.5 text-sm text-zinc-800 dark:text-zinc-200">{row.phone || "—"}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs text-zinc-500 dark:text-zinc-400">Factuuradres</dt>
            <dd className="mt-0.5 whitespace-pre-wrap text-sm text-zinc-800 dark:text-zinc-200">{row.billing_address || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500 dark:text-zinc-400">BTW-nummer</dt>
            <dd className="mt-0.5 text-sm text-zinc-800 dark:text-zinc-200">{row.vat_number || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500 dark:text-zinc-400">Verloopt op</dt>
            <dd className="mt-0.5 text-sm text-zinc-800 dark:text-zinc-200">
              {row.subscription_renews_at ? formatDocumentDate(row.subscription_renews_at) : "—"}
            </dd>
          </div>
        </dl>
      </section>

      <ClientDossierNotes subfolderSlug={row.subfolder_slug} initialNotes={dossierNotes} />

      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Commerciële velden en domein beheer je onder{" "}
        <Link href={`${base}/commercial`} className="font-medium text-blue-800 underline dark:text-blue-400">
          Commercie & domein
        </Link>
        . Websites en editor staan onder het tabblad{" "}
        <Link href={`${base}/websites`} className="font-medium text-blue-800 underline dark:text-blue-400">
          Websites
        </Link>
        .
      </p>

      <ClientPortalModulesCard
        subfolderSlug={row.subfolder_slug}
        portal_invoices_enabled={row.portal_invoices_enabled}
        portal_account_enabled={row.portal_account_enabled}
        appointments_enabled={row.appointments_enabled}
        webshop_enabled={row.webshop_enabled}
        bookingAbsoluteUrl={bookingAbsoluteUrl}
        shopAbsoluteUrl={shopAbsoluteUrl}
      />

      {row.appointments_enabled ? (
        <AdminBookingAgendaSummary
          clientId={row.id}
          subfolderSlug={row.subfolder_slug}
          bookingAbsoluteUrl={bookingAbsoluteUrl}
        />
      ) : null}

      {row.description ? (
        <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Omschrijving</h2>
          <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-800 dark:text-zinc-200">{row.description}</p>
        </section>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[
          {
            label: "Betaling",
            value:
              row.payment_status in PAYMENT_STATUS_LABELS
                ? PAYMENT_STATUS_LABELS[row.payment_status as PaymentStatus]
                : row.payment_status,
          },
          {
            label: "Pipeline",
            value:
              row.pipeline_stage in PIPELINE_STAGE_LABELS
                ? PIPELINE_STAGE_LABELS[row.pipeline_stage as PipelineStage]
                : row.pipeline_stage,
          },
          {
            label: "Plantype",
            value:
              row.plan_type && row.plan_type in PLAN_TYPE_LABELS
                ? PLAN_TYPE_LABELS[row.plan_type as PlanType]
                : row.plan_label || "—",
          },
          { label: "Gewenst domein", value: row.custom_domain || "—" },
          {
            label: "DNS / SSL",
            value: row.domain_verified ? "Gemarkeerd als OK" : "Nog controleren",
          },
        ].map((c) => (
          <div
            key={c.label}
            className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
          >
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{c.label}</p>
            <p className="mt-1 text-sm font-medium text-zinc-900 dark:text-zinc-50">{c.value}</p>
          </div>
        ))}
      </section>

      {recentInvoices.length > 0 ? (
        <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Recente facturen</h2>
            <Link href={`${base}/invoices`} className="text-xs font-medium text-blue-700 hover:underline dark:text-blue-400">
              Alles bekijken
            </Link>
          </div>
          <ul className="mt-3 divide-y divide-zinc-100 dark:divide-zinc-800">
            {recentInvoices.map((inv) => (
              <li key={inv.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <span className="font-mono text-xs text-zinc-800 dark:text-zinc-200">
                  {inv.invoice_number?.trim()
                    ? inv.invoice_number
                    : inv.status === "draft"
                      ? "Bij versturen"
                      : "—"}
                </span>
                <span className="tabular-nums text-zinc-700 dark:text-zinc-300">
                  {formatCurrencyEUR(parseInvoiceAmount(inv.amount))}
                </span>
                <span className="text-zinc-600 dark:text-zinc-400">
                  {getInvoiceListStatusLabel({
                    status: inv.status,
                    due_date: inv.due_date,
                    paid_at: inv.paid_at,
                  })}
                </span>
                <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <Link href={`/admin/invoices/${inv.id}`} className="text-xs font-medium text-blue-700 hover:underline dark:text-blue-400">
                    Openen
                  </Link>
                  <AdminPortalInvoiceRowLink
                    invoiceId={inv.id}
                    status={inv.status as InvoiceStoredStatus}
                    clients={inv.clients}
                    className="inline-flex items-center gap-1 text-xs font-medium text-violet-800 underline underline-offset-2 dark:text-violet-300"
                  />
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="rounded-xl border border-blue-200/80 bg-blue-50/40 p-4 dark:border-blue-900/40 dark:bg-blue-950/20">
        <p className="text-xs font-semibold uppercase tracking-wide text-blue-900 dark:text-blue-200">Website</p>
        <p className="mt-1 text-sm text-zinc-800 dark:text-zinc-200">
          Bewerk de site in de HTML-editor; concept bekijk je via concept-preview.{" "}
          <Link href="/admin/ops/werkwijze" className="font-medium text-violet-800 underline dark:text-violet-300">
            Veelgestelde vragen
          </Link>
          {" · "}
          <Link href="/admin/prompt" className="font-medium text-zinc-600 underline dark:text-zinc-400">
            technische referentie
          </Link>
          .
        </p>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Concept vs live</p>
        <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">
          <strong>Concept opslaan</strong> wijzigt alleen de draft-pointer. <strong>Live zetten</strong> doe je in de
          HTML-editor (knop naast concept opslaan), in het klantportaal onder <em>Website</em>, of via het
          productie-board. Bekijk het concept zonder de live site te wijzigen via concept-preview.
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-sm font-medium">
          <Link
            href={`/admin/editor/${enc}`}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-900"
          >
            HTML-editor
          </Link>
          <Link
            href={`${base}/preview`}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-900"
          >
            Concept-preview
          </Link>
          <Link
            href={`${base}/snapshots`}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-900"
          >
            Snapshots & diff
          </Link>
        </div>
      </section>

      {row.internal_notes ? (
        <section className="rounded-xl border border-amber-200/80 bg-amber-50/50 p-4 dark:border-amber-900/40 dark:bg-amber-950/20">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-amber-900 dark:text-amber-200">
            Interne notities (commercie)
          </h2>
          <p className="mt-1 text-xs text-amber-900/80 dark:text-amber-200/80">
            Eén lang veld vanuit Commercie & domein — zonder auteur of tijdstip. Voor een tijdlijn met wie wat schreef: sectie{" "}
            <strong className="font-medium">Notities</strong> hierboven.
          </p>
          <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-800 dark:text-amber-950/90 dark:text-zinc-200">
            {row.internal_notes}
          </p>
        </section>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Link
          href={`${base}/commercial`}
          className={cn(
            "inline-flex rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white",
            "hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white",
          )}
        >
          Bewerk commercie & domein
        </Link>
        <a
          href={`/api/admin/clients/${enc}/export-zip`}
          title="Bevat index.html, styles.css en gedownloade plaatjes — geschikt voor FTP zonder Tailwind-CDN."
          className={cn(
            "inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-950",
            "hover:bg-emerald-100 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-100 dark:hover:bg-emerald-950/60",
          )}
        >
          <FolderArchive className="size-4 shrink-0" aria-hidden />
          ZIP voor FTP
        </a>
        <PromoVideoDownloadButton
          subfolderSlug={row.subfolder_slug}
          fileBase={row.subfolder_slug.replace(/[^a-zA-Z0-9-]+/g, "-").replace(/^-|-$/g, "") || "site"}
          disabled={row.status !== "active"}
          disabledReason="Zet de publicatiestatus op Actief om de live /site-URL op te nemen."
        />
        <Link
          href={`/portal/${enc}`}
          className="inline-flex rounded-lg border border-violet-300 bg-violet-50 px-4 py-2.5 text-sm font-medium text-violet-950 hover:bg-violet-100 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-100 dark:hover:bg-violet-950/60"
        >
          Klantportaal (MFA)
        </Link>
      </div>
    </div>
  );
}
