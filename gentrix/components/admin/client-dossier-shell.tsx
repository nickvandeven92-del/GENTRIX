"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Briefcase,
  Code2,
  ExternalLink,
  FileText,
  Globe,
  LayoutDashboard,
  PanelTop,
  Receipt,
  ScrollText,
  SquareUserRound,
} from "lucide-react";
import { cn } from "@/lib/utils";

type ClientDossierShellProps = {
  slug: string;
  clientName: string;
  /** Volledige URL voor live site (nieuwe tab / systeembrowser). */
  liveSiteAbsoluteUrl?: string;
  /** Alleen actieve klanten hebben een portaal-route. */
  clientStatus: "draft" | "active" | "paused" | "archived";
  children: React.ReactNode;
};

export function ClientDossierShell({
  slug,
  clientName,
  liveSiteAbsoluteUrl,
  clientStatus,
  children,
}: ClientDossierShellProps) {
  const pathname = usePathname();
  const enc = encodeURIComponent(slug);
  const base = `/admin/clients/${enc}`;
  const liveHref = liveSiteAbsoluteUrl ?? `/site/${enc}`;

  const nav = [
    { href: base, label: "Overzicht", icon: LayoutDashboard, match: (p: string) => p === base },
    { href: `${base}/invoices`, label: "Facturen", icon: Receipt, match: (p: string) => p.startsWith(`${base}/invoices`) },
    { href: `${base}/quotes`, label: "Offertes", icon: ScrollText, match: (p: string) => p.startsWith(`${base}/quotes`) },
    { href: `${base}/deals`, label: "Deals", icon: Briefcase, match: (p: string) => p.startsWith(`${base}/deals`) },
    { href: `${base}/websites`, label: "Websites", icon: Globe, match: (p: string) => p.startsWith(`${base}/websites`) },
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
          <a
            href={liveHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-900"
          >
            <ExternalLink className="size-4" aria-hidden />
            Live site
          </a>
          <Link
            href={`/admin/editor/${enc}`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-900 hover:bg-blue-100 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-100 dark:hover:bg-blue-950/60"
          >
            <Code2 className="size-4" aria-hidden />
            HTML-editor
          </Link>
          <Link
            href={`/admin/ops/studio?slug=${enc}`}
            className="sales-os-glass-primary-btn inline-flex items-center gap-1.5 rounded-lg border border-transparent bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:border-transparent dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
          >
            <PanelTop className="size-4" aria-hidden />
            Site studio
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
        className="-mx-1 flex flex-wrap gap-0.5 overflow-x-auto border-b border-zinc-200 pb-px dark:border-zinc-800"
        aria-label="Klantdossier"
      >
        {nav.map(({ href, label, icon: Icon, match }) => {
          const active = match(pathname);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "inline-flex shrink-0 items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
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
