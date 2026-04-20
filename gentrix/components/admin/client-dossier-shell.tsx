"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Briefcase,
  CreditCard,
  ExternalLink,
  Eye,
  FileText,
  Globe,
  LayoutDashboard,
  PanelTop,
  QrCode,
  Receipt,
  ScrollText,
  ShieldCheck,
  SquareUserRound,
} from "lucide-react";
import { cn } from "@/lib/utils";

type ClientDossierShellProps = {
  slug: string;
  clientName: string;
  /** Volledige URL voor live site wanneer status actief (anders weglaten — voorkomt 404). */
  liveSiteAbsoluteUrl?: string;
  /** Publieke concept-URL met token; alleen bij concept + migratie preview_secret. */
  conceptPreviewAbsoluteUrl?: string | null;
  /** Alleen actieve klanten hebben een portaal-route. */
  clientStatus: "draft" | "active" | "paused" | "archived";
  children: React.ReactNode;
};

export function ClientDossierShell({
  slug,
  clientName,
  liveSiteAbsoluteUrl,
  conceptPreviewAbsoluteUrl,
  clientStatus,
  children,
}: ClientDossierShellProps) {
  const pathname = usePathname();
  const enc = encodeURIComponent(slug);
  const base = `/admin/clients/${enc}`;
  const adminConceptHref = `${base}/preview`;

  const nav = [
    { href: base, label: "Overzicht", icon: LayoutDashboard, match: (p: string) => p === base },
    { href: `${base}/invoices`, label: "Facturen", icon: Receipt, match: (p: string) => p.startsWith(`${base}/invoices`) },
    { href: `${base}/quotes`, label: "Offertes", icon: ScrollText, match: (p: string) => p.startsWith(`${base}/quotes`) },
    { href: `${base}/deals`, label: "Deals", icon: Briefcase, match: (p: string) => p.startsWith(`${base}/deals`) },
    {
      href: `${base}/abonnement`,
      label: "Abonnement",
      icon: ShieldCheck,
      match: (p: string) => p.startsWith(`${base}/abonnement`),
    },
    {
      href: `${base}/betalingen`,
      label: "Betalingen",
      icon: CreditCard,
      match: (p: string) => p.startsWith(`${base}/betalingen`),
    },
    { href: `${base}/websites`, label: "Websites", icon: Globe, match: (p: string) => p.startsWith(`${base}/websites`) },
    {
      href: `/admin/flyers/${enc}`,
      label: "Flyer & QR",
      icon: QrCode,
      match: (p: string) => p === `/admin/flyers/${enc}` || p === `/admin/flyers/${enc}/`,
    },
    { href: `${base}/activity`, label: "Activiteit", icon: Activity, match: (p: string) => p.startsWith(`${base}/activity`) },
    {
      href: `${base}/commercial`,
      label: "Commercie & domein",
      icon: FileText,
      match: (p: string) => p === `${base}/commercial` || p.startsWith(`${base}/commercial/`),
    },
  ] as const;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 border-b border-zinc-200 pb-4 dark:border-zinc-800 md:flex-row md:items-end md:justify-between">
        <div>
          <Link
            href="/admin/clients"
            className="text-sm font-medium text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
          >
            ← Alle klanten
          </Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">{clientName}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {clientStatus === "active" && liveSiteAbsoluteUrl ? (
            <a
              href={liveSiteAbsoluteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-900"
            >
              <ExternalLink className="size-4" aria-hidden />
              Publieke site
            </a>
          ) : conceptPreviewAbsoluteUrl ? (
            <a
              href={conceptPreviewAbsoluteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-950 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/80 dark:text-amber-100 dark:hover:bg-amber-950"
            >
              <Eye className="size-4" aria-hidden />
              Concept-preview (klant)
            </a>
          ) : (
            <Link
              href={adminConceptHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-950 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/80 dark:text-amber-100 dark:hover:bg-amber-950"
            >
              <Eye className="size-4" aria-hidden />
              Concept-preview (admin)
            </Link>
          )}
          <Link
            href={`/admin/flyers/${enc}`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-sm font-medium text-violet-950 hover:bg-violet-100 dark:border-violet-900/40 dark:bg-violet-950/40 dark:text-violet-100 dark:hover:bg-violet-950/60"
            title="Flyer-link, studio, PDF-downloads en scanstatistieken"
          >
            <QrCode className="size-4" aria-hidden />
            Flyer & QR
          </Link>
          <Link
            href={`/admin/ops/studio?slug=${enc}`}
            className="sales-os-glass-primary-btn inline-flex items-center gap-1.5 rounded-lg border border-transparent bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:border-transparent dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
          >
            <PanelTop className="size-4" aria-hidden />
            Site-studio
          </Link>
          {clientStatus === "active" ? (
            <Link
              href={`/portal/${enc}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-900 hover:bg-emerald-100 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-100 dark:hover:bg-emerald-950/60"
            >
              <SquareUserRound className="size-4" aria-hidden />
              Klantportaal
            </Link>
          ) : null}
        </div>
      </div>

      <nav
        className="-mx-1 flex gap-0.5 overflow-x-auto border-b border-zinc-200 pb-px [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden dark:border-zinc-800"
        aria-label="Klantdossier"
      >
        {nav.map(({ href, label, icon: Icon, match }) => {
          const active = match(pathname);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "inline-flex shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "border-blue-600 text-blue-900 dark:border-blue-400 dark:text-blue-100"
                  : "border-transparent text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100",
              )}
            >
              <Icon className="size-4 opacity-80" aria-hidden />
              {label}
            </Link>
          );
        })}
      </nav>

      <div>{children}</div>
    </div>
  );
}
