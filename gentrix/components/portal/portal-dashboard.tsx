import Link from "next/link";
import { CreditCard, Download, ExternalLink, FileText, Link2, MessageCircle, MonitorSmartphone } from "lucide-react";
import type { PortalDashboardSnapshot } from "@/lib/data/get-portal-dashboard-snapshot";
import { publicLiveBookingHref, publicLiveBookingVensterHref } from "@/lib/site/studio-section-visibility";
import { PortalBookingOpenVensterButton } from "@/components/portal/portal-booking-open-venster-button";
import { PortalOwnerWebAppInstall } from "@/components/portal/portal-owner-web-app-install";

type Props = {
  slug: string;
  clientName: string;
  snapshot: PortalDashboardSnapshot;
  invoicesEnabled: boolean;
  appointmentsEnabled: boolean;
  accountEnabled: boolean;
  publicSiteAbsoluteUrl?: string;
  publicBookingAbsoluteUrl?: string;
  publicBookingVensterAbsoluteUrl?: string;
  ownerDashboardAbsoluteUrl?: string;
};

export function PortalDashboard({
  slug,
  clientName,
  snapshot,
  invoicesEnabled,
  appointmentsEnabled,
  accountEnabled,
  publicSiteAbsoluteUrl,
  publicBookingAbsoluteUrl,
  publicBookingVensterAbsoluteUrl,
  ownerDashboardAbsoluteUrl,
}: Props) {
  const decodedSlug = decodeURIComponent(slug);
  const enc = encodeURIComponent(decodedSlug);
  const base = `/portal/${enc}`;
  const sitePublicHref = publicSiteAbsoluteUrl ?? `/site/${enc}`;
  const bookingPublicHref = publicBookingAbsoluteUrl ?? publicLiveBookingHref(decodedSlug);
  const bookingVensterHref = publicBookingVensterAbsoluteUrl ?? publicLiveBookingVensterHref(decodedSlug);

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Overzicht</h1>
          <p className="mt-0.5 text-sm text-zinc-600 dark:text-zinc-400">
            Welkom terug{clientName ? `, ${clientName}` : ""}.
          </p>
        </div>
        <a
          href={sitePublicHref}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          <ExternalLink className="size-4 shrink-0" aria-hidden />
          Open publieke site
        </a>
      </div>

      <div className="rounded-xl bg-zinc-50 px-4 py-3 dark:bg-zinc-950/80">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Abonnement &amp; betaling</p>
        <p className="mt-2 text-sm font-medium text-zinc-900 dark:text-zinc-100">{snapshot.statusLine1}</p>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{snapshot.statusLine2}</p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {invoicesEnabled ? (
          <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950/40">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Laatste factuur</p>
            {snapshot.latestInvoice ? (
              <Link
                href={snapshot.latestInvoice.href}
                className="mt-2 block text-sm font-medium text-blue-700 underline-offset-2 hover:underline dark:text-blue-400"
              >
                {snapshot.latestInvoice.number} · {snapshot.latestInvoice.amountLabel}
              </Link>
            ) : (
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">Nog geen facturen in het portaal.</p>
            )}
            {snapshot.latestInvoice ? (
              <p className="mt-1 text-xs text-zinc-500">Status: {snapshot.latestInvoice.statusLabel}</p>
            ) : null}
            <Link
              href={`${base}/facturen`}
              className="mt-2 inline-block text-xs font-medium text-zinc-700 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100"
            >
              Alle facturen →
            </Link>
          </div>
        ) : null}

        {appointmentsEnabled ? (
          <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950/40">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Boekingen-app</p>
            <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">
              Agenda en operationeel beheer blijven in de aparte boekingen-webapp.
            </p>
            {snapshot.nextAppointment ? (
              <>
                <p className="mt-3 text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {snapshot.nextAppointment.title}
                </p>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{snapshot.nextAppointment.whenLabel}</p>
              </>
            ) : (
              <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">Geen geplande afspraken.</p>
            )}
            {snapshot.appointmentStats ? (
              <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                Vandaag gepland:{" "}
                <span className="font-medium text-zinc-700 dark:text-zinc-300">
                  {snapshot.appointmentStats.todayScheduled}
                </span>
                {" · "}
                Komende 7 dagen:{" "}
                <span className="font-medium text-zinc-700 dark:text-zinc-300">
                  {snapshot.appointmentStats.upcomingWeekScheduled}
                </span>
              </p>
            ) : null}
            <div className="mt-3 flex flex-wrap gap-2">
              <a
                href={ownerDashboardAbsoluteUrl ?? `/booking-app/dashboard/${enc}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
              >
                <MonitorSmartphone className="size-4 shrink-0" aria-hidden />
                Open boekingen-app
              </a>
              <a
                href={bookingPublicHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                <ExternalLink className="size-4 shrink-0" aria-hidden />
                Publieke boekpagina
              </a>
            </div>
          </div>
        ) : null}
      </div>

      {!invoicesEnabled && !appointmentsEnabled ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Facturen en afspraken zijn voor deze klant niet ingeschakeld in het portaal.
        </p>
      ) : null}

      {appointmentsEnabled ? (
        <div className="rounded-xl border border-violet-200 bg-violet-50/80 p-4 dark:border-violet-900/50 dark:bg-violet-950/30">
          <p className="text-xs font-medium uppercase tracking-wide text-violet-800 dark:text-violet-200">Online boeken</p>
          <p className="mt-1 text-sm text-violet-950/80 dark:text-violet-100/90">
            Dezelfde stap-voor-stap boekflow als bezoekers zien. Deel deze link op je site of socials.
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <a
              href={bookingPublicHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-violet-700 px-3 py-2 text-sm font-medium text-white hover:bg-violet-800 dark:bg-violet-600 dark:hover:bg-violet-500"
            >
              <Link2 className="size-4 shrink-0" aria-hidden />
              Open boekpagina
            </a>
            <PortalBookingOpenVensterButton href={bookingVensterHref} />
          </div>
          <p className="mt-2 text-[11px] leading-snug text-violet-900/80 dark:text-violet-200/85">
            Geen ruimte voor een iframe op je eigen site? Gebruik{" "}
            <strong className="font-medium text-violet-950 dark:text-violet-100">Open in klein venster</strong> of de
            knop-snippet in het beheerdersportaal — bezoekers blijven op jullie pagina tot ze klikken; daarna opent een
            compact Gentrix-venster met de agenda.
          </p>
        </div>
      ) : null}

      {ownerDashboardAbsoluteUrl ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/30">
          <p className="text-xs font-medium uppercase tracking-wide text-emerald-800 dark:text-emerald-200">
            Boekingen-app (PWA)
          </p>
          <p className="mt-1 text-sm text-emerald-950/85 dark:text-emerald-100/90">
            Aparte <strong>web app</strong> voor agenda en boekingen-dashboard — niet het klantportaal-hoofdscherm.
          </p>
          <div className="mt-3">
            <PortalOwnerWebAppInstall dashboardUrl={ownerDashboardAbsoluteUrl} />
          </div>
          <p className="mt-3 flex items-center gap-1.5 text-xs text-emerald-900/70 dark:text-emerald-200/80">
            <Download className="size-3.5 shrink-0" aria-hidden />
            Geen App Store nodig: dit is een <strong>progressive web app</strong> (PWA).
          </p>
        </div>
      ) : null}

      <div className="border-t border-zinc-100 pt-5 dark:border-zinc-800">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Snel naar</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            href={`${base}/support`}
            className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            <MessageCircle className="size-4 shrink-0 text-zinc-500" aria-hidden />
            Support
          </Link>
          {invoicesEnabled ? (
            <Link
              href={`${base}/facturen`}
              className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              <FileText className="size-4 shrink-0 text-zinc-500" aria-hidden />
              Facturen
            </Link>
          ) : null}
          {accountEnabled ? (
            <Link
              href={`${base}/account`}
              className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              <CreditCard className="size-4 shrink-0 text-zinc-500" aria-hidden />
              Account
            </Link>
          ) : null}
          <a
            href={sitePublicHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            <ExternalLink className="size-4 shrink-0 text-zinc-500" aria-hidden />
            Publieke site
          </a>
        </div>
      </div>
    </section>
  );
}
