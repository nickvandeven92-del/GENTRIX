import { ExternalLink } from "lucide-react";
import type { ReactNode } from "react";
import { PortalAppointmentNotifier } from "@/components/portal/portal-appointment-notifier";
import { PortalNav } from "@/components/portal/portal-nav";
import { PortalPushEnrollment } from "@/components/portal/portal-push-enrollment";

type PortalShellProps = {
  slug: string;
  clientName: string;
  appointmentsEnabled: boolean;
  invoicesEnabled: boolean;
  accountEnabled: boolean;
  /** Aantal ongelezen studio-berichten in open support-threads (SSR + polling in navigatie). */
  supportUnreadInitial?: number;
  /** Studio/medewerker: snelkoppeling naar /admin/ops. Klanten: uit. */
  showStudioNav: boolean;
  /** Volledige URL (https://host/site/slug) zodat de site in een echte browsertab opent. */
  publicSiteAbsoluteUrl?: string;
  /** Studio bekijkt het dossier; niet de gekoppelde klant-sessie (push e.d.). */
  portalSessionMismatch?: boolean;
  /** Amber balk: alleen zinvol als strikte portaal-modus aan staat. */
  showStudioPreviewBanner?: boolean;
  children: ReactNode;
};

export function PortalShell({
  slug,
  clientName,
  appointmentsEnabled,
  invoicesEnabled,
  accountEnabled,
  showStudioNav,
  supportUnreadInitial = 0,
  publicSiteAbsoluteUrl,
  portalSessionMismatch = false,
  showStudioPreviewBanner = false,
  children,
}: PortalShellProps) {
  const enc = encodeURIComponent(decodeURIComponent(slug));
  const siteHref = publicSiteAbsoluteUrl ?? `/site/${enc}`;
  const siteRel = "noopener noreferrer";

  return (
    <div className="min-h-screen bg-zinc-100 dark:bg-zinc-950">
      {showStudioPreviewBanner ? (
        <div
          role="status"
          className="border-b border-amber-300 bg-amber-100 px-4 py-2 text-center text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-100"
        >
          <span className="font-medium">Studio-voorbeeld</span>
          <span className="text-amber-900/90 dark:text-amber-200/90">
            {" "}
            — je sessie hoort niet bij de portaal-login van deze klant. Zet je eigen Auth-UUID in{" "}
            <code className="rounded bg-amber-200/80 px-1 font-mono text-[11px] dark:bg-amber-900/60">PORTAL_STUDIO_PREVIEW_USER_IDS</code>{" "}
            (komma-gescheiden) om dit te blijven zien na inloggen. Lokaal alles openen zonder deze waarschuwing:{" "}
            <code className="rounded bg-amber-200/80 px-1 font-mono text-[11px] dark:bg-amber-900/60">PORTAL_STRICT_ACCESS=0</code>{" "}
            in <code className="rounded bg-amber-200/80 px-1 font-mono text-[11px] dark:bg-amber-900/60">.env.local</code> — dan verbergen we
            deze balk.
          </span>
        </div>
      ) : null}
      <div className="sticky top-0 z-40">
        <header className="border-b border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mx-auto flex max-w-7xl min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Klantportaal</p>
              <p className="truncate font-semibold text-zinc-900 dark:text-zinc-50">{clientName}</p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
              <a
                href={siteHref}
                target="_blank"
                rel={siteRel}
                className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                <ExternalLink className="size-4" aria-hidden />
                Publieke site
              </a>
            </div>
          </div>
        </header>
      </div>
      <PortalPushEnrollment
        slug={slug}
        appointmentsEnabled={appointmentsEnabled}
        studioPreview={portalSessionMismatch}
      />
      <PortalAppointmentNotifier slug={slug} appointmentsEnabled={appointmentsEnabled} />
      <div className="mx-auto max-w-7xl px-4 py-4 lg:py-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
          <PortalNav
            slug={slug}
            appointmentsEnabled={appointmentsEnabled}
            invoicesEnabled={invoicesEnabled}
            accountEnabled={accountEnabled}
            showStudioNav={showStudioNav}
            supportUnreadInitial={supportUnreadInitial}
          />
          <main className="min-w-0 flex-1 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 lg:p-6">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
