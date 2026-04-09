import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { isInvoiceStatusVisibleInPortal, type InvoiceStoredStatus } from "@/lib/commercial/billing-helpers";
import type { InvoiceWithClient } from "@/lib/data/list-invoices";
import { hrefPortalFacturen, hrefPortalFactuurDetail } from "@/lib/portal/portal-client-hrefs";

type Clients = InvoiceWithClient["clients"];

export function AdminPortalFacturenListLink({
  subfolderSlug,
  portalInvoicesEnabled = true,
  className,
}: {
  subfolderSlug: string;
  portalInvoicesEnabled?: boolean;
  className?: string;
}) {
  const slug = subfolderSlug.trim();
  if (!slug || portalInvoicesEnabled === false) return null;
  return (
    <Link
      href={hrefPortalFacturen(slug)}
      target="_blank"
      rel="noreferrer"
      className={
        className ??
        "inline-flex items-center gap-1 rounded-lg border border-violet-200 bg-violet-50/80 px-3 py-2 text-sm font-medium text-violet-950 hover:bg-violet-100 dark:border-violet-800 dark:bg-violet-950/35 dark:text-violet-100 dark:hover:bg-violet-950/55"
      }
    >
      Klantportaal: facturen
      <ExternalLink className="size-3.5 shrink-0 opacity-80" aria-hidden />
    </Link>
  );
}

export function AdminPortalInvoiceRowLink({
  invoiceId,
  status,
  clients,
  className,
}: {
  invoiceId: string;
  status: InvoiceStoredStatus;
  clients: Clients;
  className?: string;
}) {
  const slug = clients?.subfolder_slug?.trim();
  if (!slug || clients?.portal_invoices_enabled === false) return null;
  if (!isInvoiceStatusVisibleInPortal(status)) return null;
  return (
    <Link
      href={hrefPortalFactuurDetail(slug, invoiceId)}
      target="_blank"
      rel="noreferrer"
      className={
        className ??
        "inline-flex items-center gap-1 text-[12px] font-medium text-violet-800 underline underline-offset-2 dark:text-violet-300"
      }
    >
      In portaal
      <ExternalLink className="size-3 shrink-0 opacity-80" aria-hidden />
    </Link>
  );
}
